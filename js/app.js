
function getPreferredEnglishVoices(){
  const all=speechSynthesis.getVoices();
  const english=all.filter(v => /^en([-_]|$)/i.test(v.lang || ""));
  if(!english.length) return filterBlockedVoices(all);
  const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;
  const preferred=english.filter(v => !novelty.test(v.name || ""));
  return filterBlockedVoices(preferred.length>=2 ? preferred : english);
}

let voices=[], revealed=false, started=false;

let pronunciationWords={};
let pronunciationLoadFinished=false;

function pronunciationHtml(word){
  const key=String(word||"").toLowerCase();
  const item=(state.manualPronunciations&&state.manualPronunciations[key]) || (state.customPronunciations&&state.customPronunciations[key]) || pronunciationWords[key];
  if(!item)return "";

  // Prefer explicitly region-labelled IPA. Show generic fallback only when
  // neither regional label exists; never guess a UK/US label.
  const parts=[];
  if(item.uk) parts.push('<span class="ipaChip ipaUk" title="UK" dir="ltr" lang="en">'+escapeHtml(item.uk)+'</span>');
  if(item.us) parts.push('<span class="ipaChip ipaUs" title="US" dir="ltr" lang="en">'+escapeHtml(item.us)+'</span>');
  if(!parts.length && item.fallback) parts.push('<span class="ipaChip ipaGeneric" title="IPA" dir="ltr" lang="en">'+escapeHtml(item.fallback)+'</span>');
  if(!parts.length)return "";

  return '<div class="ipaWrap"><div class="ipaLine">'+parts.join('')+'</div><button type="button" class="ipaEditBtn" onclick="openPronunciationEditor(state.current)">编辑</button></div>';
}

function openPronunciationEditor(word){
  const key=String(word||"").toLowerCase();
  if(!key)return;
  const base=pronunciationWords[key]||{};
  const imported=(state.customPronunciations&&state.customPronunciations[key])||{};
  const manual=(state.manualPronunciations&&state.manualPronunciations[key])||{};
  const underneath=Object.keys(imported).length?imported:base;
  const effective=Object.keys(manual).length?manual:underneath;
  const old=document.getElementById("ipaEditorBackdrop");if(old)old.remove();
  const wrap=document.createElement("div");wrap.id="ipaEditorBackdrop";wrap.className="ipaEditorBackdrop";
  wrap.innerHTML='<div class="ipaEditor" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>编辑音标 · '+escapeHtml(word)+'</b><button class="ipaEditorClose" type="button" aria-label="关闭">×</button></div><div class="ipaEditorSource">当前底层来源：'+escapeHtml(imported.source||base.source||"无公共音标")+((imported.fallback||base.fallback)?' · '+escapeHtml(imported.fallback||base.fallback):'')+'</div><div class="ipaEditorRow"><label>🇬🇧 英音</label><input class="ipaEditorInput" id="ipaEditUk" value="'+escapeHtml(effective.uk||'')+'" placeholder="例如 /.../"></div><div class="ipaEditorRow"><label>🇺🇸 美音</label><input class="ipaEditorInput" id="ipaEditUs" value="'+escapeHtml(effective.us||'')+'" placeholder="例如 /.../"></div><div class="ipaEditorRow"><label>通用 IPA（可选覆盖）</label><input class="ipaEditorInput" id="ipaEditFallback" value="'+escapeHtml(manual.fallback||'')+'" placeholder="留空则保留原始通用 IPA"></div><div class="ipaEditorHint">最多固定三项：英音、美音、通用 IPA。填写英/美音后，页面优先显示地区音标；手动层优先；清除后回退到欧路导入音标，如无欧路数据再回退到 Wiktionary。</div><div class="ipaEditorActions"><button type="button" id="ipaResetManual">清除手动修正</button><button type="button" class="ipaSave" id="ipaSaveManual">保存</button></div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  document.getElementById('ipaSaveManual').onclick=()=>{const uk=document.getElementById('ipaEditUk').value.trim(),us=document.getElementById('ipaEditUs').value.trim(),fallback=document.getElementById('ipaEditFallback').value.trim();state.manualPronunciations=state.manualPronunciations||{};if(uk||us||fallback){state.manualPronunciations[key]={uk:uk||null,us:us||null,fallback:fallback||underneath.fallback||null,source:'manual'};}else delete state.manualPronunciations[key];save();close();refreshCurrentPronunciation();};
  document.getElementById('ipaResetManual').onclick=()=>{state.manualPronunciations=state.manualPronunciations||{};delete state.manualPronunciations[key];save();close();refreshCurrentPronunciation();};
}

function refreshCurrentPronunciation(){
  if(!revealed || !state.current)return;
  const slot=document.getElementById("pronunciationSlot");
  if(slot) slot.innerHTML=pronunciationHtml(state.current);
}

