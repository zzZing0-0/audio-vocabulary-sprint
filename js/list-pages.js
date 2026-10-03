const LIST_KEY="audio_vocab_sprint_universal_v3";
let listState=JSON.parse(localStorage.getItem(LIST_KEY)||"null")||{};
listState.debts=listState.debts||{};
listState.mastered=listState.mastered||{};
listState.seen=listState.seen||{};
listState.highestDebt=listState.highestDebt||{};
listState.lastReviewedDate=listState.lastReviewedDate||{};
listState.notes=(listState.notes&&typeof listState.notes==="object")?listState.notes:{};
listState.removedWords=(listState.removedWords&&typeof listState.removedWords==="object"&&!Array.isArray(listState.removedWords))?listState.removedWords:{};
listState.queue=Array.isArray(listState.queue)?listState.queue:[];
listState.customWords=Array.isArray(listState.customWords)?listState.customWords:[];
listState.customPronunciations=(listState.customPronunciations&&typeof listState.customPronunciations==="object"&&!Array.isArray(listState.customPronunciations))?listState.customPronunciations:{};
listState.manualPronunciations=(listState.manualPronunciations&&typeof listState.manualPronunciations==="object"&&!Array.isArray(listState.manualPronunciations))?listState.manualPronunciations:{};
listState.linkedWords=(listState.linkedWords&&typeof listState.linkedWords==="object"&&!Array.isArray(listState.linkedWords))?listState.linkedWords:{};

function h(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function persist(){localStorage.setItem(LIST_KEY,JSON.stringify(listState));}
let listToastTimer=null;
let listToastCountdownTimer=null;
const listConfirmWindows=new Map();

function clearListToastTimers(){
  if(listToastTimer){
    clearTimeout(listToastTimer);
    listToastTimer=null;
  }
  if(listToastCountdownTimer){
    clearInterval(listToastCountdownTimer);
    listToastCountdownTimer=null;
  }
}

function listToast(message){
  let el=document.getElementById("transientToast");
  if(!el){
    el=document.createElement("div");
    el.id="transientToast";
    el.className="transientToast";
    el.setAttribute("role","status");
    document.body.appendChild(el);
  }
  clearListToastTimers();
  el.textContent=message;
  el.classList.remove("show");
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
  listToastTimer=setTimeout(()=>{
    el.classList.remove("show");
    listToastTimer=null;
  },5000);
}

function listConfirmToast(message){
  let el=document.getElementById("transientToast");
  if(!el){
    el=document.createElement("div");
    el.id="transientToast";
    el.className="transientToast";
    el.setAttribute("role","status");
    document.body.appendChild(el);
  }
  clearListToastTimers();

  let remaining=5;
  const render=()=>{el.textContent=`${message}（${remaining} 秒内再次点击确认）`;};
  render();

  el.classList.remove("show");
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));

  listToastCountdownTimer=setInterval(()=>{
    remaining-=1;
    if(remaining>=1)render();
  },1000);

  listToastTimer=setTimeout(()=>{
    if(listToastCountdownTimer){
      clearInterval(listToastCountdownTimer);
      listToastCountdownTimer=null;
    }
    el.classList.remove("show");
    listToastTimer=null;
  },5000);
}
function listRequireSecondClick(key,message,action){
  const now=Date.now(),until=listConfirmWindows.get(key)||0;
  if(until>now){
    listConfirmWindows.delete(key);
    action();
    return true;
  }
  listConfirmWindows.set(key,now+5000);
  listConfirmToast(message);
  setTimeout(()=>{if((listConfirmWindows.get(key)||0)<=Date.now())listConfirmWindows.delete(key);},5100);
  return false;
}
function removedSet(){return new Set(Object.keys(listState.removedWords||{}).map(w=>w.toLowerCase()));}
function isRemovedListWord(w){return removedSet().has(String(w).toLowerCase());}

