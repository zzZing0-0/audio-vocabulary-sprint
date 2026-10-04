/* Audio Vocabulary Sprint · local data maintenance and vocabulary import */
function resetProgress(){
 requireSecondClick(
   "reset-local",
   "将清空本机词库数据，包括学习进度、自定义词、笔记、易混词和学习记录；不会直接修改 GitHub。再次点击确认",
   ()=>{
     localStorage.removeItem(KEY);
     state={debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],customPronunciations:{},manualPronunciations:{},notes:{},linkedWords:{},tags:{},wordTags:{},removedWords:{},dailyStats:{},historyLinks:{},statsStartDate:localDateKey(),current:null,queue:BASE_WORDS.slice(),queueDate:null,voiceIndex:state.voiceIndex||0};
     shuffle(state.queue);
     localStorage.setItem("audio_vocab_sprint_just_reset","1");
     save();
     speechSynthesis.cancel();
     revealed=false; started=false;
     document.getElementById("answer").innerHTML=""; syncMobileTopInfoLayout();
     document.getElementById("hint").textContent="";
     updateStats();
     updateAnswerControls();
     showTransientToast("本机词库已清空；GitHub 云端尚未修改");
   }
 );
}

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
      customPronunciations: (incoming.customPronunciations && typeof incoming.customPronunciations === "object" && !Array.isArray(incoming.customPronunciations)) ? incoming.customPronunciations : {},
      manualPronunciations: (incoming.manualPronunciations && typeof incoming.manualPronunciations === "object" && !Array.isArray(incoming.manualPronunciations)) ? incoming.manualPronunciations : {},
      notes: (incoming.notes && typeof incoming.notes === "object") ? incoming.notes : {},
      linkedWords: (incoming.linkedWords && typeof incoming.linkedWords === "object" && !Array.isArray(incoming.linkedWords)) ? incoming.linkedWords : {},
      tags: (incoming.tags && typeof incoming.tags === "object" && !Array.isArray(incoming.tags)) ? incoming.tags : {},
      wordTags: (incoming.wordTags && typeof incoming.wordTags === "object" && !Array.isArray(incoming.wordTags)) ? incoming.wordTags : {},
      removedWords: (incoming.removedWords && typeof incoming.removedWords === "object" && !Array.isArray(incoming.removedWords)) ? incoming.removedWords : {},
      current: incoming.current || null,
      queue: Array.isArray(incoming.queue) ? incoming.queue : [],
      queueDate: (typeof incoming.queueDate === "string") ? incoming.queueDate : null,
      voiceIndex: incoming.voiceIndex || 0
    };
    for (const [w,d] of Object.entries(state.debts)) {
      state.highestDebt[w] = Math.max(state.highestDebt[w]||0, Number(d)||0);
    }
    save();
    speechSynthesis.cancel();
    revealed=false; started=false;
    document.getElementById("answer").innerHTML=""; syncMobileTopInfoLayout();
    document.getElementById("hint").textContent="进度已导入。点击喇叭继续。";
    updateAnswerControls();
    showTransientToast("进度导入成功");
  }catch(e){
    showTransientToast("导入失败：这不是有效的进度文件");
  }
}

function normalizeImportedEntries(entries){
  const stop=new Set(["a","an","the"]);
  const seen=new Map();
  const out=[];
  let blank=0, header=0, stopword=0, chinese=0, duplicateInFile=0;

  (entries||[]).forEach(entry=>{
    const w=String((entry&&entry.word)||"").trim();
    if(!w){blank++;return;}
    if(w.toLowerCase()==="vc_vocabulary"){header++;return;}
    if(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(w)){chinese++;return;}

    const key=w.toLowerCase();
    if(stop.has(key)){stopword++;return;}
    if(seen.has(key)){
      duplicateInFile++;
      // Same-file duplicates never stack debt. If the first row had no IPA but a
      // later duplicate does, keep the richer pronunciation metadata.
      const existing=seen.get(key);
      if(!existing.pronunciation && entry.pronunciation) existing.pronunciation=entry.pronunciation;
      return;
    }

    const clean={word:w,pronunciation:entry&&entry.pronunciation?entry.pronunciation:null};
    seen.set(key,clean);
    out.push(clean);
  });

  return {entries:out,skipped:{blank,header,stopword,chinese,duplicateInFile}};
}

function parseTxtVocabulary(text){
  return normalizeImportedEntries(
    String(text||"").split(/\r?\n/).map(line=>({word:line,pronunciation:null}))
  );
}

function parseCsvRows(text){
  const rows=[];
  let row=[],field="",quoted=false;
  const src=String(text||"").replace(/^\uFEFF/,"");
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quoted){
      if(ch==='"' && src[i+1]==='"'){field+='"';i++;}
      else if(ch==='"'){quoted=false;}
      else field+=ch;
    }else{
      if(ch==='"') quoted=true;
      else if(ch===','){row.push(field);field="";}
      else if(ch==='\n'){
        row.push(field);rows.push(row);row=[];field="";
      }else if(ch!=='\r') field+=ch;
    }
  }
  if(field!==""||row.length){row.push(field);rows.push(row);}
  return rows;
}

