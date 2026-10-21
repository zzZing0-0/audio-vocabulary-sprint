import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {getInfo,describeZipf}=require('../js/word-info.js');
const data=JSON.parse(readFileSync(new URL('../data/word-info.json',import.meta.url),'utf8'));
test('static word information covers the entire built-in word list',()=>{
 const source=readFileSync(new URL('../data/vocabulary.js',import.meta.url),'utf8');
 const words=JSON.parse(source.match(/window\.BASE_WORDS\s*=\s*(\[.*?\]);/s)[1]);
 assert.ok(words.length>3000);
 for(const w of words)assert.ok(getInfo(data,w),`missing ${w}`);
});
test('word info is case-insensitive and uses real source values',()=>{
 const a=getInfo(data,'SPRAWL');assert.deepEqual(a.tags,['IELTS','TOEFL','GRE']);assert.equal(a.zipf,2.99);
 assert.equal(getInfo(data,'  sprawl ').zipf,a.zipf);
});
test('unknown words and invalid frequency do not imply absence from exam lists',()=>{
 assert.equal(getInfo(data,'nonexistent-word-abcdef'),null);
 assert.equal(getInfo({words:{x:{tags:[],zipf:null}}},'x').description,null);
 assert.equal(getInfo({words:{x:{tags:['IELTS'],zipf:NaN}}},'x').zipf,null);
});
test('Zipf bands are consistent at thresholds',()=>{
 for(const [value,expected] of [[2.9,'罕见'],[3,'较少见'],[4,'中等频率'],[5,'常见'],[6,'非常常见'],[0,null]])assert.equal(describeZipf(value),expected);
});
