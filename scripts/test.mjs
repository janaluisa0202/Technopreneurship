import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const output=mkdtempSync(join(tmpdir(),'sakaywise-tests-'));
const files=readdirSync('tests').filter(name=>name.endsWith('.test.ts')).sort().map(name=>join('tests',name));
// Compiled tests run from a temp folder, so point Node at this project's node_modules (e.g. for 'react').
const env={...process.env,NODE_PATH:[resolve('node_modules'),process.env.NODE_PATH].filter(Boolean).join(process.platform==='win32'?';':':')};
function run(args){const result=spawnSync(process.execPath,args,{stdio:'inherit',env});if(result.error)throw result.error;return result.status??1;}
let status=1;
try{
  writeFileSync(join(output,'package.json'),'{"type":"commonjs"}');
  status=run(['node_modules/typescript/bin/tsc','--target','ES2022','--module','commonjs','--moduleResolution','node','--skipLibCheck','--outDir',output,...files]);
  if(status===0)status=run(['--test',...files.map(file=>join(output,file.replace(/\.ts$/,'.js')))]);
}finally{rmSync(output,{recursive:true,force:true});}
process.exitCode=status;
