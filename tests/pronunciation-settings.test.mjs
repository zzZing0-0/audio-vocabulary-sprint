import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../js/pronunciation-settings.js',import.meta.url),'utf8');
function setup(initial={}){
 const data=new Map(Object.entries(initial));const calls=[];const timers=[];let canceled=0;
 const localStorage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)};
 class Utterance{constructor(text){this.text=text;}}
 const speechSynthesis={cancel:()=>{canceled++;},speak:u=>calls.push(u)};
 const window={};vm.runInNewContext(code,{window,localStorage,speechSynthesis,SpeechSynthesisUtterance:Utterance,setTimeout:(cb,ms)=>{timers.push({cb,ms});}});
 return {api:window.avsPronunciation,data,calls,timers,get canceled(){return canceled;}};
}
test('defaults are off, 3 repetitions and 700ms; legacy pause migrates as fallback',()=>{
 const x=setup();assert.equal(x.api.read().repeatEnabled,false);assert.equal(x.api.read().repeatCount,3);assert.equal(x.api.read().intervalMs,700);
 const y=setup({'audio_vocab_sprint_confusable_pause_ms':'1200'});assert.equal(y.api.read().intervalMs,1200);
 y.api.save({repeatEnabled:true,repeatCount:4,intervalMs:900});assert.equal(y.api.read().intervalMs,900);
});
test('independent speaker plays once when off, and exactly N times with interval when on',()=>{
 const x=setup();x.api.speak('dye');assert.equal(x.calls.length,1);x.calls[0].onend();assert.equal(x.timers.length,0);
 x.api.save({repeatEnabled:true,repeatCount:3,intervalMs:900});x.api.speak('die');assert.equal(x.calls.length,2);
 x.calls[1].onend();assert.equal(x.timers[0].ms,900);x.timers.shift().cb();assert.equal(x.calls.length,3);
 x.calls[2].onend();x.timers.shift().cb();assert.equal(x.calls.length,4);x.calls[3].onend();assert.equal(x.timers.length,0);
});
test('switching voice or tapping again invalidates pending repetitions',()=>{
 const x=setup();x.api.save({repeatEnabled:true,repeatCount:3,intervalMs:100});
 const a={name:'A'},b={name:'B'};x.api.speak('dye',a);x.calls[0].onend();
 x.api.speak('dye',b);x.timers.shift().cb();assert.equal(x.calls.length,2);assert.equal(x.calls[1].voice,b);
 x.api.stop();x.calls[1].onend();assert.equal(x.timers.length,0);
});
test('invalid preferences clamp and legacy storage is not overwritten',()=>{
 const x=setup({'audio_vocab_sprint_confusable_pause_ms':'1300'});
 x.api.save({repeatEnabled:true,repeatCount:100,intervalMs:-40});assert.equal(x.api.read().repeatCount,10);assert.equal(x.api.read().intervalMs,0);
 assert.equal(x.data.get('audio_vocab_sprint_confusable_pause_ms'),'1300');
});
test('library continuous player retains independent settings and group play uses shared interval',()=>{
 const list=readFileSync(new URL('../js/list-pages.js',import.meta.url),'utf8');
 const home=readFileSync(new URL('../js/word-metadata-ui.js',import.meta.url),'utf8');
 assert.match(list,/LIBRARY_PLAYER_PAUSE_KEY/);assert.match(list,/LIBRARY_PLAYER_REPEAT_KEY/);
 assert.match(list,/return avsPronunciation.intervalMs\(\)/);assert.match(home,/return avsPronunciation.intervalMs\(\)/);
 assert.doesNotMatch(list,/openConfusableReadSettings/);
});
