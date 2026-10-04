import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');

test('main page loads scheduler before app and sync after app',()=>{
  const html=read('index.html');
  const core=html.indexOf('js/state-core.js');
  const storage=html.indexOf('js/storage.js');
  const scheduler=html.indexOf('js/scheduler.js');
  const app=html.indexOf('js/app.js');
  const search=html.indexOf('js/home-search.js');
  const dataIo=html.indexOf('js/data-io.js');
  const sync=html.indexOf('js/github-sync.js');
  assert.ok(core>=0&&storage>core&&scheduler>storage&&app>scheduler&&search>app&&dataIo>search&&sync>dataIo);
});

test('judgment keeps the deliberate stress-click guard',()=>{
  const s=read('js/scheduler.js');
  assert.match(s,/if\(judgmentLocked\)\{\s*replayJudgmentFeedback\("PASS"\)/s);
  assert.match(s,/if\(judgmentLocked\)\{\s*replayJudgmentFeedback\("AGAIN"\)/s);
  assert.match(s,/Extra taps are intentionally satisfying but never mutate debt again/);
});

test('device-local session fields stay local in sync merge',()=>{
  const s=read('js/github-sync.js');
  for(const field of ['voiceIndex','current','queue','queueDate']){
    assert.match(s,new RegExp(`out\\.${field}=local\\.${field}`),`${field} must remain device-local`);
  }
});

test('core storage key remains stable',()=>{
  assert.match(read('js/state-core.js'),/const AVS_STATE_KEY='audio_vocab_sprint_universal_v3'/);
});
