import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const groups = JSON.parse(await readFile(new URL('../groups.json', import.meta.url)));
const source = JSON.parse(await readFile(new URL('../../../data/clockwork-coloring-correspondence.json', import.meta.url))).groups;
const page = await readFile(new URL('../../../correspondence-p6.html', import.meta.url), 'utf8');
const R = [[1,-1],[1,0]], I = [[1,0],[0,1]];
const mat = (A,B) => A.map(row => B[0].map((_,j) => row.reduce((s,a,k) => s+a*B[k][j],0)));
const vec = (A,v) => A.map(row => row.reduce((s,a,i) => s+a*v[i],0));
const add = (a,b) => a.map((v,i) => v+b[i]);
const mod = (a,n=1) => ((a%n)+n)%n;
const close = (a,b,eps=1e-12) => assert.ok(Math.abs(a-b)<eps, `${a} ≠ ${b}`);
const normMatrix = A => A.map(row => row.map(n => n===0?0:n));
const fraction = s => s.split('/').map(Number).reduce((a,b)=>a/b);
const equalMatrix = (A,B) => assert.deepEqual(normMatrix(A),normMatrix(B));

test('all six characters and named generators are exact source records', () => {
  assert.deepEqual(groups.map(g=>g.id),['g243','g244','g245','g246','g247','g248']);
  const shifts=[0,1/3,2/3,1/2,5/6,1/6];
  for(const [i,g] of groups.entries()) {
    const s=source.find(s=>s.id===g.id);
    assert.deepEqual(g.render,s.render);
    assert.equal(g.shortText,s.book_color_signature);
    assert.equal(g.clockOrder,s.clock_order);
    close(fraction(g.phaseCharacter.rotation60),shifts[i]);
    for(const n of g.namedGenerators) {
      const p=s.chaim_presentation.generators.find(p=>p.generator===n.name);
      const o=s.render.ops[p.plate_source_index];
      assert.deepEqual(n.matrix,o.M);
      assert.deepEqual(n.translation,add(o.v,p.plate_lattice_shift));
      assert.equal(n.timeShift,p.time_shift);
      close(n.tau,o.tau);
      assert.deepEqual(n.colourPermutation,p.colour_permutation);
      assert.ok(page.includes(`d="${n.path}"`),'glyph path must come from correspondence page');
    }
  }
});

test('spatial matrices preserve the triangular metric and every character is closed', () => {
  const G=[[1,-.5],[-.5,1]];
  for(const g of groups) {
    for(const a of g.render.ops) {
      const Mt=[[a.M[0][0],a.M[1][0]],[a.M[0][1],a.M[1][1]]];
      assert.deepEqual(mat(mat(Mt,G),a.M),G);
      assert.equal(a.s,1);
      for(const b of g.render.ops) {
        const M=normMatrix(mat(a.M,b.M)),v=add(vec(a.M,b.v),a.v).map(x=>mod(x));
        const c=g.render.ops.find(c=>JSON.stringify(normMatrix(c.M))===JSON.stringify(M)&&c.v.every((x,i)=>Math.abs(mod(x)-v[i])<1e-12));
        assert.ok(c,'every composition must have a representative');
        close(mod(a.tau+b.tau-c.tau+.5),.5);
      }
    }
    let A=I;
    for(let j=0;j<6;j++) {
      const op=g.render.ops.find(o=>JSON.stringify(o.M)===JSON.stringify(normMatrix(A)));
      assert.ok(op);
      close(mod(op.tau-j*fraction(g.phaseCharacter.rotation60)+.5),.5);
      A=mat(A,R);
    }
    equalMatrix(A,I);
  }
});

test('named affine generators have the source centres, orders, and triangle relation', () => {
  const cart = p => [p[0]-.5*p[1],Math.sqrt(3)/2*p[1]];
  for(const g of groups) {
    let totalM=I,totalV=[0,0],totalTau=0;
    for(const n of g.namedGenerators) {
      vec(n.matrix,n.centre).map((x,i)=>close(x+n.translation[i],n.centre[i]));
      cart(n.centre).map((x,i)=>close(x,n.cartesianCentre[i]));
      let M=I,v=[0,0];
      for(let j=0;j<n.order;j++){v=add(vec(n.matrix,v),n.translation);M=mat(n.matrix,M);}
      equalMatrix(M,I);v.forEach(x=>close(x,0));close(mod(n.tau*n.order+.5),.5);
      totalV=add(vec(n.matrix,totalV),n.translation);totalM=mat(n.matrix,totalM);totalTau+=n.tau;
    }
    equalMatrix(totalM,I);totalV.forEach(x=>close(x,0));close(mod(totalTau+.5),.5);
  }
});

test('triangular stencil commutes with rotations on a nontrivial periodic field', () => {
  const N=17, field=Float64Array.from({length:N*N},(_,i)=>Math.sin(i*.381)+Math.cos(i*.219));
  const sample=(f,x,y)=>f[mod(y,N)*N+mod(x,N)];
  const rotate=f=>Float64Array.from(f,(_,i)=>sample(f,...vec(R,[i%N,Math.floor(i/N)])));
  const lap=f=>Float64Array.from(f,(v,i)=>{const x=i%N,y=Math.floor(i/N);return (sample(f,x+1,y)+sample(f,x-1,y)+sample(f,x,y+1)+sample(f,x,y-1)+sample(f,x+1,y+1)+sample(f,x-1,y-1)-6*v)*2/3;});
  const a=lap(rotate(field)),b=rotate(lap(field));
  a.forEach((v,i)=>close(v,b[i]));
  const mappings=new Set(Array.from({length:N*N},(_,i)=>{const [x,y]=vec(R,[i%N,Math.floor(i/N)]);return mod(y,N)*N+mod(x,N);}));
  assert.equal(mappings.size,N*N);
});

test('nonzero rotating Fourier seeds realize every directed time character', () => {
  const Rt=[[R[0][0],R[1][0]],[R[0][1],R[1][1]]];
  for(const g of groups) {
    const tau=fraction(g.phaseCharacter.rotation60);
    const value=(point,phase)=>{
      let k=[1,0],sum=0;
      for(let j=0;j<6;j++){sum+=Math.cos(2*Math.PI*(k[0]*point[0]+k[1]*point[1]+phase+j*tau));k=vec(Rt,k);}
      return sum;
    };
    let energy=0;
    for(let i=0;i<31;i++) {
      const p=[mod(i*.273),mod(i*.419)],t=mod(i*.137),v=value(p,t);
      energy+=v*v;
      for(const op of g.render.ops)close(value(add(vec(op.M,p),op.v),t+op.tau),v,1e-10);
    }
    assert.ok(energy>1,'each seed must be nonzero');
  }
});