async function loadPronunciations(){
  try{
    const r=await fetch("data/pronunciations.json?v=4.2.0",{cache:"no-cache"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const payload=await r.json();
    pronunciationWords=(payload&&payload.words&&typeof payload.words==="object") ? payload.words : {};
  }catch(e){
    console.warn("Pronunciation database unavailable:",e);
    pronunciationWords={};
  }finally{
    pronunciationLoadFinished=true;
    refreshCurrentPronunciation();
  }
}
loadPronunciations();










function selectedVoice(){
  if(!voices.length) return null;
  return voices[state.voiceIndex % voices.length];
}

function updateVoiceInfo(){
  const el=document.getElementById("voiceInfo");
  if(!el) return;
  const v=selectedVoice();
  el.innerHTML=v ? '<span>Voice: '+escapeHtml(v.name)+'</span><button class="voiceBlockBtn" id="voiceBlockBtn" type="button" aria-label="屏蔽 ' + escapeHtml(v.name) + '" title="屏蔽这个 Voice">×</button>' : "";
  const b=document.getElementById("voiceBlockBtn");if(b)b.onclick=blockCurrentVoice;
}

function updateAnswerControls(){
  const revealBox=document.getElementById("revealControls");
  const judgeBox=document.getElementById("judgmentActions");
  const revealBtn=document.getElementById("reveal");
  const passBtn=document.getElementById("pass");
  const againBtn=document.getElementById("again");
  const removeBtn=document.getElementById("removeTopBtn");
  const undoBtn=document.getElementById("undoBtn");

  const hasWord=!!state.current;
  const undoAvailable=!!(undoBtn && !undoBtn.disabled);

  if(revealBox) revealBox.hidden=revealed;
  if(judgeBox) judgeBox.hidden=!revealed;
  if(revealBtn) revealBtn.disabled=!hasWord;
  if(passBtn) passBtn.disabled=!hasWord || !revealed || judgmentFinalizing || (judgmentLocked&&judgmentKind!=="PASS");
  if(againBtn) againBtn.disabled=!hasWord || !revealed || judgmentFinalizing || (judgmentLocked&&judgmentKind!=="AGAIN");
  if(removeBtn) removeBtn.hidden=!(hasWord&&revealed);
  if(removeBtn) removeBtn.disabled=!!judgmentLocked;

  if(undoBtn) undoBtn.hidden=!undoAvailable;

  const card=document.querySelector(".card");
  if(card) card.classList.toggle("preReveal",!revealed);

  const stack=document.querySelector(".topRightActions");
  if(stack){
    const visible=[...stack.children].filter(el=>!el.hidden);
    visible.forEach((el,i)=>el.style.order=String(i));
  }
}

function blockCurrentVoice(){
  const v=selectedVoice();if(!v)return;
  if(voices.length<=1){alert("至少保留一个可用 Voice。可以先到设置里恢复其他 Voice。");return;}
  speechSynthesis.cancel();blockVoice(v);
  voices=getPreferredEnglishVoices();
  state.voiceIndex=Math.min(Number(state.voiceIndex)||0,Math.max(0,voices.length-1));save();updateVoiceInfo();
  if(state.current)speakCurrent();
}

function openBlockedVoiceManager(){
  const rows=blockedVoiceRecords();
  const items=rows.length ? rows.map(x=>'<div class="blockedVoiceRow"><span><b>'+escapeHtml(x.name||"Voice")+'</b><small>'+escapeHtml(x.lang||"")+'</small></span><button class="miniBtn" type="button" data-restore-voice="'+encodeURIComponent(x.key||"")+'">恢复</button></div>').join('') : '<div class="utilityEmpty">目前没有屏蔽 Voice。</div>';
  openUtilityPanel(
    '<div class="utilityPanelHead"><div><h2>管理屏蔽 Voice</h2><div class="sub">只影响当前设备；恢复后会重新加入 Voice 轮换。</div></div><button class="small" id="utilityClose" type="button">关闭</button></div>'+ 
    '<div class="blockedVoiceList">'+items+'</div>'
  );
  document.getElementById("utilityClose")?.addEventListener("click",closePanel);
  document.querySelectorAll("[data-restore-voice]").forEach(btn=>btn.onclick=()=>{restoreBlockedVoice(decodeURIComponent(btn.dataset.restoreVoice));loadVoices();openBlockedVoiceManager();});
}

function changeVoice(step){
  if(!voices.length)return;
  const n=voices.length;
  state.voiceIndex=((Number(state.voiceIndex)||0)+step+n)%n;
  save();
  updateVoiceInfo();
  if(state.current)speakCurrent();
}


function speakText(text){
  speechSynthesis.cancel();
  let u=new SpeechSynthesisUtterance(text);
  u.lang="en-US"; u.rate=.86;
  let v=selectedVoice(); if(v) u.voice=v;
  speechSynthesis.speak(u);
}
function speakCurrent(){ if(state.current) speakText(state.current); }
function goToLookup(word){
  const w=String(word||"").trim();if(!w)return;
  if(window.openLookupModal)window.openLookupModal(w);
}
function linkedWordsHtml(word){
  const linked=getLinkedWords(word);
  const chips=linked.map(w=>
    '<span class="confusableChip"><button class="confusableSpeak" type="button" data-confusable-speak="'+escapeHtml(w)+'" aria-label="播放 '+escapeHtml(w)+'">🔊</button><a href="lookup.html?word='+encodeURIComponent(w)+'&v=4.2.0">'+escapeHtml(w)+'</a></span>'
  ).join('');
  return '<section class="confusableSection confusableCompact" id="confusableCompact" role="button" tabindex="0" aria-label="管理易混词"><div class="confusableHead"><span>易混词</span><span class="confusableManageHint">管理 ›</span></div>'+
    (chips?'<div class="confusableList">'+chips+'</div>':'<div class="confusableEmpty">还没有链接易混词 · 点击添加</div>')+'</section>';
}
function bindConfusableControls(){
  document.querySelectorAll('[data-confusable-speak]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();speakText(btn.dataset.confusableSpeak);});
  const section=document.getElementById('confusableCompact');
  if(section){section.onclick=e=>{if(e.target.closest('a'))return;openConfusableManager();};section.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openConfusableManager();}};}
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
  wrap.innerHTML='<div class="ipaEditor tagEditor" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>'+escapeHtml(word)+'</b><button class="ipaEditorClose" type="button">×</button></div><div class="tagChoiceList">'+(tags.length?tags.map(t=>'<label class="tagChoice"><input type="checkbox" value="'+escapeHtml(t.id)+'" '+(selected.has(t.id)?'checked':'')+'><span class="wordTagChip" style="--tag-color:'+escapeHtml(t.color)+'">'+escapeHtml(t.name)+'</span></label>').join(''):'<div class="tagEmpty">还没有标签，请先到「词库 → 标签」创建。</div>')+'</div><div class="ipaEditorActions"><a class="tagManageLink" href="tags.html?v=4.2.0">管理标签</a><button class="ipaSave" id="saveWordTags" type="button">保存</button></div></div>';
  document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  wrap.querySelector('#saveWordTags').onclick=()=>{setWordTagIds(word,[...wrap.querySelectorAll('.tagChoice input:checked')].map(x=>x.value));save();close();if(onDone)onDone();};
}
function syncMobileTopInfoLayout(){
  const card=document.querySelector(".card");
  if(!card)return;
  const info=card.querySelector(".topLeftInfo");
  const mobile=window.matchMedia&&window.matchMedia("(max-width: 600px)").matches;
  if(!mobile||!info){
    card.style.removeProperty("--mobile-top-info-height");
    return;
  }
  requestAnimationFrame(()=>{
    const h=Math.ceil(info.getBoundingClientRect().height||0);
    card.style.setProperty("--mobile-top-info-height",h+"px");
  });
}
window.addEventListener("resize",syncMobileTopInfoLayout);

function reveal(debtOverride=null, firstOverride=null){
  if(!state.current)return;
  revealed=true;
  updateAnswerControls();
  const storedDebt=state.debts[state.current];
  let d=debtOverride===null ? (storedDebt||1) : Number(debtOverride);

  const youdaoHref=(window.matchMedia&&window.matchMedia("(max-width: 700px)").matches)
    ? "https://m.youdao.com/dict?le=eng&q="+encodeURIComponent(state.current)
    : "https://dict.youdao.com/w/eng/"+encodeURIComponent(state.current);
  const isFirst=firstOverride===null ? !storedDebt : !!firstOverride;
  document.getElementById("answer").innerHTML=
    '<div class="topLeftInfo">'+
      '<div class="debtBadge">debt: '+d+'</div>'+
      (isFirst?'<div class="firstBadge">首次出现</div>':'')+
      compactTagBadgesHtml(state.current)+
    '</div>'+
    '<div class="word">'+escapeHtml(state.current)+'</div>'+
    '<div id="pronunciationSlot">'+pronunciationHtml(state.current)+'</div>'+
    '<div class="note" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+
      '<a href="https://www.oxfordlearnersdictionaries.com/definition/english/'+encodeURIComponent(state.current.toLowerCase().replace(/\s+/g,"-"))+'" data-dictionary-link="1" style="color:#666;text-decoration:none">📖 Oxford 英英</a>'+
      '<a href="'+youdaoHref+'" data-dictionary-link="1" style="color:#666;text-decoration:none">📘 有道英中</a>'+
      '<a href="https://youglish.com/pronounce/'+encodeURIComponent(state.current)+'/english" data-dictionary-link="1" style="color:#666;text-decoration:none">🎧 YouGlish 语境</a>'+
      '<a href="https://www.playphrase.me/#/search?q='+encodeURIComponent(state.current)+'" data-dictionary-link="1" style="color:#666;text-decoration:none">🎬 PlayPhrase 影视</a>'+
      '<a href="https://www.rhymezone.com/r/rhyme.cgi?Word='+encodeURIComponent(state.current)+'&typeofrhyme=sim" data-dictionary-link="1" style="color:#666;text-decoration:none">🔎 RhymeZone 近音</a>'+
    '</div>'+
    linkedWordsHtml(state.current)+
    '<details class="wordNoteWrap noteDetails'+(String(state.notes[state.current]||'').trim()?' noteHasContent':'')+'">'+
      '<summary>笔记</summary>'+
      '<textarea id="wordNoteInput" class="wordNoteInput" rows="2" placeholder="例如：相关词、例句、容易混淆的发音……">'+escapeHtml(state.notes[state.current]||'')+'</textarea>'+
    '</details>';

  bindConfusableControls();
  syncMobileTopInfoLayout();
  const tagBtn=document.getElementById('currentTagManage');if(tagBtn)tagBtn.onclick=()=>openWordTagEditor(state.current,()=>reveal(d,isFirst));

  try{ const w=(typeof currentWord!=="undefined"&&currentWord)||state.current; styleDebtBadge(state.debts[w]||1); }catch(e){}
}




let passAudioCtx=null;
function playPassSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx) return;
    if(!passAudioCtx || passAudioCtx.state==="closed") passAudioCtx=new AudioCtx();

    const play=()=>{
      const ctx=passAudioCtx;
      const now=ctx.currentTime+0.01;
      const master=ctx.createGain();
      master.gain.setValueAtTime(0.0001,now);
      master.gain.exponentialRampToValueAtTime(0.18,now+0.012);
      master.gain.exponentialRampToValueAtTime(0.0001,now+0.55);
      master.connect(ctx.destination);

      [[659.25,0],[783.99,0.09],[1046.50,0.18]].forEach(([freq,delay])=>{
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        osc.type="sine";
        osc.frequency.setValueAtTime(freq,now+delay);
        gain.gain.setValueAtTime(0.0001,now+delay);
        gain.gain.exponentialRampToValueAtTime(0.75,now+delay+0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.22);
        osc.connect(gain); gain.connect(master);
        osc.start(now+delay); osc.stop(now+delay+0.24);
      });
    };

    if(passAudioCtx.state==="suspended"){
      passAudioCtx.resume().then(play).catch(()=>{});
    }else{
      play();
    }
  }catch(e){}
}

