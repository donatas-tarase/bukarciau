import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try {
  let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==root&&!path.startsWith(root+sep))throw Error();
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(resolve(root,'404.html')).catch(()=>'<h1>404</h1>'));}
});
server.listen(4324,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4324'));
