function localDateKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function activeEligibleToday(w){
  return (state.debts[w]||0)>0 && !state.mastered[w] && state.lastReviewedDate[w]!==localDateKey();
}

function ensureDailyStatsStart(){
  if(!state.dailyStats || typeof state.dailyStats!=="object" || Array.isArray(state.dailyStats))state.dailyStats={};
  if(!state.statsStartDate)state.statsStartDate=localDateKey();
}

function recordDailyJudgment(isNew){
  ensureDailyStatsStart();
  const day=localDateKey();
  const row=(state.dailyStats[day]&&typeof state.dailyStats[day]==="object")?state.dailyStats[day]:{total:0,new:0,review:0};
  row.total=(Number(row.total)||0)+1;
  if(isNew)row.new=(Number(row.new)||0)+1;
  else row.review=(Number(row.review)||0)+1;
  state.dailyStats[day]=row;
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
  // Every extra tap deliberately restarts the short feedback window, so stress-clicking
  // stays playful. Advancing itself must never depend on an animation/particle state:
  // visual feedback is optional, while the learning state machine must always progress.
  if(judgmentTimer)clearTimeout(judgmentTimer);
  const delay=judgmentKind==="AGAIN" ? AGAIN_DISSOLVE_MS+120 : 520;
  judgmentTimer=setTimeout(()=>{
    judgmentTimer=null;
    judgmentFinalizing=true;
    // UI feedback must never be able to block the learning state machine.
    try{ updateAnswerControls(); }
    finally{ next(); }
  },delay);
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

function playDebtImpact(badge){
  if(!badge)return;
  try{
    badge.getAnimations().forEach(a=>a.cancel());
    badge.animate(
      [
        {transform:"scale(1)"},
        {transform:"scale(1.07)",offset:.45},
        {transform:"scale(1)"}
      ],
      {duration:180,easing:"ease-out"}
    );
  }catch(e){}
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
    playDebtImpact(badge);
  },240));

  debtAnimationTimers.push(setTimeout(()=>{
    if(delta.isConnected)delta.remove();
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
    playDebtImpact(badge);
  },220);
  const gone=setTimeout(()=>{
    if(delta.isConnected)delta.remove();
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
    dailyStats:JSON.parse(JSON.stringify(state.dailyStats||{})),
    statsStartDate:state.statsStartDate||null,
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
  state.dailyStats=s.dailyStats||{};
  state.statsStartDate=s.statsStartDate||null;
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
  // Data-first transition: choose and persist the next word before any optional
  // speech/animation/DOM cleanup. A UI exception must never strand state.current.
  const prev=state.current;
  clearJudgmentBurst();
  revealed=false;

  if(state.queueDate!==localDateKey()) refill();
  if(!state.queue.length) refill();
  let guard=0;
  while(state.queue.length && state.queue[0]===prev && guard++<5) state.queue.push(state.queue.shift());
  state.current=popNextEligible();
  if(!state.current){ refill(); state.current=popNextEligible(); }
  if(state.current) state.seen[state.current]=true;

  // Persist the transition before touching presentation code.
  save();

  try{ speechSynthesis.cancel(); }catch(e){}
  try{ clearDebtAnimationTimers(); }catch(e){}
  try{ resetWordDissolve(); }catch(e){}
  try{ document.getElementById("answer").innerHTML=""; }catch(e){}
  try{ updateAnswerControls(); }catch(e){}

  if(!state.current){
    try{ document.getElementById("answer").innerHTML='<div class="word">🎉 今天可复习的词已完成</div>'; }catch(e){}
    try{ updateAnswerControls(); }catch(e){}
    return;
  }
  setTimeout(()=>{try{speakCurrent();}catch(e){}},120);
}

function pass(){
  if(!state.current)return;
  if(judgmentLocked){ replayJudgmentFeedback("PASS"); return; }

  // Establish the complete judgment state before any UI/audio helper runs.
  // This also makes rapid feedback taps impossible to observe a null debt target.
  const w=state.current;
  const d=Math.max(1,Number(state.debts[w])||1);
  const nextDebt=Math.max(0,d-1);
  judgmentLocked=true;
  judgmentKind="PASS";
  judgmentFromDebt=d;
  judgmentToDebt=nextDebt;
  lastJudgmentSnapshot=cloneLearningSnapshot();
  scheduleJudgmentExit();

  const wasNew=!(Number(state.debts[w]||0)>0) && !state.mastered[w];
  recordDailyJudgment(wasNew);
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0,d);
  if(d<=1){
    delete state.debts[w];
    delete state.lastReviewedDate[w];
    state.mastered[w]=true;
  }else{
    state.debts[w]=nextDebt;
    state.lastReviewedDate[w]=localDateKey();
  }

  // Commit learning data before optional presentation work.
  save();

  try{ saveCurrentNote(); }catch(e){console.warn("note save skipped during PASS",e);}
  try{ updateAnswerControls(); }catch(e){}
  try{ const b=document.getElementById("undoBtn"); if(b)b.disabled=false; updateAnswerControls(); }catch(e){}
  try{ celebratePass(); }catch(e){}
  try{ playPassSound(); }catch(e){}
  if(d<=1){ try{playMasteredSound();}catch(e){} try{celebrateMastered();}catch(e){} }
  revealThenNext("PASS",d,nextDebt);
}

function again(){
  if(!state.current)return;
  if(judgmentLocked){ replayJudgmentFeedback("AGAIN"); return; }

  const w=state.current;
  const d=Math.max(1,Number(state.debts[w])||1);
  const nextDebt=d+1;
  judgmentLocked=true;
  judgmentKind="AGAIN";
  judgmentFromDebt=d;
  judgmentToDebt=nextDebt;
  lastJudgmentSnapshot=cloneLearningSnapshot();
  scheduleJudgmentExit();

  const wasNew=!(Number(state.debts[w]||0)>0) && !state.mastered[w];
  recordDailyJudgment(wasNew);
  state.debts[w]=nextDebt;
  state.highestDebt[w]=Math.max(state.highestDebt[w]||0,nextDebt);
  state.lastReviewedDate[w]=localDateKey();

  // Persist +1 immediately; feedback can fail without losing the judgment.
  save();

  try{ saveCurrentNote(); }catch(e){console.warn("note save skipped during AGAIN",e);}
  try{ updateAnswerControls(); }catch(e){}
  try{ const b=document.getElementById("undoBtn"); if(b)b.disabled=false; updateAnswerControls(); }catch(e){}
  try{ playAgainSound(); }catch(e){}
  revealThenNext("AGAIN",d,nextDebt);
}

function revealThenNext(kind,fromDebt,toDebt){
  // Learning data has already been persisted. Everything below is presentation only.
  try{ reveal(fromDebt,false); }catch(e){ console.warn("judgment reveal skipped:",e); }
  try{
    const firstBadge=document.querySelector("#answer .firstBadge");
    if(firstBadge)firstBadge.style.display="none";
  }catch(e){}
  if(kind==="AGAIN"){ try{celebrateAgain();}catch(e){} }
  try{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{animateDebtDelta(kind,fromDebt,toDebt);}catch(e){}
    }));
  }catch(e){}
}
