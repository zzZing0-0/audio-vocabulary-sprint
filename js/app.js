
function getPreferredEnglishVoices(){
  const all=speechSynthesis.getVoices();
  const english=all.filter(v => /^en([-_]|$)/i.test(v.lang || ""));
  if(!english.length) return all;
  const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;
  const preferred=english.filter(v => !novelty.test(v.name || ""));
  return preferred.length>=2 ? preferred : english;
}

let voices=[], revealed=false, started=false;

let pronunciationWords={};
let pronunciationLoadFinished=false;

function pronunciationHtml(word){
  const key=String(word||"").toLowerCase();
  const item=(state.customPronunciations&&state.customPronunciations[key]) || pronunciationWords[key];
  if(!item)return "";

  // Prefer explicitly region-labelled IPA. Show generic fallback only when
  // neither regional label exists; never guess a UK/US label.
  const parts=[];
  if(item.uk) parts.push('<span class="ipaChip ipaUk" title="UK" dir="ltr" lang="en">'+escapeHtml(item.uk)+'</span>');
  if(item.us) parts.push('<span class="ipaChip ipaUs" title="US" dir="ltr" lang="en">'+escapeHtml(item.us)+'</span>');
  if(!parts.length && item.fallback) parts.push('<span class="ipaChip ipaGeneric" title="IPA" dir="ltr" lang="en">'+escapeHtml(item.fallback)+'</span>');
  if(!parts.length)return "";

  return '<div class="ipaLine">'+parts.join('')+'</div>';
}

function refreshCurrentPronunciation(){
  if(!revealed || !state.current)return;
  const slot=document.getElementById("pronunciationSlot");
  if(slot) slot.innerHTML=pronunciationHtml(state.current);
}

