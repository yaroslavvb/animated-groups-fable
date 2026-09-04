"""One bounded Modal A100 benchmark. No deployment, schedule, or search fan-out.
Run: modal run benchmark.py --output /path/to/results.json
"""
from pathlib import Path
import json
import time
import modal

HERE = Path(__file__).resolve().parent
app = modal.App('scott-gray-shooting-benchmark-20260904')
image = (modal.Image.debian_slim(python_version='3.12')
         .apt_install('g++')
         .pip_install('numpy==2.4.2', 'cupy-cuda12x[ctk]==14.2.0')
         .add_local_file(HERE/'rk4_batch.cu', '/root/rk4_batch.cu')
         .add_local_file(HERE/'gray_scott_rk4.cpp', '/root/gray_scott_rk4.cpp'))

@app.function(image=image, gpu='A100-40GB', cpu=(2, 2), memory=(8192, 16384),
              max_containers=1, min_containers=0, scaledown_window=2,
              timeout=600, startup_timeout=600, retries=0)
def benchmark(payloads):
    import ctypes
    import platform
    import statistics
    import subprocess
    import numpy as np
    import cupy as cp
    started = time.perf_counter()
    subprocess.run(['g++', '-O3', '-std=c++17', '-shared', '-fPIC',
                    '/root/gray_scott_rk4.cpp', '-o', '/tmp/cpu.so'], check=True)
    cpu_compile = time.perf_counter()-started
    lib = ctypes.CDLL('/tmp/cpu.so')
    pointer = ctypes.POINTER(ctypes.c_double)
    native = lib.flow
    native.argtypes = [pointer, pointer, ctypes.c_int]+[ctypes.c_double]*6+[ctypes.c_int]
    native.restype = None
    kernel = cp.RawKernel(Path('/root/rk4_batch.cu').read_text(), 'rk4_stage', options=('--std=c++17','--fmad=false'))
    compile_start = time.perf_counter()
    kernel.compile()
    cp.cuda.runtime.deviceSynchronize()
    gpu_compile = time.perf_counter()-compile_start
    result = {'gpu': cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),
              'cpu': platform.processor(), 'cpuCompileSeconds': cpu_compile,
              'gpuCompileSeconds': gpu_compile, 'rows': [], 'precision': 'float64',
              'stencil': 'five-point', 'integrator': 'RK4', 'dtLimit': .4,
              'scope': 'Batched independent shooting, including complete finite-difference Jacobian perturbation sets.'}

    for payload in payloads:
        config = payload['config']; p=config['params']; N=config['N']; S=N*N
        base=np.frombuffer(payload['initial'],dtype='<f8').copy()
        T=config['period']; family=payload['family']; fraction=.25 if family=='rotating' else .5
        y,x=np.indices((N,N)); offset=N//2 if family=='rotating' else 0
        _,spatial=np.unique((np.minimum(y,(offset-y)%N)*N+np.minimum(x,(offset-x)%N)).reshape(-1),return_inverse=True)
        count=spatial.max()+1; expand=np.r_[spatial,spatial+count]
        _,representatives=np.unique(expand,return_index=True)
        unknowns=len(representatives)+1
        sizes=[1,32,256,unknowns+1]
        for B in sizes:
            if time.perf_counter()-started>500:
                result['stoppedEarly']='500-second internal deadline';break
            q=np.tile(base,(B,1)); periods=np.full(B,T); eps=1e-6
            for j in range(1,min(B,len(representatives)+1)):
                q[j,expand==j-1]+=eps
            if B==unknowns+1:periods[-1]*=np.exp(eps)
            steps=int(np.ceil(np.max(periods)*fraction/.4))
            par=np.tile([p['Du'],p['Dv'],p['F'],p['k'],p['dx'],0.],(B,1))
            par[:,-1]=periods*fraction/steps
            q0=cp.asarray(q); qa=cp.empty_like(q0); qb=cp.empty_like(q0)
            tmpa=cp.empty_like(q0);tmpb=cp.empty_like(q0);acc=cp.empty_like(q0);dpar=cp.asarray(par)
            stream=cp.cuda.Stream(non_blocking=True)
            args_end=(dpar,np.int32(N),np.int32(B))
            grid=((B*S+255)//256,);block=(256,)
            def stages(a,b):
                kernel(grid,block,(a,a,acc,tmpa,*args_end,np.int32(1)))
                kernel(grid,block,(a,tmpa,acc,tmpb,*args_end,np.int32(2)))
                kernel(grid,block,(a,tmpb,acc,tmpa,*args_end,np.int32(3)))
                kernel(grid,block,(a,tmpa,acc,b,*args_end,np.int32(4)))
            # Warmup resolves all lazy allocations/argument compilation before capture.
            with stream:
                cp.copyto(qa,q0);stages(qa,qb)
            stream.synchronize()
            capture_start=time.perf_counter()
            with stream:
                stream.begin_capture()
                a,b=qa,qb
                for _ in range(steps):stages(a,b);a,b=b,a
                graph=stream.end_capture()
            capture_seconds=time.perf_counter()-capture_start
            output=a
            gpu_times=[]
            for repeat in range(4):
                with stream:cp.copyto(qa,q0)
                stream.synchronize();t=time.perf_counter();graph.launch(stream);stream.synchronize()
                if repeat:gpu_times.append(time.perf_counter()-t)
            gpu=cp.asnumpy(output)
            cpu=np.empty_like(q)
            cpu_times=[]
            # Whole batch on one physical CPU thread, same container, no projection.
            for repeat in range(2):
                t=time.perf_counter()
                for bidx in range(B):
                    native(q[bidx].ctypes.data_as(pointer),cpu[bidx].ctypes.data_as(pointer),N,
                           p['Du'],p['Dv'],p['F'],p['k'],p['dx'],periods[bidx]*fraction,steps)
                cpu_times.append(time.perf_counter()-t)
            difference=gpu-cpu
            row={'family':family,'N':N,'batch':B,'steps':steps,'duration':T*fraction,
                 'gpuSecondsMedian':statistics.median(gpu_times),'gpuTimes':gpu_times,
                 'cpuSecondsMedian':statistics.median(cpu_times),'cpuTimes':cpu_times,
                 'graphCaptureSeconds':capture_seconds,'gpuCpuMaxAbs':float(np.max(abs(difference))),
                 'gpuCpuRms':float(np.sqrt(np.mean(difference*difference))),
                 'reducedUnknowns':unknowns,'completeJacobianBatch':B==unknowns+1}
            row['speedupWarm']=row['cpuSecondsMedian']/row['gpuSecondsMedian']
            row['speedupIncludingCompileAndCapture']=row['cpuSecondsMedian']/(row['gpuSecondsMedian']+gpu_compile+capture_seconds)
            if B==unknowns+1:
                jac_error=(difference[1:]-difference[0])/eps
                row['finiteDifferenceJacobianMaxCpuGpuDifference']=float(np.max(abs(jac_error)))
            if row['gpuCpuMaxAbs']>2e-10:raise RuntimeError(f'GPU/CPU parity failed: {row}')
            result['rows'].append(row);print(json.dumps(row),flush=True)
            del graph,q0,qa,qb,tmpa,tmpb,acc,dpar,output,gpu,cpu
            cp.get_default_memory_pool().free_all_blocks()
    result['functionSeconds']=time.perf_counter()-started
    result['estimatedFunctionCostUSD']=result['functionSeconds']*(.000694+2*.0000131+16*.00000222)
    result['costCaveat']='Conservative runtime estimate using A10080GB rate, two cores and16GiB; billing API remains authoritative. Image/startup not included.'
    return result

@app.local_entrypoint()
def main(output: str='benchmark-result.json', seed_dir: str=str(HERE.parent/'data'/'orbits')):
 from modal_io import load_saved_seed
 payloads=[load_saved_seed(seed_dir,'g96','rotating',baseline=True),load_saved_seed(seed_dir,'g95','standing',baseline=True)]
 t=time.perf_counter();result=benchmark.remote(payloads);result['clientRemoteWallSeconds']=time.perf_counter()-t
 Path(output).write_text(json.dumps(result,indent=2));print('Result:',output)
