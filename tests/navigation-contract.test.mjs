import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const lookup=readFileSync(new URL('../js/lookup.js',import.meta.url),'utf8');
const modal=readFileSync(new URL('../js/lookup-modal.js',import.meta.url),'utf8');
const lookupHtml=readFileSync(new URL('../lookup.html',import.meta.url),'utf8');

test('dictionary links are intercepted by the shared external-link controller',()=>{
  assert.match(app,/data-dictionary-link="1"/);
  assert.match(lookup,/data-dictionary-link="1"/);
  assert.doesNotMatch(app,/target="vocabLookup"/);
  assert.doesNotMatch(lookup,/target="vocabLookup"/);
});

test('embedded Lookup keeps external dictionary navigation out of the iframe',()=>{
  const external=readFileSync(new URL('../js/external-links.js',import.meta.url),'utf8');
  assert.match(external,/window\.top\.openDictionaryLink/);
  assert.match(external,/e\.preventDefault\(\)/);
  assert.match(external,/window\.open\(href,'_blank'\)/);
  assert.doesNotMatch(lookupHtml,/avs-external-open/);
  assert.doesNotMatch(modal,/avs-external-open/);
});
