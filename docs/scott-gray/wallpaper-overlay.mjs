/** Generator overlays in the saved field's own lattice coordinates.
 * A supplied camera is shared with field playback. The overlay closes the named
 * generator orbits under all declared affine operations, then repeats them on
 * the zero-offset simulation lattice. Reflections are spatial only: s stays +1.
 */
const EPS=1e-8, ID=[[1,0],[0,1]];
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(a,t)=>a.map(x=>x*t);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const mv=(A,p)=>A.map(r=>dot(r,p));
const mm=(A,B)=>A.map(r=>[r[0]*B[0][0]+r[1]*B[1][0],r[0]*B[0][1]+r[1]*B[1][1]]);
const inverse=A=>{const d=cross(A[0],A[1]);if(Math.abs(d)<EPS)throw Error('Singular affine matrix.');return [[A[1][1]/d,-A[0][1]/d],[-A[1][0]/d,A[0][0]/d]];};
const rounded=x=>Number(x.toFixed(9));
const num=x=>Number(x.toFixed(5)).toString();
const mod=x=>((x%1)+1)%1;
const wrap=x=>Math.min(mod(x),1-mod(x))<EPS?0:rounded(mod(x));
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pointKey=p=>p.map(rounded).join(',');
const opKey=o=>`${o.M.flat().map(rounded)}:${o.v.map(rounded)}:${rounded(o.tau)}`;

export function timeShiftLabel(tau){
 const t=wrap(tau);if(!t)return '0 T';
 for(let d=2;d<=24;d++)if(Math.abs(t*d-Math.round(t*d))<EPS)return `+${Math.round(t*d)}/${d} T`;
 return `+${num(t)} T`;
}
function basisMatrix(group){
 const basis=group.basis??(group.lattice==='triangular'?[[1,0],[-.5,Math.sqrt(3)/2]]:[[1,0],[0,1]]);
 return [[basis[0][0],basis[1][0]],[basis[0][1],basis[1][1]]];
}

/** Recover centre/axis directly from the affine action, never from glyph art. */
export function wallpaperOperationGeometry(op,group){
 if(op.s!==undefined&&op.s!==1)throw Error('The animation overlay supports constant time offsets only.');
 const B=basisMatrix(group),Bi=inverse(B),A=mm(mm(B,op.M),Bi),w=mv(B,op.v);
 if(op.M.flat().every((x,i)=>Math.abs(x-ID.flat()[i])<EPS))return {kind:'translation',vector:op.v};
 if(cross(A[0],A[1])>0){
  const C=op.M.map((r,i)=>r.map((x,j)=>(i===j?1:0)-x));
  const angle=(Math.atan2(A[1][0],A[0][0])*180/Math.PI+360)%360;
  return {kind:'rotation',centre:mv(inverse(C),op.v),angleDegrees:angle,order:Math.round(360/Math.min(angle,360-angle))};
 }
 let d=[A[0][1],1-A[0][0]];if(Math.hypot(...d)<EPS)d=[1-A[1][1],A[1][0]];
 d=scale(d,1/Math.hypot(...d));if(d[0]<-EPS||(Math.abs(d[0])<EPS&&d[1]<0))d=scale(d,-1);
 const glide=dot(d,w),normal=sub(w,scale(d,glide)),axisPoint=mv(Bi,scale(normal,.5));
 return {kind:Math.abs(glide)<EPS?'mirror':'glide',axisPoint,axisDirection:mv(Bi,d),glideVector:mv(Bi,scale(d,glide))};
}
function conjugate(op,by,group){
 const M=mm(mm(by.M,op.M),inverse(by.M));
 const B=basisMatrix(group),A=mm(mm(B,by.M),inverse(B));
 // Glyph paths use screen coordinates. Conjugation transports the artwork as
 // well as its centre, including the handedness of phase tails under mirrors.
 const glyphMatrix=[[A[0][0],-A[0][1]],[-A[1][0],A[1][1]]];
 return {...op,M,v:add(mv(by.M,op.v),sub(by.v,mv(M,by.v))),glyphMatrix,s:1};
}
function moved(op,v){return {...op,v:add(op.v,sub(v,mv(op.M,v)))};}
function cutLine(point,direction,corners){
 const values=[];
 for(let i=0;i<corners.length;i++){
  const a=corners[i],b=corners[(i+1)%corners.length],edge=sub(b,a),delta=sub(a,point),den=cross(direction,edge);
  if(Math.abs(den)<EPS){
   if(Math.abs(cross(delta,direction))<EPS)values.push(dot(delta,direction)/dot(direction,direction),dot(sub(b,point),direction)/dot(direction,direction));
  }else{
   const t=cross(delta,edge)/den,s=cross(delta,direction)/den;
   if(s>=-EPS&&s<=1+EPS)values.push(t);
  }
 }
 if(values.length<2)return null;
 const lo=Math.min(...values),hi=Math.max(...values);
 return hi-lo>EPS?[add(point,scale(direction,lo)),add(point,scale(direction,hi))]:null;
}
function lineKey(geometry){
 const p=geometry.axisPoint,d=geometry.axisDirection,unit=scale(d,1/Math.hypot(...d));
 const n=[-unit[1],unit[0]],distance=dot(n,p);
 return `${geometry.kind}:${pointKey(unit)}:${rounded(distance)}`;
}
function inScreen(p){return p[0]>=-EPS&&p[0]<=1+EPS&&p[1]>=-EPS&&p[1]<=1+EPS;}