async function loadPronunciations(){
  try{
    const r=await fetch("data/pronunciations.json?v=3.31.3",{cache:"no-cache"});
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
  el.textContent=v ? "Voice: "+v.name : "";
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
function linkedWordsHtml(word){
  const linked=getLinkedWords(word);
  const chips=linked.map(w=>
    '<span class="confusableChip"><button class="confusableSpeak" type="button" data-confusable-speak="'+escapeHtml(w)+'" aria-label="播放 '+escapeHtml(w)+'">🔊</button><a href="lookup.html?word='+encodeURIComponent(w)+'">'+escapeHtml(w)+'</a></span>'
  ).join('');
  return '<section class="confusableSection"><div class="confusableHead"><span>易混词</span><button class="confusableManageBtn" id="manageConfusables" type="button">管理易混词</button></div>'+
    (chips?'<div class="confusableList">'+chips+'</div>':'<div class="confusableEmpty">还没有链接易混词</div>')+
    '<div class="confusableManager" id="confusableManager" hidden></div></section>';
}
function bindConfusableControls(){
  document.querySelectorAll('[data-confusable-speak]').forEach(btn=>btn.onclick=()=>speakText(btn.dataset.confusableSpeak));
  const manage=document.getElementById('manageConfusables');
  if(manage)manage.onclick=()=>{
    const box=document.getElementById('confusableManager');
    box.hidden=!box.hidden;
    if(!box.hidden)renderConfusableManager();
  };
}
function renderConfusableManager(message=''){
  const box=document.getElementById('confusableManager');
  if(!box||!state.current)return;
  const linked=getLinkedWords(state.current);
  box.innerHTML='<div class="confusableCount">'+linked.length+' / 3</div>'+
    linked.map(w=>'<div class="confusableManageRow"><span>'+escapeHtml(w)+'</span><div><button class="miniBtn" type="button" data-manage-speak="'+escapeHtml(w)+'">🔊</button><button class="miniBtn confusableRemove" type="button" data-unlink="'+escapeHtml(w)+'">移除</button></div></div>').join('')+
    '<div class="confusableAddRow"><input id="confusableInput" class="lookupInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入易混词或词组"><button class="miniBtn" id="confusableAdd" type="button"'+(linked.length>=3?' disabled':'')+'>添加</button></div>'+
    (linked.length>=3?'<div class="confusableMessage">已达到 3 个上限，可先移除一个再添加。</div>':'')+
    (message?'<div class="confusableMessage">'+escapeHtml(message)+'</div>':'');
  box.querySelectorAll('[data-manage-speak]').forEach(btn=>btn.onclick=()=>speakText(btn.dataset.manageSpeak));
  box.querySelectorAll('[data-unlink]').forEach(btn=>btn.onclick=()=>{unlinkWords(state.current,btn.dataset.unlink);save();refreshConfusableSection(true);});
  const add=document.getElementById('confusableAdd'),input=document.getElementById('confusableInput');
  if(add)add.onclick=()=>addConfusable(input.value);
  if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addConfusable(input.value);}};
}
function refreshConfusableSection(keepManager=false){
  const old=document.querySelector('.confusableSection');
  if(!old||!state.current)return;
  const wrap=document.createElement('div');wrap.innerHTML=linkedWordsHtml(state.current);
  old.replaceWith(wrap.firstElementChild);bindConfusableControls();
  if(keepManager){const box=document.getElementById('confusableManager');box.hidden=false;renderConfusableManager();}
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
  save();refreshConfusableSection(true);
}

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
    '</div>'+
    '<div class="word">'+escapeHtml(state.current)+'</div>'+
    '<div id="pronunciationSlot">'+pronunciationHtml(state.current)+'</div>'+
    '<div class="note" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+
      '<a href="https://www.oxfordlearnersdictionaries.com/definition/english/'+encodeURIComponent(state.current.toLowerCase().replace(/\s+/g,"-"))+'" target="vocabLookup" style="color:#666;text-decoration:none">📖 Oxford 英英</a>'+
      '<a href="'+youdaoHref+'" target="vocabLookup" style="color:#666;text-decoration:none">📘 有道英中</a>'+
      '<a href="https://youglish.com/pronounce/'+encodeURIComponent(state.current)+'/english" target="vocabLookup" style="color:#666;text-decoration:none">🎧 YouGlish 语境</a>'+
      '<a href="https://www.playphrase.me/#/search?q='+encodeURIComponent(state.current)+'" target="vocabLookup" style="color:#666;text-decoration:none">🎬 PlayPhrase 影视</a>'+
      '<a href="https://www.rhymezone.com/r/rhyme.cgi?Word='+encodeURIComponent(state.current)+'&typeofrhyme=sim" target="vocabLookup" style="color:#666;text-decoration:none">🔎 RhymeZone 近音</a>'+
    '</div>'+
    linkedWordsHtml(state.current)+
    '<details class="wordNoteWrap noteDetails"'+(state.notes[state.current]?' open':'')+'>'+
      '<summary>笔记</summary>'+
      '<input id="wordNoteInput" class="wordNoteInput" type="text" placeholder="例如：容易和另一个词混；重音容易记错" value="'+escapeHtml(state.notes[state.current]||'')+'">'+
    '</details>';

  bindConfusableControls();

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
  if(text) state.notes[state.current]=text;
  else delete state.notes[state.current];
  save();
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
document.getElementById("info").onclick=()=>{
 document.getElementById("panel").innerHTML=
   '<h2>规则 / 进度</h2>'+
   '<div class="listLinks infoPrimaryLinks"><a class="miniBtn linkBtn" href="active.html">⚠️ 查看钉子户</a><a class="miniBtn linkBtn" href="notes.html">📝 查看笔记</a><a class="miniBtn linkBtn" href="mastered.html">✅️ 查看已掌握</a><a class="miniBtn linkBtn" href="removed.html">❌ 查看已移除</a></div>'+
   '<p>每个新词首次出现时默认 debt = 1。通过：debt −1；再来一次：debt +1。debt 到 0 后进入已掌握。因此首次通过直接清零；首次再来一次会变成 debt = 2。</p>'+
   '<p>学习中单词每个自然日最多考核一次：再来一次后当天退场；若 debt &gt; 1，通过后也当天退场，下一次最早在下一个自然日出现。</p>'+
   '<p><b>peak</b>：记录一个词历史上达到过的最高 debt；进入已掌握后仍保存在学习 state 中，并随 GitHub progress.json 一起同步。</p>'+
   '<p><b>自定义词库</b>：支持 TXT（一行一个词条）和 CSV。欧路词典 CSV 的“单词 / 音标”会同时导入；音标随 GitHub progress.json 私有同步，并优先于内置 Wiktionary 音标。</p><p><b>重复导入</b>：未学习词不增加 debt；学习中词 debt +1；已掌握词重新激活为 debt = 1。同一文件内的重复行只处理一次。</p><p><b>已移除</b>：移出词库只会把单词排除出学习队列，不删除既有 debt / 已掌握 / 笔记 历史；可随时恢复。</p>'+
   '<div class="resetBottom"><button class="miniBtn linkBtn dangerLite resetEntry" id="panelReset" type="button">🔄 重置进度</button></div>'+
   '<button class="action" style="margin-top:18px;width:100%" onclick="closePanel()">关闭</button>';
 document.getElementById("overlay").style.display="flex";
 const panelReset=document.getElementById("panelReset");
 if(panelReset)panelReset.onclick=resetProgress;
};

