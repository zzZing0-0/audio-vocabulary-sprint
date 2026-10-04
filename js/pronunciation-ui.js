// Pronunciation rendering/editor boundary. No learning-state transitions live here.
let pronunciationWords={};
let pronunciationLoadFinished=false;

function pronunciationHtml(word){
  const key=String(word||"").toLowerCase();
  const item=(state.manualPronunciations&&state.manualPronunciations[key]) || (state.customPronunciations&&state.customPronunciations[key]) || pronunciationWords[key];
  if(!item)return "";

  // Prefer explicitly region-labelled IPA. Show generic fallback only when
  // neither regional label exists; never guess a UK/US label.
  const parts=[];
  if(item.uk) parts.push('<span class="ipaChip ipaUk" title="UK" dir="ltr" lang="en">'+escapeHtml(item.uk)+'</span>');
  if(item.us) parts.push('<span class="ipaChip ipaUs" title="US" dir="ltr" lang="en">'+escapeHtml(item.us)+'</span>');
  if(!parts.length && item.fallback) parts.push('<span class="ipaChip ipaGeneric" title="IPA" dir="ltr" lang="en">'+escapeHtml(item.fallback)+'</span>');
  if(!parts.length)return "";

  return '<div class="ipaWrap"><div class="ipaLine">'+parts.join('')+'</div><button type="button" class="ipaEditBtn" onclick="openPronunciationEditor(state.current)">编辑</button></div>';
}

function openPronunciationEditor(word){
  const key=String(word||"").toLowerCase();
  if(!key)return;
  const base=pronunciationWords[key]||{};
  const imported=(state.customPronunciations&&state.customPronunciations[key])||{};
  const manual=(state.manualPronunciations&&state.manualPronunciations[key])||{};
  const underneath=Object.keys(imported).length?imported:base;
  const effective=Object.keys(manual).length?manual:underneath;
  const old=document.getElementById("ipaEditorBackdrop");if(old)old.remove();
  const wrap=document.createElement("div");wrap.id="ipaEditorBackdrop";wrap.className="ipaEditorBackdrop";
  wrap.innerHTML='<div class="ipaEditor" role="dialog" aria-modal="true"><div class="ipaEditorHead"><b>编辑音标 · '+escapeHtml(word)+'</b><button class="ipaEditorClose" type="button" aria-label="关闭">×</button></div><div class="ipaEditorSource">当前底层来源：'+escapeHtml(imported.source||base.source||"无公共音标")+((imported.fallback||base.fallback)?' · '+escapeHtml(imported.fallback||base.fallback):'')+'</div><div class="ipaEditorRow"><label>🇬🇧 英音</label><input class="ipaEditorInput" id="ipaEditUk" value="'+escapeHtml(effective.uk||'')+'" placeholder="例如 /.../"></div><div class="ipaEditorRow"><label>🇺🇸 美音</label><input class="ipaEditorInput" id="ipaEditUs" value="'+escapeHtml(effective.us||'')+'" placeholder="例如 /.../"></div><div class="ipaEditorRow"><label>通用 IPA（可选覆盖）</label><input class="ipaEditorInput" id="ipaEditFallback" value="'+escapeHtml(manual.fallback||'')+'" placeholder="留空则保留原始通用 IPA"></div><div class="ipaEditorHint">最多固定三项：英音、美音、通用 IPA。填写英/美音后，页面优先显示地区音标；手动层优先；清除后回退到欧路导入音标，如无欧路数据再回退到 Wiktionary。</div><div class="ipaEditorActions"><button type="button" id="ipaResetManual">清除手动修正</button><button type="button" class="ipaSave" id="ipaSaveManual">保存</button></div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.ipaEditorClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close();};
  document.getElementById('ipaSaveManual').onclick=()=>{const uk=document.getElementById('ipaEditUk').value.trim(),us=document.getElementById('ipaEditUs').value.trim(),fallback=document.getElementById('ipaEditFallback').value.trim();state.manualPronunciations=state.manualPronunciations||{};if(uk||us||fallback){state.manualPronunciations[key]={uk:uk||null,us:us||null,fallback:fallback||underneath.fallback||null,source:'manual'};}else delete state.manualPronunciations[key];save();close();refreshCurrentPronunciation();};
  document.getElementById('ipaResetManual').onclick=()=>{state.manualPronunciations=state.manualPronunciations||{};delete state.manualPronunciations[key];save();close();refreshCurrentPronunciation();};
}

function refreshCurrentPronunciation(){
  if(!revealed || !state.current)return;
  const slot=document.getElementById("pronunciationSlot");
  if(slot) slot.innerHTML=pronunciationHtml(state.current);
}

async function loadPronunciations(){
  try{
    const r=await fetch("data/pronunciations.json?v=4.3.1",{cache:"no-cache"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const payload=await r.json();
    pronunciationWords=(payload&&payload.words&&typeof payload.words==="object") ? payload.words : {};
  }catch(e){
    console.warn("Pronunciation database unavailable:",e);
    pronunciationWords={};
  }finally{
    pronunciationLoadFinished=true;
    refreshCurrentPronunciation();
  }
}
function initPronunciationUi(){ loadPronunciations(); }