function celebratePass(){
  const canvas=document.createElement("canvas");
  canvas.className="confettiCanvas";
  document.body.appendChild(canvas);
  const ctx=canvas.getContext("2d");
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=window.innerWidth,h=window.innerHeight;
  canvas.width=w*dpr; canvas.height=h*dpr;
  canvas.style.width=w+"px"; canvas.style.height=h+"px";
  ctx.scale(dpr,dpr);
  const colors=["#ff5f57","#ffbd2e","#28c840","#5ac8fa","#af52de","#ff2d55"];
  const pieces=Array.from({length:72},()=>({
    x:w*(0.15+Math.random()*0.7), y:h*0.18+Math.random()*20,
    vx:(Math.random()-.5)*8, vy:-4-Math.random()*7,
    g:.22+Math.random()*.16, r:3+Math.random()*4,
    rot:Math.random()*Math.PI, vr:(Math.random()-.5)*.35,
    c:colors[Math.floor(Math.random()*colors.length)]
  }));
  const start=performance.now();
  function frame(now){
    ctx.clearRect(0,0,w,h);
    for(const p of pieces){
      p.x+=p.vx; p.vy+=p.g; p.y+=p.vy; p.rot+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c;
      ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r); ctx.restore();
    }
    if(now-start<900) requestAnimationFrame(frame); else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function saveCurrentNote(){
  if(!state.current) return;
  const input=document.getElementById("wordNoteInput");
  if(!input) return;
  const text=input.value.trim();
  setWordNote(state.current,text);
  save();
  const details=input.closest('.noteDetails');
  if(details) details.classList.toggle('noteHasContent',!!text);
  autoSizeNote(input);
}
function autoSizeNote(input){
  if(!input) return;
  input.style.height='auto';
  input.style.height=Math.max(48,input.scrollHeight)+'px';
}
let transientToastTimer=null;
let transientToastCountdownTimer=null;
const confirmWindows=new Map();

function clearTransientToastTimers(){
  if(transientToastTimer){
    clearTimeout(transientToastTimer);
    transientToastTimer=null;
  }
  if(transientToastCountdownTimer){
    clearInterval(transientToastCountdownTimer);
    transientToastCountdownTimer=null;
  }
}

function showTransientToast(message){
  let el=document.getElementById("transientToast");
  if(!el){
    el=document.createElement("div");
    el.id="transientToast";
    el.className="transientToast";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
  }
  clearTransientToastTimers();
  el.textContent=message;
  el.classList.remove("show");
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
  transientToastTimer=setTimeout(()=>{
    el.classList.remove("show");
    transientToastTimer=null;
  },5000);
}

function showConfirmToast(message){
  let el=document.getElementById("transientToast");
  if(!el){
    el=document.createElement("div");
    el.id="transientToast";
    el.className="transientToast";
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
  }
  clearTransientToastTimers();

  let remaining=5;
  const render=()=>{el.textContent=`${message}（${remaining} 秒内再次点击确认）`;};
  render();

  el.classList.remove("show");
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));

  transientToastCountdownTimer=setInterval(()=>{
    remaining-=1;
    if(remaining>=1)render();
  },1000);

  transientToastTimer=setTimeout(()=>{
    if(transientToastCountdownTimer){
      clearInterval(transientToastCountdownTimer);
      transientToastCountdownTimer=null;
    }
    el.classList.remove("show");
    transientToastTimer=null;
  },5000);
}

