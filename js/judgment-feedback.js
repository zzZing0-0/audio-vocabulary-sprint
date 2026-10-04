// Judgment audiovisual feedback only. Learning-state mutation remains in scheduler.js.
let neutralFeedbackCtx=null;

function getNeutralFeedbackCtx(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!neutralFeedbackCtx)neutralFeedbackCtx=new Ctx();
    return neutralFeedbackCtx;
  }catch(e){return null;}
}

function setFeedbackAudioSession(){
  try{
    if("audioSession" in navigator && navigator.audioSession){
      navigator.audioSession.type="playback";
    }
  }catch(e){}
}

async function unlockFeedbackAudio(){
  setFeedbackAudioSession();
  const ctx=getNeutralFeedbackCtx();
  if(!ctx)return null;
  try{
    if(ctx.state!=="running")await ctx.resume();
    // A silent buffer inside a real user gesture reliably unlocks Web Audio on iOS/WebKit.
    const b=ctx.createBuffer(1,1,22050);
    const s=ctx.createBufferSource();
    s.buffer=b;s.connect(ctx.destination);s.start();
  }catch(e){}
  return ctx;
}

function crystalTone(ctx,freq,start,dur,peak){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";
  o.frequency.setValueAtTime(freq,start);
  g.gain.setValueAtTime(.0001,start);
  g.gain.exponentialRampToValueAtTime(peak,start+.008);
  g.gain.exponentialRampToValueAtTime(Math.max(peak*.28,.0002),start+dur*.36);
  g.gain.exponentialRampToValueAtTime(.0001,start+dur);
  o.connect(g);g.connect(ctx.destination);
  o.start(start);o.stop(start+dur+.03);
}

async function playAgainSound(){
  try{
    const ctx=await unlockFeedbackAudio();
    if(!ctx||ctx.state!=="running")return;

    const scale=[523.25,587.33,659.25,698.46,783.99,880,987.77];
    const f=scale[Math.floor(Math.random()*scale.length)];
    const now=ctx.currentTime+.025;

    // Crystal-like main strike.
    crystalTone(ctx,f,now,.42,.065);
    crystalTone(ctx,f*2.01,now,.16,.018);
    crystalTone(ctx,f*3.02,now+.01,.11,.010);

    // A small randomized consonant musical tail.
    const tails=[1.5,1.25,4/3,2];
    const ratio=tails[Math.floor(Math.random()*tails.length)];
    crystalTone(ctx,f*ratio,now+.12,.34,.025);
    crystalTone(ctx,f*2,now+.19,.24,.012);
  }catch(e){}
}
function playMasteredSound(){
  try{
    const ctx=getNeutralFeedbackCtx(); if(!ctx) return;
    const now=ctx.currentTime+0.01;
    [[659.25,0,.16],[783.99,.09,.17],[987.77,.18,.18],[1318.51,.29,.27]].forEach(([f,d,dur])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="sine"; o.frequency.setValueAtTime(f,now+d);
      g.gain.setValueAtTime(.0001,now+d);
      g.gain.exponentialRampToValueAtTime(.09,now+d+.012);
      g.gain.exponentialRampToValueAtTime(.0001,now+d+dur);
      o.connect(g); g.connect(ctx.destination); o.start(now+d); o.stop(now+d+dur+.03);
    });
  }catch(e){}
}
let wordDissolveParticles=[];
let wordDissolveRaf=0;
let wordDissolveTemplate=null;
let wordDissolveCanvasSize={w:0,h:0,dpr:0};
const AGAIN_DISSOLVE_MS=1050;

function resetWordDissolve(){
  wordDissolveParticles=[];
  wordDissolveTemplate=null;
  if(wordDissolveRaf){
    cancelAnimationFrame(wordDissolveRaf);
    wordDissolveRaf=0;
  }

  const a=document.getElementById("answer");
  if(a){
    const w=a.querySelector(".word");
    if(w){w.style.opacity="1";w.classList.remove("wordDissolving");}
  }

  const c=document.getElementById("wordDissolveFx");
  if(c){
    const x=c.getContext("2d");
    if(x)x.clearRect(0,0,c.width,c.height);
  }
}

function ensureWordDissolveCanvas(canvas){
  // Cap render DPR on high-density phones: visually indistinguishable here,
  // but substantially cheaper during rapid repeated bursts.
  const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const cssW=window.innerWidth;
  const cssH=window.innerHeight;
  const pxW=Math.max(1,Math.round(cssW*dpr));
  const pxH=Math.max(1,Math.round(cssH*dpr));

  if(
    wordDissolveCanvasSize.w!==pxW ||
    wordDissolveCanvasSize.h!==pxH ||
    wordDissolveCanvasSize.dpr!==dpr
  ){
    canvas.width=pxW;
    canvas.height=pxH;
    canvas.style.width=cssW+"px";
    canvas.style.height=cssH+"px";
    wordDissolveCanvasSize={w:pxW,h:pxH,dpr};
  }

  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,dpr,cssW,cssH};
}

