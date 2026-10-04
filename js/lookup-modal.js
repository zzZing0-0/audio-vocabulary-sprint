/* Audio Vocabulary Sprint · reusable Lookup modal · v4.1.3 */
(function(){
  let backdrop=null;
  let lookupStack=[];
  function frame(){return backdrop&&backdrop.querySelector('.lookupModalFrame');}
  function backBtn(){return backdrop&&backdrop.querySelector('.lookupModalBack');}
  function updateBack(){const b=backBtn();if(!b)return;b.hidden=lookupStack.length<=1;b.disabled=lookupStack.length<=1;}
  function loadWord(word){const f=frame();if(!f)return;f.src='lookup.html?embed=1&word='+encodeURIComponent(word)+'&v=4.1.3';}
  function closeLookupModal(){
    if(!backdrop)return;
    const f=frame();if(f)f.src='about:blank';
    backdrop.remove();backdrop=null;lookupStack=[];
    document.body.classList.remove('lookupModalOpen');
  }
  function openLookupModal(word,opts){
    const w=String(word||'').trim();if(!w)return;
    if(backdrop){
      const current=lookupStack[lookupStack.length-1];
      if(current!==w)lookupStack.push(w);
      loadWord(w);updateBack();return;
    }
    lookupStack=[w];
    backdrop=document.createElement('div');
    backdrop.className='lookupModalBackdrop';
    backdrop.innerHTML='<section class="lookupModalShell" role="dialog" aria-modal="true" aria-label="查看单词"><button class="lookupModalBack" type="button" aria-label="返回上一个词" hidden>← 返回</button><button class="lookupModalClose" type="button" aria-label="关闭 Lookup">×</button><iframe class="lookupModalFrame" title="Lookup" src="lookup.html?embed=1&word='+encodeURIComponent(w)+'&v=4.1.3"></iframe></section>';
    document.body.appendChild(backdrop);document.body.classList.add('lookupModalOpen');
    backdrop.querySelector('.lookupModalClose').onclick=closeLookupModal;
    backdrop.querySelector('.lookupModalBack').onclick=()=>{
      if(lookupStack.length<=1)return;
      lookupStack.pop();loadWord(lookupStack[lookupStack.length-1]);updateBack();
    };
    backdrop.onclick=e=>{if(e.target===backdrop)closeLookupModal();};
    updateBack();
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop)closeLookupModal();});
  // External dictionary links always use one reusable auxiliary tab/window.
  // This keeps the vocabulary app in place and avoids opening a new tab per click.
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[target="vocabLookup"]');if(!a)return;
    let u;try{u=new URL(a.href,location.href);}catch(_){return;}
    if(u.origin===location.origin)return;
    e.preventDefault();
    const w=window.open(u.href,'vocabLookup');
    try{w&&w.focus();}catch(_){}
  },true);
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href*="lookup.html?word="]');if(!a)return;
    let u;try{u=new URL(a.href,location.href);}catch(_){return;}
    if(u.origin!==location.origin)return;
    const w=u.searchParams.get('word');if(!w)return;
    e.preventDefault();e.stopPropagation();openLookupModal(w);
  },true);
  addEventListener('message',e=>{
    if(!backdrop||e.origin!==location.origin||e.source!==frame()?.contentWindow)return;
    if(e.data&&e.data.type==='avs-lookup-open'&&e.data.word){openLookupModal(e.data.word);return;}
    if(e.data&&e.data.type==='avs-external-open'&&e.data.url){
      let u;try{u=new URL(e.data.url,location.href);}catch(_){return;}
      if(!/^https?:$/.test(u.protocol)||u.origin===location.origin)return;
      const w=window.open(u.href,'vocabLookup');
      try{w&&w.focus();}catch(_){}
    }
  });
  window.openLookupModal=openLookupModal;window.closeLookupModal=closeLookupModal;
})();
