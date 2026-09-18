const notesRoot=document.getElementById("notesRoot");
function ne(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function nfind(obj,k){return Object.keys(obj||{}).find(x=>x.toLowerCase()===k)||null;}
function nstatus(w){const mk=nfind(state.mastered,w.toLowerCase()),dk=nfind(state.debts,w.toLowerCase());if(isRemovedWord(w))return "已移除";if(mk)return "已掌握 · debt 0 · peak "+(state.highestDebt[mk]||0);if(dk&&Number(state.debts[dk])>0)return "学习中 · debt "+state.debts[dk]+" · peak "+(state.highestDebt[dk]||state.debts[dk]);return "未学习 · debt 1";}
const NOTES_PAGE_SIZE=20;
let notesPage=1;
function renderNotesPagination(totalPages){
  const el=document.getElementById("pagination");if(!el)return;
  if(totalPages<=1){el.innerHTML="";return;}
  const page=notesPage;
  el.innerHTML='<button class="miniBtn pageFirst" '+(page<=1?'disabled':'')+'>« 首页</button><button class="miniBtn pagePrev" '+(page<=1?'disabled':'')+'>‹ 上一页</button><span class="pageInfo">'+page+' / '+totalPages+'</span><form class="pageJump"><input class="pageJumpInput" type="number" inputmode="numeric" min="1" max="'+totalPages+'" value="'+page+'" aria-label="页码"><button class="miniBtn" type="submit" aria-label="跳转">➡️</button></form><button class="miniBtn pageNext" '+(page>=totalPages?'disabled':'')+'>下一页 ›</button><button class="miniBtn pageLast" '+(page>=totalPages?'disabled':'')+'>尾页 »</button>';
  const go=n=>{notesPage=Math.min(Math.max(1,n),totalPages);renderNotes();window.scrollTo({top:0,behavior:"smooth"});};
  el.querySelector('.pageFirst').onclick=()=>go(1);el.querySelector('.pagePrev').onclick=()=>go(page-1);el.querySelector('.pageNext').onclick=()=>go(page+1);el.querySelector('.pageLast').onclick=()=>go(totalPages);
  el.querySelector('.pageJump').onsubmit=e=>{e.preventDefault();const n=parseInt(el.querySelector('.pageJumpInput').value,10);if(Number.isFinite(n))go(n);};
}
function renderNotes(){
  const rows=Object.entries(state.notes||{}).filter(([w,n])=>String(n||"").trim()).sort((a,b)=>{const ar=isRemovedWord(a[0])?1:0,br=isRemovedWord(b[0])?1:0;return ar-br||a[0].localeCompare(b[0]);});
  document.getElementById("count").textContent=rows.length;
  const totalPages=Math.max(1,Math.ceil(rows.length/NOTES_PAGE_SIZE));notesPage=Math.min(Math.max(1,notesPage),totalPages);const pageRows=rows.slice((notesPage-1)*NOTES_PAGE_SIZE,notesPage*NOTES_PAGE_SIZE);
  notesRoot.innerHTML=pageRows.length?pageRows.map(([w,n])=>'<div class="noteManageRow" data-word="'+encodeURIComponent(w)+'"><div class="noteManageHead"><a class="noteWordLink" href="lookup.html?word='+encodeURIComponent(w)+'">'+ne(w)+'</a><span class="wordListMeta">'+ne(nstatus(w))+'</span></div><input class="wordNoteInput noteManageInput" type="text" value="'+ne(n)+'"><button class="miniBtn dangerLite noteDelete" type="button">删除笔记</button></div>').join(''):'<p>目前还没有笔记。</p>';
  notesRoot.querySelectorAll(".noteManageRow").forEach(row=>{const w=decodeURIComponent(row.dataset.word),input=row.querySelector(".noteManageInput");input.onchange=input.onblur=()=>{const v=input.value.trim();if(v)state.notes[w]=v;else delete state.notes[w];save();};row.querySelector(".noteDelete").onclick=()=>{delete state.notes[w];save();renderNotes();};});
  renderNotesPagination(totalPages);
}
renderNotes();