function removeListWord(w,rerender){
  if(!w)return;
  listRequireSecondClick(
    "remove-list:"+w,
    `将 “${w}” 删除出学习词库；学习历史和笔记会保留`,
    ()=>{
      listState.removedWords=listState.removedWords||{};
      listState.removedWords[w]={removedAt:new Date().toISOString()};
      listState.queue=(listState.queue||[]).filter(x=>String(x).toLowerCase()!==String(w).toLowerCase());
      if(listState.current&&String(listState.current).toLowerCase()===String(w).toLowerCase())listState.current=null;
      persist();
      rerender();
      listToast(`已移出 “${w}”`);
    }
  );
}

const PAGE_SIZE=20;
const pageState={active:1,mastered:1,confusable:1,removed:1};
function lookupHref(w){return "lookup.html?word="+encodeURIComponent(w);}
function pageSlice(rows,key){
  const totalPages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
  pageState[key]=Math.min(Math.max(1,pageState[key]||1),totalPages);
  const start=(pageState[key]-1)*PAGE_SIZE;
  return {items:rows.slice(start,start+PAGE_SIZE),totalPages,page:pageState[key]};
}
function renderPagination(key,totalPages,rerender){
  const el=document.getElementById("pagination"); if(!el)return;
  if(totalPages<=1){el.innerHTML="";return;}
  const page=pageState[key];
  el.innerHTML='<button class="miniBtn pageFirst" '+(page<=1?'disabled':'')+'>« 首页</button><button class="miniBtn pagePrev" '+(page<=1?'disabled':'')+'>‹ 上一页</button><span class="pageInfo">'+page+' / '+totalPages+'</span><div class="pageJump"><input class="pageJumpInput" type="number" inputmode="numeric" min="1" max="'+totalPages+'" value="'+page+'" aria-label="页码"><button class="miniBtn pageGo" type="button">跳转</button></div><button class="miniBtn pageNext" '+(page>=totalPages?'disabled':'')+'>下一页 ›</button><button class="miniBtn pageLast" '+(page>=totalPages?'disabled':'')+'>尾页 »</button>';
  const go=n=>{pageState[key]=Math.min(Math.max(1,n),totalPages);rerender();window.scrollTo({top:0,behavior:"smooth"});};
  el.querySelector('.pageFirst').onclick=()=>go(1);
  el.querySelector('.pagePrev').onclick=()=>go(page-1);
  el.querySelector('.pageNext').onclick=()=>go(page+1);
  el.querySelector('.pageLast').onclick=()=>go(totalPages);
  el.querySelector('.pageGo').onclick=()=>{const n=parseInt(el.querySelector('.pageJumpInput').value,10);if(Number.isFinite(n))go(n);};
  el.querySelector('.pageJumpInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.querySelector('.pageGo').click();}};
}
function renderActive(){
  const root=document.getElementById("listRoot");
  const rows=Object.entries(listState.debts).filter(([w,d])=>Number(d)>0&&!listState.mastered[w]&&!isRemovedListWord(w)).sort((a,b)=>Number(b[1])-Number(a[1])||(listState.highestDebt[b[0]]||0)-(listState.highestDebt[a[0]]||0)||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"active");
  root.innerHTML=pg.items.length?pg.items.map(([w,d])=>{const peak=listState.highestDebt[w]||d,note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';return '<div class="wordListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="wordListMeta">debt '+d+' · peak '+peak+'</div><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">删除</button>'+note+'</div>';}).join(''):'<p>暂无钉子户 🎉</p>';
  root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderActive));
  renderPagination("active",pg.totalPages,renderActive);
}
function reAddWord(w){
  if(!listState.mastered[w]||isRemovedListWord(w))return; delete listState.mastered[w]; listState.debts[w]=1; listState.seen[w]=true; listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1); delete listState.lastReviewedDate[w]; const gap=Math.min(10+Math.floor(Math.random()*16),listState.queue.length); listState.queue.splice(gap,0,w); persist(); renderMastered();
}
function reAddTop(n){
  const rows=Object.keys(listState.mastered).filter(w=>!isRemovedListWord(w)).map(w=>[w,listState.highestDebt[w]||0]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
  rows.forEach(([w])=>{delete listState.mastered[w];listState.debts[w]=1;listState.seen[w]=true;listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1);delete listState.lastReviewedDate[w];listState.queue.push(w);});
  for(let i=listState.queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[listState.queue[i],listState.queue[j]]=[listState.queue[j],listState.queue[i]];} persist(); renderMastered();
}
function renderMastered(){
  const root=document.getElementById("listRoot"); const rows=Object.keys(listState.mastered).filter(w=>!isRemovedListWord(w)).map(w=>[w,listState.highestDebt[w]||0]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])); document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"mastered");
  root.innerHTML=pg.items.length?pg.items.map(([w,peak])=>{const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';return '<div class="wordListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="wordListMeta">peak '+peak+'</div><div class="listRowActions"><button class="miniBtn" data-word="'+encodeURIComponent(w)+'">重新学习</button><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">删除</button></div>'+note+'</div>';}).join(''):'<p>还没有已掌握单词。</p>';
  root.querySelectorAll('[data-word]').forEach(btn=>btn.onclick=()=>reAddWord(decodeURIComponent(btn.dataset.word))); root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderMastered)); renderPagination("mastered",pg.totalPages,renderMastered);
}

