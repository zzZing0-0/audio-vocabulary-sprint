let voices=[], revealed=false, started=false;









function selectedVoice(){
  let en=voices.filter(v=>/^en[-_]/i.test(v.lang));
  if(!en.length) return null;
  return en[state.voiceIndex % en.length];
}
function speakText(text){
  speechSynthesis.cancel();
  let u=new SpeechSynthesisUtterance(text);
  u.lang="en-US"; u.rate=.86;
  let v=selectedVoice(); if(v) u.voice=v;
  speechSynthesis.speak(u);
}
function speakCurrent(){ if(state.current) speakText(state.current); }
function reveal(){
  if(!state.current)return;
  revealed=true;
  let d=state.debts[state.current]||1;
  document.getElementById("answer").innerHTML=
    '<div class="word">'+escapeHtml(state.current)+'</div>'+
    '<div class="note">debt '+d+(state.debts[state.current]?'':' · 首次出现')+'</div>'+
    '<div class="note" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+
      '<a href="https://www.oxfordlearnersdictionaries.com/definition/english/'+encodeURIComponent(state.current.toLowerCase().replace(/\s+/g,"-"))+'" target="_blank" rel="noopener" style="color:#666;text-decoration:none">📖 Oxford 英英</a>'+
      '<a href="https://dict.youdao.com/w/eng/'+encodeURIComponent(state.current)+'" target="_blank" rel="noopener" style="color:#666;text-decoration:none">📘 有道英中</a>'+
      '<a href="https://youglish.com/pronounce/'+encodeURIComponent(state.current)+'/english" target="_blank" rel="noopener" style="color:#666;text-decoration:none">🎧 YouGlish 语境</a>'+
      '<a href="https://www.playphrase.me/#/search?q='+encodeURIComponent(state.current)+'" target="_blank" rel="noopener" style="color:#666;text-decoration:none">🎬 PlayPhrase 影视</a>'+
    '</div>'+
    '<div class="wordNoteWrap">'+
      '<label for="wordNoteInput">📝 Note</label>'+
      '<input id="wordNoteInput" class="wordNoteInput" type="text" placeholder="例如：容易和另一个词混；重音容易记错" value="'+escapeHtml(state.notes[state.current]||'')+'">'+
    '</div>';
}




