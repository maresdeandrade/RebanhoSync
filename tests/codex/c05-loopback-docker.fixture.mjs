// Local named-pipe adapter for the existing CLI, never a TCP Docker API listener.
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import { tmpdir } from "node:os";

export function restrictOwnedContainer(body, project) {
  assert.equal(body.Labels?.["com.supabase.cli.project"],project,"C05_UNOWNED_CONTAINER");
  assert.equal(body.HostConfig?.NetworkMode,project,"C05_UNOWNED_NETWORK");
  assert.notEqual(body.HostConfig.PublishAllPorts,true,"C05_UNSAFE_AUTOMATIC_PUBLICATION");
  assert(Object.keys(body.NetworkingConfig?.EndpointsConfig??{}).every(name=>name===project),"C05_UNSAFE_EXTRA_NETWORK");
  body.HostConfig.PublishAllPorts=false;
  for(const bindings of Object.values(body.HostConfig.PortBindings??{}))for(const binding of bindings??[])binding.HostIp="127.0.0.1";
  return body;
}

export async function settleOwnedCleanup(steps) {
  const failed=[];
  for(const [name,cleanup] of steps) {
    try { await cleanup(); } catch { failed.push(name); }
  }
  return failed;
}

export async function startLoopbackDockerAdapter(dockerHost,project) {
  const socketPath=process.platform==="win32" ? `\\\\.\\pipe\\${project}-docker` : path.join(tmpdir(),`${project}-docker.sock`);
  const upstream=dockerHost.startsWith("npipe:") ? dockerHost.replace(/^npipe:\/+/,"\\\\").replaceAll("/","\\") : new URL(dockerHost).pathname;
  const worker=new Worker(new URL(import.meta.url),{workerData:{socketPath,upstream,project}});
  await new Promise((resolve,reject)=>{worker.once("message",resolve);worker.once("error",reject);});
  return {host:process.platform==="win32" ? `npipe:////./pipe/${project}-docker` : `unix://${socketPath}`,close:()=>worker.terminate()};
}

if(!isMainThread) {
  const {socketPath,upstream,project}=workerData;
  const server=http.createServer(async(req,res)=>{
    try {
      if(process.env.C05_DOCKER_DIAGNOSTICS==="1")console.log(`C05 Docker ${req.method} ${req.url.split("?")[0]}`);
      // Supabase owns lifecycle operations; enforce tenant/network and port bindings
      // on every create before a resource can be started by that lifecycle.
      let body;
      if(req.method==="POST"&&/\/containers\/create(?:\?|$)/.test(req.url)) {
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        body=Buffer.from(JSON.stringify(restrictOwnedContainer(JSON.parse(Buffer.concat(chunks).toString()),project)));
      }
      const headers={...req.headers};if(body)headers["content-length"]=String(body.length);
      const target=http.request({socketPath:upstream,path:req.url,method:req.method,headers},response=>{
        if(process.env.C05_DOCKER_DIAGNOSTICS==="1")console.log(`C05 Docker response ${response.statusCode} ${req.url.split("?")[0]}`);
        res.writeHead(response.statusCode,response.headers);
        // ContainerWait returns headers before its body; the CLI starts the
        // container only after those headers arrive. Buffering them deadlocks startup.
        res.flushHeaders();response.pipe(res);
      });
      target.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});
      req.on("aborted",()=>target.destroy());
      if(body)target.end(body);else req.pipe(target);
    }catch{res.writeHead(403);res.end("C05_DOCKER_REQUEST_REFUSED");}
  });
  // Docker exec uses HTTP Upgrade to stream migrations/health probes.
  server.on("upgrade",(req,socket,head)=>{
    if(process.env.C05_DOCKER_DIAGNOSTICS==="1")console.log(`C05 Docker upgrade ${req.method} ${req.url.split("?")[0]}`);
    const target=net.createConnection(upstream,()=>{
      const headers=Object.entries(req.headers).flatMap(([key,value])=>Array.isArray(value)?value.map(v=>`${key}: ${v}`):[`${key}: ${value}`]);
      target.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers.join("\r\n")}\r\n\r\n`);
      if(head.length)target.write(head);
      socket.pipe(target);target.pipe(socket);
    });
    target.on("error",()=>socket.destroy());socket.on("error",()=>target.destroy());socket.on("close",()=>target.destroy());
  });
  server.listen(socketPath,()=>parentPort.postMessage("ready"));
}