function confusableRows(){
  const removed=removedSet();
  const rows=[];
  const seenWords=new Set();
  for(const [rawWord,rawLinks] of Object.entries(listState.linkedWords||{})){
    const word=String(rawWord||"").trim();
    const wordLower=word.toLowerCase();
    if(!word||removed.has(wordLower)||seenWords.has(wordLower)||!Array.isArray(rawLinks))continue;
    const links=[];
    const seenLinks=new Set();
    for(const rawLink of rawLinks){
      const link=String(rawLink||"").trim();
      const low=link.toLowerCase();
      if(!link||low===wordLower||removed.has(low)||seenLinks.has(low))continue;
      seenLinks.add(low);
      links.push(link);
    }
    if(links.length){seenWords.add(wordLower);rows.push([word,links]);}
  }
  return rows.sort((a,b)=>a[0].localeCompare(b[0],undefined,{sensitivity:"base"}));
}
function renderConfusable(){
  const root=document.getElementById("listRoot");
  const rows=confusableRows();
  document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"confusable");
  root.innerHTML=pg.items.length?pg.items.map(([w,links])=>{
    const linked=links.map(x=>'<a class="confusableListChip" href="'+lookupHref(x)+'">'+h(x)+'</a>').join('');
    const encodedGroup=encodeURIComponent(JSON.stringify([w,...links]));
    return '<div class="wordListRow confusableListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="confusableGroupControls"><button class="voiceArrow confusableVoicePrev" type="button" aria-label="上一个语音">‹</button><button class="confusableGroupPlay" type="button" aria-label="依次朗读这一组" data-confusable-group="'+encodedGroup+'">▶️</button><button class="voiceArrow confusableVoiceNext" type="button" aria-label="下一个语音">›</button></div><div class="confusableListLinks">'+linked+'</div><div class="confusableVoiceInfo" data-confusable-voice-info></div></div>';
  }).join(''):'<p>还没有设置易混词。</p>';
  renderPagination("confusable",pg.totalPages,renderConfusable);
  root.querySelectorAll('.confusableGroupPlay').forEach(b=>b.onclick=()=>{try{playConfusableGroup(JSON.parse(decodeURIComponent(b.dataset.confusableGroup||"%5B%5D")));}catch(_){}});
  root.querySelectorAll('.confusableVoicePrev').forEach(b=>b.onclick=()=>changeConfusableVoice(-1));
  root.querySelectorAll('.confusableVoiceNext').forEach(b=>b.onclick=()=>changeConfusableVoice(1));
  updateConfusableVoiceLabels();
}

