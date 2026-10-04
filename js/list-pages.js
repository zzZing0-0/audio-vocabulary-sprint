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
listState.tags=(listState.tags&&typeof listState.tags==="object"&&!Array.isArray(listState.tags))?listState.tags:{};
listState.wordTags=(listState.wordTags&&typeof listState.wordTags==="object"&&!Array.isArray(listState.wordTags))?listState.wordTags:{};


const BLOCKED_VOICES_KEY="audio_vocab_sprint_blocked_voices_v1";
function listVoiceIdentity(v){return [v?.name||"",v?.lang||"",v?.voiceURI||""].join("\u241f");}
function listBlockedVoiceKeys(){try{const x=JSON.parse(localStorage.getItem(BLOCKED_VOICES_KEY)||"[]");return new Set((Array.isArray(x)?x:[]).map(r=>r.key||[r.name||"",r.lang||"",r.voiceURI||""].join("\u241f")));}catch(_){return new Set();}}
function listFilterBlockedVoices(a){const b=listBlockedVoiceKeys();return (a||[]).filter(v=>!b.has(listVoiceIdentity(v)));}

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
  root.innerHTML=pg.items.length?pg.items.map(([w,d])=>{const peak=listState.highestDebt[w]||d,note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';return '<div class="wordListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="wordListMeta">debt '+d+' · peak '+peak+'</div><div class="listRowActions"><button class="miniBtn listListenFrom" data-listen-from="'+encodeURIComponent(w)+'" title="从这个词开始连续播放">从此播放</button><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">删除</button></div>'+note+'</div>';}).join(''):'<p>暂无钉子户 🎉</p>';
  root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderActive));
  root.querySelectorAll('[data-listen-from]').forEach(btn=>btn.onclick=()=>openLibraryPlayer('active',decodeURIComponent(btn.dataset.listenFrom)));
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
  root.innerHTML=pg.items.length?pg.items.map(([w,peak])=>{const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';return '<div class="wordListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="wordListMeta">peak '+peak+'</div><div class="listRowActions"><button class="miniBtn listListenFrom" data-listen-from="'+encodeURIComponent(w)+'" title="从这个词开始连续播放">从此播放</button><button class="miniBtn" data-word="'+encodeURIComponent(w)+'">重新学习</button><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">删除</button></div>'+note+'</div>';}).join(''):'<p>还没有已掌握单词。</p>';
  root.querySelectorAll('[data-word]').forEach(btn=>btn.onclick=()=>reAddWord(decodeURIComponent(btn.dataset.word))); root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderMastered)); root.querySelectorAll('[data-listen-from]').forEach(btn=>btn.onclick=()=>openLibraryPlayer('mastered',decodeURIComponent(btn.dataset.listenFrom))); renderPagination("mastered",pg.totalPages,renderMastered);
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
function audioIcon(kind){
  const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if(kind==="play")return '<svg '+common+'><path d="M8 5.5v13l10-6.5z"/></svg>';
  if(kind==="stop")return '<svg '+common+'><path d="M7 7h10v10H7z"/></svg>';
  if(kind==="prev")return '<svg '+common+'><path d="M15.5 5.5 9 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if(kind==="next")return '<svg '+common+'><path d="m8.5 5.5 6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if(kind==="restart")return '<svg '+common+'><path d="M5.5 8.5V4.8M5.5 4.8h3.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.1 5.4A8 8 0 1 1 4.4 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return '';
}
function renderConfusable(){
  const root=document.getElementById("listRoot");
  const rows=confusableRows();
  document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"confusable");
  root.innerHTML=pg.items.length?pg.items.map(([w,links])=>{
    const linked=links.map(x=>'<a class="confusableListChip" href="'+lookupHref(x)+'">'+h(x)+'</a>').join('');
    const encodedGroup=encodeURIComponent(JSON.stringify([w,...links]));
    return '<div class="wordListRow confusableListRow"><a class="wordListWord wordLookupLink" href="'+lookupHref(w)+'">'+h(w)+'</a><div class="confusableGroupControls" data-confusable-group="'+encodedGroup+'"><button class="audioIconBtn confusableVoicePrev" type="button" aria-label="切换到上一个语音并朗读这一组">'+audioIcon('prev')+'</button><button class="audioIconBtn confusableGroupPlay" type="button" aria-label="依次朗读这一组">'+audioIcon('play')+'</button><button class="audioIconBtn confusableVoiceNext" type="button" aria-label="切换到下一个语音并朗读这一组">'+audioIcon('next')+'</button></div><div class="confusableListLinks">'+linked+'</div></div>';
  }).join(''):'<p>还没有设置易混词。</p>';
  renderPagination("confusable",pg.totalPages,renderConfusable);
  root.querySelectorAll('.confusableGroupControls').forEach(box=>{
    let group=[];try{group=JSON.parse(decodeURIComponent(box.dataset.confusableGroup||"%5B%5D"));}catch(_){}
    const play=box.querySelector('.confusableGroupPlay'),prev=box.querySelector('.confusableVoicePrev'),next=box.querySelector('.confusableVoiceNext');
    if(play)play.onclick=()=>playConfusableGroup(group);
    if(prev)prev.onclick=()=>changeConfusableVoice(-1,group);
    if(next)next.onclick=()=>changeConfusableVoice(1,group);
  });
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
      delete listState.wordTags[target];
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


