// ===== GitHub Sync v5: manual write sync + rolling snapshots + explicit recovery =====
const SYNC = {
  owner:"zzZing0-0", repo:"audio-vocabulary-sprint-data", path:"progress.json", branch:"main",
  tokenKey:"audio_vocab_sprint_github_token", backupKey:"audio_vocab_sprint_universal_v3_backup",
  baseKey:"audio_vocab_sprint_sync_base_v1", lastSyncAtKey:"audio_vocab_sprint_last_sync_at", lastSyncActionKey:"audio_vocab_sprint_last_sync_action",
  pendingKey:"audio_vocab_sprint_pending_conflicts_v1", snapshotsKey:"audio_vocab_sprint_sync_snapshots_v1"
};
function updateLastSyncInfo(){const el=document.getElementById("lastSyncInfo");if(!el)return;const iso=localStorage.getItem(SYNC.lastSyncAtKey);el.textContent=iso?"上次同步："+new Date(iso).toLocaleString():"上次同步：尚未同步";}
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

function saveSyncSnapshot(label,stateValue){
  try{
    const raw=localStorage.getItem(SYNC.snapshotsKey);
    const arr=raw?JSON.parse(raw):[];
    const next=Array.isArray(arr)?arr:[];
    next.unshift({savedAt:new Date().toISOString(),label:label||"sync",state:clone(stateValue)});
    localStorage.setItem(SYNC.snapshotsKey,JSON.stringify(next.slice(0,10)));
  }catch(e){console.warn("Could not save sync snapshot",e);}
}
function readBase(){try{return JSON.parse(localStorage.getItem(SYNC.baseKey)||"null");}catch(_){return null;}}
function setBase(s){localStorage.setItem(SYNC.baseKey,JSON.stringify(s));}
function map3(base={},local={},remote={},resolver){const out={};const keys=new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})]);for(const k of keys){const b=base?.[k],l=local?.[k],r=remote?.[k];let v;if(same(l,r))v=l;else if(same(l,b))v=r;else if(same(r,b))v=l;else v=resolver?resolver(k,b,l,r):l;if(v!==undefined)out[k]=clone(v);}return out;}
function set3(base=[],local=[],remote=[]){const B=new Set(base||[]),L=new Set(local||[]),R=new Set(remote||[]),all=new Set([...B,...L,...R]),out=[];for(const x of all){const b=B.has(x),l=L.has(x),r=R.has(x);const keep=l===r?l:l===b?r:r===b?l:(l||r);if(keep)out.push(x);}return out;}
function dailyResolver(k,b,l,r){b=b||{};l=l||{};r=r||{};const out={};for(const f of ["total","new","review"]){const bv=Number(b[f])||0,lv=Number(l[f])||0,rv=Number(r[f])||0;out[f]=Math.max(0,bv+(lv-bv)+(rv-bv));}return out;}
function linksResolver(k,b,l,r){const byId=new Map();for(const item of [...(Array.isArray(l)?l:[]),...(Array.isArray(r)?r:[])]){if(item&&item.url){const id=item.id||item.url;if(!byId.has(id))byId.set(id,item);}}return [...byId.values()].slice(0,3);}
function linkedResolver(k,b,l,r){const out=[];const seen=new Set();for(const x of [...(Array.isArray(l)?l:[]),...(Array.isArray(r)?r:[])]){const q=String(x||"").trim(),z=q.toLowerCase();if(q&&!seen.has(z)){seen.add(z);out.push(q);}}return out.slice(0,3);}
function maxResolver(k,b,l,r){return Math.max(Number(b)||0,Number(l)||0,Number(r)||0)||undefined;}
function boolResolver(k,b,l,r){return (b||l||r)?true:undefined;}
function normalizeState(s){s=s&&typeof s==="object"?s:{};s.debts=s.debts||{};s.mastered=s.mastered||{};s.seen=s.seen||{};s.highestDebt=s.highestDebt||{};s.lastReviewedDate=s.lastReviewedDate||{};s.customWords=Array.isArray(s.customWords)?s.customWords:[];s.customPronunciations=s.customPronunciations||{};s.notes=s.notes||{};s.linkedWords=s.linkedWords||{};s.removedWords=s.removedWords||{};s.dailyStats=s.dailyStats||{};s.historyLinks=s.historyLinks||{};s.queue=Array.isArray(s.queue)?s.queue:[];return s;}
function learningBundle(s,w){return {debt:Number(s.debts?.[w])||0,mastered:!!s.mastered?.[w],lastReviewedDate:s.lastReviewedDate?.[w]||null};}
function applyLearningBundle(out,w,b){delete out.debts[w];delete out.mastered[w];delete out.lastReviewedDate[w];if(b.mastered)out.mastered[w]=true;else if(Number(b.debt)>0)out.debts[w]=Number(b.debt);if(!b.mastered&&b.lastReviewedDate)out.lastReviewedDate[w]=b.lastReviewedDate;}
function describeLearning(b){if(b.mastered)return "已掌握 · debt 0";if(Number(b.debt)>0)return `继续复习 · debt ${b.debt}${b.lastReviewedDate?" · 最近 "+b.lastReviewedDate:""}`;return "未处于复习队列";}
function mergeStates(base,local,remote){
  base=normalizeState(clone(base||{}));local=normalizeState(clone(local||{}));remote=normalizeState(clone(remote||{}));const out=clone(local),conflicts=[];
  // Learning state is a coherent per-word unit. Incompatible edits on both sides are never guessed.
  out.debts={};out.mastered={};out.lastReviewedDate={};
  const learningWords=new Set([...Object.keys(base.debts),...Object.keys(base.mastered),...Object.keys(base.lastReviewedDate),...Object.keys(local.debts),...Object.keys(local.mastered),...Object.keys(local.lastReviewedDate),...Object.keys(remote.debts),...Object.keys(remote.mastered),...Object.keys(remote.lastReviewedDate)]);
  for(const w of learningWords){const b=learningBundle(base,w),l=learningBundle(local,w),r=learningBundle(remote,w);let chosen;const learned=x=>!!x.mastered||Number(x.debt)>0||!!x.lastReviewedDate;const suspiciousRegression=learned(b)&&((learned(l)&&!learned(r))||(!learned(l)&&learned(r)));if(same(l,r))chosen=l;else if(suspiciousRegression){chosen=l;conflicts.push({word:w,base:b,local:l,remote:r});}else if(same(l,b))chosen=r;else if(same(r,b))chosen=l;else{chosen=l;conflicts.push({word:w,base:b,local:l,remote:r});}applyLearningBundle(out,w,chosen);}
  out.seen=map3(base.seen,local.seen,remote.seen,boolResolver);
  out.highestDebt=map3(base.highestDebt,local.highestDebt,remote.highestDebt,maxResolver);
  for(const key of ["customPronunciations","notes","removedWords"]){out[key]=map3(base[key],local[key],remote[key]);}
  out.customWords=set3(base.customWords,local.customWords,remote.customWords);
  out.linkedWords=map3(base.linkedWords,local.linkedWords,remote.linkedWords,linkedResolver);
  out.dailyStats=map3(base.dailyStats,local.dailyStats,remote.dailyStats,dailyResolver);
  out.historyLinks=map3(base.historyLinks,local.historyLinks,remote.historyLinks,linksResolver);
  const starts=[base.statsStartDate,local.statsStartDate,remote.statsStartDate].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x||""));out.statsStartDate=starts.sort()[0]||localDateKey();
  // Presentation/scheduler position is device-local.
  out.voiceIndex=local.voiceIndex;out.current=local.current;out.queue=local.queue;out.queueDate=local.queueDate;
  return {merged:out,conflicts};
}
function countMergedChanges(local,merged){let n=0;for(const key of ["debts","mastered","lastReviewedDate","seen","highestDebt","customPronunciations","notes","removedWords","linkedWords","dailyStats","historyLinks"]){const a=local[key]||{},b=merged[key]||{};for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(!same(a[k],b[k]))n++;}if(!same(local.customWords||[],merged.customWords||[]))n++;return n;}
async function putMerged(merged,existing){const payload={app:"Audio Vocabulary Sprint",version:10,syncedAt:new Date().toISOString(),source:"merged",state:merged};const body={message:"Merge Audio Vocabulary Sprint progress",content:bytesToBase64(JSON.stringify(payload,null,2)),branch:SYNC.branch};if(existing?.sha)body.sha=existing.sha;const r=await fetch(syncApiUrl(),{method:"PUT",headers:{...syncHeaders(),"Content-Type":"application/json"},body:JSON.stringify(body)});if(!r.ok){let detail="";try{detail=(await r.json()).message||"";}catch(_){}const e=new Error(`GitHub ${r.status}${detail?": "+detail:""}`);e.status=r.status;throw e;}return r.json();}
function studyCounts(s){
  s=normalizeState(clone(s||{}));
  const removed=new Set(Object.keys(s.removedWords||{}).map(w=>String(w).toLowerCase()));
  const bank=[], keys=new Set();
  for(const raw of BASE_WORDS.concat(s.customWords||[])){
    const w=String(raw||"").trim(), k=w.toLowerCase();
    if(!w||keys.has(k)||removed.has(k))continue;
    keys.add(k);bank.push(w);
  }
  const bankKeys=new Set(bank.map(w=>w.toLowerCase()));
  const mastered=Object.keys(s.mastered||{}).filter(w=>bankKeys.has(String(w).toLowerCase())).length;
  const active=Object.entries(s.debts||{}).filter(([w,d])=>Number(d)>0&&bankKeys.has(String(w).toLowerCase())).length;
  const unseen=bank.filter(w=>!s.seen?.[w]).length;
  return {mastered,active,unseen,total:bank.length};
}
function deltaText(a,b){const d=b-a;return d===0?"不变":(d>0?`+${d}`:`${d}`);}
function previewRoot(){return document.getElementById("syncPreviewRoot");}
function clearPreview(){const r=previewRoot();if(r)r.innerHTML="";}
function tokenState(){
  const saved=!!getSyncToken(), el=document.getElementById("syncTokenState"), input=document.getElementById("syncTokenInput");
  if(el){el.className="sync-token-state "+(saved?"is-saved":"is-missing");el.textContent=saved?"Token 状态：✓ 已保存（本设备）":"Token 状态：未保存";}
  if(input)input.placeholder=saved?"已保存；如需更换，请粘贴新 Token":"粘贴 fine-grained token";
  return saved;
}
function countTable(local,remote,merged){
  const L=studyCounts(local),R=studyCounts(remote),M=studyCounts(merged);
  const row=(label,key)=>`<div class="syncCountRow"><b>${label}</b><span>${L[key]}</span><span>${R[key]}</span><span>${M[key]} <small>${escapeHtml(deltaText(L[key],M[key]))}</small></span></div>`;
  return `<div class="syncCountTable"><div class="syncCountRow syncCountHead"><b></b><span>本机同步前</span><span>GitHub 当前</span><span>合并后</span></div>${row("已掌握","mastered")}${row("学习中","active")}${row("未学习","unseen")}</div>`;
}
function renderPreview(pkg){
  const root=previewRoot();if(!root)return;
  root.innerHTML=`<div class="syncPreviewCard"><div class="syncPreviewTitle"><b>同步预览</b><span>现在还没有写入 GitHub</span></div>${countTable(pkg.local,pkg.remote,pkg.merged)}<div class="sub syncPreviewNote">确认后：本机会采用“合并后”状态，GitHub progress.json 也会更新为同一份学习数据。</div><button class="action syncConfirmBtn" id="syncConfirmBtn">确认同步</button></div>`;
  document.getElementById("syncConfirmBtn").onclick=()=>confirmPreview(pkg);
}
function renderConflicts(pkg){
  const root=previewRoot();if(!root)return;const cs=pkg.conflicts||[];
  root.innerHTML=`<div class="syncPreviewCard"><div class="syncPreviewTitle"><b>同步预览</b><span>⚠ ${cs.length} 项需要确认；现在还没有写入 GitHub</span></div>${countTable(pkg.local,pkg.remote,pkg.merged)}<div class="syncConflictList"></div><button class="action syncResolveAll" id="syncResolveAll" disabled>确认选择并同步（还剩 ${cs.length} 项）</button></div>`;
  const list=root.querySelector(".syncConflictList");
  cs.forEach((c,i)=>{const item=document.createElement("section");item.className="syncConflictItem";item.innerHTML=`<div class="syncConflictTitle"><b>${escapeHtml(c.word)}</b><span>${i+1} / ${cs.length}</span></div><label class="syncChoice"><input type="radio" name="syncConflict${i}" value="local"><span><b>${escapeHtml(describeLearning(c.local))}</b><small>保留本机</small></span></label><label class="syncChoice"><input type="radio" name="syncConflict${i}" value="remote"><span><b>${escapeHtml(describeLearning(c.remote))}</b><small>采用 GitHub</small></span></label>`;list.appendChild(item);});
  const btn=root.querySelector("#syncResolveAll");
  const refresh=()=>{let left=0;cs.forEach((_,i)=>{if(!root.querySelector(`input[name="syncConflict${i}"]:checked`))left++;});btn.disabled=left>0;btn.textContent=left?`确认选择并同步（还剩 ${left} 项）`:`确认 ${cs.length} 项并同步`;};
  root.addEventListener("change",refresh);btn.onclick=()=>confirmConflicts(pkg,root,btn);refresh();
}
async function inspectSync(){
  if(!tokenState()){setSyncStatus("无法检查：此设备尚未保存 Token。请展开 Token 设置并保存。");document.getElementById("syncTokenDetails")?.setAttribute("open","");return;}
  clearPreview();setSyncStatus("正在读取 GitHub 并计算变化…（此步骤不会写入）");
  try{
    ensureLinkedWordsInVocabulary();const local=clone(state);let base=readBase();const existing=await githubGetProgress(),remote=cloudState(existing)||{};if(!base)base=clone(remote||{});
    const result=mergeStates(base,local,remote);const pkg={sha:existing?.sha||null,local,remote,merged:result.merged,conflicts:result.conflicts||[]};
    setSyncStatus(pkg.conflicts.length?`检查完成：${pkg.conflicts.length} 项学习状态需要你选择。确认前不会写入 GitHub。`:"检查完成：请核对下方数量变化。确认前不会写入 GitHub。");
    if(pkg.conflicts.length)renderConflicts(pkg);else renderPreview(pkg);
  }catch(e){console.error(e);setSyncStatus("检查失败 · "+e.message);showTransientToast("检查同步失败："+e.message);}
}
async function ensureStillCurrent(pkg){const latest=await githubGetProgress();if((latest?.sha||null)!==(pkg.sha||null))throw new Error("GitHub 数据刚刚发生变化，请重新点击“检查同步变化”后再确认");return latest;}
async function finishSync(final,latest,beforeCounts){
  await putMerged(final,latest);state=normalizeState(final);ensureLinkedWordsInVocabulary();for(const [w,d] of Object.entries(state.debts))state.highestDebt[w]=Math.max(state.highestDebt[w]||0,Number(d)||0);save();setBase(state);localStorage.removeItem(SYNC.pendingKey);markSyncSuccess();
  const after=studyCounts(state);clearPreview();setSyncStatus(`同步成功 · 已掌握 ${beforeCounts.mastered} → ${after.mastered}（${deltaText(beforeCounts.mastered,after.mastered)}） · 学习中 ${beforeCounts.active} → ${after.active}（${deltaText(beforeCounts.active,after.active)}） · 未学习 ${beforeCounts.unseen} → ${after.unseen}（${deltaText(beforeCounts.unseen,after.unseen)}）`);showTransientToast("✓ 同步成功");updateStats();
}
async function confirmPreview(pkg){
  const btn=document.getElementById("syncConfirmBtn");if(btn)btn.disabled=true;setSyncStatus("正在再次确认 GitHub 版本并写入…");
  try{const latest=await ensureStillCurrent(pkg);const before=studyCounts(state);await finishSync(clone(pkg.merged),latest,before);}catch(e){console.error(e);setSyncStatus("同步未完成 · "+e.message);showTransientToast("同步未完成："+e.message);if(btn)btn.disabled=false;}
}
async function confirmConflicts(pkg,root,btn){
  btn.disabled=true;setSyncStatus("正在确认选择并重新检查 GitHub…");
  try{const latest=await ensureStillCurrent(pkg);const final=clone(pkg.merged);pkg.conflicts.forEach((c,i)=>{const choice=root.querySelector(`input[name="syncConflict${i}"]:checked`)?.value;applyLearningBundle(final,c.word,choice==="remote"?c.remote:c.local);});const before=studyCounts(state);await finishSync(final,latest,before);}catch(e){console.error(e);setSyncStatus("同步未完成 · "+e.message);showTransientToast("同步未完成："+e.message);btn.disabled=false;}
}
const syncBtn=document.getElementById("syncBtn"),syncOverlay=document.getElementById("syncOverlay");
if(syncBtn)syncBtn.onclick=()=>{syncOverlay.style.display="flex";const input=document.getElementById("syncTokenInput");if(input)input.value="";tokenState();clearPreview();setSyncStatus(getSyncToken()?"点击“检查同步变化”：先预览数量变化，确认后才会写入 GitHub。":"此设备尚未保存 Token。请先展开 Token 设置。");updateLastSyncInfo();};
const syncClose=document.getElementById("syncClose"),syncNowBtn=document.getElementById("syncNow");if(syncClose)syncClose.onclick=()=>syncOverlay.style.display="none";if(syncNowBtn)syncNowBtn.onclick=inspectSync;
const syncSaveToken=document.getElementById("syncSaveToken");if(syncSaveToken)syncSaveToken.onclick=()=>{const input=document.getElementById("syncTokenInput"),v=(input?.value||"").trim();if(!v){setSyncStatus("Token 未保存：输入框为空。若状态显示“已保存”，说明本设备已有 Token，无需重复保存。");showTransientToast("请输入新 Token 后再保存");return;}try{localStorage.setItem(SYNC.tokenKey,v);if(localStorage.getItem(SYNC.tokenKey)!==v)throw new Error("写入后校验失败");if(input)input.value="";tokenState();setSyncStatus("Token 保存成功。状态已更新为“已保存（本设备）”。");showTransientToast("✓ Token 已保存");}catch(e){console.error(e);tokenState();setSyncStatus("Token 保存失败 · "+(e?.message||e));showTransientToast("Token 保存失败："+(e?.message||e));}};
const syncClearToken=document.getElementById("syncClearToken");if(syncClearToken)syncClearToken.onclick=()=>{localStorage.removeItem(SYNC.tokenKey);const input=document.getElementById("syncTokenInput");if(input)input.value="";tokenState();clearPreview();setSyncStatus("Token 已清除。当前设备无法同步，直到重新保存 Token。");showTransientToast("Token 已清除");};
updateLastSyncInfo();tokenState();
// Manual only: opening the app never reads from or writes to GitHub automatically.
