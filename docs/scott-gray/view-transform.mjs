/** A viewport is an affine map from centred Cartesian screen coordinates
 * (x right, y up) to the original saved-field lattice. No samples are changed. */
export function viewTransform({family='p4',tiles=1,viewMatrix=null,viewOrigin=null}={}){
  if(!Number.isFinite(tiles)||tiles<=0)throw Error('The view width must be positive and finite.');
  const matrix=viewMatrix??(family==='p6'?[[tiles,tiles/Math.sqrt(3)],[0,2*tiles/Math.sqrt(3)]]:[[tiles,0],[0,-tiles]]);
  const origin=viewOrigin??(viewMatrix||family==='p6'?[0,0]:[tiles/2,tiles/2]);
  if(!Array.isArray(matrix)||matrix.length!==2||matrix.some(row=>!Array.isArray(row)||row.length!==2||row.some(x=>!Number.isFinite(x))))throw Error('The view matrix must contain four finite entries.');
  const determinant=matrix[0][0]*matrix[1][1]-matrix[0][1]*matrix[1][0];
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-15)throw Error('The view matrix must be invertible.');
  if(!Array.isArray(origin)||origin.length!==2||origin.some(x=>!Number.isFinite(x)))throw Error('The view origin must contain two finite entries.');
  return {matrix,origin,inverse:[[matrix[1][1]/determinant,-matrix[0][1]/determinant],[-matrix[1][0]/determinant,matrix[0][0]/determinant]]};
}
export function screenPointToLattice([x,y],view){
  const a=x-.5,b=.5-y;
  return [view.origin[0]+view.matrix[0][0]*a+view.matrix[0][1]*b,view.origin[1]+view.matrix[1][0]*a+view.matrix[1][1]*b];
}
export function latticePointToScreen([u,v],view){
  const a=u-view.origin[0],b=v-view.origin[1];
  return [.5+view.inverse[0][0]*a+view.inverse[0][1]*b,.5-view.inverse[1][0]*a-view.inverse[1][1]*b];
}
/** WebGL matrices are column-major; public view matrices are row-major. */
export const glViewMatrix=matrix=>[matrix[0][0],matrix[1][0],matrix[0][1],matrix[1][1]];
