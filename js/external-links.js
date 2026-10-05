/* Audio Vocabulary Sprint · external dictionary navigation · v4.4.0 */
(function(){
  let dictionaryWindow=null;

  function openDictionaryLink(url){
    const href=String(url||'').trim();
    if(!/^https?:\/\//i.test(href))return null;
    if(dictionaryWindow&&!dictionaryWindow.closed){
      try{
        dictionaryWindow.location.href=href;
        dictionaryWindow.focus();
        return dictionaryWindow;
      }catch(_){dictionaryWindow=null;}
    }
    dictionaryWindow=window.open(href,'_blank');
    return dictionaryWindow;
  }

  function dictionaryHost(){
    try{
      if(window.top&&window.top!==window&&typeof window.top.openDictionaryLink==='function')return window.top;
    }catch(_){}
    return window;
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[data-dictionary-link]');
    if(!a)return;
    e.preventDefault();
    e.stopPropagation();
    dictionaryHost().openDictionaryLink(a.href);
  },true);

  window.openDictionaryLink=openDictionaryLink;
})();
