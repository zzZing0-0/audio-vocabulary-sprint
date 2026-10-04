/* Audio Vocabulary Sprint · shared runtime boundary */
(function(){
  const meta=document.querySelector('meta[name="app-build"]');
  const build=meta?.content||'';
  let checking=false;
  async function checkForFreshBuild(){
    if(checking||!navigator.onLine||!build)return;
    checking=true;
    try{
      const url=new URL('index.html',location.href);
      url.searchParams.set('__avs_refresh',Date.now().toString());
      const response=await fetch(url.toString(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return;
      const html=await response.text();
      const latest=html.match(/<meta\s+name=["']app-build["']\s+content=["']([^"']+)["']/i)?.[1];
      if(latest&&latest!==build){
        const target=new URL(location.href);
        target.searchParams.set('v',latest);
        target.searchParams.set('__reload',Date.now().toString());
        location.replace(target.toString());
      }
    }catch(_){/* offline/transient failures never block study */}
    finally{checking=false;}
  }
  addEventListener('pageshow',checkForFreshBuild);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForFreshBuild();});
  window.AVS_RUNTIME=Object.freeze({build,checkForFreshBuild});
})();
