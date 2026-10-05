/* Audio Vocabulary Sprint · shared persisted-state boundary */
const AVS_STATE_KEY='audio_vocab_sprint_universal_v3';
function avsObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function normalizeAvsStateShape(raw){
  const s=avsObject(raw);
  s.debts=avsObject(s.debts);s.mastered=avsObject(s.mastered);s.seen=avsObject(s.seen);s.highestDebt=avsObject(s.highestDebt);
  s.lastReviewedDate=avsObject(s.lastReviewedDate);s.customWords=Array.isArray(s.customWords)?s.customWords:[];
  s.customPronunciations=avsObject(s.customPronunciations);s.manualPronunciations=avsObject(s.manualPronunciations);
  for(const [k,p] of Object.entries(s.customPronunciations)){if(p&&p.source==='manual'){s.manualPronunciations[k]=p;delete s.customPronunciations[k];}}
  s.notes=avsObject(s.notes);s.noteUpdatedAt=avsObject(s.noteUpdatedAt);s.linkedWords=avsObject(s.linkedWords);
  s.tags=avsObject(s.tags);s.wordTags=avsObject(s.wordTags);s.removedWords=avsObject(s.removedWords);
  s.queue=Array.isArray(s.queue)?s.queue:[];s.queueDate=typeof s.queueDate==='string'?s.queueDate:null;
  s.dailyStats=avsObject(s.dailyStats);s.todayReview=avsObject(s.todayReview);s.lookupStats=avsObject(s.lookupStats);s.historyLinks=avsObject(s.historyLinks);
  s.current=typeof s.current==='string'?s.current:null;s.voiceIndex=Number.isFinite(Number(s.voiceIndex))?Number(s.voiceIndex):0;
  s.statsStartDate=(typeof s.statsStartDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.statsStartDate))?s.statsStartDate:null;
  return s;
}
function readAvsState(){
  try{return normalizeAvsStateShape(JSON.parse(localStorage.getItem(AVS_STATE_KEY)||'null')||{});}catch(_){return normalizeAvsStateShape({});}
}
function writeAvsState(value){localStorage.setItem(AVS_STATE_KEY,JSON.stringify(value));}
