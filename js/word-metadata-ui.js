// Word metadata UI: confusable links and per-word tag editor.
function linkedWordsHtml(word){
  const linked=getLinkedWords(word);
  const chips=linked.map(w=>
    '<span class="confusableChip"><button class="confusableSpeak" type="button" data-confusable-speak="'+escapeHtml(w)+'" aria-label="播放 '+escapeHtml(w)+'">🔊</button><a href="lookup.html?word='+encodeURIComponent(w)+'&v=4.4.3">'+escapeHtml(w)+'</a></span>'
  ).join('');
  return '<section class="confusableSection confusableCompact" id="confusableCompact" role="button" tabindex="0" aria-label="管理易混词"><div class="confusableHead"><span>易混词</span><span class="confusableHeadTools">'+(linked.length?'<button class="confusableGroupPlayHome" type="button" aria-label="依次朗读当前词和易混词" title="依次朗读当前词和易混词">▶</button>':'')+'<span class="confusableManageHint">管理 ›</span></span></div>'+
    (chips?'<div class="confusableList">'+chips+'</div>':'<div class="confusableEmpty">还没有链接易混词 · 点击添加</div>')+'</section>';
}
const CONFUSABLE_PAUSE_KEY="audio_vocab_sprint_confusable_pause_ms";
let homeConfusablePlaybackToken=0;
function homeConfusablePauseMs(){
  const raw=Number(localStorage.getItem(CONFUSABLE_PAUSE_KEY));
  return Number.isFinite(raw)?Math.min(5000,Math.max(0,raw)):700;
}
function playHomeConfusableGroup(){
  if(!state.current)return;
  const seq=[state.current,...getLinkedWords(state.current)].map(x=>String(x||'').trim()).filter(Boolean);
  if(seq.length<2)return;
  speechSynthesis.cancel();
  const token=++homeConfusablePlaybackToken,pause=homeConfusablePauseMs(),voice=selectedVoice();
  const next=i=>{
    if(token!==homeConfusablePlaybackToken||i>=seq.length)return;
    const u=new SpeechSynthesisUtterance(seq[i]);u.lang=(voice&&voice.lang)||'en-US';u.rate=.86;if(voice)u.voice=voice;
    u.onend=()=>{if(token===homeConfusablePlaybackToken)setTimeout(()=>next(i+1),pause);};
    u.onerror=()=>{if(token===homeConfusablePlaybackToken)setTimeout(()=>next(i+1),pause);};
    speechSynthesis.speak(u);
  };
  next(0);
}
function bindConfusableControls(){
  document.querySelectorAll('[data-confusable-speak]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();speakText(btn.dataset.confusableSpeak);});
  const groupPlay=document.querySelector('.confusableGroupPlayHome');if(groupPlay)groupPlay.onclick=e=>{e.stopPropagation();playHomeConfusableGroup();};
  const section=document.getElementById('confusableCompact');
  if(section){section.onclick=e=>{if(e.target.closest('a'))return;openConfusableManager();};section.onkeydown=e=>{if(e.target!==section)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openConfusableManager();}};}
}
function openConfusableManager(message=''){
  if(!state.current)return;
  const old=document.getElementById('confusableManagerBackdrop');if(old)old.remove();
  const wrap=document.createElement('div');wrap.id='confusableManagerBackdrop';wrap.className='ipaEditorBackdrop';
  wrap.innerHTML='<div class="ipaEditor confusableModal" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>易混词 · '+escapeHtml(state.current)+'</b><button class="ipaEditorClose" type="button" aria-label="关闭">×</button></div><div id="confusableManagerModal"></div></div>';
  document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};renderConfusableManager(message);
}
function renderConfusableManager(message=''){
  const box=document.getElementById('confusableManagerModal');
  if(!box||!state.current)return;
  const linked=getLinkedWords(state.current);
  box.innerHTML='<div class="confusableCount">'+linked.length+' / 3</div>'+linked.map(w=>'<div class="confusableManageRow"><span>'+escapeHtml(w)+'</span><div><button class="miniBtn" type="button" data-manage-speak="'+escapeHtml(w)+'">🔊</button><button class="miniBtn confusableRemove" type="button" data-unlink="'+escapeHtml(w)+'">移除</button></div></div>').join('')+'<div class="confusableAddRow"><input id="confusableInput" class="lookupInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入易混词或词组"><button class="miniBtn" id="confusableAdd" type="button"'+(linked.length>=3?' disabled':'')+'>添加</button></div>'+(linked.length>=3?'<div class="confusableMessage">已达到 3 个上限，可先移除一个再添加。</div>':'')+(message?'<div class="confusableMessage">'+escapeHtml(message)+'</div>':'');
  box.querySelectorAll('[data-manage-speak]').forEach(btn=>btn.onclick=()=>speakText(btn.dataset.manageSpeak));
  box.querySelectorAll('[data-unlink]').forEach(btn=>btn.onclick=()=>{unlinkWords(state.current,btn.dataset.unlink);save();refreshConfusableSection();renderConfusableManager();});
  const add=document.getElementById('confusableAdd'),input=document.getElementById('confusableInput');if(add)add.onclick=()=>addConfusable(input.value);if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addConfusable(input.value);}};
}
function refreshConfusableSection(){
  const old=document.querySelector('.confusableSection');if(!old||!state.current)return;
  const wrap=document.createElement('div');wrap.innerHTML=linkedWordsHtml(state.current);old.replaceWith(wrap.firstElementChild);bindConfusableControls();
}
function validConfusableNew(q){return q&&!/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(q)&&!new Set(['a','an','the']).has(q.toLowerCase());}
function addConfusable(raw){
  const q=String(raw||'').trim();if(!q)return;
  if(q.toLowerCase()===state.current.toLowerCase()){renderConfusableManager('不能把单词和自己链接。');return;}
  let target=findWordCaseInsensitive(q,true);
  if(target&&isRemovedWord(target)){renderConfusableManager(target+' 当前已移除，请先在「已移除」页面恢复后再链接。');return;}
  if(!target){
    if(!validConfusableNew(q)){renderConfusableManager('请输入有效的英文单词或词组。');return;}
    state.customWords.push(q);target=q;
  }
  const result=linkWords(state.current,target);
  if(!result.ok){
    if(result.reason==='source-full')renderConfusableManager('当前词已经达到 3 个易混词上限。');
    else if(result.reason==='target-full')renderConfusableManager(target+' 已经链接了 3 个易混词，请先在它的 Lookup 页面移除一个。');
    else renderConfusableManager('无法建立链接。');
    return;
  }
  save();refreshConfusableSection();renderConfusableManager();
}