export function wallpaperGeneratorPlacements(group,{cellView,translations=[]}={}){
 if(!cellView?.originalToScreen||!Array.isArray(cellView.originalCorners))throw Error('A shared field camera with cell corners is required.');
 if(!Array.isArray(group?.namedGenerators)||!Array.isArray(group.ops))throw Error('Canonical named generators and group operations are required.');
 const corners=cellView.originalCorners,bounds=cellView.latticeBounds??{min:[0,1].map(i=>Math.min(...corners.map(p=>p[i]))),max:[0,1].map(i=>Math.max(...corners.map(p=>p[i])))};
 const contains=cellView.contains??(p=>inScreen(cellView.originalToScreen(p)));
 const periods=[[0,0],...translations.map(t=>t.v??t)],result=new Map();
 const min=bounds.min.map(x=>Math.floor(x)-3),max=bounds.max.map(x=>Math.ceil(x)+3);
 if((max[0]-min[0])*(max[1]-min[1])>10000)throw Error('Overlay viewport is too large.');
 const templates=new Map();
 for(const source of group.namedGenerators)for(const op of group.ops){
  const transformed=conjugate(source,op,group);
  // Composing T_d with a generator is essential: conjugation alone moves a
  // rotation centre by d and misses new centres displaced by (I-M)^-1 d.
  const shifts=source.kind==='translation'?[[0,0]]:periods;
  for(const d of shifts){const candidate={...transformed,v:add(transformed.v,d)};templates.set(`${source.name}:${opKey(candidate)}`,candidate);}
 }
 for(const template of templates.values()){
  const baseGeometry=wallpaperOperationGeometry(template,group);
  if(baseGeometry.kind==='translation'){
   if(Math.hypot(...template.v)<EPS)continue;
   // The arrow shows the actual translation vector and is centred in the view;
   // it is clipped at the cell boundary when the current cell is smaller.
   const centre=scale(corners.reduce((a,p)=>add(a,p),[0,0]),1/corners.length);
   let segment=[sub(centre,scale(template.v,.5)),add(centre,scale(template.v,.5))];
   const axis=cutLine(centre,template.v,corners);if(!axis)continue;
   const length=dot(template.v,template.v);
   const range=axis.map(p=>dot(sub(p,centre),template.v)/length).sort((a,b)=>a-b);
   const low=Math.max(-.5,range[0]),high=Math.min(.5,range[1]);
   if(high-low<EPS)continue;segment=[add(centre,scale(template.v,low)),add(centre,scale(template.v,high))];
   const key=`${template.name}@op:${opKey(template)}`;
   result.set(`translation:${opKey(template)}`,{...template,key,kind:'translation',marker:baseGeometry,segment,screenSegment:segment.map(cellView.originalToScreen),clippedStart:low>-.5+EPS,clippedEnd:high<.5-EPS,phaseLabel:timeShiftLabel(template.tau)});
   continue;
  }
  for(let i=min[0];i<=max[0];i++)for(let j=min[1];j<=max[1];j++){
   const operation=moved(template,[i,j]),geometry=wallpaperOperationGeometry(operation,group);
   if(geometry.kind==='rotation'){
    const point=geometry.centre;if(!contains(point))continue;
    const geometricKey=`rotation:${pointKey(point)}`,previous=result.get(geometricKey);
    if(previous&&previous.marker.order>=geometry.order)continue;
    const key=`${operation.name}@${point.map(wrap).join(',')}`;
    result.set(geometricKey,{...operation,key,kind:'rotation',marker:geometry,point,screenPoint:cellView.originalToScreen(point),phaseLabel:timeShiftLabel(operation.tau)});
   }else{
    const segment=cutLine(geometry.axisPoint,geometry.axisDirection,corners);if(!segment)continue;
    const geometricKey=`${lineKey(geometry)}:${rounded(operation.tau)}`;
    const previous=result.get(geometricKey);
    if(previous&&Math.hypot(...(previous.marker.glideVector??[0,0]))<=Math.hypot(...(geometry.glideVector??[0,0])))continue;
    const key=`${operation.name}@op:${opKey(operation)}`;
    result.set(geometricKey,{...operation,key,kind:geometry.kind,marker:geometry,segment,screenSegment:segment.map(cellView.originalToScreen),phaseLabel:timeShiftLabel(operation.tau)});
   }
  }
 }
 return [...result.values()];
}

