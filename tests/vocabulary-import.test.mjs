import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {applyVocabularyImport}=require('../js/vocabulary-import.js');
const ipa={uk:'/test/',us:null,fallback:null,source:'eudic'};
function state(){return {customWords:['Known'],customPronunciations:{},debts:{ACTIVE:2},mastered:{Mastered:true},seen:{ACTIVE:true,Mastered:true},highestDebt:{ACTIVE:5,Mastered:4},lastReviewedDate:{ACTIVE:'2026-10-20'},removedWords:{Removed:true},queue:['ACTIVE','Known'],queueDate:'2026-10-21',current:'ACTIVE',dailyStats:{'2026-10-21':{total:3}}};}
test('existing words never change active debt, peak, mastery, removal, queue or daily statistics',()=>{
 const s=state(), before=structuredClone(s);
 const r=applyVocabularyImport(s,['active','MASTERED','Removed','unseen'],[{word:'active'},{word:'mastered'},{word:'removed'},{word:'unseen'},{word:'KNOWN'}]);
 assert.deepEqual(r,{added:0,existing:5,ipaChanged:0});
 assert.deepEqual(s,before);
});
test('new words are added once, case-insensitively, without changing existing learning progress',()=>{
 const s=state(), before=structuredClone(s);
 const r=applyVocabularyImport(s,['active'],[{word:'Novel'},{word:'novel'},{word:'Known'},{word:'OTHER'}]);
 assert.deepEqual(r,{added:2,existing:1,ipaChanged:0});
 assert.deepEqual(s.customWords,['Known','Novel','OTHER']);
 for(const k of ['debts','mastered','seen','highestDebt','lastReviewedDate','removedWords','queue','queueDate','current','dailyStats'])assert.deepEqual(s[k],before[k]);
 assert.deepEqual(applyVocabularyImport(s,['active'],[{word:'NOVEL'},{word:'other'}]),{added:0,existing:2,ipaChanged:0});
});
test('CSV IPA can update existing words independently and identical re-import is idempotent',()=>{
 const s=state(), before=structuredClone(s);
 assert.deepEqual(applyVocabularyImport(s,['active'],[{word:'ACTIVE',pronunciation:ipa},{word:'KNOWN',pronunciation:ipa}]),{added:0,existing:2,ipaChanged:2});
 assert.deepEqual(s.customPronunciations,{active:ipa,known:ipa});
 assert.deepEqual(applyVocabularyImport(s,['active'],[{word:'active',pronunciation:ipa},{word:'known',pronunciation:ipa}]),{added:0,existing:2,ipaChanged:0});
 for(const k of ['debts','mastered','seen','highestDebt','lastReviewedDate','removedWords','queue','queueDate','current','dailyStats'])assert.deepEqual(s[k],before[k]);
});
