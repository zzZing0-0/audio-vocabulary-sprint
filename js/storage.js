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
state.customPronunciations = (state.customPronunciations && typeof state.customPronunciations === "object" && !Array.isArray(state.customPronunciations)) ? state.customPronunciations : {}; // imported pronunciation layer (e.g. Eudic)
state.manualPronunciations = (state.manualPronunciations && typeof state.manualPronunciations === "object" && !Array.isArray(state.manualPronunciations)) ? state.manualPronunciations : {}; // v3.33.2: explicit manual override layer
// v3.33.2 briefly stored manual edits in customPronunciations. Move only entries
// explicitly marked source=manual; imported Eudic entries remain in customPronunciations.
for(const [k,p] of Object.entries(state.customPronunciations)){
  if(p && p.source==="manual"){ state.manualPronunciations[k]=p; delete state.customPronunciations[k]; }
}
state.notes = (state.notes && typeof state.notes === "object") ? state.notes : {};
state.linkedWords = (state.linkedWords && typeof state.linkedWords === "object" && !Array.isArray(state.linkedWords)) ? state.linkedWords : {}; // v3.29: bidirectional confusable-word links
state.tags = (state.tags && typeof state.tags === "object" && !Array.isArray(state.tags)) ? state.tags : {}; // v3.33: tag definitions by id
state.wordTags = (state.wordTags && typeof state.wordTags === "object" && !Array.isArray(state.wordTags)) ? state.wordTags : {}; // v3.33: lowercase word -> tag ids
state.removedWords = (state.removedWords && typeof state.removedWords === "object" && !Array.isArray(state.removedWords)) ? state.removedWords : {};
state.queueDate = (typeof state.queueDate === "string") ? state.queueDate : null; // v3.14: rebuild queue on a new local day
state.dailyStats = (state.dailyStats && typeof state.dailyStats === "object" && !Array.isArray(state.dailyStats)) ? state.dailyStats : {}; // v3.30: learning log
state.historyLinks = (state.historyLinks && typeof state.historyLinks === "object" && !Array.isArray(state.historyLinks)) ? state.historyLinks : {}; // v3.31: up to 3 learning links per day
state.statsStartDate = (typeof state.statsStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.statsStartDate)) ? state.statsStartDate : null;
if(!state.statsStartDate){
  const _statsNow=new Date();
  state.statsStartDate=_statsNow.getFullYear()+"-"+String(_statsNow.getMonth()+1).padStart(2,"0")+"-"+String(_statsNow.getDate()).padStart(2,"0");
  localStorage.setItem(KEY,JSON.stringify(state));
}

// v3.29.6: linkedWords is only a relationship map; every referenced word must
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

function cleanTagIds(ids){
  const out=[],seen=new Set();
  for(const raw of Array.isArray(ids)?ids:[]){const id=String(raw||"");if(id&&state.tags[id]&&!seen.has(id)){seen.add(id);out.push(id);}}
  return out;
}
function getWordTagIds(word){const k=String(word||"").trim().toLowerCase();return cleanTagIds(state.wordTags[k]);}
function setWordTagIds(word,ids){const k=String(word||"").trim().toLowerCase();if(!k)return;const clean=cleanTagIds(ids);if(clean.length)state.wordTags[k]=clean;else delete state.wordTags[k];}
function tagList(){return Object.entries(state.tags||{}).map(([id,t])=>({id,name:String(t?.name||"").trim(),color:String(t?.color||"#8b7cf6")})).filter(t=>t.name).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));}
function createTag(name,color){name=String(name||"").trim();if(!name)return {ok:false,reason:"empty"};if(tagList().some(t=>t.name.toLowerCase()===name.toLowerCase()))return {ok:false,reason:"duplicate"};const id='tag_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);state.tags[id]={name,color:/^#[0-9a-f]{6}$/i.test(color||'')?color:'#8b7cf6'};return {ok:true,id};}
function deleteTag(id){delete state.tags[id];for(const [w,ids] of Object.entries(state.wordTags||{})){const next=(Array.isArray(ids)?ids:[]).filter(x=>x!==id);if(next.length)state.wordTags[w]=next;else delete state.wordTags[w];}}
function shuffle(a){ for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

function save(){ ensureLinkedWordsInVocabulary(); localStorage.setItem(KEY,JSON.stringify(state)); if(typeof updateStats==="function") updateStats(); }