/** Same plane conventions as the correspondence plates: solid m, dotted c,
 * long-dashed axial glide, and dash-dot n/d with the d direction chevrons. */
const AXIS_STYLES={
 'plane-m':{width:2.2,dash:null},
 'plane-c':{width:3.4,dash:'0 8'},
 'plane-axial':{width:2.2,dash:'12 8'},
 'plane-n':{width:2.2,dash:'12 6.5 0 6.5'},
 'plane-d':{width:2.2,dash:'12 6.5 0 6.5'},
};
export function wallpaperGeneratorSymbol(item){
 if(item.kind==='rotation'){
  if(!item.glyph?.path||!item.glyph.symbol?.startsWith('rotation-'))throw Error('Missing correspondence rotation glyph.');
  return item.glyph.symbol;
 }
 if(item.kind==='translation')return 'translation';
 // A certified period can turn a named mirror into a parallel glide (or the
 // converse). Choose the symbol of the resulting operation, not its parent.
 const tau=wrap(item.tau);
 if(item.kind==='mirror')return tau===0?'plane-m':'plane-c';
 return tau===0?'plane-axial':Math.abs(tau-.5)<EPS?'plane-n':'plane-d';
}
function markerMarkup(item,index,size,selected,cellView){
 const title=`${item.name}: ${item.kind}, ${item.phaseLabel}${item.clippedStart||item.clippedEnd?' (continues beyond cell)':''}`;
 const active=selected===item.key||selected===item.name;
 const color=active?'#b8fff0':'#fff';
 const symbol=wallpaperGeneratorSymbol(item);
 const common=`class="wallpaper-generator ${item.kind}${active?' selected':''}" data-generator-index="${index}" data-generator-key="${escape(item.key)}" data-generator-symbol="${symbol}" data-time-shift="${item.tau}" tabindex="0" role="button" aria-label="${escape(title)}" style="cursor:pointer;pointer-events:auto"`;
 const label=(p,offset=8)=>`<text x="${num(p[0]+offset)}" y="${num(p[1]-offset)}" fill="${color}" stroke="#172032" stroke-width="3" paint-order="stroke" stroke-linejoin="round" font-size="14" font-weight="600">${escape(item.name)} · ${item.phaseLabel}</text>`;
 if(item.kind==='rotation'){
  const p=item.screenPoint.map(x=>x*size),A=item.glyphMatrix??ID,matrix=[A[0][0],A[1][0],A[0][1],A[1][1],0,0].map(num).join(' ');
  const glyph=`<path class="generator-symbol-core" transform="translate(${p.map(num).join(' ')}) rotate(${num(cellView?.glyphAngleOffset??0)}) matrix(${matrix}) scale(1.25)" d="${escape(item.glyph.path)}" fill="${color}" stroke="#172032" stroke-width="2" paint-order="stroke fill" stroke-linejoin="round"/>`;
  return `<g ${common} data-lattice-point="${escape(pointKey(item.point))}"><title>${escape(title)}</title><circle cx="${num(p[0])}" cy="${num(p[1])}" r="24" fill="#172032aa" stroke="${color}" stroke-width="1"/>${glyph}${label(p,23)}</g>`;
 }
 const [a,b]=item.screenSegment.map(p=>p.map(x=>x*size)),mid=scale(add(a,b),.5);
 const style=AXIS_STYLES[symbol]??{width:2.2,dash:null},dash=style.dash?` stroke-dasharray="${style.dash}"`:'';
 const line=`<path d="M${a.map(num).join(' ')} L${b.map(num).join(' ')}" stroke="#172032" stroke-width="6" fill="none" stroke-linecap="round"/><path class="generator-axis ${symbol}" d="M${a.map(num).join(' ')} L${b.map(num).join(' ')}" stroke="${color}" stroke-width="${style.width}" fill="none" stroke-linecap="round"${dash}/>`;
 let head='';
 if(item.kind==='translation'&&!item.clippedEnd||symbol==='plane-axial'||symbol==='plane-d'){
  let d=sub(b,a);if(item.kind==='glide'){
   const positive=dot(item.marker.glideVector,sub(item.segment[1],item.segment[0]))>=0;if(!positive)d=scale(d,-1);
  }
  d=scale(d,1/Math.hypot(...d));
  if(symbol==='plane-axial'){
   const tip=add(mid,scale(d,17)),tail=sub(tip,scale(d,15)),n=[-d[1]*9,d[0]*9];
   head=`<path class="generator-glide-arrow" d="M${sub(mid,scale(d,17)).map(num).join(' ')} L${tip.map(num).join(' ')}" stroke="${color}" stroke-width="2.1" fill="none"/><path class="generator-glide-head" d="M${tip.map(num).join(' ')} L${tail.map(num).join(' ')} L${add(tail,n).map(num).join(' ')} Z" fill="${color}" stroke="#172032" stroke-width="3" paint-order="stroke fill"/>`;
  }else{
   for(const offset of symbol==='plane-d'?[-28,28]:[null]){
    const tip=offset===null?b:add(mid,scale(d,offset)),tail=sub(tip,scale(d,10)),n=[-d[1]*4.2,d[0]*4.2];
    head+=`<path class="${symbol==='plane-d'?'generator-quarter-arrow':'generator-translation-arrow'}" d="M${add(tail,n).map(num).join(' ')} L${tip.map(num).join(' ')} L${sub(tail,n).map(num).join(' ')}" stroke="${color}" stroke-width="2.35" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
   }
  }
 }
 return `<g ${common}><title>${escape(title)}</title>${line}${head}${label(mid)}</g>`;
}
export function renderWallpaperOverlay(svg,group,{cellView,visible=true,translations=[],selected=null,onSelect=null,size=768}={}){
 if(!svg||typeof svg.setAttribute!=='function')throw Error('An SVG overlay element is required.');
 svg.setAttribute('viewBox',`0 0 ${size} ${size}`);svg.setAttribute('aria-label','Spatial generators and their time offsets');
 svg.toggleAttribute('hidden',!visible);svg.style.pointerEvents='none';
 if(!visible){svg.innerHTML='';return [];}
 const placements=wallpaperGeneratorPlacements(group,{cellView,translations});
 svg.innerHTML=placements.map((p,i)=>markerMarkup(p,i,size,selected,cellView)).join('');
 for(const element of svg.querySelectorAll('[data-generator-index]')){
  const item=placements[Number(element.getAttribute('data-generator-index'))];
  element.addEventListener('click',()=>onSelect?.(item));
  element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.(item);}});
 }
 return placements;
}