function compactTagBadgesHtml(word){const ids=getWordTagIds(word),tags=ids.map(id=>({id,...state.tags[id]})).filter(t=>t.name);return tags.map(t=>'<span class="topTagBadge" style="--tag-color:'+escapeHtml(t.color||'#8b7cf6')+'">'+escapeHtml(t.name)+'</span>').join('')+'<button class="topTagAdd" id="currentTagManage" type="button" aria-label="管理标签" title="管理标签">＋</button>';}
function openWordTagEditor(word,onDone){
  const old=document.getElementById('wordTagBackdrop');if(old)old.remove();
  const wrap=document.createElement('div');wrap.id='wordTagBackdrop';wrap.className='ipaEditorBackdrop';
  const selected=new Set(getWordTagIds(word)),tags=tagList();
  wrap.innerHTML='<div class="ipaEditor tagEditor" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>'+escapeHtml(word)+'</b><button class="ipaEditorClose" type="button">×</button></div><div class="tagChoiceList">'+(tags.length?tags.map(t=>'<label class="tagChoice"><input type="checkbox" value="'+escapeHtml(t.id)+'" '+(selected.has(t.id)?'checked':'')+'><span class="wordTagChip" style="--tag-color:'+escapeHtml(t.color)+'">'+escapeHtml(t.name)+'</span></label>').join(''):'<div class="tagEmpty">还没有标签，请先到「词库 → 标签」创建。</div>')+'</div><div class="ipaEditorActions"><a class="tagManageLink" href="tags.html?v=4.4.3">管理标签</a><button class="ipaSave" id="saveWordTags" type="button">保存</button></div></div>';
  document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  wrap.querySelector('#saveWordTags').onclick=()=>{setWordTagIds(word,[...wrap.querySelectorAll('.tagChoice input:checked')].map(x=>x.value));save();close();if(onDone)onDone();};
}

