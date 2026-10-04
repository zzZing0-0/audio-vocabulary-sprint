/* Audio Vocabulary Sprint · reusable Lookup modal · v4.1.0 */
(function(){
  let backdrop=null;
  function closeLookupModal(){
    if(!backdrop)return;
    const frame=backdrop.querySelector('iframe');
    if(frame)frame.src='about:blank';
    backdrop.remove();backdrop=null;
    document.body.classList.remove('lookupModalOpen');
  }
  function openLookupModal(word){
    const w=String(word||'').trim();if(!w)return;
    closeLookupModal();
    backdrop=document.createElement('div');
    backdrop.className='lookupModalBackdrop';
    backdrop.innerHTML='<section class="lookupModalShell" role="dialog" aria-modal="true" aria-label="查看单词"><button class="lookupModalClose" type="button" aria-label="关闭 Lookup">×</button><iframe class="lookupModalFrame" title="Lookup" src="lookup.html?embed=1&word='+encodeURIComponent(w)+'&v=4.1.0"></iframe></section>';
    document.body.appendChild(backdrop);document.body.classList.add('lookupModalOpen');
    backdrop.querySelector('.lookupModalClose').onclick=closeLookupModal;
    backdrop.onclick=e=>{if(e.target===backdrop)closeLookupModal();};
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop)closeLookupModal();});
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href*="lookup.html?word="]');if(!a)return;
    let u;try{u=new URL(a.href,location.href);}catch(_){return;}
    if(u.origin!==location.origin)return;
    const w=u.searchParams.get('word');if(!w)return;
    e.preventDefault();e.stopPropagation();openLookupModal(w);
  },true);
  window.openLookupModal=openLookupModal;window.closeLookupModal=closeLookupModal;
})();