function closePanel(){document.getElementById("overlay").style.display="none"}
document.getElementById("overlay").onclick=e=>{if(e.target.id==="overlay")closePanel()};
function resetProgress(){
 requireSecondClick(
   "reset-local",
   "将重置进度学习进度；不会修改 GitHub 云端，但之后上传会覆盖云端",
   ()=>{
     localStorage.removeItem(KEY);
     state={debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],customPronunciations:{},notes:{},linkedWords:{},removedWords:{},dailyStats:{},historyLinks:{},statsStartDate:localDateKey(),current:null,queue:BASE_WORDS.slice(),queueDate:null,voiceIndex:state.voiceIndex||0};
     shuffle(state.queue);
     localStorage.setItem("audio_vocab_sprint_just_reset","1");
     save();
     speechSynthesis.cancel();
     revealed=false; started=false;
     document.getElementById("answer").innerHTML="";
     document.getElementById("hint").textContent="";
     updateStats();
     updateAnswerControls();
     showTransientToast("本机学习进度已重置；此时上传会覆盖 GitHub 云端进度");
   }
 );
}

async function exportProgress(){
  const payload = {
    app: "Audio Vocabulary Sprint",
    version: 3,
    exportedAt: new Date().toISOString(),
    totalWords: allWords().length,
    state: state
  };
  const stamp = new Date().toISOString().slice(0,10);
  const filename = "Audio_Vocabulary_Sprint_progress_"+stamp+".json";
  const json = JSON.stringify(payload,null,2);
  const blob = new Blob([json], {type:"application/json"});

  // iPhone/iPad Safari: Share Sheet lets the user save the JSON directly to Files.
  try{
    if(typeof File !== "undefined" && navigator.share && navigator.canShare){
      const file = new File([blob], filename, {type:"application/json"});
      if(navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:"Audio Vocabulary Sprint Progress"
        });
        return;
      }
    }
  }catch(e){
    // User cancelling the share sheet is harmless; fall through only for real failures.
    if(e && e.name === "AbortError") return;
  }

  // Desktop / browsers without file sharing.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importProgress(file){
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    const incoming = payload && payload.state ? payload.state : payload;
    if(!incoming || typeof incoming!=="object" || !incoming.debts || !incoming.mastered || !incoming.seen){
      throw new Error("Invalid progress file");
    }
    state = {
      debts: incoming.debts || {},
      mastered: incoming.mastered || {},
      seen: incoming.seen || {},
      highestDebt: incoming.highestDebt || {},
      lastReviewedDate: incoming.lastReviewedDate || {},
      customWords: Array.isArray(incoming.customWords) ? incoming.customWords : [],
      customPronunciations: (incoming.customPronunciations && typeof incoming.customPronunciations === "object" && !Array.isArray(incoming.customPronunciations)) ? incoming.customPronunciations : {},
      notes: (incoming.notes && typeof incoming.notes === "object") ? incoming.notes : {},
      linkedWords: (incoming.linkedWords && typeof incoming.linkedWords === "object" && !Array.isArray(incoming.linkedWords)) ? incoming.linkedWords : {},
      removedWords: (incoming.removedWords && typeof incoming.removedWords === "object" && !Array.isArray(incoming.removedWords)) ? incoming.removedWords : {},
      current: incoming.current || null,
      queue: Array.isArray(incoming.queue) ? incoming.queue : [],
      queueDate: (typeof incoming.queueDate === "string") ? incoming.queueDate : null,
      voiceIndex: incoming.voiceIndex || 0
    };
    for (const [w,d] of Object.entries(state.debts)) {
      state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
    }
    save();
    speechSynthesis.cancel();
    revealed=false; started=false;
    document.getElementById("answer").innerHTML="";
    document.getElementById("hint").textContent="进度已导入。点击喇叭继续。";
    updateAnswerControls();
    showTransientToast("进度导入成功");
  }catch(e){
    showTransientToast("导入失败：这不是有效的进度文件");
  }
}

