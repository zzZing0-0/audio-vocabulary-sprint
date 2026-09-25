let lookupPronunciations={};
let lookupVoices=[];
const $=id=>document.getElementById(id);
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function findKey(obj,k){return Object.keys(obj||{}).find(x=>x.toLowerCase()===k)||null;}
function canonicalWord(q){const k=q.toLowerCase();return allWords().find(w=>w.toLowerCase()===k)||null;}
function prefixMatches(raw){
  const q=String(raw||"").trim().toLowerCase();
  if(!q)return [];
  return allWords().filter(w=>!isRemovedWord(w)&&String(w).toLowerCase().startsWith(q)).sort((a,b)=>a.localeCompare(b)).slice(0,8);
}
function renderLookupSuggestions(raw){
  const box=$("lookupSuggestions");if(!box)return;
  const q=String(raw||"").trim(),matches=prefixMatches(q);
  if(!q||!matches.length){box.hidden=true;box.innerHTML="";return;}
  box.innerHTML='<div class="lookupSuggestLabel">词库中以 “'+esc(q)+'” 开头</div><div class="lookupSuggestList">'+matches.map(w=>'<button type="button" class="lookupSuggestItem" data-suggest="'+esc(w)+'">'+esc(w)+'</button>').join('')+'</div>';
  box.hidden=false;
  box.querySelectorAll('[data-suggest]').forEach(b=>b.onclick=()=>{box.hidden=true;runLookup(b.dataset.suggest);});
}

