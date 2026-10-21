/* Non-destructive vocabulary import. Learning state is deliberately untouched. */
function applyVocabularyImport(state,baseWords,entries){
  const known=new Set([...(baseWords||[]),...(state.customWords||[])].map(w=>String(w).toLowerCase()));
  if(!Array.isArray(state.customWords))state.customWords=[];
  if(!state.customPronunciations||typeof state.customPronunciations!=="object"||Array.isArray(state.customPronunciations))state.customPronunciations={};
  const processed=new Set();
  let added=0,existing=0,ipaChanged=0;
  for(const entry of entries||[]){
    const w=String(entry?.word||"").trim();
    if(!w)continue;
    const k=w.toLowerCase();
    if(processed.has(k))continue;
    processed.add(k);
    if(known.has(k))existing++;
    else{
      state.customWords.push(w);
      known.add(k);
      added++;
    }
    if(entry.pronunciation){
      const before=state.customPronunciations[k];
      if(JSON.stringify(before)!==JSON.stringify(entry.pronunciation)){
        state.customPronunciations[k]=entry.pronunciation;
        ipaChanged++;
      }
    }
  }
  return {added,existing,ipaChanged};
}
if(typeof module!=="undefined"&&module.exports)module.exports={applyVocabularyImport};