function requireSecondClick(key,message,action){
  const now=Date.now();
  const until=confirmWindows.get(key)||0;
  if(until>now){
    confirmWindows.delete(key);
    action();
    return true;
  }
  confirmWindows.set(key,now+5000);
  showConfirmToast(message);
  setTimeout(()=>{
    if((confirmWindows.get(key)||0)<=Date.now())confirmWindows.delete(key);
  },5100);
  return false;
}

function removeCurrentWord(){
  const w=state.current;
  if(!w)return;
  saveCurrentNote();

  requireSecondClick(
    "remove:"+w,
    `将 “${w}” 删除出学习词库；学习历史和笔记会保留`,
    ()=>{
      armUndo();
      state.removedWords=state.removedWords||{};
      state.removedWords[w]={removedAt:new Date().toISOString()};
      state.queue=(state.queue||[]).filter(x=>String(x).toLowerCase()!==String(w).toLowerCase());

      speechSynthesis.cancel();
      state.current=null;
      revealed=false;
      save();

      updateStats();
      updateAnswerControls();
      showTransientToast(`已删除 “${w}”，可点击撤回恢复`);
      next();
    }
  );
}

function updateStats(){
 const bank=allWords();
 const bankKeys=new Set(bank.map(w=>w.toLowerCase()));
 let m=Object.keys(state.mastered).filter(w=>bankKeys.has(w.toLowerCase())).length;
 let a=Object.entries(state.debts).filter(([w,d])=>Number(d)>0&&bankKeys.has(w.toLowerCase())).length;
 let u=bank.filter(w=>!state.seen[w]).length;
 document.getElementById("mastered").textContent=m;
 document.getElementById("active").textContent=a;
 document.getElementById("unseen").textContent=u;
 const total=Math.max(bank.length,1);
 const masteredPct=Math.max(0,Math.min(100,m/total*100));
 const activePct=Math.max(0,Math.min(100,a/total*100));
 const unseenPct=Math.max(0,100-masteredPct-activePct);

 const masteredSeg=document.getElementById("progressMastered");
 const activeSeg=document.getElementById("progressActive");
 const unseenSeg=document.getElementById("progressUnseen");
 if(masteredSeg) masteredSeg.style.width=masteredPct+"%";
 if(activeSeg) activeSeg.style.width=activePct+"%";
 if(unseenSeg) unseenSeg.style.width=unseenPct+"%";
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function loadVoices(){voices=getPreferredEnglishVoices(); updateVoiceInfo();}
speechSynthesis.onvoiceschanged=loadVoices; loadVoices();

document.getElementById("speak").onclick=()=>{
  started=true;
  if(!state.current){
    speechSynthesis.cancel();
    revealed=false;
    if(state.queueDate!==localDateKey()) refill();
    if(!state.queue.length) refill();
    state.current=popNextEligible();
    if(!state.current){ refill(); state.current=popNextEligible(); }
    if(state.current){
      state.seen[state.current]=true;
      save();
      updateAnswerControls();
      speakCurrent();
    }
  }else{
    speakCurrent();
  }
};
document.getElementById("answer").addEventListener("input",e=>{
  if(e.target && e.target.id==="wordNoteInput") autoSizeNote(e.target);
});
document.getElementById("answer").addEventListener("toggle",e=>{
  if(e.target && e.target.matches && e.target.matches('.noteDetails[open]')) autoSizeNote(e.target.querySelector('.wordNoteInput'));
},true);
document.getElementById("answer").addEventListener("change",e=>{
  if(e.target && e.target.id==="wordNoteInput") saveCurrentNote();
});
document.getElementById("answer").addEventListener("blur",e=>{
  if(e.target && e.target.id==="wordNoteInput") saveCurrentNote();
},true);
document.getElementById("reveal").onclick=()=>{if(state.current)reveal();};
document.getElementById("removeTopBtn").onclick=removeCurrentWord;
document.getElementById("undoBtn").onclick=undoLastJudgment;
document.getElementById("pass").onclick=()=>{if(revealed)pass();};
document.getElementById("again").onclick=()=>{if(revealed)again();};
document.getElementById("voicePrev").onclick=()=>changeVoice(-1);
document.getElementById("voiceNext").onclick=()=>changeVoice(1);
document.getElementById("voicePrevMobile").onclick=()=>changeVoice(-1);
document.getElementById("voiceNextMobile").onclick=()=>changeVoice(1);
function openUtilityPanel(html){
 document.getElementById("panel").innerHTML=html;
 document.getElementById("overlay").style.display="flex";
}

const libraryBtn=document.getElementById("libraryBtn");
if(libraryBtn)libraryBtn.onclick=()=>{
 openUtilityPanel(
   '<div class="utilityPanelHead"><div><h2>词库</h2><div class="sub">查看和管理不同状态的单词</div></div><button class="small" id="utilityClose" type="button">关闭</button></div>'+ 
   '<div class="utilityMenu">'+
    '<a class="utilityMenuItem" href="active.html?v=4.2.0"><span><b>学习中</b><small>需要继续复习的单词 · 钉子户</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="mastered.html?v=4.2.0"><span><b>已掌握</b><small>已经完成当前学习周期的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="confusable.html?v=4.2.0"><span><b>易混词</b><small>查看所有已经建立易混词关联的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="tags.html?v=4.2.0"><span><b>标签</b><small>按自定义标签浏览和管理词汇</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="notes.html?v=4.2.0"><span><b>笔记</b><small>查看所有带笔记的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="removed.html?v=4.2.0"><span><b>已移除</b><small>从学习队列中移出的单词</small></span><i>›</i></a>'+ 
   '</div>'
 );
 const c=document.getElementById("utilityClose");if(c)c.onclick=closePanel;
};

const settingsBtn=document.getElementById("settingsBtn");
if(settingsBtn)settingsBtn.onclick=()=>{
 openUtilityPanel(
   '<div class="utilityPanelHead"><div><h2>设置</h2><div class="sub">同步、导入与本机数据维护</div></div><button class="small" id="utilityClose" type="button">关闭</button></div>'+ 
   '<div class="utilityMenu">'+
    '<button class="utilityMenuItem utilityMenuButton" id="panelSync" type="button"><span><b>GitHub 同步</b><small>检查本机与 GitHub 的学习数据并确认合并</small></span><i>›</i></button>'+
    '<button class="utilityMenuItem utilityMenuButton" id="panelBlockedVoices" type="button"><span><b>管理屏蔽 Voice</b><small>恢复这台设备上被隐藏的 TTS Voice</small></span><i>›</i></button>'+ 
    '<label class="utilityMenuItem utilityMenuButton" for="importWordsFile"><span><b>导入新词表</b><small>支持 TXT 与 CSV</small></span><i>›</i></label>'+ 
   '</div>'+ 
   '<div class="utilityDanger"><button class="utilityDangerButton" id="panelReset" type="button">清空词库</button><div class="sub">清除本机学习进度、自定义词、笔记等本地词库数据；不会直接修改 GitHub。</div></div>'
 );
 const c=document.getElementById("utilityClose");if(c)c.onclick=closePanel;
 const sync=document.getElementById("panelSync");if(sync)sync.onclick=()=>{closePanel();document.getElementById("syncBtn").click();};
 const bv=document.getElementById("panelBlockedVoices");if(bv)bv.onclick=openBlockedVoiceManager;
 const reset=document.getElementById("panelReset");if(reset)reset.onclick=resetProgress;
};

function closePanel(){document.getElementById("overlay").style.display="none"}
document.getElementById("overlay").onclick=e=>{if(e.target.id==="overlay")closePanel()};


updateStats();
updateAnswerControls();


let neutralFeedbackCtx=null;

function getNeutralFeedbackCtx(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!neutralFeedbackCtx)neutralFeedbackCtx=new Ctx();
    return neutralFeedbackCtx;
  }catch(e){return null;}
}

