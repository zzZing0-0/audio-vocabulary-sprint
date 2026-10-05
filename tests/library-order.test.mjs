import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/library-order.js',import.meta.url),'utf8');
function api(){const c=vm.createContext({Math});vm.runInContext(source+'\nglobalThis.api={order:avsRandomLibraryOrder};',c);return c.api;}
const seq=(...xs)=>{let i=0;return()=>xs[i++%xs.length];};
test('today review randomizes the whole playback list without mutating source',()=>{const {order}=api(),words=['a','b','c','d'],copy=[...words],out=Array.from(order('today',words,{},()=>0));assert.deepEqual(words,copy);assert.deepEqual(out,['b','c','d','a']);assert.deepEqual([...out].sort(),copy);});
test('active randomization never crosses debt/peak priority groups',()=>{const {order}=api(),words=['a','b','c','d','e'],state={debts:{a:3,b:3,c:3,d:2,e:2},highestDebt:{a:5,b:5,c:4,d:9,e:9}},out=Array.from(order('active',words,state,()=>0));assert.deepEqual(out.slice(0,2).sort(),['a','b']);assert.equal(out[2],'c');assert.deepEqual(out.slice(3).sort(),['d','e']);});
test('mastered randomization stays inside equal-peak groups',()=>{const {order}=api(),words=['a','b','c','d'],state={highestDebt:{a:7,b:7,c:4,d:4}},out=Array.from(order('mastered',words,state,()=>0));assert.deepEqual(out.slice(0,2).sort(),['a','b']);assert.deepEqual(out.slice(2).sort(),['c','d']);});
test('random order is a pure permutation and creates no persistence data',()=>{const {order}=api(),state={debts:{a:2,b:2},highestDebt:{a:3,b:3}},out=Array.from(order('active',['a','b'],state,seq(.9,.1)));assert.deepEqual([...out].sort(),['a','b']);assert.deepEqual(state,{debts:{a:2,b:2},highestDebt:{a:3,b:3}});});
