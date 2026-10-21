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
  const colors={'CET-4':'cet4','CET-6':'cet6','考研':'kaoyan','IELTS':'ielts','TOEFL':'toefl','GRE':'gre'};
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderHtml(data,word){
    const info=getInfo(data,word);if(!info)return '';
    const tags=info.tags.length?'<div class="wordInfoLine"><span class="wordInfoLabel">考试词汇</span>'+info.tags.map(t=>'<span class="wordInfoTag wordInfoTag--'+(colors[t]||'other')+'">'+escapeHtml(t)+'</span>').join('')+'</div>':'';
    const freq=info.zipf===null?'':'<div class="wordInfoLine"><span class="wordInfoLabel">词频</span><span>Zipf '+info.zipf.toFixed(1)+' · '+escapeHtml(info.description)+'</span></div>';
    return tags||freq?'<section class="lookupWordInfo" aria-label="词汇信息">'+tags+freq+'</section>':'';
  }
  const api={describeZipf,getInfo,renderHtml};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.avsWordInfo=api;
})(typeof window!=='undefined'?window:globalThis);