function setFeedbackAudioSession(){
  try{
    if("audioSession" in navigator && navigator.audioSession){
      navigator.audioSession.type="playback";
    }
  }catch(e){}
}

async function unlockFeedbackAudio(){
  setFeedbackAudioSession();
  const ctx=getNeutralFeedbackCtx();
  if(!ctx)return null;
  try{
    if(ctx.state!=="running")await ctx.resume();
    // A silent buffer inside a real user gesture reliably unlocks Web Audio on iOS/WebKit.
    const b=ctx.createBuffer(1,1,22050);
    const s=ctx.createBufferSource();
    s.buffer=b;s.connect(ctx.destination);s.start();
  }catch(e){}
  return ctx;
}

function crystalTone(ctx,freq,start,dur,peak){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";
  o.frequency.setValueAtTime(freq,start);
  g.gain.setValueAtTime(.0001,start);
  g.gain.exponentialRampToValueAtTime(peak,start+.008);
  g.gain.exponentialRampToValueAtTime(Math.max(peak*.28,.0002),start+dur*.36);
  g.gain.exponentialRampToValueAtTime(.0001,start+dur);
  o.connect(g);g.connect(ctx.destination);
  o.start(start);o.stop(start+dur+.03);
}

async function playAgainSound(){
  try{
    const ctx=await unlockFeedbackAudio();
    if(!ctx||ctx.state!=="running")return;

    const scale=[523.25,587.33,659.25,698.46,783.99,880,987.77];
    const f=scale[Math.floor(Math.random()*scale.length)];
    const now=ctx.currentTime+.025;

    // Crystal-like main strike.
    crystalTone(ctx,f,now,.42,.065);
    crystalTone(ctx,f*2.01,now,.16,.018);
    crystalTone(ctx,f*3.02,now+.01,.11,.010);

    // A small randomized consonant musical tail.
    const tails=[1.5,1.25,4/3,2];
    const ratio=tails[Math.floor(Math.random()*tails.length)];
    crystalTone(ctx,f*ratio,now+.12,.34,.025);
    crystalTone(ctx,f*2,now+.19,.24,.012);
  }catch(e){}
}
function playMasteredSound(){
  try{
    const ctx=getNeutralFeedbackCtx(); if(!ctx) return;
    const now=ctx.currentTime+0.01;
    [[659.25,0,.16],[783.99,.09,.17],[987.77,.18,.18],[1318.51,.29,.27]].forEach(([f,d,dur])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine"; o.frequency.setValueAtTime(f,now+d);
      g.gain.setValueAtTime(.0001,now+d);
      g.gain.exponentialRampToValueAtTime(.09,now+d+.012);
      g.gain.exponentialRampToValueAtTime(.0001,now+d+dur);
      o.connect(g); g.connect(ctx.destination); o.start(now+d); o.stop(now+d+dur+.03);
    });
  }catch(e){}
}
let wordDissolveParticles=[];
let wordDissolveRaf=0;
let wordDissolveTemplate=null;
let wordDissolveCanvasSize={w:0,h:0,dpr:0};
const AGAIN_DISSOLVE_MS=1050;

