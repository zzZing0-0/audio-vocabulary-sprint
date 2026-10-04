import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const lookup=readFileSync(new URL('../js/lookup.js',import.meta.url),'utf8');
const modal=readFileSync(new URL('../js/lookup-modal.js',import.meta.url),'utf8');
const lookupHtml=readFileSync(new URL('../lookup.html',import.meta.url),'utf8');

test('dictionary links use the reusable vocabLookup browsing context',()=>{
  assert.match(app,/target="vocabLookup"/);
  assert.match(lookup,/target="vocabLookup"/);
  assert.doesNotMatch(modal,/window\.open\([^)]*vocabLookup/);
});

test('embedded Lookup leaves external dictionary links to native target navigation',()=>{
  assert.doesNotMatch(lookupHtml,/avs-external-open/);
  assert.doesNotMatch(modal,/avs-external-open/);
  assert.match(lookup,/target="vocabLookup"/);
});