function parseEudicPronunciation(raw){
  const text=String(raw||"").trim();
  if(!text)return null;
  const ukMatch=text.match(/英\s*[:：]\s*(.+?)(?=\s*美\s*[:：]|$)/);
  const usMatch=text.match(/美\s*[:：]\s*(.+)$/);
  const uk=ukMatch?ukMatch[1].trim():null;
  const us=usMatch?usMatch[1].trim():null;
  let fallback=null;
  if(!uk&&!us) fallback=text;
  if(!uk&&!us&&!fallback)return null;
  return {uk:uk||null,us:us||null,fallback:fallback||null,source:"eudic"};
}

function parseCsvVocabulary(text){
  const rows=parseCsvRows(text).filter(r=>r.some(cell=>String(cell||"").trim()!==""));
  if(!rows.length) return normalizeImportedEntries([]);

  const headers=rows[0].map(x=>String(x||"").trim().toLowerCase());
  const wordHeaders=new Set(["单词","word","words","词条","term"]);
  const ipaHeaders=new Set(["音标","ipa","pronunciation","phonetic"]);
  const wordIndex=headers.findIndex(h=>wordHeaders.has(h));
  const ipaIndex=headers.findIndex(h=>ipaHeaders.has(h));
  if(wordIndex<0) throw new Error("CSV 找不到“单词”列");

  const entries=rows.slice(1).map(r=>({
    word:String(r[wordIndex]||"").trim(),
    pronunciation:ipaIndex>=0?parseEudicPronunciation(r[ipaIndex]):null
  }));
  return normalizeImportedEntries(entries);
}

function findStateKeyCaseInsensitive(obj,lowerKey){
  return Object.keys(obj||{}).find(k=>String(k).toLowerCase()===lowerKey)||null;
}

document.getElementById("importWordsFile").onchange=(ev)=>{
  const file=ev.target.files&&ev.target.files[0];
  if(!file)return;

  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const text=String(reader.result||"");
      const isCsv=/\.csv$/i.test(file.name||"") || /csv/i.test(file.type||"");
      const normalized=isCsv?parseCsvVocabulary(text):parseTxtVocabulary(text);
      const imported=normalized.entries;
      const baseSet=new Set(BASE_WORDS.map(w=>String(w).toLowerCase()));
      const customSet=new Set((state.customWords||[]).map(w=>String(w).toLowerCase()));
      state.customPronunciations=(state.customPronunciations&&typeof state.customPronunciations==="object")?state.customPronunciations:{};

      let added=0;
      let unseenDuplicate=0;
      let activeRaised=0;
      let masteredReactivated=0;
      let ipaImported=0;

      imported.forEach(entry=>{
        const w=entry.word;
        const k=w.toLowerCase();
        const alreadyExists=baseSet.has(k)||customSet.has(k);

        // Eudic/CSV pronunciation belongs to the learner's private state and overrides
        // the static Wiktionary database for this word on every synced device.
        if(entry.pronunciation){
          state.customPronunciations[k]=entry.pronunciation;
          ipaImported++;
        }

        // New vocabulary entry: add it, but importing is not a learning failure.
        if(!alreadyExists){
          state.customWords.push(w);
          customSet.add(k);
          added++;
          return;
        }

        const masteredKey=findStateKeyCaseInsensitive(state.mastered,k);
        const debtKey=findStateKeyCaseInsensitive(state.debts,k);
        const seenKey=findStateKeyCaseInsensitive(state.seen,k);
        const reviewKey=findStateKeyCaseInsensitive(state.lastReviewedDate,k);
        const hasLearningHistory=Boolean(masteredKey||debtKey||seenKey||reviewKey);

        // Existing but never studied: keep it Unseen. Import overlap alone is not failure.
        if(!hasLearningHistory){
          unseenDuplicate++;
          return;
        }

        // Mastered + re-imported => reactivate at debt 1.
        if(masteredKey){
          delete state.mastered[masteredKey];
          const canonical=debtKey||masteredKey||w;
          state.debts[canonical]=1;
          state.highestDebt[canonical]=Math.max(state.highestDebt[canonical]||0,1);
          delete state.lastReviewedDate[canonical];
          masteredReactivated++;
          return;
        }

        // Active + re-imported => debt +1.
        if(debtKey){
          const oldDebt=Math.max(1,Number(state.debts[debtKey])||1);
          state.debts[debtKey]=oldDebt+1;
          state.highestDebt[debtKey]=Math.max(state.highestDebt[debtKey]||0,oldDebt+1);
          delete state.lastReviewedDate[debtKey];
          activeRaised++;
          return;
        }

        unseenDuplicate++;
      });

      state.queue=[];
      state.queueDate=null;
      refill();
      save();
      updateStats();
      refreshCurrentPronunciation();

      const invalid=normalized.skipped.chinese+normalized.skipped.stopword+normalized.skipped.header;
      showTransientToast(
        (isCsv?"CSV":"TXT")+" 导入完成：有效 "+imported.length+
        "｜新增 "+added+
        "｜未学习重复 "+unseenDuplicate+
        "｜学习中 debt+1 "+activeRaised+
        "｜重新激活 "+masteredReactivated+
        (isCsv?"｜导入 IPA "+ipaImported:"")+
        "｜跳过无效 "+invalid+
        (normalized.skipped.duplicateInFile?"｜文件内重复 "+normalized.skipped.duplicateInFile:"")
      );
    }catch(e){
      showTransientToast("词表导入失败："+e.message);
    }finally{
      ev.target.value="";
    }
  };
  reader.readAsText(file,"utf-8");
};
