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
test('exam tags use distinct stable colors and safe HTML',()=>{
 const {renderHtml}=require('../js/word-info.js');
 const html=renderHtml(data,'episode');
 for(const name of ['cet4','cet6','kaoyan','ielts','toefl','gre'])assert.ok(html.includes('wordInfoTag--'+name),name);
 assert.ok(html.includes('Zipf 5.0'));
 assert.equal(renderHtml({words:{x:{tags:['<script>'],zipf:3.5}}},'x').includes('<script>'),false);
 assert.equal(renderHtml({words:{x:{tags:[],zipf:null}}},'x'),'');
});
test('study and Lookup both reuse reference renderer before notes',()=>{
 const home=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
 const lookup=readFileSync(new URL('../js/lookup.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(home, /linkedWordsHtml\(state.current\)\+\s*\(window\.avsWordInfo\?\.renderHtml/);
 assert.ok(lookup.includes("+confusableLookupHtml(w)+lookupWordInfoHtml(w)+'<details"));
 assert.ok(lookup.includes('window.avsWordInfo?.renderHtml(lookupWordInfo,w)'));
 assert.ok(index.indexOf('js/word-info.js')<index.indexOf('js/app.js'));
});
test('mobile search suggestions overlay card and have bounded scrolling',()=>{
 const css=readFileSync(new URL('../css/style.css',import.meta.url),'utf8');
 assert.match(css,/\.homeSearch\{isolation:isolate;z-index:60\}/);
 assert.match(css,/\.homeSearchSuggestions\{z-index:2;max-height:[^}]+overflow-y:auto/);
 assert.match(css,/\.homeSearch \+ \.card\{z-index:0\}/);
});
