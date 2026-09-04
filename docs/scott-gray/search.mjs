#!/usr/bin/env node
// Node 20+; writes reproducible numerical candidates, never certifies by replay.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createProblem} from './core.mjs';
import {makePreview} from './seeds.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const [k,...rest]=v.replace(/^--/,'').split('=');return [k,rest.join('=')||true];}));
const catalog=JSON.parse(readFileSync(new URL('./groups.json',import.meta.url)));
const output=String(args.output||'scott-gray-results');mkdirSync(output,{recursive:true});
const selected=args.group&&args.group!=='all'?catalog.filter(g=>g.id===args.group):catalog;
if(!selected.length)throw Error('Choose g94, g95, g96, g97, g98, g99, or all.');
for(const group of selected){
  const N=Number(args.grid||32),M=Number(args.frames||32),period=Number(args.period||1200);
  const config={N,M,ops:group.render.ops,params:{Du:.16,Dv:.08,F:Number(args.feed||.062),k:Number(args.kill||.0609),dx:Number(args.length||96)/N},minTemporal:Number(args['min-motion']||.012),minSpatial:Number(args['min-space']||.04),periodBounds:[8,20000]};
  const problem=createProblem(config),field=makePreview({...config,seed:args.seed||'skate',F:config.params.F,k:config.params.k});
  const start=problem.evaluate(field,period);
  const result=await problem.fitOrbit({field,period,iterations:Number(args.iterations||200),requireFaithfulTimeShifts:true,onProgress:p=>{if(p.iteration%50===0)process.stdout.write(`${group.id} iteration ${p.iteration}: PDE RMS ${p.pdeRms.toExponential(3)}, relative ${p.relativePde.toFixed(3)}, T=${p.period.toFixed(2)}\n`);}});
  const {field:values,...summary}=result;
  // Typed final states are redundant with the stored movie and omitted from JSON.
  if(summary.diagnostics.closure)delete summary.diagnostics.closure.finalState;
  const report={group:group.id,config,initial:{pdeRms:start.pdeRms,relativePde:start.relativePde},...summary};
  writeFileSync(join(output,group.id+'.json'),JSON.stringify(report,null,2));
  writeFileSync(join(output,group.id+'.f32'),Buffer.from(Float32Array.from(values).buffer));
  process.stdout.write(`${group.id}: ${result.diagnostics.status}\n`);
}
