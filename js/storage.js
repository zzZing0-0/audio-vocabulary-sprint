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
state.customPronunciations = (state.customPronunciations && typeof state.customPronunciations === "object" && !Array.isArray(state.customPronunciations)) ? state.customPronunciations : {};
state.notes = (state.notes && typeof state.notes === "object") ? state.notes : {};
state.linkedWords = (state.linkedWords && typeof state.linkedWords === "object" && !Array.isArray(state.linkedWords)) ? state.linkedWords : {}; // v3.29: bidirectional confusable-word links
state.removedWords = (state.removedWords && typeof state.removedWords === "object" && !Array.isArray(state.removedWords)) ? state.removedWords : {};
state.queueDate = (typeof state.queueDate === "string") ? state.queueDate : null; // v3.14: rebuild queue on a new local day

// v3.29.5: linkedWords is only a relationship map; every referenced word must
// also exist in the actual vocabulary (BASE_WORDS or customWords). Repair any
// older/orphaned links without touching debt/seen/mastered state.
function ensureLinkedWordsInVocabulary(){
  const known=new Set();
  for(const raw of BASE_WORDS.concat(state.customWords||[])){
    const w=String(raw||"").trim();
    if(w)known.add(w.toLowerCase());
  }
  let added=0;
  const refs=[];
  for(const [rawKey,rawList] of Object.entries(state.linkedWords||{})){
    refs.push(rawKey);
    if(Array.isArray(rawList))refs.push(...rawList);
  }
  for(const raw of refs){
    const w=String(raw||"").trim();
    const k=w.toLowerCase();
    if(!w||known.has(k))continue;
    state.customWords.push(w);
    known.add(k);
    added++;
  }
  return added;
}
ensureLinkedWordsInVocabulary();

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

function findWordCaseInsensitive(word, includeRemoved=false){
  const k=String(word||"").trim().toLowerCase();
  if(!k) return null;
  const pool=BASE_WORDS.concat(state.customWords||[]);
  const found=pool.find(w=>String(w||"").trim().toLowerCase()===k);
  if(!found) return null;
  if(!includeRemoved && isRemovedWord(found)) return null;
  return String(found).trim();
}
function linkedKey(word){
  const k=String(word||"").trim().toLowerCase();
  return Object.keys(state.linkedWords||{}).find(x=>x.toLowerCase()===k)||null;
}
function getLinkedWords(word){
  const key=linkedKey(word);
  const arr=key&&Array.isArray(state.linkedWords[key])?state.linkedWords[key]:[];
  const out=[],seen=new Set();
  for(const raw of arr){
    const w=findWordCaseInsensitive(raw,true)||String(raw||"").trim();
    const k=w.toLowerCase();
    if(!w||seen.has(k)||k===String(word||"").trim().toLowerCase())continue;
    seen.add(k);out.push(w);
  }
  return out.slice(0,3);
}
function setLinkedList(word,list){
  const canonical=findWordCaseInsensitive(word,true)||String(word||"").trim();
  const old=linkedKey(canonical);
  if(old&&old!==canonical)delete state.linkedWords[old];
  const clean=[],seen=new Set();
  for(const raw of list){
    const w=findWordCaseInsensitive(raw,true)||String(raw||"").trim();
    const k=w.toLowerCase();
    if(!w||seen.has(k)||k===canonical.toLowerCase())continue;
    seen.add(k);clean.push(w);
  }
  if(clean.length)state.linkedWords[canonical]=clean.slice(0,3);
  else delete state.linkedWords[canonical];
}
function linkWords(a,b){
  const A=findWordCaseInsensitive(a,true),B=findWordCaseInsensitive(b,true);
  if(!A||!B)return {ok:false,reason:"missing"};
  if(A.toLowerCase()===B.toLowerCase())return {ok:false,reason:"same"};
  const la=getLinkedWords(A),lb=getLinkedWords(B);
  if(la.some(w=>w.toLowerCase()===B.toLowerCase()))return {ok:true,already:true};
  if(la.length>=3)return {ok:false,reason:"source-full"};
  if(lb.length>=3)return {ok:false,reason:"target-full"};
  setLinkedList(A,la.concat(B));setLinkedList(B,lb.concat(A));
  return {ok:true};
}
function unlinkWords(a,b){
  const A=findWordCaseInsensitive(a,true)||String(a||"").trim();
  const B=findWordCaseInsensitive(b,true)||String(b||"").trim();
  setLinkedList(A,getLinkedWords(A).filter(w=>w.toLowerCase()!==B.toLowerCase()));
  setLinkedList(B,getLinkedWords(B).filter(w=>w.toLowerCase()!==A.toLowerCase()));
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

function save(){ ensureLinkedWordsInVocabulary(); localStorage.setItem(KEY,JSON.stringify(state)); if(typeof updateStats==="function") updateStats(); }
