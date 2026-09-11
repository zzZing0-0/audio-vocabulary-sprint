function localDateKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function activeEligibleToday(w){
  return (state.debts[w]||0)>0 && !state.mastered[w] && state.lastReviewedDate[w]!==localDateKey();
}

let lastJudgmentSnapshot=null;
let judgmentTimer=null;

function cloneLearningSnapshot(){
  return {
    debts:JSON.parse(JSON.stringify(state.debts||{})),
    mastered:JSON.parse(JSON.stringify(state.mastered||{})),
    seen:JSON.parse(JSON.stringify(state.seen||{})),
    highestDebt:JSON.parse(JSON.stringify(state.highestDebt||{})),
    lastReviewedDate:JSON.parse(JSON.stringify(state.lastReviewedDate||{})),
    removedWords:JSON.parse(JSON.stringify(state.removedWords||{})),
    current:state.current,
    queue:Array.isArray(state.queue)?state.queue.slice():[],
    queueDate:state.queueDate
  };
}

function armUndo(){
  lastJudgmentSnapshot=cloneLearningSnapshot();
  const b=document.getElementById("undoBtn");
  if(b)b.disabled=false;
}

function clearUndo(){
  lastJudgmentSnapshot=null;
  const b=document.getElementById("undoBtn");
  if(b)b.disabled=true;
}

function undoLastJudgment(){
  if(!lastJudgmentSnapshot)return;

  if(judgmentTimer){
    clearTimeout(judgmentTimer);
    judgmentTimer=null;
  }

  speechSynthesis.cancel();
  resetWordDissolve();

  const s=lastJudgmentSnapshot;
  state.debts=s.debts;
  state.mastered=s.mastered;
  state.seen=s.seen;
  state.highestDebt=s.highestDebt;
  state.lastReviewedDate=s.lastReviewedDate;
  state.removedWords=s.removedWords||{};
  state.current=s.current;
  state.queue=s.queue;
  state.queueDate=s.queueDate;

  clearUndo();
  save();

  if(state.current){
    reveal();
    const badge=document.querySelector("#answer .debtBadge");
    if(badge){
      badge.textContent="↶ 已撤回";
      badge.classList.remove("passBadge","againBadge");
    }
    const hint=document.getElementById("hint");
    if(hint)hint.textContent="上一步已撤回；当前单词已恢复。";
    setTimeout(()=>speakCurrent(),80);
  }
}

function eligible(){
  return allWords().filter(w=>!state.mastered[w] && (!(state.debts[w]>0) || activeEligibleToday(w)));
}

function refill(){
  let unseen=allWords().filter(w=>!state.seen[w]&&!state.mastered[w]);
  let debt=allWords().filter(w=>activeEligibleToday(w));
  shuffle(unseen);

  // Weighted random review order: higher-debt words tend to surface earlier,
  // while still retaining randomness among Active words.
  debt=debt
    .map(w=>({
      w,
      key:-Math.log(Math.max(Math.random(),1e-9))/Math.max(1,Number(state.debts[w])||1)
    }))
    .sort((a,b)=>a.key-b.key)
    .map(x=>x.w);

  // Interleave retrieval practice instead of burying Active words under thousands of unseen.
  // About 20% of a mixed session is review: 4 unseen + 1 Active.
  let q=[], ui=0, di=0;
  while(ui<unseen.length || di<debt.length){
    for(let k=0;k<4 && ui<unseen.length;k++) q.push(unseen[ui++]);
    if(di<debt.length) q.push(debt[di++]);
  }
  state.queue=q;
  state.queueDate=localDateKey();
}

function popNextEligible(){
  const today=localDateKey();
  while(state.queue.length){
    const w=state.queue.shift();
    if(isRemovedWord(w)) continue;
    if(state.mastered[w]) continue;
    if((state.debts[w]||0)>0 && state.lastReviewedDate[w]===today) continue;
    return w;
  }
  return null;
}

function next(){
  speechSynthesis.cancel(); revealed=false;
  resetWordDissolve();
  document.getElementById("answer").innerHTML="";

  // A queue built yesterday cannot contain words that only became review-eligible today.
  // Rebuild immediately on the first transition of each new local calendar day.
  if(state.queueDate!==localDateKey()) refill();
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
  saveCurrentNote();
  armUndo();
  celebratePass(); playPassSound();
  let w=state.current, d=state.debts[w]||1;
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0, d);
  if(d<=1){
    delete state.debts[w];
    delete state.lastReviewedDate[w];
    state.mastered[w]=true;
    playMasteredSound(); celebrateMastered();
  }else{
    state.debts[w]=d-1;
    state.lastReviewedDate[w]=localDateKey();
  }
  revealThenNext("PASS");
}

function again(){
  playAgainSound();
  if(!state.current)return;
  saveCurrentNote();
  armUndo();
  let w=state.current;
  state.debts[w]=(state.debts[w]||1)+1;
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0, state.debts[w]);
  state.lastReviewedDate[w]=localDateKey();
  revealThenNext("AGAIN");
}

function revealThenNext(kind){
  reveal(); save();
  const badge=document.querySelector("#answer .debtBadge");
  if(badge){
    badge.textContent=kind==="PASS"?"✓ PASS":"↻ AGAIN";
    badge.classList.add(kind==="PASS"?"passBadge":"againBadge");
  }

  // Wait until the newly revealed word has actually been laid out.
  if(kind==="AGAIN"){
    requestAnimationFrame(()=>requestAnimationFrame(()=>celebrateAgain()));
  }

  if(judgmentTimer)clearTimeout(judgmentTimer);
  judgmentTimer=setTimeout(()=>{
    judgmentTimer=null;
    const hint=document.getElementById("hint");
    if(hint) hint.textContent="听到后只判断：能否立刻想到单词和意思？";
    next();
  },950);
}
