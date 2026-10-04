
function getPreferredEnglishVoices(){
  const all=speechSynthesis.getVoices();
  const english=all.filter(v => /^en([-_]|$)/i.test(v.lang || ""));
  if(!english.length) return filterBlockedVoices(all);
  const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;
  const preferred=english.filter(v => !novelty.test(v.name || ""));
  return filterBlockedVoices(preferred.length>=2 ? preferred : english);
}

let voices=[], revealed=false, started=false;
initPronunciationUi();












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
    '<a class="utilityMenuItem" href="active.html?v=4.3.0"><span><b>学习中</b><small>需要继续复习的单词 · 钉子户</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="mastered.html?v=4.3.0"><span><b>已掌握</b><small>已经完成当前学习周期的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="confusable.html?v=4.3.0"><span><b>易混词</b><small>查看所有已经建立易混词关联的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="tags.html?v=4.3.0"><span><b>标签</b><small>按自定义标签浏览和管理词汇</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="notes.html?v=4.3.0"><span><b>笔记</b><small>查看所有带笔记的单词</small></span><i>›</i></a>'+ 
    '<a class="utilityMenuItem" href="removed.html?v=4.3.0"><span><b>已移除</b><small>从学习队列中移出的单词</small></span><i>›</i></a>'+ 
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