function resetWordDissolve(){
  wordDissolveParticles=[];
  wordDissolveTemplate=null;
  if(wordDissolveRaf){
    cancelAnimationFrame(wordDissolveRaf);
    wordDissolveRaf=0;
  }

  const a=document.getElementById("answer");
  if(a){
    const w=a.querySelector(".word");
    if(w){w.style.opacity="1";w.classList.remove("wordDissolving");}
  }

  const c=document.getElementById("wordDissolveFx");
  if(c){
    const x=c.getContext("2d");
    if(x)x.clearRect(0,0,c.width,c.height);
  }
}

function ensureWordDissolveCanvas(canvas){
  // Cap render DPR on high-density phones: visually indistinguishable here,
  // but substantially cheaper during rapid repeated bursts.
  const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const cssW=window.innerWidth;
  const cssH=window.innerHeight;
  const pxW=Math.max(1,Math.round(cssW*dpr));
  const pxH=Math.max(1,Math.round(cssH*dpr));

  if(
    wordDissolveCanvasSize.w!==pxW ||
    wordDissolveCanvasSize.h!==pxH ||
    wordDissolveCanvasSize.dpr!==dpr
  ){
    canvas.width=pxW;
    canvas.height=pxH;
    canvas.style.width=cssW+"px";
    canvas.style.height=cssH+"px";
    wordDissolveCanvasSize={w:pxW,h:pxH,dpr};
  }

  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,dpr,cssW,cssH};
}

