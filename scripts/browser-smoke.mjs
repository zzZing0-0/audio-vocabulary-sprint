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
  return {debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:['alpha','beta'],customPronunciations:{},manualPronunciations:{},notes:{},noteUpdatedAt:{},linkedWords:{},tags:{},wordTags:{},removedWords:{},queue:['beta'],queueDate:null,dailyStats:{},historyLinks:{},statsStartDate:'2026-10-04',current:'alpha',voiceIndex:0,...overrides};
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
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.hostname==='127.0.0.1') localStorage.setItem(${JSON.stringify(STORAGE_KEY)},${JSON.stringify(JSON.stringify(seedState))});`});
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
