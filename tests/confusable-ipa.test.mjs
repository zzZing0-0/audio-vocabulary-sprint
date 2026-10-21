import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../js/confusable-ipa.js',import.meta.url),'utf8');
const sandbox={};vm.runInNewContext(src,sandbox);const api=sandbox.avsConfusableIpa;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
test('linked-word IPA follows manual > imported > base priority',()=>{
 const base={special:{uk:'/base/'},spatial:{fallback:'/space/'}};
 const state={manualPronunciations:{special:{uk:'/manual/'}},customPronunciations:{special:{us:'/import/'}}};
 assert.equal(api.lines('SPECIAL',state,base)[0].text,'/manual/');
 assert.equal(api.lines('spatial',state,base)[0].text,'/space/');
});
test('regional readings are shown in order, generic only as fallback',()=>{
 const base={special:{uk:'/UK/',us:'/US/',fallback:'/generic/'}};
 assert.deepEqual(Array.from(api.lines('special',{},base),x=>x.region),['UK','US']);
 assert.match(api.render('special',{},base,esc),/\/UK\/[\s\S]*\/US\//);
 assert.doesNotMatch(api.render('special',{},base,esc),/generic/);
});
test('unknown IPA adds no blank placeholder and user-supplied IPA is escaped',()=>{
 assert.equal(api.render('unknown',{}, {},esc),'');
 assert.match(api.render('word',{manualPronunciations:{word:{fallback:'<unsafe>&'}}},{},esc),/&lt;unsafe&gt;&amp;/);
});
test('home and Lookup share the same IPA renderer without changing manager rows',()=>{
 const home=readFileSync(new URL('../js/word-metadata-ui.js',import.meta.url),'utf8');
 const lookup=readFileSync(new URL('../js/lookup.js',import.meta.url),'utf8');
 assert.match(home,/avsConfusableIpa\.render\(w,state,pronunciationWords,escapeHtml\)/);
 assert.match(lookup,/avsConfusableIpa\.render\(x,state,lookupPronunciations,esc\)/);
 assert.match(home,/function renderConfusableManager/);
 assert.match(lookup,/function renderLookupManager/);
});
