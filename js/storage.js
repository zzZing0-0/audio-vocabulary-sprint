const BASE_WORDS = window.BASE_WORDS || [];

const KEY="audio_vocab_sprint_universal_v3";
let state = JSON.parse(localStorage.getItem(KEY)||"null") || {
  debts:{}, mastered:{}, seen:{}, highestDebt:{}, current:null, queue:[], voiceIndex:0
};
// Migrate older saves. Current debt can be recovered; historical peaks from old versions cannot.
state.debts = state.debts || {};
state.mastered = state.mastered || {};
state.seen = state.seen || {};
state.highestDebt = state.highestDebt || {};
state.lastReviewedDate = state.lastReviewedDate || {}; // v3.3; absent in old saves, so old progress stays intact
state.customWords = Array.isArray(state.customWords) ? state.customWords : [];
state.notes = (state.notes && typeof state.notes === "object") ? state.notes : {};
state.removedWords = (state.removedWords && typeof state.removedWords === "object" && !Array.isArray(state.removedWords)) ? state.removedWords : {};
state.queueDate = (typeof state.queueDate === "string") ? state.queueDate : null; // v3.14: rebuild queue on a new local day



for (const [w,d] of Object.entries(state.debts)) {
  state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
}
// A brand-new progress state gets a fresh randomized queue.
// Existing progress is preserved exactly as saved.
if (!state.current && (!state.queue || state.queue.length === 0) &&
    Object.keys(state.seen || {}).length === 0) {
  state.queue = BASE_WORDS.slice();
  shuffle(state.queue);
}

function removedKeySet(){
  return new Set(Object.keys(state.removedWords||{}).map(w=>String(w).toLowerCase()));
}

function isRemovedWord(word){
  const k=String(word||"").toLowerCase();
  return removedKeySet().has(k);
}

function allWords(){
  const out=[];
  const keys=new Set();
  const removed=removedKeySet();
  for(const raw of BASE_WORDS.concat(state.customWords)){
    const w=String(raw||"").trim();
    const k=w.toLowerCase();
    if(!w || keys.has(k) || removed.has(k)) continue;
    keys.add(k);
    out.push(w);
  }
  return out;
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

function save(){ localStorage.setItem(KEY,JSON.stringify(state)); updateStats(); }
