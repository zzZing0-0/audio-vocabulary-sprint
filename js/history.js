const HISTORY_KEY="audio_vocab_sprint_universal_v3";
let historyState=JSON.parse(localStorage.getItem(HISTORY_KEY)||"null")||{};
historyState.dailyStats=(historyState.dailyStats&&typeof historyState.dailyStats==="object"&&!Array.isArray(historyState.dailyStats))?historyState.dailyStats:{};
function dateKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function todayKey(){return dateKey(new Date());}
if(!historyState.statsStartDate)historyState.statsStartDate=todayKey();
localStorage.setItem(HISTORY_KEY,JSON.stringify(historyState));

let view="month";
const now=new Date();
let cursorYear=now.getFullYear(),cursorMonth=now.getMonth();
let selectedDay=null;
const root=document.getElementById("historyRoot"),detail=document.getElementById("dayDetail");
function rowFor(key){const r=historyState.dailyStats[key];return r&&typeof r==="object"?{total:Number(r.total)||0,new:Number(r.new)||0,review:Number(r.review)||0}:null;}
function level(total){if(total>=50)return 4;if(total>=25)return 3;if(total>=10)return 2;if(total>0)return 1;return 0;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function showDay(key){selectedDay=key;const r=rowFor(key);if(!r||r.total<=0){detail.hidden=true;detail.innerHTML="";return;}const [y,m,d]=key.split("-").map(Number);detail.innerHTML='<div class="dayDetailDate">'+y+'年'+m+'月'+d+'日</div><div class="dayMetrics"><span><b>'+r.total+'</b> 完成</span><span><b>'+r.new+'</b> 新词</span><span><b>'+r.review+'</b> 复习</span></div>';detail.hidden=false;document.querySelectorAll('[data-day]').forEach(el=>el.classList.toggle('selected',el.dataset.day===key));}
function navHead(label){return '<div class="historyNav"><button class="historyArrow" id="historyPrev" type="button" aria-label="上一段">‹</button><div class="historyPeriod">'+esc(label)+'</div><button class="historyArrow" id="historyNext" type="button" aria-label="下一段">›</button></div>';}
function bindNav(prev,next){document.getElementById("historyPrev").onclick=prev;document.getElementById("historyNext").onclick=next;root.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>showDay(el.dataset.day));}
function renderMonth(){
  detail.hidden=true;selectedDay=null;
  const first=new Date(cursorYear,cursorMonth,1),days=new Date(cursorYear,cursorMonth+1,0).getDate();
  const offset=(first.getDay()+6)%7;
  let cells='';
  for(let i=0;i<offset;i++)cells+='<div class="monthCell outside" aria-hidden="true"></div>';
  for(let d=1;d<=days;d++){
    const key=dateKey(new Date(cursorYear,cursorMonth,d)),r=rowFor(key),total=r?r.total:0,before=key<historyState.statsStartDate;
    cells+='<button class="monthCell heat'+level(total)+(before?' beforeStats':'')+'" type="button" data-day="'+key+'"><span class="monthDate">'+d+'</span>'+(total>0?'<span class="monthTotal">'+total+'</span>':'')+'</button>';
  }
  const trailing=(7-((offset+days)%7))%7; for(let i=0;i<trailing;i++)cells+='<div class="monthCell outside" aria-hidden="true"></div>';
  root.innerHTML=navHead(cursorYear+'年'+(cursorMonth+1)+'月')+'<div class="weekHead"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="monthGrid">'+cells+'</div><div class="heatLegend"><span>少</span><i class="heat0"></i><i class="heat1"></i><i class="heat2"></i><i class="heat3"></i><i class="heat4"></i><span>多</span></div>';
  bindNav(()=>{cursorMonth--;if(cursorMonth<0){cursorMonth=11;cursorYear--;}renderMonth();},()=>{cursorMonth++;if(cursorMonth>11){cursorMonth=0;cursorYear++;}renderMonth();});
}
function renderYear(){
  detail.hidden=true;selectedDay=null;
  const start=new Date(cursorYear,0,1),end=new Date(cursorYear,11,31),firstMonday=new Date(start);firstMonday.setDate(start.getDate()-((start.getDay()+6)%7));
  const lastSunday=new Date(end);lastSunday.setDate(end.getDate()+(7-((end.getDay()+6)%7)-1));
  const weeks=[];let d=new Date(firstMonday);
  while(d<=lastSunday){const week=[];for(let i=0;i<7;i++){const x=new Date(d),key=dateKey(x),inYear=x.getFullYear()===cursorYear,r=rowFor(key),total=r?r.total:0,before=key<historyState.statsStartDate;week.push({key,day:x.getDate(),month:x.getMonth(),inYear,total,before});d.setDate(d.getDate()+1);}weeks.push(week);}
  const monthLabels=[];let last=-1;weeks.forEach((w,i)=>{const hit=w.find(x=>x.inYear&&x.day<=7);if(hit&&hit.month!==last){monthLabels.push('<span style="grid-column:'+(i+1)+'">'+(hit.month+1)+'月</span>');last=hit.month;}});
  let cols='';weeks.forEach(w=>{cols+='<div class="yearWeek">'+w.map(x=>x.inYear?'<button class="yearDay heat'+level(x.total)+(x.before?' beforeStats':'')+'" type="button" data-day="'+x.key+'" title="'+x.key+(x.total?' · 完成 '+x.total:'')+'"></button>':'<span class="yearDay outside"></span>').join('')+'</div>';});
  root.innerHTML=navHead(cursorYear+'年')+'<div class="yearScroll"><div class="yearMonthLabels" style="grid-template-columns:repeat('+weeks.length+',12px)">'+monthLabels.join('')+'</div><div class="yearBody"><div class="yearWeekLabels"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div><div class="yearGrid">'+cols+'</div></div></div><div class="heatLegend"><span>少</span><i class="heat0"></i><i class="heat1"></i><i class="heat2"></i><i class="heat3"></i><i class="heat4"></i><span>多</span></div>';
  bindNav(()=>{cursorYear--;renderYear();},()=>{cursorYear++;renderYear();});
}
function setView(v){view=v;document.getElementById('monthTab').classList.toggle('active',v==='month');document.getElementById('yearTab').classList.toggle('active',v==='year');if(v==='month')renderMonth();else renderYear();}
document.getElementById('monthTab').onclick=()=>setView('month');document.getElementById('yearTab').onclick=()=>setView('year');setView('month');
