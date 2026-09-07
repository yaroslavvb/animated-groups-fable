const select=document.getElementById('family-nav');
if(select){
  const root=new URL('./',import.meta.url),current=select.dataset.family;
  try{
    const response=await fetch(new URL('wallpaper-groups.json?v=20260907-equations',root));
    if(!response.ok)throw Error('Wallpaper groups unavailable');
    const {families}=await response.json();
    select.replaceChildren(...families.map(family=>{const option=document.createElement('option');option.value=family.page;option.textContent=`${family.orbifold.replace(/\*/g,'∗')} · ${family.id}`;option.selected=family.id===current;return option;}));
    select.onchange=()=>location.assign(new URL('../'+select.value,root));
  }catch{select.disabled=true;}
}