function restoreRemovedWord(w){
  const key=Object.keys(listState.removedWords||{}).find(k=>k.toLowerCase()===String(w).toLowerCase()); if(!key)return; delete listState.removedWords[key]; const alreadyQueued=(listState.queue||[]).some(x=>String(x).toLowerCase()===String(w).toLowerCase()); const mastered=!!listState.mastered[w]; if(!mastered&&!alreadyQueued)listState.queue.push(w); persist(); renderRemoved(); listToast(`已恢复 “${w}” 到学习词库`);
}
function deleteCaseInsensitiveKey(obj,w){
  if(!obj||typeof obj!=="object")return;
  const target=String(w).toLowerCase();
  for(const key of Object.keys(obj))if(String(key).toLowerCase()===target)delete obj[key];
}
function isCustomListWord(w){
  const target=String(w).toLowerCase();
  return (listState.customWords||[]).some(x=>String(x).toLowerCase()===target);
}
function permanentlyDeleteRemovedWord(w){
  if(!isCustomListWord(w)){
    listToast(`“${w}” 来自基础词库，只能保持已移除，不能彻底删除`);
    return;
  }
  listRequireSecondClick(
    "permanent-delete:"+String(w).toLowerCase(),
    `将彻底删除 “${w}” 的全部记录、发音、笔记和易混词链接；此操作不可恢复`,
    ()=>{
      const target=String(w).toLowerCase();
      listState.customWords=(listState.customWords||[]).filter(x=>String(x).toLowerCase()!==target);
      for(const obj of [listState.customPronunciations,listState.manualPronunciations,listState.debts,listState.mastered,listState.seen,listState.highestDebt,listState.lastReviewedDate,listState.notes,listState.removedWords])deleteCaseInsensitiveKey(obj,w);
      // Remove both the word's own linkedWords entry and every reverse reference to it.
      deleteCaseInsensitiveKey(listState.linkedWords,w);
      for(const key of Object.keys(listState.linkedWords||{})){
        if(Array.isArray(listState.linkedWords[key])){
          listState.linkedWords[key]=listState.linkedWords[key].filter(x=>String(x).toLowerCase()!==target);
          if(listState.linkedWords[key].length===0)delete listState.linkedWords[key];
        }
      }
      listState.queue=(listState.queue||[]).filter(x=>String(x).toLowerCase()!==target);
      if(listState.current&&String(listState.current).toLowerCase()===target)listState.current=null;
      persist();
      renderRemoved();
      listToast(`已彻底删除 “${w}” 及其全部记录`);
    }
  );
}
function renderRemoved(){
  const root=document.getElementById("listRoot"); const rows=Object.entries(listState.removedWords||{}).map(([w,meta])=>[w,meta||{}]).sort((a,b)=>String(b[1].removedAt||"").localeCompare(String(a[1].removedAt||""))||a[0].localeCompare(b[0])); document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"removed");
  root.innerHTML=pg.items.length?pg.items.map(([w,meta])=>{const status=listState.mastered[w]?'原状态：已掌握':(Number(listState.debts[w]||0)>0?'原状态：学习中 · debt '+listState.debts[w]:'原状态：未学习 / 无 debt'),date=meta.removedAt?new Date(meta.removedAt).toLocaleDateString():"",note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'',permanent=isCustomListWord(w)?'<button class="miniBtn dangerLite" data-permanent="'+encodeURIComponent(w)+'">彻底删除</button>':'';return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">'+h(status)+(date?' · '+h(date):'')+'</div><div class="listRowActions"><button class="miniBtn" data-restore="'+encodeURIComponent(w)+'">恢复词库</button>'+permanent+'</div>'+note+'</div>';}).join(''):'<p>暂无已移除单词。</p>';
  root.querySelectorAll('[data-restore]').forEach(btn=>btn.onclick=()=>restoreRemovedWord(decodeURIComponent(btn.dataset.restore)));
  root.querySelectorAll('[data-permanent]').forEach(btn=>btn.onclick=()=>permanentlyDeleteRemovedWord(decodeURIComponent(btn.dataset.permanent)));
  renderPagination("removed",pg.totalPages,renderRemoved);
}


// v3.32.5: auditory comparison controls for confusable-word groups.
let confusableVoices=[];
let confusablePlaybackToken=0;
const CONFUSABLE_PAUSE_KEY="audio_vocab_sprint_confusable_pause_ms";
function confusablePreferredVoices(){
  const all=speechSynthesis.getVoices();
  const en=all.filter(v=>/^en([-_]|$)/i.test(v.lang||""));
  const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;
  const preferred=en.filter(v=>!novelty.test(v.name||""));
  return preferred.length>=2?preferred:(en.length?en:all);
}
function refreshConfusableVoices(){confusableVoices=confusablePreferredVoices();updateConfusableVoiceLabels();}
function confusableSelectedVoice(){
  if(!confusableVoices.length)return null;
  const i=((Number(listState.voiceIndex)||0)%confusableVoices.length+confusableVoices.length)%confusableVoices.length;
  return confusableVoices[i];
}
function updateConfusableVoiceLabels(){
  const v=confusableSelectedVoice();
  document.querySelectorAll('[data-confusable-voice-info]').forEach(el=>el.textContent=v?"Voice: "+v.name:"");
}
function changeConfusableVoice(step){
  refreshConfusableVoices();
  if(!confusableVoices.length)return;
  speechSynthesis.cancel();confusablePlaybackToken++;
  const n=confusableVoices.length;
  listState.voiceIndex=((Number(listState.voiceIndex)||0)+step+n)%n;
  persist();updateConfusableVoiceLabels();
}
function confusablePauseMs(){
  const raw=Number(localStorage.getItem(CONFUSABLE_PAUSE_KEY));
  return Number.isFinite(raw)?Math.min(5000,Math.max(0,raw)):700;
}
function playConfusableGroup(words){
  const seq=(words||[]).map(x=>String(x||"").trim()).filter(Boolean);
  if(!seq.length)return;
  refreshConfusableVoices();speechSynthesis.cancel();
  const token=++confusablePlaybackToken, pause=confusablePauseMs(), voice=confusableSelectedVoice();
  const next=i=>{
    if(token!==confusablePlaybackToken||i>=seq.length)return;
    const u=new SpeechSynthesisUtterance(seq[i]);u.lang="en-US";u.rate=.86;if(voice)u.voice=voice;
    u.onend=()=>{if(token===confusablePlaybackToken)setTimeout(()=>next(i+1),pause);};
    u.onerror=()=>{if(token===confusablePlaybackToken)setTimeout(()=>next(i+1),pause);};
    speechSynthesis.speak(u);
  };next(0);
}
function openConfusableReadSettings(){
  const old=document.getElementById('confusableReadSettingsBackdrop');if(old)old.remove();
  const wrap=document.createElement('div');wrap.id='confusableReadSettingsBackdrop';wrap.className='ipaEditorBackdrop';
  const current=confusablePauseMs();
  wrap.innerHTML='<div class="ipaEditor confusableReadSettings" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>朗读设置</b><button class="ipaEditorClose" type="button" aria-label="关闭">×</button></div><div class="ipaEditorSource">设置同一组中每个单词朗读结束后，到下一个单词开始前的停顿时间。</div><div class="ipaEditorRow"><label>单词间停顿</label><div class="pauseSettingRow"><input id="confusablePauseRange" type="range" min="0" max="3000" step="100" value="'+current+'"><input id="confusablePauseNumber" class="ipaEditorInput pauseNumber" type="number" min="0" max="5000" step="100" value="'+current+'"><span>ms</span></div></div><div class="ipaEditorHint">0–5000 ms；默认 700 ms。这个设置只影响易混词整组朗读。</div><div class="ipaEditorActions"><button type="button" id="confusablePauseDefault">恢复默认</button><button type="button" class="ipaSave" id="confusablePauseSave">保存</button></div></div>';
  document.body.appendChild(wrap);
  const range=wrap.querySelector('#confusablePauseRange'), num=wrap.querySelector('#confusablePauseNumber');
  range.oninput=()=>{num.value=range.value;};num.oninput=()=>{const v=Math.min(3000,Math.max(0,Number(num.value)||0));range.value=v;};
  const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  wrap.querySelector('#confusablePauseDefault').onclick=()=>{range.value='700';num.value='700';};
  wrap.querySelector('#confusablePauseSave').onclick=()=>{const v=Math.min(5000,Math.max(0,Number(num.value)||0));localStorage.setItem(CONFUSABLE_PAUSE_KEY,String(v));close();listToast('易混词朗读停顿已设为 '+v+' ms');};
}
function initConfusableReading(){
  refreshConfusableVoices();
  if('speechSynthesis' in window){speechSynthesis.addEventListener?.('voiceschanged',refreshConfusableVoices);}
  const b=document.getElementById('confusableReadSettingsBtn');if(b)b.onclick=openConfusableReadSettings;
}
