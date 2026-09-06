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
      version:7,
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
    state.notes = (state.notes && typeof state.notes === "object") ? state.notes : {};
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
