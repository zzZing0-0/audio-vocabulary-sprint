function localDateKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function activeEligibleToday(w){
  return (state.debts[w]||0)>0 && !state.mastered[w] && state.lastReviewedDate[w]!==localDateKey();
}

let lastJudgmentSnapshot=null;
let judgmentTimer=null;
let judgmentLocked=false;
let judgmentFinalizing=false;
let judgmentKind=null;
let judgmentFromDebt=null;
let judgmentToDebt=null;
let debtAnimationTimers=[];

function clearDebtAnimationTimers(){
  debtAnimationTimers.forEach(id=>clearTimeout(id));
  debtAnimationTimers=[];
}

function clearJudgmentBurst(){
  if(judgmentTimer){
    clearTimeout(judgmentTimer);
    judgmentTimer=null;
  }
  judgmentLocked=false;
  judgmentFinalizing=false;
  judgmentKind=null;
  judgmentFromDebt=null;
  judgmentToDebt=null;
}

function scheduleJudgmentExit(){
  if(judgmentTimer)clearTimeout(judgmentTimer);
  judgmentTimer=setTimeout(()=>{
    judgmentTimer=null;
    judgmentFinalizing=true;
    updateAnswerControls();

    if(judgmentKind==="AGAIN"){
      // The particle effect has already started on the tap itself.
      // Only advance after the final burst has completely faded.
      const waitForParticles=()=>{
        if(isWordDissolveActive()){
          judgmentTimer=setTimeout(waitForParticles,70);
        }else{
          judgmentTimer=null;
          next();
        }
      };
      waitForParticles();
    }else{
      next();
    }
  },520);
}

function replayJudgmentFeedback(kind){
  if(!judgmentLocked || judgmentFinalizing || kind!==judgmentKind)return false;

  // Extra taps are intentionally satisfying but never mutate debt again.
  if(kind==="AGAIN"){
    playAgainSound();
    celebrateAgain();
  }else{
    playPassSound();
  }

  animateDebtEcho(kind,judgmentToDebt);
  scheduleJudgmentExit();
  return true;
}

function setDebtBadgeValue(badge,debt){
  if(!badge)return;
  badge.textContent="debt: "+debt;
  badge.classList.remove("debtLow","debtMid","debtHigh","debtExtreme","debtImpact");
  badge.classList.add(debtVisualClass(Math.max(1,Number(debt)||1)));
  if(Number(debt)>=7) badge.textContent="🔥 "+badge.textContent;
}

function animateDebtDelta(kind,fromDebt,toDebt){
  clearDebtAnimationTimers();
  const info=document.querySelector("#answer .topLeftInfo");
  const badge=document.querySelector("#answer .debtBadge");
  if(!info||!badge)return;

  setDebtBadgeValue(badge,fromDebt);

  const delta=document.createElement("span");
  delta.className="debtDelta "+(kind==="PASS"?"debtDeltaPass":"debtDeltaAgain");
  delta.textContent=kind==="PASS"?"−1":"+1";
  info.appendChild(delta);

  // The arithmetic lands before the next word appears:
  // AGAIN: +1 drops onto the current debt.
  // PASS:  −1 drops away from the current debt.
  debtAnimationTimers.push(setTimeout(()=>{
    setDebtBadgeValue(badge,toDebt);
    badge.classList.add("debtImpact");
  },430));

  debtAnimationTimers.push(setTimeout(()=>{
    if(delta.isConnected)delta.remove();
    badge.classList.remove("debtImpact");
  },820));
}

function animateDebtEcho(kind,currentDebt){
  const info=document.querySelector("#answer .topLeftInfo");
  const badge=document.querySelector("#answer .debtBadge");
  if(!info||!badge)return;

  // Do not clear earlier echo timers: rapid taps may overlap visually.
  setDebtBadgeValue(badge,currentDebt);

  const delta=document.createElement("span");
  delta.className="debtDelta debtDeltaEcho "+(kind==="PASS"?"debtDeltaPass":"debtDeltaAgain");
  delta.textContent=kind==="PASS"?"−1":"+1";
  info.appendChild(delta);

  const hit=setTimeout(()=>{
    if(!badge.isConnected)return;
    badge.classList.remove("debtImpact");
    void badge.offsetWidth;
    badge.classList.add("debtImpact");
  },300);
  const gone=setTimeout(()=>{
    if(delta.isConnected)delta.remove();
    if(badge.isConnected)badge.classList.remove("debtImpact");
  },680);
  debtAnimationTimers.push(hit,gone);
}

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
  updateAnswerControls();
}

function clearUndo(){
  lastJudgmentSnapshot=null;
  const b=document.getElementById("undoBtn");
  if(b)b.disabled=true;
  updateAnswerControls();
}

function undoLastJudgment(){
  if(!lastJudgmentSnapshot)return;

  if(judgmentTimer){
    clearTimeout(judgmentTimer);
    judgmentTimer=null;
  }

  speechSynthesis.cancel();
  clearDebtAnimationTimers();
  clearJudgmentBurst();
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
  speechSynthesis.cancel();
  clearDebtAnimationTimers();
  clearJudgmentBurst();
  revealed=false;
  resetWordDissolve();
  document.getElementById("answer").innerHTML="";
  updateAnswerControls();

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
    updateAnswerControls();
    save(); return;
  }
  state.seen[state.current]=true; save();
  updateAnswerControls();
  setTimeout(speakCurrent,120);
}

function pass(){
  if(!state.current)return;
  if(judgmentLocked){
    replayJudgmentFeedback("PASS");
    return;
  }

  judgmentLocked=true;
  judgmentKind="PASS";
  updateAnswerControls();
  saveCurrentNote();
  armUndo();
  celebratePass(); playPassSound();

  let w=state.current, d=state.debts[w]||1;
  const nextDebt=Math.max(0,d-1);
  judgmentFromDebt=d;
  judgmentToDebt=nextDebt;

  state.highestDebt[w]=Math.max(state.highestDebt[w]||0, d);
  if(d<=1){
    delete state.debts[w];
    delete state.lastReviewedDate[w];
    state.mastered[w]=true;
    playMasteredSound(); celebrateMastered();
  }else{
    state.debts[w]=nextDebt;
    state.lastReviewedDate[w]=localDateKey();
  }
  revealThenNext("PASS",d,nextDebt);
}

function again(){
  if(!state.current)return;
  if(judgmentLocked){
    replayJudgmentFeedback("AGAIN");
    return;
  }

  judgmentLocked=true;
  judgmentKind="AGAIN";
  updateAnswerControls();
  playAgainSound();
  saveCurrentNote();
  armUndo();

  let w=state.current;
  const d=state.debts[w]||1;
  const nextDebt=d+1;
  judgmentFromDebt=d;
  judgmentToDebt=nextDebt;

  state.debts[w]=nextDebt;
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0, nextDebt);
  state.lastReviewedDate[w]=localDateKey();
  revealThenNext("AGAIN",d,nextDebt);
}

function revealThenNext(kind,fromDebt,toDebt){
  // First tap commits the learning result exactly once.
  // Re-render first so the dissolve targets the actual visible word node.
  reveal(fromDebt,false);
  save();

  const firstBadge=document.querySelector("#answer .firstBadge");
  if(firstBadge)firstBadge.style.display="none";

  // AGAIN feedback starts immediately after the DOM rebuild: the word disappears
  // into particles on the same tap instead of being recreated visibly afterward.
  if(kind==="AGAIN")celebrateAgain();

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    animateDebtDelta(kind,fromDebt,toDebt);
  }));

  scheduleJudgmentExit();
}

