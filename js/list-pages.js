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
const pageState={active:1,mastered:1,removed:1};
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
function restoreRemovedWord(w){
  const key=Object.keys(listState.removedWords||{}).find(k=>k.toLowerCase()===String(w).toLowerCase()); if(!key)return; delete listState.removedWords[key]; const alreadyQueued=(listState.queue||[]).some(x=>String(x).toLowerCase()===String(w).toLowerCase()); const mastered=!!listState.mastered[w]; if(!mastered&&!alreadyQueued)listState.queue.push(w); persist(); renderRemoved(); listToast(`已恢复 “${w}” 到学习词库`);
}
function renderRemoved(){
  const root=document.getElementById("listRoot"); const rows=Object.entries(listState.removedWords||{}).map(([w,meta])=>[w,meta||{}]).sort((a,b)=>String(b[1].removedAt||"").localeCompare(String(a[1].removedAt||""))||a[0].localeCompare(b[0])); document.getElementById("count").textContent=rows.length;
  const pg=pageSlice(rows,"removed");
  root.innerHTML=pg.items.length?pg.items.map(([w,meta])=>{const status=listState.mastered[w]?'原状态：已掌握':(Number(listState.debts[w]||0)>0?'原状态：学习中 · debt '+listState.debts[w]:'原状态：未学习 / 无 debt'),date=meta.removedAt?new Date(meta.removedAt).toLocaleDateString():"",note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">'+h(status)+(date?' · '+h(date):'')+'</div><button class="miniBtn" data-restore="'+encodeURIComponent(w)+'">恢复词库</button>'+note+'</div>';}).join(''):'<p>暂无已移除单词。</p>';
  root.querySelectorAll('[data-restore]').forEach(btn=>btn.onclick=()=>restoreRemovedWord(decodeURIComponent(btn.dataset.restore))); renderPagination("removed",pg.totalPages,renderRemoved);
}
