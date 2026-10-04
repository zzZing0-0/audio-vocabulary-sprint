import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/github-sync.js',import.meta.url),'utf8');
const cutoff=source.indexOf('function countMergedChanges');
if(cutoff<0)throw new Error('sync merge boundary not found');
const context={console,TextEncoder,TextDecoder,localDateKey:()=> '2026-10-04'};
vm.createContext(context);
vm.runInContext(source.slice(0,cutoff)+'\nglobalThis.__mergeStates=mergeStates;',context);
const merge=(base,local,remote)=>context.__mergeStates(base,local,remote);
const baseState=()=>({debts:{},mastered:{},seen:{},highestDebt:{},lastReviewedDate:{},customWords:[],customPronunciations:{},manualPronunciations:{},notes:{},noteUpdatedAt:{},linkedWords:{},tags:{},wordTags:{},removedWords:{},dailyStats:{},historyLinks:{},statsStartDate:'2026-10-04',current:'local-current',queue:['local-q'],queueDate:'2026-10-04',voiceIndex:2});

test('sync merges independent learning edits on different words',()=>{
  const b=baseState(),l=structuredClone(b),r=structuredClone(b);
  l.debts.alpha=2;l.lastReviewedDate.alpha='2026-10-04';
  r.debts.beta=3;r.lastReviewedDate.beta='2026-10-03';
  const {merged,conflicts}=merge(b,l,r);
  assert.equal(merged.debts.alpha,2);assert.equal(merged.debts.beta,3);assert.equal(conflicts.length,0);
});

test('sync surfaces incompatible same-word learning edits',()=>{
  const b=baseState();b.debts.alpha=2;
  const l=structuredClone(b),r=structuredClone(b);l.debts.alpha=3;r.mastered.alpha=true;delete r.debts.alpha;
  const {merged,conflicts}=merge(b,l,r);
  assert.equal(merged.debts.alpha,3);assert.equal(merged.mastered.alpha,undefined);assert.ok(conflicts.some(c=>c.word==='alpha'));
});

test('sync keeps session position and voice device-local',()=>{
  const b=baseState(),l=structuredClone(b),r=structuredClone(b);
  l.current='phone';l.queue=['p1'];l.queueDate='L';l.voiceIndex=7;
  r.current='cloud';r.queue=['c1'];r.queueDate='R';r.voiceIndex=1;
  const {merged}=merge(b,l,r);
  assert.equal(merged.current,'phone');assert.deepEqual(Array.from(merged.queue),['p1']);assert.equal(merged.queueDate,'L');assert.equal(merged.voiceIndex,7);
});

test('sync daily stats combine relative deltas from base',()=>{
  const b=baseState();b.dailyStats['2026-10-04']={total:10,new:4,review:6};
  const l=structuredClone(b),r=structuredClone(b);l.dailyStats['2026-10-04']={total:12,new:5,review:7};r.dailyStats['2026-10-04']={total:13,new:5,review:8};
  const {merged}=merge(b,l,r);assert.deepEqual(JSON.parse(JSON.stringify(merged.dailyStats['2026-10-04'])),{total:15,new:6,review:9});
});

test('sync preserves set-style word tags from both sides',()=>{
  const b=baseState();b.wordTags.alpha=['base'];const l=structuredClone(b),r=structuredClone(b);l.wordTags.alpha=['base','local'];r.wordTags.alpha=['base','remote'];
  const {merged}=merge(b,l,r);assert.deepEqual(new Set(merged.wordTags.alpha),new Set(['base','local','remote']));
});

test('sync reports divergent notes instead of silently choosing remote',()=>{
  const b=baseState();b.notes.alpha='old';const l=structuredClone(b),r=structuredClone(b);l.notes.alpha='local';r.notes.alpha='remote';
  const {merged,conflicts}=merge(b,l,r);assert.equal(merged.notes.alpha,'local');assert.ok(conflicts.some(c=>c.type==='note'&&c.word==='alpha'));
});
