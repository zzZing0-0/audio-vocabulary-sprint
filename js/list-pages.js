const LIST_KEY="audio_vocab_sprint_universal_v3";
let listState=JSON.parse(localStorage.getItem(LIST_KEY)||"null")||{};
listState.debts=listState.debts||{};
listState.mastered=listState.mastered||{};
listState.highestDebt=listState.highestDebt||{};
listState.lastReviewedDate=listState.lastReviewedDate||{};
listState.notes=(listState.notes&&typeof listState.notes==="object")?listState.notes:{};
listState.queue=Array.isArray(listState.queue)?listState.queue:[];

function h(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function persist(){localStorage.setItem(LIST_KEY,JSON.stringify(listState));}

function renderActive(){
  const root=document.getElementById("listRoot");
  const rows=Object.entries(listState.debts)
    .filter(([w,d])=>Number(d)>0&&!listState.mastered[w])
    .sort((a,b)=>Number(b[1])-Number(a[1])||(listState.highestDebt[b[0]]||0)-(listState.highestDebt[a[0]]||0)||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  root.innerHTML=rows.length?rows.map(([w,d])=>{
    const peak=listState.highestDebt[w]||d;
    const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';
    return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">debt '+d+' · peak '+peak+'</div>'+note+'</div>';
  }).join(''):'<p>暂无钉子户 🎉</p>';
}

function reAddWord(w){
  if(!listState.mastered[w]) return;
  delete listState.mastered[w];
  listState.debts[w]=1;
  listState.seen=listState.seen||{}; listState.seen[w]=true;
  listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1);
  delete listState.lastReviewedDate[w];
  const gap=Math.min(10+Math.floor(Math.random()*16),listState.queue.length);
  listState.queue.splice(gap,0,w);
  persist(); renderMastered();
}
function reAddTop(n){
  const rows=Object.keys(listState.mastered)
    .map(w=>[w,listState.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
  listState.seen=listState.seen||{};
  rows.forEach(([w])=>{
    delete listState.mastered[w]; listState.debts[w]=1; listState.seen[w]=true;
    listState.highestDebt[w]=Math.max(listState.highestDebt[w]||0,1);
    delete listState.lastReviewedDate[w]; listState.queue.push(w);
  });
  for(let i=listState.queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[listState.queue[i],listState.queue[j]]=[listState.queue[j],listState.queue[i]];}
  persist(); renderMastered();
}
function renderMastered(){
  const root=document.getElementById("listRoot");
  const rows=Object.keys(listState.mastered)
    .map(w=>[w,listState.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  document.getElementById("count").textContent=rows.length;
  root.innerHTML=rows.length?rows.map(([w,peak])=>{
    const note=listState.notes[w]?'<div class="wordListNote">📝 '+h(listState.notes[w])+'</div>':'';
    return '<div class="wordListRow"><div class="wordListWord">'+h(w)+'</div><div class="wordListMeta">peak '+peak+'</div><button class="miniBtn" data-word="'+encodeURIComponent(w)+'">重新加入</button>'+note+'</div>';
  }).join(''):'<p>还没有已掌握单词。</p>';
  root.querySelectorAll('[data-word]').forEach(btn=>btn.onclick=()=>reAddWord(decodeURIComponent(btn.dataset.word)));
}
