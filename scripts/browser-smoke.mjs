import http from 'node:http';
import {createReadStream,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {extname,join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://local');
  const rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).replace(/^\/+/, '');
  const file=resolve(root,rel);
  if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);res.end('not found');return;}
  res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const sitePort=server.address().port;

const candidates=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const chrome=candidates.find(existsSync);
if(!chrome){console.log('browser regression SKIP: Chrome/Chromium not found (set CHROME_BIN)');server.close();process.exit(0);}

const debugPort=19000+Math.floor(Math.random()*1000);
const profile=mkdtempSync(join(tmpdir(),'avs-chrome-'));
const proc=spawn(chrome,[`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
const STORAGE_KEY='audio_vocab_sprint_universal_v3';
function seed(overrides={}){
  return {debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:['alpha','beta'],customPronunciations:{},manualPronunciations:{},notes:{},noteUpdatedAt:{},linkedWords:{},tags:{},wordTags:{},removedWords:{},queue:['beta'],queueDate:null,dailyStats:{},todayReview:{},historyLinks:{},statsStartDate:'2026-10-04',current:'alpha',voiceIndex:0,...overrides};
}

let browserUnavailable=false;
async function openCase(name,seedState){
  const target=await json(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'});
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0;const pending=new Map();const exceptions=[];
  ws.addEventListener('message',ev=>{
    const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''));
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.hostname==='127.0.0.1'&&!sessionStorage.getItem('__avsRegressionSeeded')){localStorage.setItem(${JSON.stringify(STORAGE_KEY)},${JSON.stringify(JSON.stringify(seedState))});sessionStorage.setItem('__avsRegressionSeeded','1');}`});
  await send('Page.navigate',{url:`http://127.0.0.1:${sitePort}/index.html?regression=${encodeURIComponent(name)}`});
  await sleep(900);
  const evalv=async (expression,userGesture=false)=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture})).result.value;
  const href=await evalv('location.href');
  if(String(href).startsWith('chrome-error://'))browserUnavailable=true;
  return {ws,evalv,exceptions,close(){try{ws.close();}catch{}}};
}

async function browserTargets(){
  return await json(`http://127.0.0.1:${debugPort}/json/list`);
}
async function waitFor(predicate,{timeout=2500,step=50}={}){
  const end=Date.now()+timeout;
  while(Date.now()<end){const value=await predicate();if(value)return value;await sleep(step);}
  return null;
}

