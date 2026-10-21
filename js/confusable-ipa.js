// Read-only pronunciation display for linked words; uses the same precedence as the main IPA editor.
(function(root){
  function effective(word,state,base){
    const key=String(word||'').toLowerCase();
    return (state?.manualPronunciations||{})[key] || (state?.customPronunciations||{})[key] || (base||{})[key] || null;
  }
  function lines(word,state,base){
    const p=effective(word,state,base);
    if(!p)return [];
    const result=[];
    if(p.uk)result.push({region:'UK',text:String(p.uk)});
    if(p.us)result.push({region:'US',text:String(p.us)});
    if(!result.length&&p.fallback)result.push({region:'IPA',text:String(p.fallback)});
    return result;
  }
  function render(word,state,base,escape){
    const items=lines(word,state,base);
    return items.length?'<span class="confusableIpa" lang="en">'+items.map(item=>'<span class="confusableIpaLine" title="'+item.region+'">'+escape(item.text)+'</span>').join('')+'</span>':'';
  }
  root.avsConfusableIpa={effective,lines,render};
})(typeof window!=='undefined'?window:globalThis);