function buildWordDissolveTemplate(wordEl){
  const wr=wordEl.getBoundingClientRect();
  const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const w=Math.max(1,Math.ceil(wr.width));
  const h=Math.max(1,Math.ceil(wr.height));

  const off=document.createElement("canvas");
  off.width=Math.ceil(w*dpr);
  off.height=Math.ceil(h*dpr);
  const o=off.getContext("2d",{willReadFrequently:true});
  o.scale(dpr,dpr);

  const cs=getComputedStyle(wordEl);
  o.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  o.fillStyle=cs.color||"#222";
  o.textAlign="center";
  o.textBaseline="middle";
  o.fillText(wordEl.textContent,w/2,h/2);

  const image=o.getImageData(0,0,off.width,off.height);
  const data=image.data;
  const points=[];

  // Slightly coarser than v3.26 because the same cached shape can now burst repeatedly.
  // The final visual remains fine-grained because each point becomes a very small particle.
  const step=Math.max(2,Math.round(2.2*dpr));
  for(let py=0;py<off.height;py+=step){
    for(let px=0;px<off.width;px+=step){
      const i=(py*off.width+px)*4;
      if(data[i+3]>55){
        points.push({x:px/dpr,y:py/dpr});
      }
    }
  }

  wordDissolveTemplate={
    word:wordEl.textContent,
    left:wr.left,
    top:wr.top,
    points
  };
  return wordDissolveTemplate;
}

