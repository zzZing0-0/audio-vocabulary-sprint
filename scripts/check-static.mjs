import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join,relative,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function walk(dir,ext){
  const out=[];
  for(const name of readdirSync(dir)){
    const p=join(dir,name),s=statSync(p);
    if(s.isDirectory()&&!['.git','node_modules'].includes(name))out.push(...walk(p,ext));
    else if(s.isFile()&&p.endsWith(ext))out.push(p);
  }
  return out;
}
const js=walk(root,'.js');
for(const file of js)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});

const html=walk(root,'.html');
for(const file of html){
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/<script[^>]+src=["']([^"']+)["']/g)){
    const src=m[1].split('?')[0];
    if(/^(https?:)?\/\//.test(src))continue;
    const target=resolve(dirname(file),src);
    if(!existsSync(target))throw new Error(`${relative(root,file)} references missing script: ${src}`);
  }
}

// Build identity is intentionally duplicated in the static HTML refresh guard and
// package.json. If these drift, the page can mistake itself for a stale build and
// reload repeatedly. This exact regression was caught during v4.1.3 stabilization.
const packageJson=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const indexHtml=readFileSync(join(root,'index.html'),'utf8');
const metaBuild=indexHtml.match(/<meta\s+name=["']app-build["']\s+content=["']([^"']+)["']/i)?.[1];
const currentBuild=indexHtml.match(/const\s+CURRENT_BUILD\s*=\s*["']([^"']+)["']/)?.[1];
const expectedBuild=String(packageJson.version||'');
if(!metaBuild)throw new Error('index.html is missing app-build meta');
if(!currentBuild)throw new Error('index.html is missing CURRENT_BUILD');
if(metaBuild!==expectedBuild || currentBuild!==expectedBuild){
  throw new Error(`Build version mismatch: package=${expectedBuild}, app-build=${metaBuild}, CURRENT_BUILD=${currentBuild}`);
}

// Removed during the v4.1 Lookup-modal migration. A stale call once aborted app.js
// initialization and indirectly broke judgment audio/animation/advance.
const forbidden=['restoreHomeAfterLookup'];
for(const symbol of forbidden){
  for(const file of js){
    if(readFileSync(file,'utf8').includes(symbol))throw new Error(`Legacy symbol ${symbol} reintroduced in ${relative(root,file)}`);
  }
}
console.log(`static check OK: ${js.length} JS files, ${html.length} HTML files`);