function normalizeImportedEntries(entries){
  const stop=new Set(["a","an","the"]);
  const seen=new Map();
  const out=[];
  let blank=0, header=0, stopword=0, chinese=0, duplicateInFile=0;

  (entries||[]).forEach(entry=>{
    const w=String((entry&&entry.word)||"").trim();
    if(!w){blank++;return;}
    if(w.toLowerCase()==="vc_vocabulary"){header++;return;}
    if(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(w)){chinese++;return;}

    const key=w.toLowerCase();
    if(stop.has(key)){stopword++;return;}
    if(seen.has(key)){
      duplicateInFile++;
      // Same-file duplicates never stack debt. If the first row had no IPA but a
      // later duplicate does, keep the richer pronunciation metadata.
      const existing=seen.get(key);
      if(!existing.pronunciation && entry.pronunciation) existing.pronunciation=entry.pronunciation;
      return;
    }

    const clean={word:w,pronunciation:entry&&entry.pronunciation?entry.pronunciation:null};
    seen.set(key,clean);
    out.push(clean);
  });

  return {entries:out,skipped:{blank,header,stopword,chinese,duplicateInFile}};
}

function parseTxtVocabulary(text){
  return normalizeImportedEntries(
    String(text||"").split(/\r?\n/).map(line=>({word:line,pronunciation:null}))
  );
}

function parseCsvRows(text){
  const rows=[];
  let row=[],field="",quoted=false;
  const src=String(text||"").replace(/^\uFEFF/,"");
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quoted){
      if(ch==='"' && src[i+1]==='"'){field+='"';i++;}
      else if(ch==='"'){quoted=false;}
      else field+=ch;
    }else{
      if(ch==='"') quoted=true;
      else if(ch===','){row.push(field);field="";}
      else if(ch==='\n'){
        row.push(field);rows.push(row);row=[];field="";
      }else if(ch!=='\r') field+=ch;
    }
  }
  if(field!==""||row.length){row.push(field);rows.push(row);}
  return rows;
}

function parseEudicPronunciation(raw){
  const text=String(raw||"").trim();
  if(!text)return null;
  const ukMatch=text.match(/英\s*[:：]\s*(.+?)(?=\s*美\s*[:：]|$)/);
  const usMatch=text.match(/美\s*[:：]\s*(.+)$/);
  const uk=ukMatch?ukMatch[1].trim():null;
  const us=usMatch?usMatch[1].trim():null;
  let fallback=null;
  if(!uk&&!us) fallback=text;
  if(!uk&&!us&&!fallback)return null;
  return {uk:uk||null,us:us||null,fallback:fallback||null,source:"eudic"};
}

function parseCsvVocabulary(text){
  const rows=parseCsvRows(text).filter(r=>r.some(cell=>String(cell||"").trim()!==""));
  if(!rows.length) return normalizeImportedEntries([]);

  const headers=rows[0].map(x=>String(x||"").trim().toLowerCase());
  const wordHeaders=new Set(["单词","word","words","词条","term"]);
  const ipaHeaders=new Set(["音标","ipa","pronunciation","phonetic"]);
  const wordIndex=headers.findIndex(h=>wordHeaders.has(h));
  const ipaIndex=headers.findIndex(h=>ipaHeaders.has(h));
  if(wordIndex<0) throw new Error("CSV 找不到“单词”列");

  const entries=rows.slice(1).map(r=>({
    word:String(r[wordIndex]||"").trim(),
    pronunciation:ipaIndex>=0?parseEudicPronunciation(r[ipaIndex]):null
  }));
  return normalizeImportedEntries(entries);
}

