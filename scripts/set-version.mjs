import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const next=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(next||''))throw new Error('Usage: npm run version:set -- x.y.z');
const pkgPath=join(root,'package.json');const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));const old=pkg.version;
if(old===next)throw new Error(`Already at ${next}`);
pkg.version=next;writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
function walk(dir){let out=[];for(const n of readdirSync(dir)){const p=join(dir,n),s=statSync(p);if(s.isDirectory()&&!['.git','node_modules'].includes(n))out=out.concat(walk(p));else if(s.isFile()&&/\.(html|js|md|webmanifest)$/.test(n))out.push(p);}return out;}
for(const file of walk(root)){
  let text=readFileSync(file,'utf8');const changed=text.split(old).join(next);if(changed!==text)writeFileSync(file,changed);
}
console.log(`version ${old} -> ${next}`);
