import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/lookup-history.js',import.meta.url),'utf8');
function api(){const c=vm.createContext({Date});vm.runInContext(source+'\nglobalThis.api={record:avsLookupRecord,count:avsLookupCount};',c);return c.api;}
test('lookup history counts one active lookup per word per calendar day',()=>{const {record,count}=api(),s={};assert.equal(record(s,'alpha','2026-10-04'),true);assert.equal(record(s,'alpha','2026-10-04'),false);assert.equal(count(s,'alpha'),1);assert.equal(record(s,'alpha','2026-10-05'),true);assert.equal(count(s,'ALPHA'),2);assert.deepEqual(Array.from(s.lookupStats.alpha.dates),['2026-10-04','2026-10-05']);});
test('lookup history keeps words independent and rejects invalid dates',()=>{const {record,count}=api(),s={lookupStats:{alpha:{dates:['2026-10-04']}}};assert.equal(record(s,'beta','2026-10-04'),true);assert.equal(record(s,'alpha','bad-date'),false);assert.equal(count(s,'alpha'),1);assert.equal(count(s,'beta'),1);});
test('lookup history deduplicates existing dates when deriving count',()=>{const {count}=api();assert.equal(count({lookupStats:{alpha:{dates:['2026-10-04','2026-10-04','2026-10-05']}}},'alpha'),2);});