function buildWordDissolveTemplate(wordEl){
  const wr=wordEl.getBoundingClientRect();
  const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const w=Math.max(1,Math.ceil(wr.width));
  const h=Math.max(1,Math.ceil(wr.height));

  const off=document.createElement("canvas");
  off.width=Math.ceil(w*dpr);
  off.height=Math.ceil(h*dpr);
  const o=off.getContext("2d",{willReadFrequently:true});
  o.scale(dpr,dpr);

  const cs=getComputedStyle(wordEl);
  o.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  o.fillStyle=cs.color||"#222";
  o.textAlign="center";
  o.textBaseline="middle";
  o.fillText(wordEl.textContent,w/2,h/2);

  const image=o.getImageData(0,0,off.width,off.height);
  const data=image.data;
  const points=[];

  // Slightly coarser than v3.26 because the same cached shape can now burst repeatedly.
  // The final visual remains fine-grained because each point becomes a very small particle.
  const step=Math.max(2,Math.round(2.2*dpr));
  for(let py=0;py<off.height;py+=step){
    for(let px=0;px<off.width;px+=step){
      const i=(py*off.width+px)*4;
      if(data[i+3]>55){
        points.push({x:px/dpr,y:py/dpr});
      }
    }
  }

  wordDissolveTemplate={
    word:wordEl.textContent,
    left:wr.left,
    top:wr.top,
    points
  };
  return wordDissolveTemplate;
}

function isWordDissolveActive(){
  return wordDissolveParticles.some(p=>p.life>0);
}

function runWordDissolveLoop(){
  if(wordDissolveRaf)return;

  const canvas=document.getElementById("wordDissolveFx");
  if(!canvas)return;
  const {ctx,cssW,cssH}=ensureWordDissolveCanvas(canvas);

  function frame(){
    wordDissolveRaf=0;
    ctx.clearRect(0,0,cssW,cssH);

    let write=0;
    for(let i=0;i<wordDissolveParticles.length;i++){
      const p=wordDissolveParticles[i];
      p.x+=p.vx;
      p.y+=p.vy;
      p.vx*=.995;
      p.vy-=.001;
      p.life-=p.fade;
      if(p.life<=0)continue;

      wordDissolveParticles[write++]=p;
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle="rgb(55,60,67)";
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }
    wordDissolveParticles.length=write;
    ctx.globalAlpha=1;

    if(wordDissolveParticles.length){
      wordDissolveRaf=requestAnimationFrame(frame);
    }else{
      ctx.clearRect(0,0,cssW,cssH);
    }
  }

  wordDissolveRaf=requestAnimationFrame(frame);
}

function dissolveCurrentWord(){
  const answer=document.getElementById("answer");
  const wordEl=answer&&answer.querySelector(".word");
  const canvas=document.getElementById("wordDissolveFx");
  if(!wordEl||!canvas||!wordEl.textContent.trim())return 0;

  ensureWordDissolveCanvas(canvas);

  let template=wordDissolveTemplate;
  if(!template || template.word!==wordEl.textContent){
    template=buildWordDissolveTemplate(wordEl);
  }
  if(!template || !template.points.length)return 0;

  // Hide the real word immediately on the first tap. Later taps reuse its cached
  // silhouette, so every rapid tap can launch a fresh particle burst instantly.
  wordEl.classList.add("wordDissolving");
  wordEl.style.opacity="0";

  const mobile=window.matchMedia&&window.matchMedia("(max-width: 500px)").matches;
  const perBurstCap=mobile?560:820;
  const totalCap=mobile?1800:2800;
  const points=template.points;
  const stride=Math.max(1,Math.floor(points.length/perBurstCap));
  const offset=Math.floor(Math.random()*stride);
  let added=0;

  for(let i=offset;i<points.length && added<perBurstCap;i+=stride){
    if(Math.random()>.86)continue;
    const pt=points[i];
    const angle=Math.random()*Math.PI*2;
    const speed=.7+Math.random()*2.45;

    wordDissolveParticles.push({
      x:template.left+pt.x,
      y:template.top+pt.y,
      vx:Math.cos(angle)*speed+.24,
      vy:Math.sin(angle)*speed-.18,
      r:.34+Math.random()*.72,
      life:1,
      fade:.010+Math.random()*.009
    });
    added++;
  }

  // Bound accumulated work during "stress-clicking": keep the newest particles,
  // which are also the most visually salient ones.
  if(wordDissolveParticles.length>totalCap){
    wordDissolveParticles.splice(0,wordDissolveParticles.length-totalCap);
  }

  runWordDissolveLoop();
  return AGAIN_DISSOLVE_MS;
}

function celebrateAgain(){
  try{
    return dissolveCurrentWord();
  }catch(e){
    console.warn("AGAIN dissolve skipped:",e);
    return 0;
  }
}

function celebrateMastered(){
  const card=document.querySelector(".card"); if(!card) return;
  card.classList.remove("masteredGlow"); void card.offsetWidth; card.classList.add("masteredGlow");
  setTimeout(()=>card.classList.remove("masteredGlow"),900);
}
function debtVisualClass(d){
  d=Number(d)||1;
  return d>=7?"debtExtreme":d>=4?"debtHigh":d>=2?"debtMid":"debtLow";
}
function styleDebtBadge(d){
  const badge=document.querySelector(".debtBadge"); if(!badge) return;
  badge.classList.remove("debtLow","debtMid","debtHigh","debtExtreme");
  badge.classList.add(debtVisualClass(d));
  if(Number(d)>=7 && !badge.textContent.includes("🔥")) badge.textContent="🔥 "+badge.textContent;
}


setFeedbackAudioSession();
function installFeedbackAudioUnlock(){
  const unlock=()=>{unlockFeedbackAudio();};
  ["pointerdown","touchstart","click"].forEach(type=>{
    document.addEventListener(type,unlock,{once:true,passive:true});
  });
}
installFeedbackAudioUnlock();