function saveCurrentNote(){
  if(!state.current) return;
  const input=document.getElementById("wordNoteInput");
  if(!input) return;
  const text=input.value.trim();
  if(text) state.notes[state.current]=text;
  else delete state.notes[state.current];
  save();
}
function updateStats(){
 let m=Object.keys(state.mastered).length;
 let a=Object.values(state.debts).filter(x=>x>0).length;
 let u=allWords().filter(w=>!state.seen[w]).length;
 document.getElementById("mastered").textContent=m;
 document.getElementById("active").textContent=a;
 document.getElementById("unseen").textContent=u;
 document.getElementById("bar").style.width=(m/Math.max(allWords().length,1)*100)+"%";
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function loadVoices(){voices=speechSynthesis.getVoices();}
speechSynthesis.onvoiceschanged=loadVoices; loadVoices();

document.getElementById("speak").onclick=()=>{
  started=true;
  if(!state.current){
    speechSynthesis.cancel();
    revealed=false;
    if(!state.queue.length) refill();
    state.current=popNextEligible();
    if(!state.current){ refill(); state.current=popNextEligible(); }
    if(state.current){
      state.seen[state.current]=true;
      save();
      speakCurrent();
    }
  }else{
    speakCurrent();
  }
};
document.getElementById("answer").addEventListener("change",e=>{
  if(e.target && e.target.id==="wordNoteInput") saveCurrentNote();
});
document.getElementById("answer").addEventListener("blur",e=>{
  if(e.target && e.target.id==="wordNoteInput") saveCurrentNote();
},true);
document.getElementById("reveal").onclick=reveal;
document.getElementById("pass").onclick=()=>{if(!started){started=true;next()}else pass()};
document.getElementById("again").onclick=()=>{if(!started){started=true;next()}else again()};
document.getElementById("voice").onclick=()=>{
 let en=voices.filter(v=>/^en[-_]/i.test(v.lang)); if(!en.length)return;
 state.voiceIndex=(state.voiceIndex+1)%en.length; save();
 document.getElementById("hint").textContent="Voice: "+en[state.voiceIndex].name;
 speakCurrent();
};
document.getElementById("info").onclick=()=>{
 const debt=Object.entries(state.debts)
   .filter(x=>Number(x[1])>0 && !state.mastered[x[0]])
   .sort((a,b)=>Number(b[1])-Number(a[1]) || a[0].localeCompare(b[0]));
 const top=debt.slice(0,10);
 const list=rows=>rows.length
   ? '<ol>'+rows.map(x=>'<li>'+escapeHtml(x[0])+' — debt '+x[1]+'</li>').join('')+'</ol>'
   : '<p>暂无钉子户 🎉</p>';
 document.getElementById("panel").innerHTML=
   '<h2>规则</h2>'+
   '<p>每个新词首次出现时默认 debt = 1。PASS：debt −1；AGAIN：debt +1。debt 到 0 后进入 Mastered。因此首次 PASS 直接清零；首次 AGAIN 会变成 debt = 2。</p>'+
   '<p>Active 单词每个自然日最多考核一次：AGAIN 后当天退场；若 debt &gt; 1，PASS 后也当天退场，下一次最早在下一个自然日出现。</p>'+
   '<p><b>peak</b>：记录一个词历史上达到过的最高 debt；进入 Mastered 后仍保存在学习 state 中，并随 GitHub progress.json 一起同步。</p>'+
   '<p><b>自定义词库</b>：导入的新词会永久写入学习 state，并随 GitHub progress.json 同步；不会只临时塞进 queue。</p>'+
   '<h2>🔩 当前钉子户 '+debt.length+'</h2>'+
   list(top)+
   (debt.length>10
     ? '<details><summary>展开其余 '+(debt.length-10)+' 个</summary>'+list(debt.slice(10))+'</details>'
     : '')+
   '<button class="action" onclick="closePanel()">关闭</button>';
 document.getElementById("overlay").style.display="flex";
};

function reAddWord(word){
  if(!state.mastered[word]) return;
  delete state.mastered[word];
  state.debts[word]=1;              // one successful recognition clears this review
  state.seen[word]=true;
  state.highestDebt[word]=Math.max(state.highestDebt[word]||0, 1);
  delete state.lastReviewedDate[word];
  // Put it into the queue soon, but not necessarily immediately.
  const gap=Math.min(10+Math.floor(Math.random()*16), state.queue.length);
  state.queue.splice(gap,0,word);
  save();
  showMastered();
}
function reAddTop(n){
  const rows=Object.keys(state.mastered)
    .map(w=>[w,state.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
    .slice(0,n);
  rows.forEach(([w])=>{
    delete state.mastered[w];
    state.debts[w]=1;
    state.seen[w]=true;
    state.highestDebt[w]=Math.max(state.highestDebt[w]||0,1);
    delete state.lastReviewedDate[w];
    state.queue.push(w);
  });
  shuffle(state.queue);
  save();
  showMastered();
}
function showMastered(){
  const rows=Object.keys(state.mastered)
    .map(w=>[w,state.highestDebt[w]||0])
    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]));
  const rowHtml=([w,d])=>
    '<div class="masterRow"><span>'+escapeHtml(w)+'</span><span>peak '+d+'</span>'+
    '<button class="miniBtn" onclick='+JSON.stringify("reAddWord("+JSON.stringify(w)+")")+'>重新加入</button></div>';
  const topRows=rows.slice(0,10);
  const restRows=rows.slice(10);
  const body = rows.length
    ? topRows.map(rowHtml).join('')+
      (restRows.length
        ? '<details><summary>展开其余 '+restRows.length+' 个</summary>'+restRows.map(rowHtml).join('')+'</details>'
        : '')
    : '<p>还没有 mastered 单词。</p>';
  document.getElementById("panel").innerHTML=
    '<h2>Mastered</h2>'+
    '<p>按历史最高 error debt 降序排列。peak 会永久保留，即使后来清零。</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
    '<button class="miniBtn" onclick="reAddTop(10)">重刷 Top 10</button>'+
    '<button class="miniBtn" onclick="reAddTop(50)">重刷 Top 50</button>'+
    '</div>'+body+
    '<button class="action" style="margin-top:18px;width:100%" onclick="closePanel()">关闭</button>';
  document.getElementById("overlay").style.display="flex";
}
document.getElementById("masteredList").onclick=showMastered;

function closePanel(){document.getElementById("overlay").style.display="none"}
document.getElementById("overlay").onclick=e=>{if(e.target.id==="overlay")closePanel()};
document.getElementById("reset").onclick=()=>{
 if(confirm("重置本机学习进度？\n\n这会清空当前浏览器里的 Mastered、debt、seen、peak 等学习记录，但不会修改 GitHub 云端 progress.json。\n\n重置后如果再上传，会用重置后的空白进度覆盖云端。")){
   localStorage.removeItem(KEY);
   state={debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],notes:{},current:null,queue:BASE_WORDS.slice(),voiceIndex:state.voiceIndex||0};
   shuffle(state.queue);
   localStorage.setItem("audio_vocab_sprint_just_reset","1");
   save();
   speechSynthesis.cancel();
   revealed=false; started=false;
   document.getElementById("answer").innerHTML="";
   document.getElementById("hint").textContent="本机进度已重置。点击喇叭开始。";
   alert("本机已重置。\n⚠️ 此时上传 GitHub 会覆盖云端进度。");
 }
};

