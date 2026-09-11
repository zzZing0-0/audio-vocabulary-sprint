
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
  const item=pronunciationWords[String(word||"").toLowerCase()];
  if(!item)return "";

  // Prefer explicitly region-labelled IPA. Show generic fallback only when
  // neither regional label exists; never guess a UK/US label.
  const parts=[];
  if(item.uk) parts.push('<span class="ipaChip ipaUk" title="UK">'+escapeHtml(item.uk)+'</span>');
  if(item.us) parts.push('<span class="ipaChip ipaUs" title="US">'+escapeHtml(item.us)+'</span>');
  if(!parts.length && item.fallback) parts.push('<span class="ipaChip ipaGeneric" title="IPA">'+escapeHtml(item.fallback)+'</span>');
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
    const r=await fetch("data/pronunciations.json?v=3.19",{cache:"no-cache"});
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
  const removeBtn=document.getElementById("removeTopBtn");
  const undoBtn=document.getElementById("undoBtn");

  const hasWord=!!state.current;
  const undoAvailable=!!(undoBtn && !undoBtn.disabled);

  if(revealBox) revealBox.hidden=revealed;
  if(judgeBox) judgeBox.hidden=!revealed;
  if(revealBtn) revealBtn.disabled=!hasWord;
  if(removeBtn) removeBtn.hidden=!(hasWord&&revealed);

  if(undoBtn) undoBtn.hidden=!undoAvailable;

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
function reveal(){
  if(!state.current)return;
  revealed=true;
  updateAnswerControls();
  let d=state.debts[state.current]||1;
  const youdaoHref=(window.matchMedia&&window.matchMedia("(max-width: 700px)").matches)
    ? "https://m.youdao.com/dict?le=eng&q="+encodeURIComponent(state.current)
    : "https://dict.youdao.com/w/eng/"+encodeURIComponent(state.current);
  document.getElementById("answer").innerHTML=
    '<div class="debtBadge">debt '+d+(state.debts[state.current]?'':' · 首次出现')+'</div>'+
    '<div class="word">'+escapeHtml(state.current)+'</div>'+
    '<div id="pronunciationSlot">'+pronunciationHtml(state.current)+'</div>'+
    '<div class="note" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+
      '<a href="https://www.oxfordlearnersdictionaries.com/definition/english/'+encodeURIComponent(state.current.toLowerCase().replace(/\s+/g,"-"))+'" target="vocabLookup" style="color:#666;text-decoration:none">📖 Oxford 英英</a>'+
      '<a href="'+youdaoHref+'" target="vocabLookup" style="color:#666;text-decoration:none">📘 有道英中</a>'+
      '<a href="https://youglish.com/pronounce/'+encodeURIComponent(state.current)+'/english" target="vocabLookup" style="color:#666;text-decoration:none">🎧 YouGlish 语境</a>'+
      '<a href="https://www.playphrase.me/#/search?q='+encodeURIComponent(state.current)+'" target="vocabLookup" style="color:#666;text-decoration:none">🎬 PlayPhrase 影视</a>'+
      '<a href="https://www.rhymezone.com/r/rhyme.cgi?Word='+encodeURIComponent(state.current)+'&typeofrhyme=sim" target="vocabLookup" style="color:#666;text-decoration:none">🔎 RhymeZone 近音</a>'+
    '</div>'+
    '<details class="wordNoteWrap noteDetails"'+(state.notes[state.current]?' open':'')+'>'+
      '<summary>笔记</summary>'+
      '<input id="wordNoteInput" class="wordNoteInput" type="text" placeholder="例如：容易和另一个词混；重音容易记错" value="'+escapeHtml(state.notes[state.current]||'')+'">'+
    '</details>';

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
 const pct=m/Math.max(bank.length,1)*100;
 const boundedPct=Math.max(0,Math.min(100,pct));
 const bar=document.getElementById("bar");
 if(bar){
   bar.style.width="100%";
   bar.style.clipPath=`inset(0 ${100-boundedPct}% 0 0 round 999px)`;
 }
 const flag=document.getElementById("progressFlag");
 if(flag){flag.style.left=boundedPct+"%";flag.title=Math.round(pct)+"%";}
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
document.getElementById("info").onclick=()=>{
 document.getElementById("panel").innerHTML=
   '<h2>规则</h2>'+
   '<p>每个新词首次出现时默认 debt = 1。通过：debt −1；再来一次：debt +1。debt 到 0 后进入已掌握。因此首次通过直接清零；首次再来一次会变成 debt = 2。</p>'+
   '<p>学习中单词每个自然日最多考核一次：再来一次后当天退场；若 debt &gt; 1，通过后也当天退场，下一次最早在下一个自然日出现。</p>'+
   '<p><b>peak</b>：记录一个词历史上达到过的最高 debt；进入已掌握后仍保存在学习 state 中，并随 GitHub progress.json 一起同步。</p>'+
   '<p><b>自定义词库</b>：导入的新词会永久写入学习 state，并随 GitHub progress.json 同步；不会只临时塞进 queue。</p><p><b>已移除</b>：移出词库只会把单词排除出学习队列，不删除既有 debt / 已掌握 / 笔记 历史；可随时恢复。</p>'+
   '<div class="listLinks"><a class="miniBtn linkBtn" href="active.html">⚠️ 查看钉子户</a><a class="miniBtn linkBtn" href="mastered.html">✅️ 查看已掌握</a><a class="miniBtn linkBtn" href="removed.html">❌ 查看已移除</a></div>'+
   '<button class="action" style="margin-top:18px;width:100%" onclick="closePanel()">关闭</button>';
 document.getElementById("overlay").style.display="flex";
};

function closePanel(){document.getElementById("overlay").style.display="none"}
document.getElementById("overlay").onclick=e=>{if(e.target.id==="overlay")closePanel()};
document.getElementById("reset").onclick=()=>{
 requireSecondClick(
   "reset-local",
   "将重置本机学习进度；不会修改 GitHub 云端，但之后上传会覆盖云端",
   ()=>{
     localStorage.removeItem(KEY);
     state={debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],notes:{},removedWords:{},current:null,queue:BASE_WORDS.slice(),queueDate:null,voiceIndex:state.voiceIndex||0};
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
};

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
      notes: (incoming.notes && typeof incoming.notes === "object") ? incoming.notes : {},
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

function normalizeImportedWords(text){
  const stop = new Set(["a","an","the"]);
  const seen = new Set();
  const words = [];
  text.split(/\r?\n/).forEach(raw=>{
    const w = raw.trim();
    if(!w) return;
    if(w.toLowerCase()==="vc_vocabulary") return;
    const key = w.toLowerCase();
    if(stop.has(key)) return;
    if(seen.has(key)) return;
    seen.add(key);
    words.push(w);
  });
  return words;
}

document.getElementById("importWordsFile").onchange=(ev)=>{
  const file=ev.target.files && ev.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const imported=normalizeImportedWords(String(reader.result||""));
      const baseSet=new Set(BASE_WORDS.map(w=>String(w).toLowerCase()));
      const customSet=new Set((state.customWords||[]).map(w=>String(w).toLowerCase()));
      const masteredSet=new Set(Object.keys(state.mastered||{}).map(w=>w.toLowerCase()));
      const activeSet=new Set([
        ...Object.keys(state.debts||{}),
        ...(state.queue||[]),
        ...(state.current?[state.current]:[])
      ].map(w=>String(w).toLowerCase()));

      let alreadyBase=0, alreadyCustom=0, skippedMastered=0, skippedActive=0;
      const added=[];

      imported.forEach(w=>{
        const k=w.toLowerCase();
        if(baseSet.has(k)){ alreadyBase++; return; }
        if(customSet.has(k)){ alreadyCustom++; return; }

        // A word can remain historically Mastered/Active even if it came from an older queue-only import.
        // In that case, promote it into customWords without destroying its learning record.
        state.customWords.push(w);
        customSet.add(k);
        added.push(w);
        if(masteredSet.has(k)) skippedMastered++;
        else if(activeSet.has(k)) skippedActive++;
      });

      // Only genuinely unseen added words need queue insertion; mastered/active ones already have state.
      const toQueue=added.filter(w=>{
        const k=w.toLowerCase();
        return !masteredSet.has(k) && !activeSet.has(k);
      });
      shuffle(toQueue);
      state.queue=(state.queue||[]).concat(toQueue);
      save();
      updateStats();

      showTransientToast(
        "词表导入完成：读取 "+imported.length+" 个；新增 "+added.length+
        " 个；内置重复 "+alreadyBase+" 个；自定义重复 "+alreadyCustom+
        " 个；保留已掌握 "+skippedMastered+" 个；保留学习中 "+skippedActive+" 个"
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
function resetWordDissolve(){
  const a=document.getElementById("answer");
  if(a){
    const w=a.querySelector(".word");
    if(w){w.style.opacity="1";w.classList.remove("wordDissolving");}
  }
  const c=document.getElementById("wordDissolveFx");
  if(c){const x=c.getContext("2d");if(x)x.clearRect(0,0,c.width,c.height);}
}

function dissolveCurrentWord(){
  const answer=document.getElementById("answer");
  const wordEl=answer&&answer.querySelector(".word");
  const canvas=document.getElementById("wordDissolveFx");
  if(!wordEl||!canvas||!wordEl.textContent.trim())return;

  const wr=wordEl.getBoundingClientRect();
  const dpr=Math.max(1,window.devicePixelRatio||1);

  canvas.width=Math.max(1,Math.round(window.innerWidth*dpr));
  canvas.height=Math.max(1,Math.round(window.innerHeight*dpr));
  canvas.style.width=window.innerWidth+"px";
  canvas.style.height=window.innerHeight+"px";

  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const w=Math.max(1,Math.ceil(wr.width));
  const h=Math.max(1,Math.ceil(wr.height));
  const off=document.createElement("canvas");
  off.width=Math.ceil(w*dpr);
  off.height=Math.ceil(h*dpr);

  const o=off.getContext("2d");
  o.scale(dpr,dpr);

  const cs=getComputedStyle(wordEl);
  o.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  o.fillStyle=cs.color||"#222";
  o.textAlign="center";
  o.textBaseline="middle";
  o.fillText(wordEl.textContent,w/2,h/2);

  const image=o.getImageData(0,0,off.width,off.height);
  const data=image.data;
  const particles=[];
  const step=Math.max(2,Math.round(2.5*dpr));

  for(let py=0;py<off.height;py+=step){
    for(let px=0;px<off.width;px+=step){
      const i=(py*off.width+px)*4;
      if(data[i+3]>70&&Math.random()<.72){
        particles.push({
          x:wr.left+px/dpr,
          y:wr.top+py/dpr,
          vx:(Math.random()-.5)*1.55+.62,
          vy:(Math.random()-.5)*.95-.18,
          r:.9+Math.random()*1.35,
          life:1,
          fade:.016+Math.random()*.012
        });
      }
    }
  }

  if(!particles.length)return;

  // Let the original word remain for the first instant, then "break" it into the particles.
  wordEl.classList.add("wordDissolving");
  requestAnimationFrame(()=>requestAnimationFrame(()=>{wordEl.style.opacity="0";}));

  const start=performance.now();
  function frame(t){
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);

    for(const p of particles){
      p.x+=p.vx;
      p.y+=p.vy;
      p.vx*=.993;
      p.vy-=.0015;
      p.life-=p.fade;
      if(p.life<=0)continue;

      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle="rgb(55,60,67)";
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;

    if(t-start<900&&particles.some(p=>p.life>0)){
      requestAnimationFrame(frame);
    }else{
      ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    }
  }
  requestAnimationFrame(frame);
}

function celebrateAgain(){
  try{ dissolveCurrentWord(); }catch(e){ console.warn("AGAIN dissolve skipped:",e); }
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
