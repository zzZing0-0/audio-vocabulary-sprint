import {execFileSync} from 'node:child_process';
import {readdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join,relative,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function walk(dir,ext){const out=[];for(const name of readdirSync(dir)){const p=join(dir,name),s=statSync(p);if(s.isDirectory()&&!['.git','node_modules'].includes(name))out.push(...walk(p,ext));else if(s.isFile()&&p.endsWith(ext))out.push(p);}return out;}
const js=walk(root,'.js');for(const file of js)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const html=walk(root,'.html');
for(const file of html){const text=readFileSync(file,'utf8');for(const m of text.matchAll(/<script[^>]+src=["']([^"']+)["']/g)){const src=m[1].split('?')[0];if(/^(https?:)?\/\//.test(src))continue;const target=resolve(dirname(file),src);if(!existsSync(target))throw new Error(`${relative(root,file)} references missing script: ${src}`);}}
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));const expected=String(pkg.version||'');
const index=readFileSync(join(root,'index.html'),'utf8');
for(const file of html){
  const source=readFileSync(file,'utf8'),rel=relative(root,file);
  const meta=source.match(/<meta\s+name=["']app-build["']\s+content=["']([^"']+)["']/i)?.[1];
  if(!meta)throw new Error(`${rel} missing app-build meta`);
  if(meta!==expected)throw new Error(`${rel} app-build=${meta}, expected ${expected}`);
  if(!source.includes(`js/runtime.js?v=${expected}`))throw new Error(`${rel} missing shared runtime.js for ${expected}`);
  if(/CURRENT_BUILD/.test(source))throw new Error(`${rel} reintroduced page-local CURRENT_BUILD guard`);
  for(const m of source.matchAll(/[?&]v=(\d+\.\d+\.\d+)/g))if(m[1]!==expected)throw new Error(`${rel} contains stale asset/link version ${m[1]}`);
}
const title=index.match(/<title>Audio Vocabulary Sprint v([^<]+)<\/title>/i)?.[1];const footer=index.match(/<div class=["']footerVersion["']>v([^<]+)<\/div>/i)?.[1];
if(title!==expected||footer!==expected)throw new Error(`Visible version mismatch: title=${title}, footer=${footer}, expected=${expected}`);
for(const symbol of ['restoreHomeAfterLookup'])for(const file of js)if(readFileSync(file,'utf8').includes(symbol))throw new Error(`Legacy symbol ${symbol} reintroduced in ${relative(root,file)}`);
console.log(`static check OK: ${js.length} JS files, ${html.length} HTML files, build ${expected}`);
