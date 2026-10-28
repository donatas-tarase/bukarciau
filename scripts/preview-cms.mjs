// Loopback-only development server. This file is never copied into dist or deployed.
// Production authentication lives exclusively in server/auth.mjs.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile, writeFile, mkdir, stat, realpath, rm} from 'node:fs/promises';
import {resolve, join, extname, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {handleRequest} from '../server/worker.mjs';

const root = resolve('dist');
const directory = resolve('.wrangler/cms-preview');
await mkdir(join(directory,'media'),{recursive:true});
const db = new DatabaseSync(join(directory,'content.sqlite'));
db.exec(await readFile('db/schema.sql','utf8'));
class Statement {
  constructor(sql,args=[]) { this.sql=sql; this.args=args; }
  bind(...args) { return new Statement(this.sql,args); }
  execute(method='all') {
    const statement=db.prepare(this.sql);
    if(method==='first') return statement.get(...this.args) || null;
    const results=method==='run' ? (statement.run(...this.args),[]) : statement.all(...this.args);
    const changes=Number(db.prepare('SELECT changes() AS n').get().n);
    return {success:true,results,meta:{changes}};
  }
  async first(column) { const row=this.execute('first'); return column ? row?.[column] ?? null : row; }
  async all() { return this.execute(); }
  async run() { return this.execute('run'); }
}
const database = {
  prepare(sql) { return new Statement(sql); },
  async batch(statements) {
    db.exec('BEGIN IMMEDIATE');
    try { const result=statements.map(statement=>statement.execute()); db.exec('COMMIT'); return result; }
    catch(error) { db.exec('ROLLBACK'); throw error; }
  }
};
const validId = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;
const media = {
  async put(key,value) {
    if(!validId.test(key)) throw Error('Invalid media key');
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    await writeFile(join(directory,'media',key),bytes);
  },
  async get(key) {
    if(!validId.test(key)) return null;
    const bytes=await readFile(join(directory,'media',key)).catch(()=>null);
    return bytes ? {body:new Uint8Array(bytes),httpEtag:`"${createHash('sha256').update(bytes).digest('hex')}"`} : null;
  },
  async delete(key) { if(validId.test(key)) await rm(join(directory,'media',key),{force:true}); }
};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const env={CMS_DB:database,CMS_MEDIA:media,ASSETS:{async fetch(request){
  const url=new URL(request.url);
  if(/^\/_/.test(url.pathname)) return new Response('Nerasta',{status:404});
  let path=resolve(root,'.'+url.pathname);
  if(path!==root&&!path.startsWith(root+sep)) return new Response('Nerasta',{status:404});
  let statusCode=200;
  try { if((await stat(path)).isDirectory()) path=join(path,'index.html'); path=await realpath(path); if(!path.startsWith(root+sep)) throw Error(); await stat(path); }
  catch {path=join(root,'404.html');statusCode=404;}
  const bytes=await readFile(path);
  return new Response(request.method==='HEAD'?null:bytes,{status:statusCode,headers:{'Content-Type':types[extname(path)]||'application/octet-stream'}});
}}};
const server=http.createServer(async(req,res)=>{
  try {
    if(!['localhost:4324','127.0.0.1:4324'].includes(req.headers.host)) {res.writeHead(403);res.end();return;}
    const chunks=[]; let size=0;
    for await(const chunk of req) {size+=chunk.length;if(size>9*1024*1024)throw Error('Request too large');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:bytes})});
    const response=await handleRequest(request,env,{waitUntil:promise=>promise.catch(()=>{})},{verifyAccess:async()=>({email:'admin@example.test'}),adminOrigin:new URL(request.url).origin});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  } catch(error) {console.error(error.message);res.writeHead(500);res.end('Vietinės peržiūros klaida.');}
});
server.listen(4324,'127.0.0.1',()=>{
  console.log('Local: http://localhost:4324');
  console.log('Editor preview: http://localhost:4324/admin/');
  console.log('Local preview uses a simulated identity and isolated local data. Production stays protected by Access.');
});
function stop(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
