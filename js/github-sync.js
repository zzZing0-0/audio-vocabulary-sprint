// ===== GitHub Sync v3: directionless three-way merge =====
const SYNC = {
  owner:"zzZing0-0", repo:"audio-vocabulary-sprint-data", path:"progress.json", branch:"main",
  tokenKey:"audio_vocab_sprint_github_token", backupKey:"audio_vocab_sprint_universal_v3_backup",
  baseKey:"audio_vocab_sprint_sync_base_v1", lastSyncAtKey:"audio_vocab_sprint_last_sync_at", lastSyncActionKey:"audio_vocab_sprint_last_sync_action"
};
function updateLastSyncInfo(){const el=document.getElementById("lastSyncInfo");if(!el)return;const iso=localStorage.getItem(SYNC.lastSyncAtKey);el.textContent=iso?"上次同步："+new Date(iso).toLocaleString()+"（自动合并）":"上次同步：尚未同步";}
function markSyncSuccess(){localStorage.setItem(SYNC.lastSyncAtKey,new Date().toISOString());localStorage.setItem(SYNC.lastSyncActionKey,"merge");updateLastSyncInfo();}
function getSyncToken(){return localStorage.getItem(SYNC.tokenKey)||"";}
function setSyncStatus(msg){const el=document.getElementById("syncStatus");if(el)el.textContent=msg;}
function syncApiUrl(){return `https://api.github.com/repos/${SYNC.owner}/${SYNC.repo}/contents/${SYNC.path}`;}
function syncHeaders(){return {"Accept":"application/vnd.github+json","Authorization":"Bearer "+getSyncToken(),"X-GitHub-Api-Version":"2022-11-28"};}
function bytesToBase64(str){const bytes=new TextEncoder().encode(str);let bin="";for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin);}
function base64ToUtf8(b64){const bin=atob(b64.replace(/\n/g,""));return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
async function githubGetProgress(){const r=await fetch(syncApiUrl(),{headers:syncHeaders(),cache:"no-store"});if(r.status===404)return null;if(!r.ok){let detail="";try{detail=(await r.json()).message||"";}catch(_){}throw new Error(`GitHub ${r.status}${detail?": "+detail:""}`);}return await r.json();}
function cloudState(file){if(!file||!file.content)return null;const payload=JSON.parse(base64ToUtf8(file.content));return payload.state||payload;}
function readBase(){try{return JSON.parse(localStorage.getItem(SYNC.baseKey)||"null");}catch(_){return null;}}
function setBase(s){localStorage.setItem(SYNC.baseKey,JSON.stringify(s));}
function map3(base={},local={},remote={},resolver){const out={};const keys=new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})]);for(const k of keys){const b=base?.[k],l=local?.[k],r=remote?.[k];let v;if(same(l,r))v=l;else if(same(l,b))v=r;else if(same(r,b))v=l;else v=resolver?resolver(k,b,l,r):l;if(v!==undefined)out[k]=clone(v);}return out;}
function set3(base=[],local=[],remote=[]){const B=new Set(base||[]),L=new Set(local||[]),R=new Set(remote||[]),all=new Set([...B,...L,...R]),out=[];for(const x of all){const b=B.has(x),l=L.has(x),r=R.has(x);const keep=l===r?l:l===b?r:r===b?l:(l||r);if(keep)out.push(x);}return out;}
function dailyResolver(k,b,l,r){b=b||{};l=l||{};r=r||{};const out={};for(const f of ["total","new","review"]){const bv=Number(b[f])||0,lv=Number(l[f])||0,rv=Number(r[f])||0;out[f]=Math.max(0,bv+(lv-bv)+(rv-bv));}return out;}
function linksResolver(k,b,l,r){const byId=new Map();for(const item of [...(Array.isArray(l)?l:[]),...(Array.isArray(r)?r:[])]){if(item&&item.url){const id=item.id||item.url;if(!byId.has(id))byId.set(id,item);}}return [...byId.values()].slice(0,3);}
function linkedResolver(k,b,l,r){const out=[];const seen=new Set();for(const x of [...(Array.isArray(l)?l:[]),...(Array.isArray(r)?r:[])]){const q=String(x||"").trim(),z=q.toLowerCase();if(q&&!seen.has(z)){seen.add(z);out.push(q);}}return out.slice(0,3);}
function normalizeState(s){s=s&&typeof s==="object"?s:{};s.debts=s.debts||{};s.mastered=s.mastered||{};s.seen=s.seen||{};s.highestDebt=s.highestDebt||{};s.lastReviewedDate=s.lastReviewedDate||{};s.customWords=Array.isArray(s.customWords)?s.customWords:[];s.customPronunciations=s.customPronunciations||{};s.notes=s.notes||{};s.linkedWords=s.linkedWords||{};s.removedWords=s.removedWords||{};s.dailyStats=s.dailyStats||{};s.historyLinks=s.historyLinks||{};s.queue=Array.isArray(s.queue)?s.queue:[];return s;}
function mergeStates(base,local,remote){
  base=normalizeState(clone(base||{}));local=normalizeState(clone(local||{}));remote=normalizeState(clone(remote||{}));const out=clone(local);
  for(const key of ["debts","mastered","seen","highestDebt","lastReviewedDate","customPronunciations","notes","removedWords"]){out[key]=map3(base[key],local[key],remote[key]);}
  out.customWords=set3(base.customWords,local.customWords,remote.customWords);
  out.linkedWords=map3(base.linkedWords,local.linkedWords,remote.linkedWords,linkedResolver);
  out.dailyStats=map3(base.dailyStats,local.dailyStats,remote.dailyStats,dailyResolver);
  out.historyLinks=map3(base.historyLinks,local.historyLinks,remote.historyLinks,linksResolver);
  // Device-local presentation/scheduler state stays local; shared start date uses the earliest valid date.
  const starts=[base.statsStartDate,local.statsStartDate,remote.statsStartDate].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||""));out.statsStartDate=starts.sort()[0]||localDateKey();
  out.voiceIndex=local.voiceIndex;out.current=local.current;out.queue=local.queue;out.queueDate=local.queueDate;
  // A soft removal wins visibility without destroying retained learning history.
  for(const w of Object.keys(out.mastered)){if(out.removedWords[w])continue;if(out.mastered[w])delete out.debts[w];}
  return out;
}
async function putMerged(merged,existing){const payload={app:"Audio Vocabulary Sprint",version:9,syncedAt:new Date().toISOString(),source:"merged",state:merged};const body={message:"Merge Audio Vocabulary Sprint progress",content:bytesToBase64(JSON.stringify(payload,null,2)),branch:SYNC.branch};if(existing?.sha)body.sha=existing.sha;const r=await fetch(syncApiUrl(),{method:"PUT",headers:{...syncHeaders(),"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok){let detail="";try{detail=(await r.json()).message||"";}catch(_){}const e=new Error(`GitHub ${r.status}${detail?": "+detail:""}`);e.status=r.status;throw e;}return r.json();}
async function syncNow(retry=0){
  if(!getSyncToken()){showTransientToast("请先在 Token 设置里粘贴并保存 Token");return;}
  setSyncStatus("正在读取并合并本机与 GitHub…");
  try{
    ensureLinkedWordsInVocabulary();
    const local=clone(state),base=readBase()||{};let existing=await githubGetProgress(),remote=cloudState(existing)||{};
    let merged=mergeStates(base,local,remote);
    localStorage.setItem(SYNC.backupKey,JSON.stringify({backedUpAt:new Date().toISOString(),state:local}));
    try{await putMerged(merged,existing);}catch(e){if((e.status===409||e.status===422)&&retry<1){setSyncStatus("云端刚有新变化，正在重新合并…");return syncNow(retry+1);}throw e;}
    state=normalizeState(merged);ensureLinkedWordsInVocabulary();for(const [w,d] of Object.entries(state.debts))state.highestDebt[w]=Math.max(state.highestDebt[w]||0,Number(d)||0);save();setBase(state);localStorage.removeItem("audio_vocab_sprint_just_reset");markSyncSuccess();setSyncStatus("同步成功 · 已自动合并本机与 GitHub · "+new Date().toLocaleString());showTransientToast("同步成功，双方变化已合并");
  }catch(e){console.error(e);setSyncStatus("同步失败 · "+e.message);showTransientToast("同步失败："+e.message);}
}
const syncBtn=document.getElementById("syncBtn"),syncOverlay=document.getElementById("syncOverlay");if(syncBtn)syncBtn.onclick=()=>{syncOverlay.style.display="flex";document.getElementById("syncTokenInput").value="";setSyncStatus(getSyncToken()?"Token 已保存。点击同步即可自动合并。":"此设备尚未保存 Token。");updateLastSyncInfo();};
const syncClose=document.getElementById("syncClose"),syncNowBtn=document.getElementById("syncNow");if(syncClose)syncClose.onclick=()=>syncOverlay.style.display="none";if(syncNowBtn)syncNowBtn.onclick=()=>syncNow();
document.getElementById("syncSaveToken").onclick=()=>{const v=document.getElementById("syncTokenInput").value.trim();if(!v){showTransientToast("请先粘贴 Token");return;}localStorage.setItem(SYNC.tokenKey,v);document.getElementById("syncTokenInput").value="";setSyncStatus("Token 已保存到此浏览器。");showTransientToast("Token 已保存到此浏览器");};
document.getElementById("syncClearToken").onclick=()=>{localStorage.removeItem(SYNC.tokenKey);document.getElementById("syncTokenInput").value="";setSyncStatus("Token 已清除。");showTransientToast("Token 已清除");};
updateLastSyncInfo();
