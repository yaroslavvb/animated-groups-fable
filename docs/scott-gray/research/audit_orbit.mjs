#!/usr/bin/env node
// Recompute acceptance from concentrations; saved success flags are ignored.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,basename,join} from 'node:path';
import {createSolutionAtlas} from '../solution-atlas.mjs';
const [argument,explicitField]=process.argv.slice(2);
if(!argument)throw Error('Usage: node audit_orbit.mjs METADATA.json [FIELD.f32]');
const file=resolve(argument),candidate=JSON.parse(await readFile(file,'utf8'));
const groups=JSON.parse(await readFile(new URL('../groups.json',import.meta.url),'utf8'));
if(!candidate.field){
  const path=explicitField?resolve(explicitField):join(dirname(file),candidate.fieldUrl??basename(file,'.json')+'.f32');
  const buffer=await readFile(path);if(buffer.length%4)throw Error('Incomplete Float32 concentration field.');
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  candidate.field=Float32Array.from({length:buffer.length/4},(_,i)=>view.getFloat32(i*4,true));
}
const started=performance.now(),atlas=createSolutionAtlas(groups);
const result=await atlas.admit(candidate,{groupId:candidate.config.groupId,onPhase:message=>process.stderr.write(message+'\n')});
const report={accepted:result.accepted,reasons:result.reasons,elapsedMs:performance.now()-started,diagnostics:result.record?.diagnostics??result.diagnostics};
await writeFile(file.replace(/\.json$/,'.audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({accepted:report.accepted,reasons:report.reasons,elapsedMs:report.elapsedMs,period:candidate.config.period},null,2));
if(!result.accepted)process.exitCode=1;
