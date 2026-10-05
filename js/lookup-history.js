/* Audio Vocabulary Sprint · lookup history · sync-safe daily dedupe */
function avsLookupDateKey(d=new Date()){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function avsLookupRecord(state,word,dateKey){
  const w=String(word||'').trim();
  const day=String(dateKey||'').trim();
  if(!w||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  state.lookupStats=state.lookupStats&&typeof state.lookupStats==='object'&&!Array.isArray(state.lookupStats)?state.lookupStats:{};
  const key=Object.keys(state.lookupStats).find(x=>x.toLowerCase()===w.toLowerCase())||w;
  const old=state.lookupStats[key]&&typeof state.lookupStats[key]==='object'?state.lookupStats[key]:{};
  const dates=Array.isArray(old.dates)?old.dates.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x))):[];
  if(dates.includes(day))return false;
  state.lookupStats[key]={dates:[...new Set([...dates,day])].sort()};
  return true;
}
function avsLookupCount(state,word){
  const w=String(word||'').trim().toLowerCase();
  const key=Object.keys(state?.lookupStats||{}).find(x=>x.toLowerCase()===w);
  if(!key)return 0;
  return new Set((Array.isArray(state.lookupStats[key]?.dates)?state.lookupStats[key].dates:[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x)))).size;
}
