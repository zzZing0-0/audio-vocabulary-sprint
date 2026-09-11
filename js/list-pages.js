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
function removedSet(){return new Set(Object.keys(listState.removedWords||{}).map(w=>w.toLowerCase()));}
function isRemovedListWord(w){return removedSet().has(String(w).toLowerCase());}

function removeListWord(w,rerender){
  if(!w)return;
  if(!confirm(`把 “${w}” 移出学习词库？

可在「已移除」页面恢复，学习历史不会删除。`))return;
  listState.removedWords=listState.removedWords||{};
  listState.removedWords[w]={removedAt:new Date().toISOString()};
  listState.queue=(listState.queue||[]).filter(x=>String(x).toLowerCase()!==String(w).toLowerCase());
  if(listState.current&&String(listState.current).toLowerCase()===String(w).toLowerCase())listState.current=null;
  persist();
  rerender();
}

function renderActive(){
  const root=document.getElementById("listRoot");
  const rows=Object.entries(listState.debts)
    .filter(([w,d])=>Number(d)>0&&!listState.mastered[w]&&!isRemovedListWord(w))
    .sort((a,b)=>Number(b[1])-Number(a[1])||(listState.highestDebt[b[0]]||0)-(listState.highestDebt[a[0]]||0)||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  root.innerHTML=rows.length?rows.map(([w,d])=>{
    const peak=listState.highestDebt[w]||d;
    const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';
    return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">debt '+d+' · peak '+peak+'</div><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">移出词库</button>'+note+'</div>';
  }).join(''):'<p>暂无钉子户 🎉</p>';
  root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderActive));
}

function reAddWord(w){
  if(!listState.mastered[w]||isRemovedListWord(w))return;
  delete listState.mastered[w];
  listState.debts[w]=1;
  listState.seen[w]=true;
  listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1);
  delete listState.lastReviewedDate[w];
  const gap=Math.min(10+Math.floor(Math.random()*16),listState.queue.length);
  listState.queue.splice(gap,0,w);
  persist();
  renderMastered();
}

function reAddTop(n){
  const rows=Object.keys(listState.mastered)
    .filter(w=>!isRemovedListWord(w))
    .map(w=>[w,listState.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
  rows.forEach(([w])=>{
    delete listState.mastered[w];
    listState.debts[w]=1;
    listState.seen[w]=true;
    listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1);
    delete listState.lastReviewedDate[w];
    listState.queue.push(w);
  });
  for(let i=listState.queue.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [listState.queue[i],listState.queue[j]]=[listState.queue[j],listState.queue[i]];
  }
  persist();
  renderMastered();
}

function renderMastered(){
  const root=document.getElementById("listRoot");
  const rows=Object.keys(listState.mastered)
    .filter(w=>!isRemovedListWord(w))
    .map(w=>[w,listState.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  root.innerHTML=rows.length?rows.map(([w,peak])=>{
    const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';
    return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">peak '+peak+'</div><div class="listRowActions"><button class="miniBtn" data-word="'+encodeURIComponent(w)+'">重新加入</button><button class="miniBtn dangerLite" data-remove="'+encodeURIComponent(w)+'">移出词库</button></div>'+note+'</div>';
  }).join(''):'<p>还没有已掌握单词。</p>';
  root.querySelectorAll('[data-word]').forEach(btn=>btn.onclick=()=>reAddWord(decodeURIComponent(btn.dataset.word)));
  root.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>removeListWord(decodeURIComponent(btn.dataset.remove),renderMastered));
}

function restoreRemovedWord(w){
  const key=Object.keys(listState.removedWords||{}).find(k=>k.toLowerCase()===String(w).toLowerCase());
  if(!key)return;
  delete listState.removedWords[key];

  const alreadyQueued=(listState.queue||[]).some(x=>String(x).toLowerCase()===String(w).toLowerCase());
  const mastered=!!listState.mastered[w];
  if(!mastered&&!alreadyQueued)listState.queue.push(w);

  persist();
  renderRemoved();
}

function renderRemoved(){
  const root=document.getElementById("listRoot");
  const rows=Object.entries(listState.removedWords||{})
    .map(([w,meta])=>[w,meta||{}])
    .sort((a,b)=>String(b[1].removedAt||"").localeCompare(String(a[1].removedAt||""))||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  root.innerHTML=rows.length?rows.map(([w,meta])=>{
    const status=listState.mastered[w]?'原状态：已掌握':(Number(listState.debts[w]||0)>0?'原状态：学习中 · debt '+listState.debts[w]:'原状态：未学习 / 无 debt');
    const date=meta.removedAt?new Date(meta.removedAt).toLocaleDateString():"";
    const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';
    return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">'+h(status)+(date?' · '+h(date):'')+'</div><button class="miniBtn" data-restore="'+encodeURIComponent(w)+'">恢复词库</button>'+note+'</div>';
  }).join(''):'<p>暂无已移除单词。</p>';
  root.querySelectorAll('[data-restore]').forEach(btn=>btn.onclick=()=>restoreRemovedWord(decodeURIComponent(btn.dataset.restore)));
}