function removedWord(q){const k=q.toLowerCase();return Object.keys(state.removedWords||{}).find(w=>w.toLowerCase()===k)||null;}
function pronunciationHtml(w){const k=w.toLowerCase(),p=(state.customPronunciations&&state.customPronunciations[k])||lookupPronunciations[k];if(!p)return "";const a=[];if(p.uk)a.push('<span class="ipaChip ipaUk" title="UK" dir="ltr" lang="en">'+esc(p.uk)+'</span>');if(p.us)a.push('<span class="ipaChip ipaUs" title="US" dir="ltr" lang="en">'+esc(p.us)+'</span>');if(!a.length&&p.fallback)a.push('<span class="ipaChip ipaGeneric" title="IPA" dir="ltr" lang="en">'+esc(p.fallback)+'</span>');return a.length?'<div class="ipaLine">'+a.join('')+'</div>':"";}
async function loadPron(){try{const r=await fetch("data/pronunciations.json?v=3.31.6",{cache:"no-cache"});const j=await r.json();lookupPronunciations=j?.words||{};}catch(e){} const q=new URLSearchParams(location.search).get("word");if(q)runLookup(q);}
function preferredVoices(){const all=speechSynthesis.getVoices(),en=all.filter(v=>/^en([-_]|$)/i.test(v.lang||""));const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;const p=en.filter(v=>!novelty.test(v.name||""));return p.length>=2?p:(en.length?en:all);}
function refreshVoices(){lookupVoices=preferredVoices();updateLookupVoiceInfo();}
speechSynthesis.onvoiceschanged=refreshVoices;refreshVoices();
function lookupSelectedVoice(){if(!lookupVoices.length)return null;return lookupVoices[(Number(state.voiceIndex)||0)%lookupVoices.length];}
function updateLookupVoiceInfo(){const el=$("lookupVoiceInfo");if(!el)return;const v=lookupSelectedVoice();el.textContent=v?"Voice: "+v.name:"";}
function speak(w){try{if("audioSession" in navigator&&navigator.audioSession)navigator.audioSession.type="playback";}catch(e){} speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(w);u.lang="en-US";u.rate=.86;const v=lookupSelectedVoice();if(v)u.voice=v;speechSynthesis.speak(u);}
function changeLookupVoice(step,w){
  // Re-read the browser voice pool at the moment of interaction. Safari/iOS can
  // populate speechSynthesis voices after the page has already rendered.
  const latest=preferredVoices();
  if(latest.length) lookupVoices=latest;
  if(!lookupVoices.length)return;
  const n=lookupVoices.length;
  state.voiceIndex=((Number(state.voiceIndex)||0)+step+n)%n;
  save();
  updateLookupVoiceInfo();
  // Arrow taps are a listening action: immediately audition the main lookup word
  // with the newly selected voice. Linked-word speakers use the same voiceIndex.
  requestAnimationFrame(()=>speak(w));
}
function statusFor(w){const mk=findKey(state.mastered,w.toLowerCase()),dk=findKey(state.debts,w.toLowerCase());if(mk)return {label:"已掌握",debt:0,peak:Number(state.highestDebt[mk]||0)};if(dk&&Number(state.debts[dk])>0)return {label:"学习中",debt:Number(state.debts[dk]),peak:Number(state.highestDebt[dk]||state.debts[dk])};return {label:"未学习",debt:1,peak:Number(state.highestDebt[w]||0)};}
function sourceFor(w){return (state.customWords||[]).some(x=>String(x).toLowerCase()===w.toLowerCase())?"自定义词库":"内置词库";}
function links(w){const yd=matchMedia&&matchMedia("(max-width:700px)").matches?"https://m.youdao.com/dict?le=eng&q="+encodeURIComponent(w):"https://dict.youdao.com/w/eng/"+encodeURIComponent(w);return '<div class="note lookupLinks"><a href="https://www.oxfordlearnersdictionaries.com/definition/english/'+encodeURIComponent(w.toLowerCase().replace(/\s+/g,"-"))+'" target="vocabLookup">📖 Oxford 英英</a><a href="'+yd+'" target="vocabLookup">📘 有道英中</a><a href="https://youglish.com/pronounce/'+encodeURIComponent(w)+'/english" target="vocabLookup">🎧 YouGlish 语境</a><a href="https://www.playphrase.me/#/search?q='+encodeURIComponent(w)+'" target="vocabLookup">🎬 PlayPhrase 影视</a><a href="https://www.rhymezone.com/r/rhyme.cgi?Word='+encodeURIComponent(w)+'&typeofrhyme=sim" target="vocabLookup">🔎 RhymeZone 近音</a></div>';}
function confusableLookupHtml(w){const a=getLinkedWords(w);return '<section class="confusableSection"><div class="confusableHead"><span>易混词</span><button class="confusableManageBtn" id="lookupManageConfusables" type="button">管理易混词</button></div>'+(a.length?'<div class="confusableList">'+a.map(x=>'<span class="confusableChip"><button class="confusableSpeak" type="button" data-ls="'+esc(x)+'">🔊</button><a href="lookup.html?word='+encodeURIComponent(x)+'">'+esc(x)+'</a></span>').join('')+'</div>':'<div class="confusableEmpty">还没有链接易混词</div>')+'<div class="confusableManager" id="lookupConfusableManager" hidden></div></section>';}
function renderLookupManager(w,msg=''){const box=$('lookupConfusableManager');if(!box)return;const a=getLinkedWords(w);box.innerHTML='<div class="confusableCount">'+a.length+' / 3</div>'+a.map(x=>'<div class="confusableManageRow"><span>'+esc(x)+'</span><div><button class="miniBtn" type="button" data-lms="'+esc(x)+'">🔊</button><button class="miniBtn confusableRemove" type="button" data-lu="'+esc(x)+'">移除</button></div></div>').join('')+'<div class="confusableAddRow"><input id="lookupConfusableInput" class="lookupInput" type="text" autocomplete="off" placeholder="输入易混词或词组"><button class="miniBtn" id="lookupConfusableAdd" type="button"'+(a.length>=3?' disabled':'')+'>添加</button></div>'+(a.length>=3?'<div class="confusableMessage">已达到 3 个上限，可先移除一个再添加。</div>':'')+(msg?'<div class="confusableMessage">'+esc(msg)+'</div>':'');box.querySelectorAll('[data-lms]').forEach(b=>b.onclick=()=>speak(b.dataset.lms));box.querySelectorAll('[data-lu]').forEach(b=>b.onclick=()=>{unlinkWords(w,b.dataset.lu);save();renderFound(w);setTimeout(()=>{const m=$('lookupConfusableManager');if(m){m.hidden=false;renderLookupManager(w);}},0);});const add=$('lookupConfusableAdd'),inp=$('lookupConfusableInput');if(add)add.onclick=()=>addLookupConfusable(w,inp.value);if(inp)inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addLookupConfusable(w,inp.value);}};}
function addLookupConfusable(w,raw){const q=String(raw||'').trim();if(!q)return;if(q.toLowerCase()===w.toLowerCase()){renderLookupManager(w,'不能把单词和自己链接。');return;}let t=findWordCaseInsensitive(q,true);if(t&&isRemovedWord(t)){renderLookupManager(w,t+' 当前已移除，请先恢复后再链接。');return;}if(!t){if(!validNew(q)){renderLookupManager(w,'请输入有效的英文单词或词组。');return;}state.customWords.push(q);t=q;}const r=linkWords(w,t);if(!r.ok){renderLookupManager(w,r.reason==='target-full'?t+' 已经链接了 3 个易混词，请先移除一个。':'当前词已经达到 3 个易混词上限。');return;}save();renderFound(w);setTimeout(()=>{const m=$('lookupConfusableManager');if(m){m.hidden=false;renderLookupManager(w);}},0);}
let lookupRemoveConfirmUntil=0;
let lookupRemoveToastTimer=null;
let lookupRemoveCountdownTimer=null;
function lookupConfirmToast(message){
  let el=document.getElementById("transientToast");
  if(!el){
    el=document.createElement("div");
    el.id="transientToast";
    el.className="transientToast";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
  }
  if(lookupRemoveToastTimer)clearTimeout(lookupRemoveToastTimer);
  if(lookupRemoveCountdownTimer)clearInterval(lookupRemoveCountdownTimer);
  let remaining=5;
  const render=()=>{el.textContent=message+`（${remaining} 秒内再次点击确认）`;};
  render();
  el.classList.remove("show");
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
  lookupRemoveCountdownTimer=setInterval(()=>{remaining-=1;if(remaining>=1)render();},1000);
  lookupRemoveToastTimer=setTimeout(()=>{
    clearInterval(lookupRemoveCountdownTimer);lookupRemoveCountdownTimer=null;
    el.classList.remove("show");lookupRemoveToastTimer=null;
  },5000);
}
function removeLookupWord(w){
  const now=Date.now();
  if(lookupRemoveConfirmUntil>now){
    lookupRemoveConfirmUntil=0;
    state.removedWords=state.removedWords||{};
    state.removedWords[w]={removedAt:new Date().toISOString()};
    state.queue=(state.queue||[]).filter(x=>String(x).toLowerCase()!==String(w).toLowerCase());
    if(String(state.current||'').toLowerCase()===String(w).toLowerCase())state.current=null;
    try{speechSynthesis.cancel();}catch(_){}
    save();
    runLookup(w);
    return;
  }
  lookupRemoveConfirmUntil=now+5000;
  lookupConfirmToast(`将 “${w}” 删除出学习词库；学习历史和笔记会保留`);
  setTimeout(()=>{if(lookupRemoveConfirmUntil<=Date.now())lookupRemoveConfirmUntil=0;},5100);
}
function renderFound(w){const s=statusFor(w),nk=findKey(state.notes,w.toLowerCase()),note=nk?state.notes[nk]:"";$("lookupResult").innerHTML='<div class="lookupDetail"><button class="removeTopBtn lookupRemoveBtn" id="lookupRemove" type="button">删除</button><div class="lookupStatusRow"><span>'+esc(s.label)+'</span><span>debt '+s.debt+'</span><span>peak '+s.peak+'</span><span>'+esc(sourceFor(w))+'</span></div><div class="lookupWord">'+esc(w)+'</div><div class="lookupVoiceControls"><button class="voiceArrow" id="lookupVoicePrev" type="button" aria-label="上一个语音">‹</button><button class="lookupSpeaker" id="lookupSpeak" type="button" aria-label="播放发音">🔊</button><button class="voiceArrow" id="lookupVoiceNext" type="button" aria-label="下一个语音">›</button></div><div class="voiceInfo" id="lookupVoiceInfo"></div>'+pronunciationHtml(w)+links(w)+confusableLookupHtml(w)+'<details class="wordNoteWrap noteDetails"'+(note?' open':'')+'><summary>笔记</summary><input id="lookupNote" class="wordNoteInput" type="text" placeholder="例如：容易和另一个词混；重音容易记错" value="'+esc(note)+'"></details></div>';$("lookupSpeak").onclick=()=>speak(w);$("lookupRemove").onclick=()=>removeLookupWord(w);$("lookupVoicePrev").onclick=()=>changeLookupVoice(-1,w);$("lookupVoiceNext").onclick=()=>changeLookupVoice(1,w);updateLookupVoiceInfo();document.querySelectorAll('[data-ls]').forEach(b=>b.onclick=()=>speak(b.dataset.ls));$('lookupManageConfusables').onclick=()=>{const box=$('lookupConfusableManager');box.hidden=!box.hidden;if(!box.hidden)renderLookupManager(w);};$("lookupNote").onchange=$("lookupNote").onblur=()=>{const v=$("lookupNote").value.trim();const key=nk||w;if(v)state.notes[key]=v;else delete state.notes[key];save();};}
function validNew(q){return q&& !/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(q) && !new Set(["a","an","the"]).has(q.toLowerCase());}
function renderMissing(q){const rem=removedWord(q);if(rem){$("lookupResult").innerHTML='<div class="lookupMissing"><b>'+esc(rem)+'</b><p>当前已从学习词库移除，学习历史和笔记仍保留。</p><button class="action" id="restoreLookup">恢复到词库</button></div>';$("restoreLookup").onclick=()=>{delete state.removedWords[rem];save();runLookup(rem);};return;}const ok=validNew(q);$("lookupResult").innerHTML='<div class="lookupMissing"><b>'+esc(q)+'</b><p>'+(ok?'不在当前词库中。':'不是可添加的英文词条。')+'</p>'+(ok?'<button class="action" id="addLookup">添加到词库</button>':'')+'</div>';if(ok)$("addLookup").onclick=()=>{state.customWords.push(q);save();runLookup(q);};}
function runLookup(raw){const q=String(raw||"").trim();if(!q)return;const suggest=$("lookupSuggestions");if(suggest){suggest.hidden=true;suggest.innerHTML="";}$("lookupInput").value=q;const w=canonicalWord(q);if(w)renderFound(w);else renderMissing(q);history.replaceState(null,"","lookup.html?word="+encodeURIComponent(q));}
$("lookupInput").oninput=e=>renderLookupSuggestions(e.target.value);
$("lookupSubmit").onclick=()=>runLookup($("lookupInput").value);
$("lookupForm").onsubmit=e=>{e.preventDefault();runLookup($("lookupInput").value);};
loadPron();
