/* Audio Vocabulary Sprint · temporary library playback order */
function avsShuffleCopy(items,random=Math.random){
  const out=[...(items||[])];
  for(let i=out.length-1;i>0;i--){const r=Math.min(.999999999,Math.max(0,Number(random())||0));const j=Math.floor(r*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function avsShuffleWithinGroups(items,groupKey,random=Math.random){
  const rows=[...(items||[])],out=[];
  for(let i=0;i<rows.length;){const key=groupKey(rows[i]),group=[];let j=i;while(j<rows.length&&groupKey(rows[j])===key)group.push(rows[j++]);out.push(...avsShuffleCopy(group,random));i=j;}
  return out;
}
function avsRandomLibraryOrder(type,words,state,random=Math.random){
  const list=[...(words||[])];
  if(type==='today')return avsShuffleCopy(list,random);
  if(type==='active')return avsShuffleWithinGroups(list,w=>String(Number(state?.debts?.[w])||0)+'|'+String(Number(state?.highestDebt?.[w])||0),random);
  if(type==='mastered')return avsShuffleWithinGroups(list,w=>String(Number(state?.highestDebt?.[w])||0),random);
  return list;
}