const cases=[
  ['startup initializes seeded current word',seed(),async({evalv,exceptions})=>{
    if(exceptions.length)throw new Error('startup exception: '+exceptions.join('\n'));
    const current=await evalv('state.current');
    if(current!=='alpha')throw new Error(`expected current alpha, got ${current}`);
  }],
  ['AGAIN stress-click commits once, advances, and persists',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2}}),async({evalv,exceptions})=>{
    const rapid=await evalv(`(()=>{document.getElementById('reveal').click();document.getElementById('again').click();const first=state.debts.alpha;document.getElementById('again').click();document.getElementById('again').click();return {first,after:state.debts.alpha,current:state.current,locked:judgmentLocked,kind:judgmentKind,finalizing:judgmentFinalizing};})()`);
    if(rapid.first!==3)throw new Error(`first AGAIN expected debt 3, got ${rapid.first}`);
    if(rapid.after!==3)throw new Error(`stress-click mutated debt again: ${rapid.after}`);
    if(rapid.current!=='alpha'||!rapid.locked||rapid.kind!=='AGAIN'||rapid.finalizing)throw new Error(`escaped judgment window: ${JSON.stringify(rapid)}`);
    await sleep(2300);
    if(exceptions.length)throw new Error('judgment exception: '+exceptions.join('\n'));
    const current=await evalv('state.current');
    if(current==='alpha'||!current)throw new Error(`AGAIN did not advance: current=${current}`);
    const persisted=await evalv(`JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).debts.alpha`);
    if(persisted!==3)throw new Error(`persisted debt expected 3, got ${persisted}`);
  }],
  ['PASS masters a word when debt is 1',seed({debts:{alpha:1},seen:{alpha:true},highestDebt:{alpha:1}}),async({evalv,exceptions})=>{
    await evalv(`document.getElementById('reveal').click();document.getElementById('pass').click();true`);
    const immediate=await evalv(`({mastered:Boolean(state.mastered.alpha),debt:state.debts.alpha??null})`);
    if(!immediate.mastered||immediate.debt!==null)throw new Error(`expected mastered=true and debt removed, got ${JSON.stringify(immediate)}`);
    await sleep(900);
    if(exceptions.length)throw new Error('PASS exception: '+exceptions.join('\n'));
  }],
  ['PASS reduces debt by one without premature mastery',seed({debts:{alpha:3},seen:{alpha:true},highestDebt:{alpha:3}}),async({evalv,exceptions})=>{
    await evalv(`document.getElementById('reveal').click();document.getElementById('pass').click();true`);
    const immediate=await evalv(`({mastered:Boolean(state.mastered.alpha),debt:state.debts.alpha??null})`);
    if(immediate.mastered||immediate.debt!==2)throw new Error(`expected debt 2 and not mastered, got ${JSON.stringify(immediate)}`);
    await sleep(900);
    if(exceptions.length)throw new Error('PASS exception: '+exceptions.join('\n'));
  }],
  ['dictionary click keeps app in place and reuses one external tab',seed(),async({evalv,exceptions})=>{
    const appHref=await evalv('location.href');
    await evalv(`document.getElementById('reveal').click();true`);
    const before=(await browserTargets()).filter(t=>t.type==='page');
    const firstUrl=`http://127.0.0.1:${sitePort}/index.html?dictionaryMock=one`;
    const firstClicked=await evalv(`(()=>{const a=document.querySelector('a[data-dictionary-link]');if(!a)return false;a.href=${JSON.stringify('PLACEHOLDER_FIRST')};a.click();return true;})()`.replace('PLACEHOLDER_FIRST',firstUrl),true);
    if(!firstClicked)throw new Error('dictionary link not found on revealed card');
    const popup=await waitFor(async()=>{const pages=(await browserTargets()).filter(t=>t.type==='page');return pages.find(t=>t.url.includes('dictionaryMock=one'));});
    if(!popup)throw new Error('first dictionary click did not open an external tab');
    const afterFirstHref=await evalv('location.href');
    if(afterFirstHref!==appHref)throw new Error(`main app navigated on first dictionary click: ${afterFirstHref}`);
    const afterFirst=(await browserTargets()).filter(t=>t.type==='page');
    const secondUrl=`http://127.0.0.1:${sitePort}/index.html?dictionaryMock=two`;
    await evalv(`(()=>{const links=document.querySelectorAll('a[data-dictionary-link]');const a=links[1]||links[0];a.href=${JSON.stringify('PLACEHOLDER_SECOND')};a.click();return true;})()`.replace('PLACEHOLDER_SECOND',secondUrl),true);
    const reused=await waitFor(async()=>{const pages=(await browserTargets()).filter(t=>t.type==='page');return pages.find(t=>t.id===popup.id&&t.url.includes('dictionaryMock=two'));});
    if(!reused)throw new Error('second dictionary click did not reuse the first external tab');
    const afterSecond=(await browserTargets()).filter(t=>t.type==='page');
    if(afterSecond.length!==afterFirst.length)throw new Error(`second dictionary click opened another tab: ${afterFirst.length} -> ${afterSecond.length}`);
    const afterSecondHref=await evalv('location.href');
    if(afterSecondHref!==appHref)throw new Error(`main app navigated on second dictionary click: ${afterSecondHref}`);
    if(exceptions.length)throw new Error('dictionary navigation exception: '+exceptions.join('\n'));
  }],
  ['note edit persists without changing learning state',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2}}),async({evalv,exceptions})=>{
    const before=await evalv(`JSON.stringify({debts:state.debts,mastered:state.mastered,seen:state.seen})`);
    await evalv(`(()=>{document.getElementById('reveal').click();const n=document.getElementById('wordNoteInput');n.value='persistent note';n.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
    const result=await evalv(`({note:state.notes.alpha,persisted:JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).notes.alpha,learning:JSON.stringify({debts:state.debts,mastered:state.mastered,seen:state.seen})})`);
    if(result.note!=='persistent note'||result.persisted!=='persistent note')throw new Error('note did not persist');
    if(result.learning!==before)throw new Error('note edit changed learning state');
    if(exceptions.length)throw new Error('note exception: '+exceptions.join('\n'));
  }],
  ['tag edit persists without changing debt',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2},tags:{t1:{name:'Tools',color:'#888888'}},wordTags:{}}),async({evalv,exceptions})=>{
    await evalv(`(()=>{document.getElementById('reveal').click();document.getElementById('currentTagManage').click();const c=document.querySelector('.tagChoice input[value="t1"]');c.checked=true;document.getElementById('saveWordTags').click();return true;})()`);
    const result=await evalv(`({tags:state.wordTags.alpha,debt:state.debts.alpha,persisted:JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})).wordTags.alpha})`);
    if(!result.tags?.includes('t1')||!result.persisted?.includes('t1'))throw new Error('tag did not persist');
    if(result.debt!==2)throw new Error('tag edit changed debt');
    if(exceptions.length)throw new Error('tag exception: '+exceptions.join('\n'));
  }],
  ['confusable link is bidirectional and does not mutate learning state',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2}}),async({evalv,exceptions})=>{
    await evalv(`(()=>{document.getElementById('reveal').click();document.getElementById('confusableCompact').click();const i=document.getElementById('confusableInput');i.value='beta';document.getElementById('confusableAdd').click();return true;})()`);
    const result=await evalv(`({a:state.linkedWords.alpha,b:state.linkedWords.beta,debt:state.debts.alpha,mastered:Boolean(state.mastered.alpha)})`);
    if(!result.a?.includes('beta')||!result.b?.includes('alpha'))throw new Error('confusable link is not bidirectional');
    if(result.debt!==2||result.mastered)throw new Error('confusable edit changed learning state');
    if(exceptions.length)throw new Error('confusable exception: '+exceptions.join('\n'));
  }],
  ['main confusable group play reads current word then linked words without opening manager',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2},customWords:['alpha','beta','gamma'],linkedWords:{alpha:['beta','gamma'],beta:['alpha'],gamma:['alpha']}}),async({evalv,exceptions})=>{
    await evalv(`(()=>{localStorage.setItem('audio_vocab_sprint_confusable_pause_ms','0');document.getElementById('reveal').click();window.__spoken=[];window.__voiceCalls=0;window.__expectedVoice=(selectedVoice()&&selectedVoice().name)||null;const originalSelectedVoice=selectedVoice;selectedVoice=()=>{window.__voiceCalls++;return originalSelectedVoice();};Object.defineProperty(SpeechSynthesis.prototype,'speak',{configurable:true,writable:true,value:function(u){window.__spoken.push({text:u.text,voice:u.voice&&u.voice.name});setTimeout(()=>u.onend&&u.onend(),0);}});document.querySelector('.confusableGroupPlayHome').click();return true;})()`);
    await sleep(120);
    const result=await evalv(`({spoken:window.__spoken,voiceCalls:window.__voiceCalls,expectedVoice:window.__expectedVoice,manager:Boolean(document.getElementById('confusableManagerBackdrop')),voiceIndex:state.voiceIndex})`);
    if(exceptions.length)throw new Error('grouped playback exception: '+exceptions.join('\n'));
    if(result.spoken.map(x=>x.text).join(',')!=='alpha,beta,gamma')throw new Error(`wrong grouped playback order: ${JSON.stringify(result.spoken)}`);
    if(result.voiceCalls!==1)throw new Error(`grouped playback did not resolve the current voice exactly once: ${result.voiceCalls}`);
    if(result.expectedVoice&&result.spoken.some(x=>x.voice!==result.expectedVoice))throw new Error(`grouped playback did not keep current voice: ${JSON.stringify(result)}`);
    if(result.manager)throw new Error('grouped playback click opened confusable manager');
    if(result.voiceIndex!==0)throw new Error(`grouped playback changed voiceIndex: ${result.voiceIndex}`);
  }],
  ['today review records real judgments once and stays read-only',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2}}),async({evalv,exceptions})=>{
    await evalv(`(()=>{document.getElementById('libraryBtn').click();window.__todayHiddenBefore=!document.body.textContent.includes('今日复习');document.getElementById('utilityClose').click();document.getElementById('reveal').click();document.getElementById('again').click();document.getElementById('again').click();return true;})()`);
    const recorded=await evalv(`(()=>{const day=localDateKey(),row=state.todayReview?.[day]||[];return {day,row,hiddenBefore:window.__todayHiddenBefore,learning:JSON.stringify({debts:state.debts,mastered:state.mastered,seen:state.seen,highestDebt:state.highestDebt,dailyStats:state.dailyStats})};})()`);
    if(!recorded.hiddenBefore)throw new Error('today review entry was visible before any judgment');
    if(recorded.row.length!==1||recorded.row[0]!=='alpha')throw new Error(`today review did not record judgment exactly once: ${JSON.stringify(recorded.row)}`);
    await evalv(`location.href='today.html?regression=today-review';true`);await sleep(700);
    const page=await evalv(`({title:document.querySelector('h1')?.textContent,words:[...document.querySelectorAll('.wordListWord')].map(x=>x.textContent),meta:[...document.querySelectorAll('.wordListMeta')].map(x=>x.textContent.trim()),mutators:[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(x=>['重新学习','删除','通过','再来一次'].includes(x)),learning:JSON.stringify((()=>{const s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));return {debts:s.debts,mastered:s.mastered,seen:s.seen,highestDebt:s.highestDebt,dailyStats:s.dailyStats};})())})`);
    if(!page.title?.includes('今日复习')||page.words.join(',')!=='alpha')throw new Error(`today review page did not preserve first-judgment order: ${JSON.stringify(page)}`);
    if(page.meta.join(',')!=='debt 3 · peak 3 · 学习中')throw new Error(`today review did not show current debt/peak/status: ${JSON.stringify(page.meta)}`);
    if(page.meta.some(x=>x.includes('今日第')||x.includes('NaN')))throw new Error(`today review exposed internal ordering metadata: ${JSON.stringify(page.meta)}`);
    if(page.mutators.length)throw new Error(`today review exposed learning mutators: ${page.mutators.join(',')}`);
    if(page.learning!==recorded.learning)throw new Error('opening today review changed learning state');
    if(exceptions.length)throw new Error('today review exception: '+exceptions.join('\n'));
  }],
  ['Lookup modal close preserves underlying study card',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2}}),async({evalv,exceptions})=>{
    await evalv(`document.getElementById('reveal').click();openLookupModal('beta');true`);
    const opened=await evalv(`Boolean(document.querySelector('.lookupModalBackdrop'))`);
    if(!opened)throw new Error('Lookup modal did not open');
    await evalv(`document.querySelector('.lookupModalClose').click();true`);
    const result=await evalv(`({modal:Boolean(document.querySelector('.lookupModalBackdrop')),current:state.current,revealed:!document.getElementById('judgmentActions').hidden,word:document.querySelector('#answer .word')?.textContent})`);
    if(result.modal||result.current!=='alpha'||!result.revealed||result.word!=='alpha')throw new Error(`Lookup close lost study context: ${JSON.stringify(result)}`);
    if(exceptions.length)throw new Error('Lookup modal exception: '+exceptions.join('\n'));
  }],
  ['remove action preserves note and linked-word metadata',seed({debts:{alpha:2},seen:{alpha:true},highestDebt:{alpha:2},notes:{alpha:'keep me'},linkedWords:{alpha:['beta'],beta:['alpha']}}),async({evalv,exceptions})=>{
    await evalv(`(()=>{document.getElementById('reveal').click();const b=document.getElementById('removeTopBtn');b.click();b.click();return true;})()`);
    const result=await evalv(`({removed:Boolean(state.removedWords.alpha),note:state.notes.alpha,links:state.linkedWords.alpha})`);
    if(!result.removed)throw new Error('word was not removed');
    if(result.note!=='keep me'||!result.links?.includes('beta'))throw new Error('remove action discarded metadata');
    if(exceptions.length)throw new Error('remove exception: '+exceptions.join('\n'));
  }]
];

try{
  let version;
  for(let i=0;i<50;i++){try{version=await json(`http://127.0.0.1:${debugPort}/json/version`);break;}catch{await sleep(100);}}
  if(!version)throw new Error('Chrome DevTools endpoint did not start');
  const results=[];
  for(const [name,seedState,run] of cases){
    let ctx;
    try{
      ctx=await openCase(name,seedState);
      if(browserUnavailable){ctx.close();break;}
      await run(ctx);
      results.push({name,ok:true});
    }catch(error){results.push({name,ok:false,error:error?.message||String(error)});}
    finally{ctx?.close();await sleep(80);}
  }
  if(browserUnavailable){console.log('browser regression SKIP: headless Chrome could not navigate in this environment');}
  else{
    console.log('\nBrowser regression results:');
    for(const r of results)console.log(`${r.ok?'✔':'✘'} ${r.name}${r.ok?'':`\n    ${r.error}`}`);
    const failed=results.filter(r=>!r.ok);
    console.log(`\n${results.length-failed.length} passed, ${failed.length} failed`);
    if(failed.length)process.exitCode=1;
  }
} finally {
  proc.kill('SIGKILL');
  await new Promise(r=>{if(proc.exitCode!==null)return r();proc.once('exit',r);setTimeout(r,1000);});
  server.close();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}
}
