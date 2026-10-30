import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { restrictOwnedContainer, startLoopbackDockerAdapter } from "./c05-loopback-docker.fixture.mjs";

test("C05 publication always binds explicitly to loopback before Docker creates a container",()=>{
  const body={Labels:{"com.supabase.cli.project":"owned"},HostConfig:{NetworkMode:"owned",PortBindings:{"5432/tcp":[{HostIp:"",HostPort:"55422"}],"8000/tcp":[{HostIp:"0.0.0.0",HostPort:"55421"}]}}};
  const result=restrictOwnedContainer(body,"owned");
  assert.deepEqual(result.HostConfig.PortBindings,{"5432/tcp":[{HostIp:"127.0.0.1",HostPort:"55422"}],"8000/tcp":[{HostIp:"127.0.0.1",HostPort:"55421"}]});
});
test("local adapter forwards explicit bindings and Docker exec upgrade streams",async()=>{
  const project=`c05-test-${randomUUID()}`;
  const pipe=process.platform==="win32" ? `\\\\.\\pipe\\${project}-upstream` : path.join(tmpdir(),`${project}-upstream.sock`);
  let pendingWait, forwarded=0;
  const upstream=http.createServer(async(req,res)=>{
    if(req.url.endsWith("/wait")){pendingWait=res;res.writeHead(200);res.flushHeaders();return;}
    forwarded++;
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks));
    assert.equal(body.HostConfig.PortBindings["5432/tcp"][0].HostIp,"127.0.0.1");
    res.writeHead(201);res.end("created");
  });
  upstream.on("upgrade",(_req,socket)=>{socket.write("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\nmigration-stream");socket.end();});
  await new Promise(resolve=>upstream.listen(pipe,resolve));
  const adapter=await startLoopbackDockerAdapter(process.platform==="win32" ? `npipe:////./pipe/${project}-upstream` : `unix://${pipe}`,project);
  const socketPath=process.platform==="win32" ? `\\\\.\\pipe\\${project}-docker` : new URL(adapter.host).pathname;
  try{
    const unsafe=JSON.stringify({Labels:{"com.supabase.cli.project":project},HostConfig:{NetworkMode:project,PublishAllPorts:true}});
    const refused=await new Promise((resolve,reject)=>{const req=http.request({socketPath,path:"/v1.47/containers/create",method:"POST",headers:{"Content-Length":Buffer.byteLength(unsafe)}},res=>{res.resume();res.on("end",()=>resolve(res.statusCode));});req.on("error",reject);req.end(unsafe);});
    assert.equal(refused,403);assert.equal(forwarded,0);
    const body=JSON.stringify({Labels:{"com.supabase.cli.project":project},HostConfig:{NetworkMode:project,PortBindings:{"5432/tcp":[{HostPort:"55422"}]}}});
    const created=await new Promise((resolve,reject)=>{const req=http.request({socketPath,path:"/v1.47/containers/create",method:"POST",headers:{"Content-Length":Buffer.byteLength(body)}},res=>{res.resume();res.on("end",()=>resolve(res.statusCode));});req.on("error",reject);req.end(body);});
    assert.equal(created,201);
    const stream=await new Promise((resolve,reject)=>{const req=http.request({socketPath,path:"/v1.47/exec/owned/start",method:"POST",headers:{Connection:"Upgrade",Upgrade:"tcp"}});req.on("upgrade",(_res,socket,head)=>{let value=head.toString();socket.on("data",chunk=>{value+=chunk;});socket.on("end",()=>resolve(value));});req.on("error",reject);req.end();});
    assert.equal(stream,"migration-stream");
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error("Docker wait headers were buffered")),1000);
      const req=http.request({socketPath,path:"/v1.47/containers/owned/wait",method:"POST"},res=>{
        clearTimeout(timer);pendingWait.end("done");res.resume();res.on("end",resolve);
      });req.on("error",reject);req.end();
    });
  }finally{await adapter.close();await new Promise(resolve=>upstream.close(resolve));}
});

test("cleanup attempts every owned step even after earlier failures",async()=>{
  const { settleOwnedCleanup }=await import("./c05-loopback-docker.fixture.mjs");
  assert.equal(typeof settleOwnedCleanup,"function");
  for(const failing of ["db","edge","project","network","adapter"]){
    const calls=[];
    const steps=["db","edge","project","network","adapter"].map(name=>[name,async()=>{calls.push(name);if(name===failing)throw Error("injected failure");}]);
    assert.deepEqual(await settleOwnedCleanup(steps),[failing]);
    assert.deepEqual(calls,["db","edge","project","network","adapter"]);
  }
});
test("unowned containers or shared network fail before forwarding",()=>{
  for(const body of [{Labels:{"com.supabase.cli.project":"other"},HostConfig:{NetworkMode:"owned"}}, {Labels:{"com.supabase.cli.project":"owned"},HostConfig:{NetworkMode:"shared"}}]) {
    assert.throws(()=>restrictOwnedContainer(body,"owned"),/C05_UNOWNED/);
  }
});

test("automatic publication and extra network attachment fail closed",()=>{
  for(const extra of [
    {HostConfig:{NetworkMode:"owned",PublishAllPorts:true}},
    {NetworkingConfig:{EndpointsConfig:{shared:{}}}},
  ]) {
    const body={Labels:{"com.supabase.cli.project":"owned"},HostConfig:{NetworkMode:"owned"},...extra};
    assert.throws(()=>restrictOwnedContainer(body,"owned"),/C05_UNSAFE/);
  }
});
