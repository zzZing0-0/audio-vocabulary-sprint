import http from 'node:http';
import {createReadStream,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {extname,join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

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
await new Promise(r=>server.listen(8765,'127.0.0.1',r));
const sitePort=server.address().port;

const candidates=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const chrome=candidates.find(existsSync);
if(!chrome){console.log('browser smoke SKIP: Chrome/Chromium not found (set CHROME_BIN)');server.close();process.exit(0);}

const debugPort=19000+Math.floor(Math.random()*1000);
const profile=mkdtempSync(join(tmpdir(),'avs-chrome-'));
const proc=spawn(chrome,[`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(url,opts){const r=await fetch(url,opts);if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
try{
  let version;
  for(let i=0;i<50;i++){try{version=await json(`http://127.0.0.1:${debugPort}/json/version`);break;}catch{await sleep(100);}}
  if(!version)throw new Error('Chrome DevTools endpoint did not start');
  const target=await json(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'});
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0;const pending=new Map();const exceptions=[];
  ws.addEventListener('message',ev=>{
    const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''));
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');await send('Page.enable');
  const seeded={debts:{alpha:2},mastered:{},seen:{alpha:true},highestDebt:{alpha:2},lastReviewedDate:{},customWords:['alpha','beta'],customPronunciations:{},manualPronunciations:{},notes:{},noteUpdatedAt:{},linkedWords:{},tags:{},wordTags:{},removedWords:{},queue:['beta'],queueDate:null,dailyStats:{},historyLinks:{},statsStartDate:'2026-10-04',current:'alpha',voiceIndex:0};
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.protocol==='file:') localStorage.setItem('audio_vocab_sprint_universal_v3',${JSON.stringify(JSON.stringify(seeded))});`});
  await send('Page.navigate',{url:pathToFileURL(join(root,'index.html')).href});
  await sleep(1000);
  if(exceptions.length)throw new Error('startup exception: '+exceptions.join('\n'));
  const evalv=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const href=await evalv('location.href');
  if(String(href).startsWith('chrome-error://')){console.log('browser smoke SKIP: headless Chrome could not navigate in this environment');ws.close();process.exitCode=0;}
  if(!String(href).startsWith('chrome-error://')){
  const initial=await evalv('state.current');
  if(initial!=='alpha')throw new Error(`seeded current word lost: ${initial}`);
  await evalv(`document.getElementById('reveal').click(); document.getElementById('again').click(); true`);
  const debtAfterFirst=await evalv(`state.debts.alpha`);
  if(debtAfterFirst!==3)throw new Error(`AGAIN must mutate debt once: expected 3, got ${debtAfterFirst}`);
  await evalv(`document.getElementById('again').click(); document.getElementById('again').click(); true`);
  const debtAfterStress=await evalv(`state.debts.alpha`);
  if(debtAfterStress!==3)throw new Error(`stress-click mutated debt again: ${debtAfterStress}`);
  await sleep(2300);
  if(exceptions.length)throw new Error('judgment exception: '+exceptions.join('\n'));
  const current=await evalv('state.current');
  if(current==='alpha'||!current)throw new Error(`AGAIN did not advance: current=${current}`);
  const persisted=await evalv(`JSON.parse(localStorage.getItem('audio_vocab_sprint_universal_v3')).debts.alpha`);
  if(persisted!==3)throw new Error(`persisted debt mismatch: ${persisted}`);
  await evalv(`document.getElementById('reveal').click(); document.getElementById('pass').click(); true`);
  await sleep(900);
  if(exceptions.length)throw new Error('PASS exception: '+exceptions.join('\n'));
  const betaMastered=await evalv('Boolean(state.mastered.beta)');
  if(!betaMastered)throw new Error('PASS did not commit mastery for beta');
  console.log('browser smoke OK: startup + AGAIN + stress-click + advance + persistence + PASS');
  ws.close();
  }
} finally {
  proc.kill('SIGKILL');
  await new Promise(r=>{if(proc.exitCode!==null)return r();proc.once('exit',r);setTimeout(r,1000);});
  server.close();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}
}