function findStateKeyCaseInsensitive(obj,lowerKey){
  return Object.keys(obj||{}).find(k=>String(k).toLowerCase()===lowerKey)||null;
}

document.getElementById("importWordsFile").onchange=(ev)=>{
  const file=ev.target.files&&ev.target.files[0];
  if(!file)return;

  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const text=String(reader.result||"");
      const isCsv=/\.csv$/i.test(file.name||"") || /csv/i.test(file.type||"");
      const normalized=isCsv?parseCsvVocabulary(text):parseTxtVocabulary(text);
      const imported=normalized.entries;
      const baseSet=new Set(BASE_WORDS.map(w=>String(w).toLowerCase()));
      const customSet=new Set((state.customWords||[]).map(w=>String(w).toLowerCase()));
      state.customPronunciations=(state.customPronunciations&&typeof state.customPronunciations==="object")?state.customPronunciations:{};

      let added=0;
      let unseenDuplicate=0;
      let activeRaised=0;
      let masteredReactivated=0;
      let ipaImported=0;

      imported.forEach(entry=>{
        const w=entry.word;
        const k=w.toLowerCase();
        const alreadyExists=baseSet.has(k)||customSet.has(k);

        // Eudic/CSV pronunciation belongs to the learner's private state and overrides
        // the static Wiktionary database for this word on every synced device.
        if(entry.pronunciation){
          state.customPronunciations[k]=entry.pronunciation;
          ipaImported++;
        }

        // New vocabulary entry: add it, but importing is not a learning failure.
        if(!alreadyExists){
          state.customWords.push(w);
          customSet.add(k);
          added++;
          return;
        }

        const masteredKey=findStateKeyCaseInsensitive(state.mastered,k);
        const debtKey=findStateKeyCaseInsensitive(state.debts,k);
        const seenKey=findStateKeyCaseInsensitive(state.seen,k);
        const reviewKey=findStateKeyCaseInsensitive(state.lastReviewedDate,k);
        const hasLearningHistory=Boolean(masteredKey||debtKey||seenKey||reviewKey);

        // Existing but never studied: keep it Unseen. Import overlap alone is not failure.
        if(!hasLearningHistory){
          unseenDuplicate++;
          return;
        }

        // Mastered + re-imported => reactivate at debt 1.
        if(masteredKey){
          delete state.mastered[masteredKey];
          const canonical=debtKey||masteredKey||w;
          state.debts[canonical]=1;
          state.highestDebt[canonical]=Math.max(state.highestDebt[canonical]||0,1);
          delete state.lastReviewedDate[canonical];
          masteredReactivated++;
          return;
        }

        // Active + re-imported => debt +1.
        if(debtKey){
          const oldDebt=Math.max(1,Number(state.debts[debtKey])||1);
          state.debts[debtKey]=oldDebt+1;
          state.highestDebt[debtKey]=Math.max(state.highestDebt[debtKey]||0,oldDebt+1);
          delete state.lastReviewedDate[debtKey];
          activeRaised++;
          return;
        }

        unseenDuplicate++;
      });

      state.queue=[];
      state.queueDate=null;
      refill();
      save();
      updateStats();
      refreshCurrentPronunciation();

      const invalid=normalized.skipped.chinese+normalized.skipped.stopword+normalized.skipped.header;
      showTransientToast(
        (isCsv?"CSV":"TXT")+" 导入完成：有效 "+imported.length+
        "｜新增 "+added+
        "｜未学习重复 "+unseenDuplicate+
        "｜学习中 debt+1 "+activeRaised+
        "｜重新激活 "+masteredReactivated+
        (isCsv?"｜导入 IPA "+ipaImported:"")+
        "｜跳过无效 "+invalid+
        (normalized.skipped.duplicateInFile?"｜文件内重复 "+normalized.skipped.duplicateInFile:"")
      );
    }catch(e){
      showTransientToast("词表导入失败："+e.message);
    }finally{
      ev.target.value="";
    }
  };
  reader.readAsText(file,"utf-8");
};


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
