import http from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root=resolve('dist');
const realRoot=await realpath(root).catch(()=>root);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8'};
const insideRoot=path=>path===realRoot||path.startsWith(realRoot+sep);
function byteRange(header,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(header.trim());
 if(!match||(!match[1]&&!match[2])||size===0)return null;
 let start,end;
 if(!match[1]){
  const suffix=Number(match[2]);
  if(!Number.isSafeInteger(suffix)||suffix<=0)return null;
  start=Math.max(0,size-suffix);end=size-1;
 }else{
  start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return null;
  end=Math.min(end,size-1);
 }
 return {start,end};
}
async function notFound(req,res){
 const body=await readFile(resolve(root,'404.html')).catch(()=>Buffer.from('<h1>404</h1>'));
 res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Content-Length':body.length});
 res.end(req.method==='HEAD'?undefined:body);
}
const server=http.createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){
  res.writeHead(405,{'Allow':'GET, HEAD','Content-Length':0});res.end();return;
 }
 try {
  let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==root&&!path.startsWith(root+sep))throw Error();
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  path=await realpath(path);
  if(!insideRoot(path))throw Error();
  const file=await stat(path);
  if(!file.isFile())throw Error();
  const headers={'Content-Type':types[extname(path).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Content-Length':file.size};
  let range;
  if(req.headers.range){
   range=byteRange(req.headers.range,file.size);
   if(!range){res.writeHead(416,{'Content-Range':`bytes */${file.size}`,'Accept-Ranges':'bytes','Content-Length':0});res.end();return;}
   headers['Content-Range']=`bytes ${range.start}-${range.end}/${file.size}`;
   headers['Content-Length']=range.end-range.start+1;
  }
  res.writeHead(range?206:200,headers);
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(path,range||{});
  stream.on('error',()=>res.destroy());
  res.on('close',()=>stream.destroy());
  stream.pipe(res);
 }catch{await notFound(req,res);}
});
server.listen(4324,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4324'));