// v4.0.2: auditory comparison controls with one global voice display.
let confusableVoices=[];
let confusablePlaybackToken=0;
const CONFUSABLE_PAUSE_KEY="audio_vocab_sprint_confusable_pause_ms";
function confusablePreferredVoices(){
  const all=speechSynthesis.getVoices();
  const en=all.filter(v=>/^en([-_]|$)/i.test(v.lang||""));
  const novelty=/(bells?|boing|bubbles?|cellos?|good news|bad news|whisper|wobble|zarvox|trinoids?|organ|superstar|jester|bahh|deranged|hysterical|robot|novelty)/i;
  const preferred=en.filter(v=>!novelty.test(v.name||""));
  return listFilterBlockedVoices(preferred.length>=2?preferred:(en.length?en:all));
}
function refreshConfusableVoices(){confusableVoices=confusablePreferredVoices();updateConfusableVoiceLabels();}
function confusableSelectedVoice(){
  if(!confusableVoices.length)return null;
  const i=((Number(listState.voiceIndex)||0)%confusableVoices.length+confusableVoices.length)%confusableVoices.length;
  return confusableVoices[i];
}
function updateConfusableVoiceLabels(){
  const v=confusableSelectedVoice(),el=document.getElementById('confusableGlobalVoice');
  if(!el)return;
  el.textContent=v?"Voice: "+v.name+(v.lang?"（"+v.lang.replace('-', ' · ')+"）":""):"Voice: —";
}
function changeConfusableVoice(step,words){
  refreshConfusableVoices();
  if(!confusableVoices.length)return;
  speechSynthesis.cancel();confusablePlaybackToken++;
  const n=confusableVoices.length;
  listState.voiceIndex=((Number(listState.voiceIndex)||0)+step+n)%n;
  persist();updateConfusableVoiceLabels();
  if(Array.isArray(words)&&words.length)playConfusableGroup(words);
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
    const u=new SpeechSynthesisUtterance(seq[i]);u.lang=(voice&&voice.lang)||"en-US";u.rate=.86;if(voice)u.voice=voice;
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


// v4.0.2: continuous whole-library listening for Active / Mastered.
const LIBRARY_PLAYER_PAUSE_KEY="audio_vocab_sprint_library_player_pause_ms";
const LIBRARY_PLAYER_REPEAT_KEY="audio_vocab_sprint_library_player_repeat";
const LIBRARY_PLAYER_POS_PREFIX="audio_vocab_sprint_library_player_pos_";
let libraryPlayer={type:null,words:[],index:0,repeatIndex:0,playing:false,token:0,voices:[],modal:null};
function libraryWords(type){
  if(type==='active')return Object.entries(listState.debts).filter(([w,d])=>Number(d)>0&&!listState.mastered[w]&&!isRemovedListWord(w)).sort((a,b)=>Number(b[1])-Number(a[1])||(listState.highestDebt[b[0]]||0)-(listState.highestDebt[a[0]]||0)||a[0].localeCompare(b[0])).map(x=>x[0]);
  return Object.keys(listState.mastered).filter(w=>!isRemovedListWord(w)).map(w=>[w,listState.highestDebt[w]||0]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(x=>x[0]);
}
function libraryPauseMs(){const n=Number(localStorage.getItem(LIBRARY_PLAYER_PAUSE_KEY));return Number.isFinite(n)?Math.min(5000,Math.max(0,n)):700;}
function libraryRepeat(){const n=Number(localStorage.getItem(LIBRARY_PLAYER_REPEAT_KEY));return Number.isFinite(n)?Math.min(5,Math.max(1,Math.round(n))):1;}
function libraryPlayerVoice(){
  if(!libraryPlayer.voices.length)libraryPlayer.voices=confusablePreferredVoices();
  if(!libraryPlayer.voices.length)return null;
  const i=((Number(listState.voiceIndex)||0)%libraryPlayer.voices.length+libraryPlayer.voices.length)%libraryPlayer.voices.length;
  return libraryPlayer.voices[i];
}
function saveLibraryPosition(){if(libraryPlayer.type)localStorage.setItem(LIBRARY_PLAYER_POS_PREFIX+libraryPlayer.type,String(libraryPlayer.index));}
function renderLibraryPlayer(){
  const m=libraryPlayer.modal;if(!m)return;
  const word=libraryPlayer.words[libraryPlayer.index]||'—',v=libraryPlayerVoice();
  m.querySelector('#libraryPlayerCount').textContent=libraryPlayer.words.length?(libraryPlayer.index+1)+' / '+libraryPlayer.words.length:'0 / 0';
  m.querySelector('#libraryPlayerWord').textContent=word;
  m.querySelector('#libraryPlayerVoice').textContent=v?(v.name+(v.lang?' · '+v.lang:'')):'—';
  m.querySelector('#libraryPlayerToggle').innerHTML=audioIcon(libraryPlayer.playing?'stop':'play');
  m.querySelector('#libraryPlayerToggle').setAttribute('aria-label',libraryPlayer.playing?'停止连续播放':'开始连续播放');
  m.querySelector('#libraryPlayerPrev').disabled=libraryPlayer.index<=0;
  m.querySelector('#libraryPlayerNext').disabled=libraryPlayer.index>=libraryPlayer.words.length-1;
}
function stopLibraryPlayer(){libraryPlayer.token++;libraryPlayer.playing=false;speechSynthesis.cancel();renderLibraryPlayer();}
function speakLibraryCurrent(resetRepeat=true){
  if(!libraryPlayer.words.length)return;
  if(resetRepeat)libraryPlayer.repeatIndex=0;
  libraryPlayer.playing=true;const token=++libraryPlayer.token;renderLibraryPlayer();saveLibraryPosition();
  const speakOne=()=>{
    if(token!==libraryPlayer.token||!libraryPlayer.playing)return;
    const word=libraryPlayer.words[libraryPlayer.index];if(!word){stopLibraryPlayer();return;}
    const voice=libraryPlayerVoice(),u=new SpeechSynthesisUtterance(word);u.lang=(voice&&voice.lang)||'en-US';u.rate=.86;if(voice)u.voice=voice;
    u.onend=u.onerror=()=>{
      if(token!==libraryPlayer.token||!libraryPlayer.playing)return;
      const pause=libraryPauseMs(),repeat=libraryRepeat();
      if(libraryPlayer.repeatIndex+1<repeat){libraryPlayer.repeatIndex++;setTimeout(speakOne,pause);return;}
      if(libraryPlayer.index>=libraryPlayer.words.length-1){libraryPlayer.playing=false;libraryPlayer.repeatIndex=0;renderLibraryPlayer();return;}
      libraryPlayer.index++;libraryPlayer.repeatIndex=0;saveLibraryPosition();renderLibraryPlayer();setTimeout(speakOne,pause);
    };
    speechSynthesis.speak(u);
  };
  speechSynthesis.cancel();speakOne();
}
function moveLibraryPlayer(step){
  if(!libraryPlayer.words.length)return;
  const wasPlaying=libraryPlayer.playing;libraryPlayer.token++;speechSynthesis.cancel();
  libraryPlayer.index=Math.min(libraryPlayer.words.length-1,Math.max(0,libraryPlayer.index+step));libraryPlayer.repeatIndex=0;saveLibraryPosition();renderLibraryPlayer();
  if(wasPlaying)speakLibraryCurrent(true);else{libraryPlayer.playing=true;speakLibraryCurrent(true);}
}
function restartLibraryPlayer(){
  if(!libraryPlayer.words.length)return;libraryPlayer.token++;speechSynthesis.cancel();libraryPlayer.index=0;libraryPlayer.repeatIndex=0;saveLibraryPosition();speakLibraryCurrent(true);
}
function changeLibraryPlayerVoice(step){
  libraryPlayer.voices=confusablePreferredVoices();if(!libraryPlayer.voices.length)return;
  const n=libraryPlayer.voices.length;listState.voiceIndex=((Number(listState.voiceIndex)||0)+step+n)%n;persist();updateConfusableVoiceLabels();
  const wasPlaying=libraryPlayer.playing;libraryPlayer.token++;speechSynthesis.cancel();renderLibraryPlayer();
  if(wasPlaying)speakLibraryCurrent(true);
}
function openLibraryPlayer(type,startWord){
  const words=libraryWords(type);if(!words.length){listToast('这个词库目前没有可播放的单词');return;}
  const old=document.getElementById('libraryPlayerBackdrop');if(old)old.remove();
  let idx=-1;if(startWord)idx=words.findIndex(w=>String(w).toLowerCase()===String(startWord).toLowerCase());
  if(idx<0){const saved=parseInt(localStorage.getItem(LIBRARY_PLAYER_POS_PREFIX+type)||'0',10);idx=Number.isFinite(saved)?Math.min(words.length-1,Math.max(0,saved)):0;}
  libraryPlayer={type,words,index:idx,repeatIndex:0,playing:false,token:libraryPlayer.token+1,voices:confusablePreferredVoices(),modal:null};
  const wrap=document.createElement('div');wrap.id='libraryPlayerBackdrop';wrap.className='ipaEditorBackdrop';
  wrap.innerHTML='<div class="ipaEditor libraryPlayer" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>'+(type==='active'?'学习中':'已掌握')+' · 连续播放</b><button class="ipaEditorClose" type="button" aria-label="关闭">×</button></div><div class="libraryPlayerCount" id="libraryPlayerCount"></div><div class="libraryPlayerWord" id="libraryPlayerWord"></div><div class="libraryVoiceRow"><button class="audioIconBtn" id="libraryVoicePrev" type="button" aria-label="上一个语音">'+audioIcon('prev')+'</button><div class="libraryPlayerVoice" id="libraryPlayerVoice"></div><button class="audioIconBtn" id="libraryVoiceNext" type="button" aria-label="下一个语音">'+audioIcon('next')+'</button></div><div class="libraryTransport"><button class="audioIconBtn" id="libraryPlayerRestart" type="button" aria-label="从头播放" title="从头播放">'+audioIcon('restart')+'</button><button class="audioIconBtn" id="libraryPlayerPrev" type="button" aria-label="上一个单词">'+audioIcon('prev')+'</button><button class="audioIconBtn audioIconPrimary" id="libraryPlayerToggle" type="button" aria-label="开始连续播放">'+audioIcon('play')+'</button><button class="audioIconBtn" id="libraryPlayerNext" type="button" aria-label="下一个单词">'+audioIcon('next')+'</button></div><div class="libraryTransportLabels"><span>从头</span><span>上一个</span><span>播放 / 停止</span><span>下一个</span></div><div class="librarySettings"><div class="librarySetting"><label for="libraryRepeatInput">每词朗读次数</label><input id="libraryRepeatInput" type="number" min="1" max="5" step="1" value="'+libraryRepeat()+'"><span>次</span></div><div class="librarySetting"><label for="libraryPauseInput">词间停顿</label><input id="libraryPauseInput" type="number" min="0" max="5000" step="100" value="'+libraryPauseMs()+'"><span>ms</span></div></div><div class="ipaEditorHint">设置保存在本机。连续播放会跨越分页，一直播放到这个词库的最后一个词。</div></div>';
  document.body.appendChild(wrap);libraryPlayer.modal=wrap;renderLibraryPlayer();
  const close=()=>{stopLibraryPlayer();wrap.remove();libraryPlayer.modal=null;};wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  wrap.querySelector('#libraryPlayerToggle').onclick=()=>{if(libraryPlayer.playing)stopLibraryPlayer();else speakLibraryCurrent(true);};
  wrap.querySelector('#libraryPlayerRestart').onclick=restartLibraryPlayer;wrap.querySelector('#libraryPlayerPrev').onclick=()=>moveLibraryPlayer(-1);wrap.querySelector('#libraryPlayerNext').onclick=()=>moveLibraryPlayer(1);
  wrap.querySelector('#libraryVoicePrev').onclick=()=>changeLibraryPlayerVoice(-1);wrap.querySelector('#libraryVoiceNext').onclick=()=>changeLibraryPlayerVoice(1);
  wrap.querySelector('#libraryRepeatInput').onchange=e=>{const v=Math.min(5,Math.max(1,Math.round(Number(e.target.value)||1)));e.target.value=v;localStorage.setItem(LIBRARY_PLAYER_REPEAT_KEY,String(v));};
  wrap.querySelector('#libraryPauseInput').onchange=e=>{const v=Math.min(5000,Math.max(0,Math.round(Number(e.target.value)||0)));e.target.value=v;localStorage.setItem(LIBRARY_PLAYER_PAUSE_KEY,String(v));};
}
function initLibraryPlayerButton(type){const b=document.getElementById('continuousPlayBtn');if(b)b.onclick=()=>openLibraryPlayer(type);}
