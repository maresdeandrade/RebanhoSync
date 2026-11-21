import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const inventory=JSON.parse(fs.readFileSync('docs/review/evidence/BLOCK1_INTEGRATION_20261121.json')).documentInventory;
const currentFiles=inventory.filter(r=>r.action!=='preservado sem alteração').map(r=>r.document);
const slug=text=>text.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu,'').replace(/\s/g,'-');
function anchors(file){
  const counts=new Map(),set=new Set();let fenced=false;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    if(/^\s*```/.test(line)){fenced=!fenced;continue;}if(fenced)continue;
    const heading=/^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);if(!heading)continue;
    const base=slug(heading[1]),n=counts.get(base)??0;counts.set(base,n+1);set.add(base+(n?'-'+n:''));
  }return set;
}
const failures=[],oldFailures=[];let checked=0;
for(const file of currentFiles){
  const text=fs.readFileSync(file,'utf8');let baseline='';try{baseline=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',stdio:['ignore','pipe','ignore']});}catch{}
  for(const match of text.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)){
    const href=match[1]??match[2];if(/^(?:[a-z]+:|\/\/)/i.test(href))continue;
    checked++;let decoded;try{decoded=decodeURIComponent(href);}catch{decoded=href;}
    const [target,anchor]=decoded.split('#');const resolved=target?path.resolve(path.dirname(file),target):path.resolve(file);
    let error=null;if(!fs.existsSync(resolved))error='arquivo ausente';else if(anchor&&path.extname(resolved)==='.md'&&!anchors(resolved).has(anchor))error='âncora ausente';
    if(error){const finding={file,href,error};(baseline.includes(href)?oldFailures:failures).push(finding);}
  }
}
const result={files:currentFiles.length,checked,failures,preexistingFailures:oldFailures};
fs.writeFileSync('.work/block1-integration/links.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures.length||oldFailures.length)process.exit(1);