function isWordDissolveActive(){
  return wordDissolveParticles.some(p=>p.life>0);
}

function runWordDissolveLoop(){
  if(wordDissolveRaf)return;

  const canvas=document.getElementById("wordDissolveFx");
  if(!canvas)return;
  const {ctx,cssW,cssH}=ensureWordDissolveCanvas(canvas);

  function frame(){
    wordDissolveRaf=0;
    ctx.clearRect(0,0,cssW,cssH);

    let write=0;
    for(let i=0;i<wordDissolveParticles.length;i++){
      const p=wordDissolveParticles[i];
      p.x+=p.vx;
      p.y+=p.vy;
      p.vx*=.995;
      p.vy-=.001;
      p.life-=p.fade;
      if(p.life<=0)continue;

      wordDissolveParticles[write++]=p;
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle="rgb(55,60,67)";
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }
    wordDissolveParticles.length=write;
    ctx.globalAlpha=1;

    if(wordDissolveParticles.length){
      wordDissolveRaf=requestAnimationFrame(frame);
    }else{
      ctx.clearRect(0,0,cssW,cssH);
    }
  }

  wordDissolveRaf=requestAnimationFrame(frame);
}

function dissolveCurrentWord(){
  const answer=document.getElementById("answer");
  const wordEl=answer&&answer.querySelector(".word");
  const canvas=document.getElementById("wordDissolveFx");
  if(!wordEl||!canvas||!wordEl.textContent.trim())return 0;

  ensureWordDissolveCanvas(canvas);

  let template=wordDissolveTemplate;
  if(!template || template.word!==wordEl.textContent){
    template=buildWordDissolveTemplate(wordEl);
  }
  if(!template || !template.points.length)return 0;

  // Hide the real word immediately on the first tap. Later taps reuse its cached
  // silhouette, so every rapid tap can launch a fresh particle burst instantly.
  wordEl.classList.add("wordDissolving");
  wordEl.style.opacity="0";

  const mobile=window.matchMedia&&window.matchMedia("(max-width: 500px)").matches;
  const perBurstCap=mobile?560:820;
  const totalCap=mobile?1800:2800;
  const points=template.points;
  const stride=Math.max(1,Math.floor(points.length/perBurstCap));
  const offset=Math.floor(Math.random()*stride);
  let added=0;

  for(let i=offset;i<points.length && added<perBurstCap;i+=stride){
    if(Math.random()>.86)continue;
    const pt=points[i];
    const angle=Math.random()*Math.PI*2;
    const speed=.7+Math.random()*2.45;

    wordDissolveParticles.push({
      x:template.left+pt.x,
      y:template.top+pt.y,
      vx:Math.cos(angle)*speed+.24,
      vy:Math.sin(angle)*speed-.18,
      r:.34+Math.random()*.72,
      life:1,
      fade:.010+Math.random()*.009
    });
    added++;
  }

  // Bound accumulated work during "stress-clicking": keep the newest particles,
  // which are also the most visually salient ones.
  if(wordDissolveParticles.length>totalCap){
    wordDissolveParticles.splice(0,wordDissolveParticles.length-totalCap);
  }

  runWordDissolveLoop();
  return AGAIN_DISSOLVE_MS;
}

function celebrateAgain(){
  try{
    return dissolveCurrentWord();
  }catch(e){
    console.warn("AGAIN dissolve skipped:",e);
    return 0;
  }
}

function celebrateMastered(){
  const card=document.querySelector(".card"); if(!card) return;
  card.classList.remove("masteredGlow"); void card.offsetWidth; card.classList.add("masteredGlow");
  setTimeout(()=>card.classList.remove("masteredGlow"),900);
}
function debtVisualClass(d){
  d=Number(d)||1;
  return d>=7?"debtExtreme":d>=4?"debtHigh":d>=2?"debtMid":"debtLow";
}
function styleDebtBadge(d){
  const badge=document.querySelector(".debtBadge"); if(!badge) return;
  badge.classList.remove("debtLow","debtMid","debtHigh","debtExtreme");
  badge.classList.add(debtVisualClass(d));
  if(Number(d)>=7 && !badge.textContent.includes("🔥")) badge.textContent="🔥 "+badge.textContent;
}


setFeedbackAudioSession();
function installFeedbackAudioUnlock(){
  const unlock=()=>{unlockFeedbackAudio();};
  ["pointerdown","touchstart","click"].forEach(type=>{
    document.addEventListener(type,unlock,{once:true,passive:true});
  });
}
installFeedbackAudioUnlock();







function installMoreToolsOutsideClose(){
  const details=document.querySelector("details.moreTools");
  if(!details)return;

  document.addEventListener("pointerdown",(e)=>{
    if(details.open && !details.contains(e.target)){
      details.open=false;
    }
  },true);
}
installMoreToolsOutsideClose();
