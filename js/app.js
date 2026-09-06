const BASE_WORDS = window.BASE_WORDS || [];

const KEY="audio_vocab_sprint_universal_v3";
let state = JSON.parse(localStorage.getItem(KEY)||"null") || {
  debts:{}, mastered:{}, seen:{}, highestDebt:{}, current:null, queue:[], voiceIndex:0
};
// Migrate older saves. Current debt can be recovered; historical peaks from old versions cannot.
state.debts = state.debts || {};
state.mastered = state.mastered || {};
state.seen = state.seen || {};
state.highestDebt = state.highestDebt || {};
state.lastReviewedDate = state.lastReviewedDate || {}; // v3.3; absent in old saves, so old progress stays intact
state.customWords = Array.isArray(state.customWords) ? state.customWords : [];

function allWords(){
  const out=[];
  const keys=new Set();
  for(const raw of BASE_WORDS.concat(state.customWords)){
    const w=String(raw||"").trim();
    const k=w.toLowerCase();
    if(!w || keys.has(k)) continue;
    keys.add(k);
    out.push(w);
  }
  return out;
}

for (const [w,d] of Object.entries(state.debts)) {
  state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
}
// A brand-new progress state gets a fresh randomized queue.
// Existing progress is preserved exactly as saved.
if (!state.current && (!state.queue || state.queue.length === 0) &&
    Object.keys(state.seen || {}).length === 0) {
  state.queue = WORDS.slice();
  shuffle(state.queue);
}
let voices=[], revealed=false, started=false;

