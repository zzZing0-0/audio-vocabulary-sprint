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
