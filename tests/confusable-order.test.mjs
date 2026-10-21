import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../js/storage.js',import.meta.url),'utf8');
const a=src.indexOf('function linkedKey('),b=src.indexOf('function cleanTagIds(');
function setup(){const c={state:{linkedWords:{A:['B','C','D'],B:['A'],C:['A'],D:['A']}},findWordCaseInsensitive:w=>w};vm.createContext(c);vm.runInContext(src.slice(a,b),c);return c;}
test('reorder changes only source order, not bidirectional links',()=>{const c=setup();assert.equal(vm.runInContext('reorderLinkedWords("A",1,2)',c),true);assert.deepEqual([...c.state.linkedWords.A],['B','D','C']);assert.deepEqual([...c.state.linkedWords.B],['A']);assert.deepEqual([...c.state.linkedWords.C],['A']);});
test('reorder rejects out-of-bounds and no-op without mutation',()=>{const c=setup(),before=JSON.stringify(c.state.linkedWords);for(const pair of [[-1,1],[0,4],[1,1]])assert.equal(vm.runInContext(`reorderLinkedWords('A',${pair})`,c),false);assert.equal(JSON.stringify(c.state.linkedWords),before);});
test('both study and Lookup managers load pointer sort and save reordered list',()=>{for(const name of ['word-metadata-ui.js','lookup.js']){const src=readFileSync(new URL('../js/'+name,import.meta.url),'utf8');assert.match(src,/avsBindConfusableSort\(/);assert.match(src,/reorderLinkedWords\(/);assert.match(src,/data-confusable-drag/);}for(const name of ['index.html','lookup.html'])assert.match(readFileSync(new URL('../'+name,import.meta.url),'utf8'),/js\/confusable-sort.js/);});
