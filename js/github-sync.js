// ===== GitHub Sync v4: startup sync + explicit learning-state conflict resolution =====
const SYNC = {
  owner:"zzZing0-0", repo:"audio-vocabulary-sprint-data", path:"progress.json", branch:"main",
  tokenKey:"audio_vocab_sprint_github_token", backupKey:"audio_vocab_sprint_universal_v3_backup",
  baseKey:"audio_vocab_sprint_sync_base_v1", lastSyncAtKey:"audio_vocab_sprint_last_sync_at", lastSyncActionKey:"audio_vocab_sprint_last_sync_action",
  pendingKey:"audio_vocab_sprint_pending_conflicts_v1"
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
function conflictRoot(){let root=document.getElementById("syncConflictRoot");if(root)return root;const status=document.getElementById("syncStatus");if(!status)return null;root=document.createElement("div");root.id="syncConflictRoot";status.insertAdjacentElement("afterend",root);return root;}
function clearConflictUI(){const r=conflictRoot();if(r)r.innerHTML="";}
function renderConflicts(pkg){const root=conflictRoot();if(!root)return;const cs=pkg.conflicts||[];root.innerHTML=`<div class="syncResultHead"><b>⚠ ${cs.length} 项学习状态需要你确认</b><span>已自动合并 ${pkg.mergedCount||0} 项无冲突更新</span></div><div class="syncConflictList"></div><button class="action syncResolveAll" id="syncResolveAll" disabled>确认并完成同步（还剩 ${cs.length} 项）</button><div class="sub syncConflictHint">可以先关闭窗口；冲突不会被自动覆盖，下次同步仍可继续处理。</div>`;
  const list=root.querySelector(".syncConflictList");
  cs.forEach((c,i)=>{const item=document.createElement("section");item.className="syncConflictItem";item.innerHTML=`<div class="syncConflictTitle"><b>${escapeHtml(c.word)}</b><span>${i+1} / ${cs.length}</span></div><label class="syncChoice"><input type="radio" name="syncConflict${i}" value="local"><span><b>${escapeHtml(describeLearning(c.local))}</b><small>本机当前状态</small></span></label><label class="syncChoice"><input type="radio" name="syncConflict${i}" value="remote"><span><b>${escapeHtml(describeLearning(c.remote))}</b><small>GitHub 端状态</small></span></label>`;list.appendChild(item);});
  const btn=root.querySelector("#syncResolveAll");
  const refresh=()=>{let left=0;cs.forEach((_,i)=>{if(!root.querySelector(`input[name="syncConflict${i}"]:checked`))left++;});btn.disabled=left>0;btn.textContent=left?`确认并完成同步（还剩 ${left} 项）`:`✓ 确认 ${cs.length} 项并完成同步`;};
  root.addEventListener("change",refresh);btn.onclick=()=>resolveConflicts(pkg,root,btn);refresh();
}
async function resolveConflicts(pkg,root,btn){btn.disabled=true;setSyncStatus("正在确认冲突并重新检查云端…");try{
  // Re-read cloud first. If it changed while the panel was open, restart merge rather than overwrite it.
  const latest=await githubGetProgress();if((latest?.sha||null)!==(pkg.sha||null)){setSyncStatus("云端已有新变化，正在重新合并…");return syncNow(0,{openPanel:true});}
  // Local study may have continued while the conflict panel was closed. Re-merge the latest local state first.
  const fresh=mergeStates(readBase()||{},clone(state),cloudState(latest)||{});
  const sameConflictSet=fresh.conflicts.length===pkg.conflicts.length && fresh.conflicts.every((c,i)=>c.word===pkg.conflicts[i].word && same(c.local,pkg.conflicts[i].local) && same(c.remote,pkg.conflicts[i].remote));
  if(!sameConflictSet){setSyncStatus("本机已有新的学习变化，已重新整理冲突，请再次确认。");const nextPkg={createdAt:new Date().toISOString(),sha:latest?.sha||null,merged:fresh.merged,conflicts:fresh.conflicts,mergedCount:countMergedChanges(state,fresh.merged)};localStorage.setItem(SYNC.pendingKey,JSON.stringify(nextPkg));if(nextPkg.conflicts.length){renderConflicts(nextPkg);showTransientToast("学习状态已变化，请重新确认冲突");return;}return syncNow(0,{openPanel:true});}
  const final=clone(fresh.merged);pkg.conflicts.forEach((c,i)=>{const choice=root.querySelector(`input[name="syncConflict${i}"]:checked`)?.value;applyLearningBundle(final,c.word,choice==="remote"?c.remote:c.local);});
  await putMerged(final,latest);state=normalizeState(final);ensureLinkedWordsInVocabulary();for(const [w,d] of Object.entries(state.debts))state.highestDebt[w]=Math.max(state.highestDebt[w]||0,Number(d)||0);save();setBase(state);localStorage.removeItem(SYNC.pendingKey);markSyncSuccess();clearConflictUI();setSyncStatus(`同步成功 · 已确认 ${pkg.conflicts.length} 项冲突 · ${new Date().toLocaleString()}`);showTransientToast(`✓ 同步成功 · 已确认 ${pkg.conflicts.length} 项冲突`);
}catch(e){console.error(e);setSyncStatus("同步失败 · "+e.message);showTransientToast("同步失败："+e.message);renderConflicts(pkg);}}
async function syncNow(retry=0,opts={}){
  if(!getSyncToken()){if(!opts.startup)showTransientToast("请先在 Token 设置里粘贴并保存 Token");return {ok:false,reason:"no-token"};}
  setSyncStatus(opts.startup?"正在自动同步…":"正在读取并合并本机与 GitHub…");
  try{
    ensureLinkedWordsInVocabulary();const local=clone(state);let base=readBase();let existing=await githubGetProgress(),remote=cloudState(existing)||{};
    // First sync on a device with no common base: cloud is the shared baseline; local presentation state remains device-local.
    if(!base)base=clone(remote||{});
    const result=mergeStates(base,local,remote),merged=result.merged,conflicts=result.conflicts,mergedCount=countMergedChanges(local,merged);
    localStorage.setItem(SYNC.backupKey,JSON.stringify({backedUpAt:new Date().toISOString(),state:local}));
    if(conflicts.length){const pkg={createdAt:new Date().toISOString(),sha:existing?.sha||null,merged,conflicts,mergedCount};localStorage.setItem(SYNC.pendingKey,JSON.stringify(pkg));setSyncStatus(`已检查 · 自动合并 ${mergedCount} 项 · ${conflicts.length} 项需要确认`);renderConflicts(pkg);if(opts.openPanel||opts.startup)syncOverlay.style.display="flex";showTransientToast(`⚠ 同步发现 ${conflicts.length} 项冲突，请确认`);return {ok:false,conflicts:conflicts.length};}
    clearConflictUI();localStorage.removeItem(SYNC.pendingKey);
    try{await putMerged(merged,existing);}catch(e){if((e.status===409||e.status===422)&&retry<1){setSyncStatus("云端刚有新变化，正在重新合并…");return syncNow(retry+1,opts);}throw e;}
    state=normalizeState(merged);ensureLinkedWordsInVocabulary();for(const [w,d] of Object.entries(state.debts))state.highestDebt[w]=Math.max(state.highestDebt[w]||0,Number(d)||0);save();setBase(state);localStorage.removeItem("audio_vocab_sprint_just_reset");markSyncSuccess();setSyncStatus(`同步成功 · 已合并 ${mergedCount} 项更新 · ${new Date().toLocaleString()}`);showTransientToast(mergedCount?`✓ 同步成功 · 已合并 ${mergedCount} 项更新`:"✓ 同步成功 · 无新变化");return {ok:true,mergedCount};
  }catch(e){console.error(e);setSyncStatus("同步失败 · "+e.message);showTransientToast("⚠ 自动同步失败 · 当前继续使用本地数据");return {ok:false,error:e};}
}

function restorePreSyncBackup(){
  try{
    const raw=localStorage.getItem(SYNC.backupKey);
    if(!raw){showTransientToast("没有找到同步前备份");return;}
    const pack=JSON.parse(raw), restored=normalizeState(clone(pack?.state||pack));
    if(!restored||typeof restored!=="object")throw new Error("备份格式无效");
    state=restored; ensureLinkedWordsInVocabulary(); save();
    // The old common base may be exactly what caused a stale cloud state to be treated as a deletion.
    // Force the next manual sync to establish a fresh baseline from cloud while preserving restored local progress.
    localStorage.removeItem(SYNC.baseKey);
    localStorage.removeItem(SYNC.pendingKey);
    clearConflictUI(); updateStats(); showWord();
    setSyncStatus(`已恢复同步前备份 · ${pack?.backedUpAt?new Date(pack.backedUpAt).toLocaleString():""}。请核对数量后再手动同步。`);
    showTransientToast("✓ 已恢复同步前本地备份");
  }catch(e){console.error(e);showTransientToast("恢复失败："+e.message);}
}
const syncBtn=document.getElementById("syncBtn"),syncOverlay=document.getElementById("syncOverlay");if(syncBtn)syncBtn.onclick=()=>{syncOverlay.style.display="flex";document.getElementById("syncTokenInput").value="";setSyncStatus(getSyncToken()?"Token 已保存。点击同步即可自动合并。":"此设备尚未保存 Token。");updateLastSyncInfo();try{const p=JSON.parse(localStorage.getItem(SYNC.pendingKey)||"null");if(p?.conflicts?.length)renderConflicts(p);}catch(_){}};
const syncClose=document.getElementById("syncClose"),syncNowBtn=document.getElementById("syncNow");if(syncClose)syncClose.onclick=()=>syncOverlay.style.display="none";if(syncNowBtn)syncNowBtn.onclick=()=>syncNow(0,{openPanel:true});
document.getElementById("syncSaveToken").onclick=()=>{const v=document.getElementById("syncTokenInput").value.trim();if(!v){showTransientToast("请先粘贴 Token");return;}localStorage.setItem(SYNC.tokenKey,v);document.getElementById("syncTokenInput").value="";setSyncStatus("Token 已保存到此浏览器。");showTransientToast("Token 已保存到此浏览器");};
const syncRestoreBackup=document.getElementById("syncRestoreBackup");if(syncRestoreBackup)syncRestoreBackup.onclick=restorePreSyncBackup;
document.getElementById("syncClearToken").onclick=()=>{localStorage.removeItem(SYNC.tokenKey);document.getElementById("syncTokenInput").value="";setSyncStatus("Token 已清除。");showTransientToast("Token 已清除");};
updateLastSyncInfo();
// Every entry to the main learning page performs one visible startup sync when a token exists.
if(getSyncToken())setTimeout(()=>syncNow(0,{startup:true}),180);