function save(){ localStorage.setItem(KEY,JSON.stringify(state)); updateStats(); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }
function localDateKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function activeEligibleToday(w){
  return (state.debts[w]||0)>0 && !state.mastered[w] && state.lastReviewedDate[w]!==localDateKey();
}
function eligible(){
  return allWords().filter(w=>!state.mastered[w] && (!(state.debts[w]>0) || activeEligibleToday(w)));
}
function refill(){
  let unseen=allWords().filter(w=>!state.seen[w]&&!state.mastered[w]);
  let debt=allWords().filter(w=>activeEligibleToday(w));
  shuffle(unseen); shuffle(debt);
  let q=[], ui=0, di=0;
  while(ui<unseen.length || di<debt.length){
    for(let k=0;k<12 && ui<unseen.length;k++) q.push(unseen[ui++]);
    if(di<debt.length) q.push(debt[di++]);
  }
  state.queue=q;
}
function popNextEligible(){
  const today=localDateKey();
  while(state.queue.length){
    const w=state.queue.shift();
    if(state.mastered[w]) continue;
    if((state.debts[w]||0)>0 && state.lastReviewedDate[w]===today) continue;
    return w;
  }
  return null;
}
function next(){
  speechSynthesis.cancel(); revealed=false;
  document.getElementById("answer").innerHTML="";
  if(!state.queue.length) refill();
  let prev=state.current, guard=0;
  while(state.queue.length && state.queue[0]===prev && guard++<5) state.queue.push(state.queue.shift());
  state.current=popNextEligible();
  if(!state.current){ refill(); state.current=popNextEligible(); }
  if(!state.current){
    document.getElementById("answer").innerHTML='<div class="word">🎉 今天可复习的词已完成</div>';
    save(); return;
  }
  state.seen[state.current]=true; save();
  setTimeout(speakCurrent,120);
}
function selectedVoice(){
  let en=voices.filter(v=>/^en[-_]/i.test(v.lang));
  if(!en.length) return null;
  return en[state.voiceIndex % en.length];
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
  let d=state.debts[state.current]||0;
  document.getElementById("answer").innerHTML =
    '<div class="word">'+escapeHtml(state.current)+'</div>'+
    '<div class="level">'+(d?('Error debt: '+d):'首次出现')+'</div>'+
    '<div class="note" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+
    '<a href="https://www.ldoceonline.com/dictionary/'+encodeURIComponent(state.current.toLowerCase().replace(/\\s+/g,"-"))+'" target="_blank" rel="noopener" style="color:#666;text-decoration:none">📖 Longman 英英</a>'+
    '<a href="https://dictionary.cambridge.org/dictionary/english-chinese-simplified/'+encodeURIComponent(state.current.toLowerCase().replace(/\\s+/g,"-"))+'" target="_blank" rel="noopener" style="color:#666;text-decoration:none">📘 Cambridge 英中</a>'+
    '</div>';
}
function pass(){
  if(!state.current)return;
  let w=state.current, d=state.debts[w]||0;
  if(d<=1){
    delete state.debts[w];
    delete state.lastReviewedDate[w];
    state.mastered[w]=true;
  }else{
    state.debts[w]=d-1;
    state.lastReviewedDate[w]=localDateKey();
  }
  revealThenNext("PASS");
}
function again(){
  if(!state.current)return;
  let w=state.current;
  state.debts[w]=(state.debts[w]||0)+1;
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0, state.debts[w]);
  state.lastReviewedDate[w]=localDateKey();
  revealThenNext("AGAIN");
}
function revealThenNext(kind){
  reveal(); save();
  let el=document.getElementById("hint");
  el.textContent=kind==="PASS"?"✓ PASS":"↻ AGAIN";
  setTimeout(()=>{el.textContent="听到后只判断：能否立刻想到单词和意思？";next()},950);
}
function updateStats(){
 let m=Object.keys(state.mastered).length;
 let a=Object.values(state.debts).filter(x=>x>0).length;
 let u=allWords().filter(w=>!state.seen[w]).length;
 document.getElementById("mastered").textContent=m;
 document.getElementById("active").textContent=a;
 document.getElementById("unseen").textContent=u;
 document.getElementById("bar").style.width=(m/Math.max(allWords().length,1)*100)+"%";
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function loadVoices(){voices=speechSynthesis.getVoices();}
speechSynthesis.onvoiceschanged=loadVoices; loadVoices();

document.getElementById("speak").onclick=()=>{
  started=true;
  if(!state.current){
    speechSynthesis.cancel();
    revealed=false;
    if(!state.queue.length) refill();
    state.current=popNextEligible();
    if(!state.current){ refill(); state.current=popNextEligible(); }
    if(state.current){
      state.seen[state.current]=true;
      save();
      speakCurrent();
    }
  }else{
    speakCurrent();
  }
};
document.getElementById("reveal").onclick=reveal;
document.getElementById("pass").onclick=()=>{if(!started){started=true;next()}else pass()};
document.getElementById("again").onclick=()=>{if(!started){started=true;next()}else again()};
document.getElementById("voice").onclick=()=>{
 let en=voices.filter(v=>/^en[-_]/i.test(v.lang)); if(!en.length)return;
 state.voiceIndex=(state.voiceIndex+1)%en.length; save();
 document.getElementById("hint").textContent="Voice: "+en[state.voiceIndex].name;
 speakCurrent();
};
document.getElementById("info").onclick=()=>{
 const debt=Object.entries(state.debts)
   .filter(x=>Number(x[1])>0 && !state.mastered[x[0]])
   .sort((a,b)=>Number(b[1])-Number(a[1]) || a[0].localeCompare(b[0]));
 const top=debt.slice(0,20);
 const list=rows=>rows.length
   ? '<ol>'+rows.map(x=>'<li>'+escapeHtml(x[0])+' — debt '+x[1]+'</li>').join('')+'</ol>'
   : '<p>暂无钉子户 🎉</p>';
 document.getElementById("panel").innerHTML=
   '<h2>规则</h2>'+
   '<p>第一次 PASS：直接清零。第一次 AGAIN：error debt = 1。以后 AGAIN +1，PASS −1；debt 到 0 后进入 Mastered。</p>'+
   '<p>Active 单词每个自然日最多考核一次：AGAIN 后当天退场；若 debt &gt; 1，PASS 后也当天退场，下一次最早在下一个自然日出现。</p>'+
   '<p><b>peak</b>：记录一个词历史上达到过的最高 debt；进入 Mastered 后仍保存在学习 state 中，并随 GitHub progress.json 一起同步。</p>'+
   '<p><b>自定义词库</b>：导入的新词会永久写入学习 state，并随 GitHub progress.json 同步；不会只临时塞进 queue。</p>'+
   '<h2>🔩 当前钉子户 '+debt.length+'</h2>'+
   list(top)+
   (debt.length>20
     ? '<details><summary>查看全部 '+debt.length+' 个</summary>'+list(debt)+'</details>'
     : '')+
   '<button class="action" onclick="closePanel()">关闭</button>';
 document.getElementById("overlay").style.display="flex";
};

function reAddWord(word){
  if(!state.mastered[word]) return;
  delete state.mastered[word];
  state.debts[word]=1;              // one successful recognition clears this review
  state.seen[word]=true;
  state.highestDebt[word]=Math.max(state.highestDebt[word]||0, 1);
  delete state.lastReviewedDate[word];
  // Put it into the queue soon, but not necessarily immediately.
  const gap=Math.min(10+Math.floor(Math.random()*16), state.queue.length);
  state.queue.splice(gap,0,word);
  save();
  showMastered();
}
function reAddTop(n){
  const rows=Object.keys(state.mastered)
    .map(w=>[w,state.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,n);
  rows.forEach(([w])=>{
    delete state.mastered[w];
    state.debts[w]=1;
    state.seen[w]=true;
    state.highestDebt[w]=Math.max(state.highestDebt[w]||0,1);
    delete state.lastReviewedDate[w];
    state.queue.push(w);
  });
  shuffle(state.queue);
  save();
  showMastered();
}
function showMastered(){
  const rows=Object.keys(state.mastered)
    .map(w=>[w,state.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
  const body = rows.length ? rows.map(([w,d])=>
    '<div class="masterRow"><span>'+escapeHtml(w)+'</span><span>peak '+d+'</span>'+
    '<button class="miniBtn" onclick='+JSON.stringify("reAddWord("+JSON.stringify(w)+")")+'>重新加入</button></div>'
  ).join('') : '<p>还没有 mastered 单词。</p>';
  document.getElementById("panel").innerHTML=
    '<h2>Mastered</h2>'+
    '<p>按历史最高 error debt 降序排列。peak 会永久保留，即使后来清零。</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
    '<button class="miniBtn" onclick="reAddTop(10)">重刷 Top 10</button>'+
    '<button class="miniBtn" onclick="reAddTop(50)">重刷 Top 50</button>'+
    '</div>'+body+
    '<button class="action" style="margin-top:18px;width:100%" onclick="closePanel()">关闭</button>';
  document.getElementById("overlay").style.display="flex";
}
document.getElementById("masteredList").onclick=showMastered;

function closePanel(){document.getElementById("overlay").style.display="none"}
document.getElementById("overlay").onclick=e=>{if(e.target.id==="overlay")closePanel()};
document.getElementById("reset").onclick=()=>{
 if(confirm("重置本机学习进度？\n\n这会清空当前浏览器里的 Mastered、debt、seen、peak 等学习记录，但不会修改 GitHub 云端 progress.json。\n\n重置后如果再上传，会用重置后的空白进度覆盖云端。")){
   localStorage.removeItem(KEY);
   state={debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],current:null,queue:BASE_WORDS.slice(),voiceIndex:state.voiceIndex||0};
   shuffle(state.queue);
   localStorage.setItem("audio_vocab_sprint_just_reset","1");
   save();
   speechSynthesis.cancel();
   revealed=false; started=false;
   document.getElementById("answer").innerHTML="";
   document.getElementById("hint").textContent="本机进度已重置。点击喇叭开始。";
   alert("本机已重置。\n⚠️ 此时上传 GitHub 会覆盖云端进度。");
 }
};

async function exportProgress(){
  const payload = {
    app: "Audio Vocabulary Sprint",
    version: 3,
    exportedAt: new Date().toISOString(),
    totalWords: WORDS.length,
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
      current: incoming.current || null,
      queue: Array.isArray(incoming.queue) ? incoming.queue : [],
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
    alert("进度导入成功");
  }catch(e){
    alert("导入失败：这不是有效的进度文件。");
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

      alert(
        "导入完成：\n"+
        "读取词条 "+imported.length+" 个\n"+
        "永久加入自定义词库 "+added.length+" 个\n"+
        "已在内置词库 "+alreadyBase+" 个\n"+
        "已在自定义词库 "+alreadyCustom+" 个\n"+
        "其中保留既有 Mastered 记录 "+skippedMastered+" 个\n"+
        "其中保留既有 Active 记录 "+skippedActive+" 个"
      );
    }catch(e){
      alert("词表导入失败："+e.message);
    }finally{
      ev.target.value="";
    }
  };
  reader.readAsText(file,"utf-8");
};




updateStats();

// ===== GitHub Sync v2 =====
const SYNC = {
  owner: "zzZing0-0",
  repo: "audio-vocabulary-sprint-data",
  path: "progress.json",
  branch: "main",
  tokenKey: "audio_vocab_sprint_github_token",
  backupKey: "audio_vocab_sprint_universal_v3_backup"
};

function getSyncToken(){
  return localStorage.getItem(SYNC.tokenKey) || "";
}
function setSyncStatus(msg){
  const el = document.getElementById("syncStatus");
  if(el) el.textContent = msg;
}
function syncApiUrl(){
  return `https://api.github.com/repos/${SYNC.owner}/${SYNC.repo}/contents/${SYNC.path}`;
}
function syncHeaders(){
  const token = getSyncToken();
  return {
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer " + token,
    "X-GitHub-Api-Version":"2022-11-28"
  };
}
function bytesToBase64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for(const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function base64ToUtf8(b64){
  const bin = atob(b64.replace(/\n/g,""));
  const bytes = Uint8Array.from(bin, c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function githubGetProgress(){
  const r = await fetch(syncApiUrl(), {headers: syncHeaders()});
  if(r.status === 404) return null;
  if(!r.ok){
    let detail = "";
    try{ detail = (await r.json()).message || ""; }catch(e){}
    throw new Error(`GitHub ${r.status}${detail ? ": "+detail : ""}`);
  }
  return await r.json();
}
async function syncUpload(){
  const token = getSyncToken();
  if(!token){
    alert("请先在 Token 设置里粘贴并保存 token。");
    return;
  }
  if(localStorage.getItem("audio_vocab_sprint_just_reset")==="1"){
    if(!confirm("⚠️ 当前设备刚刚执行过“重置本机”。\n\n继续上传会用重置后的进度覆盖 GitHub 云端 progress.json。\n\n确定继续上传吗？")) return;
  }
  setSyncStatus("正在上传…");
  try{
    const existing = await githubGetProgress();
    const payload = {
      app:"Audio Vocabulary Sprint",
      version:6,
      syncedAt:new Date().toISOString(),
      source: (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) ? "mobile" : "desktop",
      state:state
    };
    const body = {
      message:"Update Audio Vocabulary Sprint progress",
      content:bytesToBase64(JSON.stringify(payload,null,2)),
      branch:SYNC.branch
    };
    if(existing && existing.sha) body.sha = existing.sha;

    const r = await fetch(syncApiUrl(), {
      method:"PUT",
      headers:{...syncHeaders(),"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!r.ok){
      let detail = "";
      try{ detail = (await r.json()).message || ""; }catch(e){}
      throw new Error(`GitHub ${r.status}${detail ? ": "+detail : ""}`);
    }
    localStorage.removeItem("audio_vocab_sprint_just_reset");
    const now = new Date();
    setSyncStatus("上传成功 · " + now.toLocaleString());
  }catch(e){
    console.error(e);
    setSyncStatus("上传失败 · " + e.message);
    alert("上传失败：\n" + e.message);
  }
}
async function syncDownload(){
  const token = getSyncToken();
  if(!token){
    alert("请先在 Token 设置里粘贴并保存 token。");
    return;
  }
  if(!confirm("从 GitHub 下载会覆盖当前设备进度。\n下载前会自动保存一份本机备份。\n\n继续吗？")) return;

  setSyncStatus("正在下载…");
  try{
    const existing = await githubGetProgress();
    if(!existing || !existing.content){
      throw new Error("云端还没有 progress.json，请先从某台设备上传一次。");
    }
    const txt = base64ToUtf8(existing.content);
    const payload = JSON.parse(txt);
    const incoming = payload.state || payload;

    if(!incoming || typeof incoming !== "object" || !incoming.debts || !incoming.mastered || !incoming.seen){
      throw new Error("progress.json 格式不正确。");
    }

    // one-step local backup before overwrite
    localStorage.setItem(SYNC.backupKey, JSON.stringify({
      backedUpAt:new Date().toISOString(),
      state:state
    }));

    state = incoming;
    state.debts = state.debts || {};
    state.mastered = state.mastered || {};
    state.seen = state.seen || {};
    state.highestDebt = state.highestDebt || {};
    state.lastReviewedDate = state.lastReviewedDate || {};
    state.customWords = Array.isArray(state.customWords) ? state.customWords : [];
    state.queue = Array.isArray(state.queue) ? state.queue : [];
    state.voiceIndex = Number(state.voiceIndex)||0;

    for (const [w,d] of Object.entries(state.debts)) {
      state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
    }

    save();
    localStorage.removeItem("audio_vocab_sprint_just_reset");
    setSyncStatus("下载成功 · " + new Date().toLocaleString());
    alert("已从 GitHub 下载并覆盖当前设备进度。");
    location.reload();
  }catch(e){
    console.error(e);
    setSyncStatus("下载失败 · " + e.message);
    alert("下载失败：\n" + e.message);
  }
}

const syncBtn = document.getElementById("syncBtn");
const syncOverlay = document.getElementById("syncOverlay");
if(syncBtn) syncBtn.onclick = ()=>{
  syncOverlay.style.display = "flex";
  document.getElementById("syncTokenInput").value = "";
  const deviceName = (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) ? "手机端" : "电脑端";
  setSyncStatus(getSyncToken() ? `${deviceName} Token 已保存，可同步。` : `${deviceName} 尚未保存 Token。`);
};
const syncClose = document.getElementById("syncClose");
const syncUploadBtn = document.getElementById("syncUpload");
const syncDownloadBtn = document.getElementById("syncDownload");
if(syncClose) syncClose.onclick = ()=> syncOverlay.style.display = "none";
if(syncUploadBtn) syncUploadBtn.onclick = syncUpload;
if(syncDownloadBtn) syncDownloadBtn.onclick = syncDownload;
document.getElementById("syncSaveToken").onclick = ()=>{
  const v = document.getElementById("syncTokenInput").value.trim();
  if(!v){ alert("请先粘贴 token。"); return; }
  localStorage.setItem(SYNC.tokenKey, v);
  document.getElementById("syncTokenInput").value = "";
  setSyncStatus("Token 已保存到此浏览器。");
};
document.getElementById("syncClearToken").onclick = ()=>{
  localStorage.removeItem(SYNC.tokenKey);
  document.getElementById("syncTokenInput").value = "";
  setSyncStatus("Token 已清除。");
};
