/* Static reference data only; never writes learning state. */
(function(root){
  function describeZipf(value){
    if(!Number.isFinite(value)||value<=0)return null;
    if(value>=6)return '非常常见';
    if(value>=5)return '常见';
    if(value>=4)return '中等频率';
    if(value>=3)return '较少见';
    return '罕见';
  }
  function getInfo(data,word){
    const key=String(word||'').trim().toLowerCase();
    const entry=data?.words?.[key];
    if(!entry)return null;
    const tags=Array.isArray(entry.tags)?entry.tags.filter(t=>typeof t==='string'):[];
    const zipf=typeof entry.zipf==='number'&&Number.isFinite(entry.zipf)&&entry.zipf>0?entry.zipf:null;
    return {tags,zipf,description:describeZipf(zipf)};
  }
  const api={describeZipf,getInfo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.avsWordInfo=api;
})(typeof window!=='undefined'?window:globalThis);
