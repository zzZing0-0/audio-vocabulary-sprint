const HISTORY_KEY="audio_vocab_sprint_universal_v3";
let historyState=JSON.parse(localStorage.getItem(HISTORY_KEY)||"null")||{};
historyState.dailyStats=(historyState.dailyStats&&typeof historyState.dailyStats==="object"&&!Array.isArray(historyState.dailyStats))?historyState.dailyStats:{};
historyState.historyLinks=(historyState.historyLinks&&typeof historyState.historyLinks==="object"&&!Array.isArray(historyState.historyLinks))?historyState.historyLinks:{};
function dateKey(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function todayKey(){return dateKey(new Date());}
if(!historyState.statsStartDate)historyState.statsStartDate=todayKey();
function saveHistory(){localStorage.setItem(HISTORY_KEY,JSON.stringify(historyState));}
saveHistory();

let view="month";
const now=new Date();
let cursorYear=now.getFullYear(),cursorMonth=now.getMonth();
let selectedDay=null;
const root=document.getElementById("historyRoot"),detail=document.getElementById("dayDetail");
function rowFor(key){const r=historyState.dailyStats[key];return r&&typeof r==="object"?{total:Number(r.total)||0,new:Number(r.new)||0,review:Number(r.review)||0}:null;}
function linksFor(key){const a=historyState.historyLinks[key];return Array.isArray(a)?a.slice(0,3):[];}
function level(total){if(total>=50)return 4;if(total>=25)return 3;if(total>=10)return 2;if(total>0)return 1;return 0;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function safeUrl(raw){try{const u=new URL(String(raw||'').trim());return /^https?:$/.test(u.protocol)?u.toString():null;}catch(_){return null;}}
function linkLabel(item){if(item.title&&item.title.trim())return item.title.trim();try{const u=new URL(item.url);return u.hostname.replace(/^www\./,'');}catch(_){return item.url;}}
function renderDayDetail(key){
  selectedDay=key;const r=rowFor(key)||{total:0,new:0,review:0},links=linksFor(key);const [y,m,d]=key.split("-").map(Number);
  let linkHtml=links.length?'<div class="historyLinkList">'+links.map((item,i)=>'<div class="historyLinkItem"><a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">🔗 '+esc(linkLabel(item))+'</a><button type="button" class="historyLinkDelete" data-link-delete="'+i+'" aria-label="删除链接">×</button></div>').join('')+'</div>':'<div class="historyLinkEmpty">这一天还没有链接笔记。</div>';
  detail.innerHTML='<div class="dayDetailDate">'+y+'年'+m+'月'+d+'日</div>'+
    (r.total>0?'<div class="dayMetrics"><span><b>'+r.total+'</b> 完成</span><span><b>'+r.new+'</b> 新词</span><span><b>'+r.review+'</b> 复习</span></div>':'<div class="dayMetrics dayMetricsEmpty">当天没有背词记录</div>')+
    '<div class="historyLinks"><div class="historyLinksHead"><strong>链接笔记</strong><span>'+links.length+' / 3</span></div>'+linkHtml+
    (links.length<3?'<div class="historyLinkForm"><input id="historyLinkUrl" type="url" inputmode="url" placeholder="粘贴 YouTube / 网页链接"><input id="historyLinkTitle" type="text" maxlength="80" placeholder="标题或备注（可选）"><button id="historyLinkAdd" type="button">添加</button></div>':'<div class="historyLinkLimit">每天最多 3 个链接。</div>')+'</div>';
  detail.hidden=false;
  document.querySelectorAll('[data-day]').forEach(el=>el.classList.toggle('selected',el.dataset.day===key));
  const add=document.getElementById('historyLinkAdd');if(add)add.onclick=()=>{
    const input=document.getElementById('historyLinkUrl'),title=document.getElementById('historyLinkTitle');const url=safeUrl(input.value);
    if(!url){input.focus();input.setCustomValidity('请输入 http:// 或 https:// 开头的有效链接');input.reportValidity();input.oninput=()=>input.setCustomValidity('');return;}
    const arr=linksFor(key);if(arr.length>=3)return;
    if(arr.some(x=>x.url===url)){input.setCustomValidity('这个链接已经记录过了');input.reportValidity();return;}
    arr.push({id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)),url,title:title.value.trim(),addedAt:new Date().toISOString()});
    historyState.historyLinks[key]=arr;saveHistory();rerenderKeepDay();
  };
  detail.querySelectorAll('[data-link-delete]').forEach(btn=>btn.onclick=()=>{const arr=linksFor(key);arr.splice(Number(btn.dataset.linkDelete),1);if(arr.length)historyState.historyLinks[key]=arr;else delete historyState.historyLinks[key];saveHistory();rerenderKeepDay();});
}
function showDay(key){
  if(selectedDay===key&&!detail.hidden){
    selectedDay=null;
    detail.hidden=true;
    detail.innerHTML="";
    document.querySelectorAll('[data-day]').forEach(el=>el.classList.remove('selected'));
    return;
  }
  renderDayDetail(key);
}
function rerenderKeepDay(){const k=selectedDay;if(view==='month')renderMonth(true);else renderYear(true);if(k)renderDayDetail(k);}
function navHead(label){return '<div class="historyNav"><button class="historyArrow" id="historyPrev" type="button" aria-label="上一段">‹</button><div class="historyPeriod">'+esc(label)+'</div><button class="historyArrow" id="historyNext" type="button" aria-label="下一段">›</button></div>';}
function bindNav(prev,next){document.getElementById("historyPrev").onclick=prev;document.getElementById("historyNext").onclick=next;root.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>showDay(el.dataset.day));}
function renderMonth(keep=false){
  if(!keep){detail.hidden=true;selectedDay=null;}
  const first=new Date(cursorYear,cursorMonth,1),days=new Date(cursorYear,cursorMonth+1,0).getDate();const offset=(first.getDay()+6)%7;let cells='';
  for(let i=0;i<offset;i++)cells+='<div class="monthCell outside" aria-hidden="true"></div>';
  for(let d=1;d<=days;d++){const key=dateKey(new Date(cursorYear,cursorMonth,d)),r=rowFor(key),total=r?r.total:0,before=key<historyState.statsStartDate,lc=linksFor(key).length;cells+='<button class="monthCell heat'+level(total)+(before?' beforeStats':'')+'" type="button" data-day="'+key+'"><span class="monthDate">'+d+'</span>'+(total>0?'<span class="monthTotal">'+total+'</span>':'')+(lc?'<span class="monthLinks">🔗 '+lc+'</span>':'')+'</button>';}
  const trailing=(7-((offset+days)%7))%7;for(let i=0;i<trailing;i++)cells+='<div class="monthCell outside" aria-hidden="true"></div>';
  root.innerHTML=navHead(cursorYear+'年'+(cursorMonth+1)+'月')+'<div class="weekHead"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="monthGrid">'+cells+'</div><div class="heatLegend"><span>少</span><i class="heat0"></i><i class="heat1"></i><i class="heat2"></i><i class="heat3"></i><i class="heat4"></i><span>多</span></div>';
  bindNav(()=>{cursorMonth--;if(cursorMonth<0){cursorMonth=11;cursorYear--;}renderMonth();},()=>{cursorMonth++;if(cursorMonth>11){cursorMonth=0;cursorYear++;}renderMonth();});
}
function renderYear(keep=false){
  if(!keep){detail.hidden=true;selectedDay=null;}const start=new Date(cursorYear,0,1),end=new Date(cursorYear,11,31),firstMonday=new Date(start);firstMonday.setDate(start.getDate()-((start.getDay()+6)%7));const lastSunday=new Date(end);lastSunday.setDate(end.getDate()+(7-((end.getDay()+6)%7)-1));const weeks=[];let d=new Date(firstMonday);
  while(d<=lastSunday){const week=[];for(let i=0;i<7;i++){const x=new Date(d),key=dateKey(x),inYear=x.getFullYear()===cursorYear,r=rowFor(key),total=r?r.total:0,before=key<historyState.statsStartDate;week.push({key,day:x.getDate(),month:x.getMonth(),inYear,total,before,links:linksFor(key).length});d.setDate(d.getDate()+1);}weeks.push(week);}
  const monthLabels=[];let last=-1;weeks.forEach((w,i)=>{const hit=w.find(x=>x.inYear&&x.day<=7);if(hit&&hit.month!==last){monthLabels.push('<span style="grid-column:'+(i+1)+'">'+(hit.month+1)+'月</span>');last=hit.month;}});let cols='';
  weeks.forEach(w=>{cols+='<div class="yearWeek">'+w.map(x=>x.inYear?'<button class="yearDay heat'+level(x.total)+(x.before?' beforeStats':'')+(x.links?' hasLink':'')+'" type="button" data-day="'+x.key+'" title="'+x.key+(x.total?' · 完成 '+x.total:'')+(x.links?' · '+x.links+' 个链接':'')+'"></button>':'<span class="yearDay outside"></span>').join('')+'</div>';});
  root.innerHTML=navHead(cursorYear+'年')+'<div class="yearScroll"><div class="yearMonthLabels" style="grid-template-columns:repeat('+weeks.length+',12px)">'+monthLabels.join('')+'</div><div class="yearBody"><div class="yearWeekLabels"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div><div class="yearGrid">'+cols+'</div></div></div><div class="heatLegend"><span>少</span><i class="heat0"></i><i class="heat1"></i><i class="heat2"></i><i class="heat3"></i><i class="heat4"></i><span>多</span></div>';
  bindNav(()=>{cursorYear--;renderYear();},()=>{cursorYear++;renderYear();});
}
function setView(v){view=v;document.getElementById('monthTab').classList.toggle('active',v==='month');document.getElementById('yearTab').classList.toggle('active',v==='year');if(v==='month')renderMonth();else renderYear();}
document.getElementById('monthTab').onclick=()=>setView('month');document.getElementById('yearTab').onclick=()=>setView('year');setView('month');