async function exportProgress(){
  const payload = {
    app: "Audio Vocabulary Sprint",
    version: 3,
    exportedAt: new Date().toISOString(),
    totalWords: allWords().length,
    state: state
  };
  const stamp = new Date().toISOString().slice(0,10);
  const filename = "Audio_Vocabulary_Sprint_progress_"+stamp+".json";
  const json = JSON.stringify(payload,null,2);
  const blob = new Blob([json], {type:"application/json"});

  // iPhone/iPad Safari: Share Sheet lets the user save the JSON directly to Files.
  try{
    if(typeof File !== "undefined" && navigator.share && navigator.canShare){
      const file = new File([blob], filename, {type:"application/json"});
      if(navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:"Audio Vocabulary Sprint Progress"
        });
        return;
      }
    }
  }catch(e){
    // User cancelling the share sheet is harmless; fall through only for real failures.
    if(e && e.name === "AbortError") return;
  }

  // Desktop / browsers without file sharing.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importProgress(file){
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    const incoming = payload && payload.state ? payload.state : payload;
    if(!incoming || typeof incoming!=="object" || !incoming.debts || !incoming.mastered || !incoming.seen){
      throw new Error("Invalid progress file");
    }
    state = {
      debts: incoming.debts || {},
      mastered: incoming.mastered || {},
      seen: incoming.seen || {},
      highestDebt: incoming.highestDebt || {},
      lastReviewedDate: incoming.lastReviewedDate || {},
      customWords: Array.isArray(incoming.customWords) ? incoming.customWords : [],
      notes: (incoming.notes && typeof incoming.notes === "object") ? incoming.notes : {},
      current: incoming.current || null,
      queue: Array.isArray(incoming.queue) ? incoming.queue : [],
      voiceIndex: incoming.voiceIndex || 0
    };
    for (const [w,d] of Object.entries(state.debts)) {
      state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
    }
    save();
    speechSynthesis.cancel();
    revealed=false; started=false;
    document.getElementById("answer").innerHTML="";
    document.getElementById("hint").textContent="进度已导入。点击喇叭继续。";
    alert("进度导入成功");
  }catch(e){
    alert("导入失败：这不是有效的进度文件。");
  }
}

function normalizeImportedWords(text){
  const stop = new Set(["a","an","the"]);
  const seen = new Set();
  const words = [];
  text.split(/\r?\n/).forEach(raw=>{
    const w = raw.trim();
    if(!w) return;
    if(w.toLowerCase()==="vc_vocabulary") return;
    const key = w.toLowerCase();
    if(stop.has(key)) return;
    if(seen.has(key)) return;
    seen.add(key);
    words.push(w);
  });
  return words;
}

document.getElementById("importWordsFile").onchange=(ev)=>{
  const file=ev.target.files && ev.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const imported=normalizeImportedWords(String(reader.result||""));
      const baseSet=new Set(BASE_WORDS.map(w=>String(w).toLowerCase()));
      const customSet=new Set((state.customWords||[]).map(w=>String(w).toLowerCase()));
      const masteredSet=new Set(Object.keys(state.mastered||{}).map(w=>w.toLowerCase()));
      const activeSet=new Set([
        ...Object.keys(state.debts||{}),
        ...(state.queue||[]),
        ...(state.current?[state.current]:[])
      ].map(w=>String(w).toLowerCase()));

      let alreadyBase=0, alreadyCustom=0, skippedMastered=0, skippedActive=0;
      const added=[];

      imported.forEach(w=>{
        const k=w.toLowerCase();
        if(baseSet.has(k)){ alreadyBase++; return; }
        if(customSet.has(k)){ alreadyCustom++; return; }

        // A word can remain historically Mastered/Active even if it came from an older queue-only import.
        // In that case, promote it into customWords without destroying its learning record.
        state.customWords.push(w);
        customSet.add(k);
        added.push(w);
        if(masteredSet.has(k)) skippedMastered++;
        else if(activeSet.has(k)) skippedActive++;
      });

      // Only genuinely unseen added words need queue insertion; mastered/active ones already have state.
      const toQueue=added.filter(w=>{
        const k=w.toLowerCase();
        return !masteredSet.has(k) && !activeSet.has(k);
      });
      shuffle(toQueue);
      state.queue=(state.queue||[]).concat(toQueue);
      save();
      updateStats();

      alert(
        "导入完成：\n"+
        "读取词条 "+imported.length+" 个\n"+
        "永久加入自定义词库 "+added.length+" 个\n"+
        "已在内置词库 "+alreadyBase+" 个\n"+
        "已在自定义词库 "+alreadyCustom+" 个\n"+
        "其中保留既有 Mastered 记录 "+skippedMastered+" 个\n"+
        "其中保留既有 Active 记录 "+skippedActive+" 个"
      );
    }catch(e){
      alert("词表导入失败："+e.message);
    }finally{
      ev.target.value="";
    }
  };
  reader.readAsText(file,"utf-8");
};




updateStats();
