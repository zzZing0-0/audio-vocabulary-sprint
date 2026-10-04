/* Audio Vocabulary Sprint · home search UI */
function homeSearchWords(raw){
 const q=String(raw||"").trim().toLowerCase();
 if(!q)return [];
 const words=allWords();
 const starts=[],contains=[];
 for(const w of words){const k=String(w).toLowerCase();if(k.startsWith(q))starts.push(w);else if(k.includes(q))contains.push(w);}
 return starts.concat(contains).slice(0,8);
}
function renderHomeSearch(raw){
 const box=document.getElementById("homeSearchSuggestions");
 const clear=document.getElementById("homeSearchClear");
 const q=String(raw||"").trim();
 if(clear)clear.hidden=!q;
 if(!box)return;
 const items=homeSearchWords(q);
 if(!q||!items.length){box.hidden=true;box.innerHTML="";return;}
 box.innerHTML=items.map(w=>'<button type="button" class="homeSearchSuggestion" data-word="'+escapeHtml(w)+'"><span>'+escapeHtml(w)+'</span><i>›</i></button>').join("");
 box.hidden=false;
 box.querySelectorAll("[data-word]").forEach(btn=>btn.onclick=()=>{goToLookup(btn.dataset.word);});
}
function clearHomeSearch(focus=false){
 const input=document.getElementById("homeSearchInput");
 const box=document.getElementById("homeSearchSuggestions");
 const clear=document.getElementById("homeSearchClear");
 if(input)input.value="";
 if(box){box.hidden=true;box.innerHTML="";}
 if(clear)clear.hidden=true;
 if(focus&&input)input.focus();
}
const homeSearchInput=document.getElementById("homeSearchInput");
const homeSearchClear=document.getElementById("homeSearchClear");
if(homeSearchInput){
 homeSearchInput.oninput=e=>renderHomeSearch(e.target.value);
 homeSearchInput.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();const q=homeSearchInput.value.trim();if(q)goToLookup(q);}};
}
if(homeSearchClear)homeSearchClear.onclick=()=>clearHomeSearch(true);
