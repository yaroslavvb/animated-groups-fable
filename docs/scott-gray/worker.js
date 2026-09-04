import {createProblem} from './core.mjs?v=20260904-gpu';
import {createStepper,projectKernel,movieStats} from './dynamics.mjs?v=20260904-gpu';
import {hasRefinedAcceptance,refinedShootingOptions} from './acceptance.mjs';
self.onmessage=async({data})=>{try{const {mode,config:c,iterations}=data,{N,M,params,period,ops}=c,nn=N*N;
  if(mode==='evolve'){
    const stepper=createStepper(projectKernel(data.field.slice(0,2*nn),N,ops),N,params),field=new Float64Array(2*nn*M),interval=period/M;
    field.set(stepper.state);
    for(let t=1;t<M;t++){stepper.advance(interval);field.set(stepper.state,t*2*nn);const snapshot=stepper.state.slice();self.postMessage({type:'snapshot',field:snapshot,time:t*interval,fraction:t/(M-1)},[snapshot.buffer]);await new Promise(r=>setTimeout(r,0));}
    const diagnostics=movieStats(field,N,M,ops);self.postMessage({type:'done',field,kind:'trajectory',period,diagnostics},[field.buffer]);
  }else{
    const problem=createProblem({...c,periodBounds:[20,12000]});
    const result=await problem.fitOrbit({field:data.field,period,iterations,validate:false,yieldEvery:5,onProgress:p=>{self.postMessage({type:'progress',...p},[p.field.buffer]);}});
    self.postMessage({type:'validating'});await new Promise(r=>setTimeout(r,0));
    const diagnostics=problem.diagnostics(result.field,result.period,{shootingDt:.4,maxShootingSteps:65000,requireFaithfulTimeShifts:true});
    if(diagnostics.validated){
      const fine=problem.shoot(result.field,result.period,refinedShootingOptions(diagnostics.closure));
      diagnostics.refinedClosure=fine;
      if(!hasRefinedAcceptance(diagnostics)){
        diagnostics.validated=false;diagnostics.status='unverified candidate';
        diagnostics.reasons.push(fine.computed?'The refined full-period integration failed numerical acceptance or did not halve the actual timestep.':(fine.reason||'The refined full-period integration could not be completed.'));
      }
    }
    self.postMessage({type:'done',...result,diagnostics,kind:'candidate'},[result.field.buffer]);
  }
}catch(e){self.postMessage({type:'error',message:e.message||String(e)});}};
