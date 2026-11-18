// Requires an explicitly task-owned disposable Supabase stack; never touches an existing project.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root=process.env.REBANHOSYNC_CALENDAR_HTTP_WORKDIR;
assert(root, 'Task-owned stack path is required');
const project=readFileSync(`${root}/task-owned.marker`,'utf8').trim();
assert.equal(project,'rs-calendar-http-58431');
const labels=JSON.parse(execFileSync('docker',['inspect',`supabase_db_${project}`,'--format','{{json .Config.Labels}}'],{encoding:'utf8'}));
assert.equal(labels['com.supabase.cli.project'],project);
assert.equal(resolve(labels['com.supabase.cli.workdir']).toLowerCase(),resolve(root).toLowerCase());
const status=JSON.parse(execFileSync('supabase',['status','--workdir',root,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1'); assert.equal(new URL(status.API_URL).port,'58431');
assert.equal(new URL(status.DB_URL).hostname,'127.0.0.1'); assert.equal(new URL(status.DB_URL).port,'58432');
const server=createServer(); await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
const port=server.address().port; await new Promise(ok=>server.close(ok));
const source=pathToFileURL(resolve('supabase/functions/sync-batch/index.ts')).href;
const bootstrap=`const serve=Deno.serve.bind(Deno); Deno.serve=(handler)=>serve({port:${port},hostname:'127.0.0.1'},handler); await import(${JSON.stringify(source)});`;
const endpoint=`http://127.0.0.1:${port}`;
const proc=spawn('deno',['eval','--no-lock','--allow-env','--allow-net','--allow-read',bootstrap],{env:{...process.env,SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY},stdio:'ignore'});
try {
 let ready=false;
 for(let n=0;n<150;n++) {
  if(proc.exitCode!==null) throw Error(`Deno server exited (${proc.exitCode})`);
  try { const response=await fetch(endpoint,{signal:AbortSignal.timeout(500)}); const listeners=execFileSync('netstat',['-ano','-p','tcp'],{encoding:'utf8'}).split(/\r?\n/); const owned=listeners.some(line=>line.includes(`127.0.0.1:${port}`)&&line.includes('LISTENING')&&line.trim().split(/\s+/).at(-1)===String(proc.pid)); if(response.status===401&&owned&&proc.exitCode===null){ready=true;break;} } catch {}
  await new Promise(ok=>setTimeout(ok,200));
 }
 assert(ready,'task-owned handler did not become ready');
 const child=spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','tests/codex/strategic-calendar-http.integration.test.ts','--pool=threads','--maxWorkers=1','--reporter=dot'],{
  env:{...process.env,VITE_SUPABASE_URL:status.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY,VITE_SUPABASE_FUNCTIONS_URL:endpoint,CALENDAR_TEST_DB_URL:status.DB_URL,CALENDAR_TEST_PROJECT:project},stdio:'inherit',
 });
 const code=await new Promise((ok,fail)=>{child.on('error',fail);child.on('exit',ok);});
 if(code!==0) process.exitCode=1;
} finally {proc.kill();}
