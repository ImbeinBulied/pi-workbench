import { readdir, stat, realpath, open, readFile } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute=promisify(execFile)
const MAX_FILE=1024*1024
function within(root:string,path:string){const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'))}
async function directories(path:string){try{return await readdir(path,{withFileTypes:true})}catch{return []}}
async function walk(root:string,depth:number,limit=10000):Promise<string[]>{
 const files:string[]=[]
 async function visit(dir:string,remaining:number){for(const entry of await directories(dir)){
  if(files.length>=limit)return
  if(entry.name==='.git'||entry.name==='node_modules'||entry.isSymbolicLink())continue
  const path=join(dir,entry.name)
  if(entry.isDirectory()&&remaining>0)await visit(path,remaining-1);else if(entry.isFile())files.push(path)
 }}await visit(root,depth);return files
}
export async function listFiles(cwd:string):Promise<string[]>{
 for(const [program,args] of [['git',['ls-files','--cached','--others','--exclude-standard','-z']],['rg',['--files','--hidden','--glob','!.git','--glob','!node_modules','--null']]] satisfies [string,string[]][]){
  try{const {stdout}=await execute(program,args,{cwd,maxBuffer:8*1024*1024,timeout:5000});return [...new Set(stdout.split('\0').filter(Boolean).map(p=>p.replaceAll('\\','/')).filter(p=>!p.split('/').some(part=>part==='node_modules'||part==='.git')))].sort()}catch{}
 }
 // shortcut: without git or rg, apply simple local ignore rules; use either tool for full gitignore semantics.
 let ignores:string[]=[];try{ignores=(await readFile(join(cwd,'.gitignore'),'utf8')).split(/\r?\n/).filter(p=>p&&!p.startsWith('#'))}catch{}
 return (await walk(cwd,12)).map(p=>relative(cwd,p).replaceAll('\\','/')).filter(p=>!ignores.some(ignore=>p===ignore||p.startsWith(ignore.replace(/\/$/,'')+'/'))).sort()
}
export async function expandReferences(text:string,cwd:string):Promise<string>{
 const root=await realpath(cwd);const pattern=/(^|\s)@(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s]+))/g
 let output='';let previous=0
 for(const match of text.matchAll(pattern)){
  const token=match[2]??match[3]??match[4]??'';const candidate=resolve(root,token)
  if(!within(root,candidate))throw new Error(`File reference escapes project: ${token}`)
  let info;try{info=await stat(candidate)}catch{if(/[./\\]/.test(token)||match[2]||match[3])throw new Error(`File reference not found: ${token}`);continue}
  if(!within(root,await realpath(candidate)))throw new Error(`File reference escapes project: ${token}`)
  if(!info.isFile())throw new Error(`File reference is not a file: ${token}`)
  if(info.size>MAX_FILE)throw new Error(`File reference exceeds 1 MB: ${token}`)
  const handle=await open(candidate,'r');let contents:Buffer
  try{const buffer=Buffer.alloc(MAX_FILE+1);const result=await handle.read(buffer,0,buffer.length,0);contents=buffer.subarray(0,result.bytesRead)}finally{await handle.close()}
  if(contents.length>MAX_FILE)throw new Error(`File reference exceeds 1 MB: ${token}`)
  let content:string;try{content=new TextDecoder('utf-8',{fatal:true}).decode(contents)}catch{throw new Error(`Binary file reference: ${token}`)}
  if(content.includes('\0'))throw new Error(`Binary file reference: ${token}`)
  output+=text.slice(previous,match.index)+(match[1]??'')+`<file path=${JSON.stringify(token)}>\n${content}\n</file>`;previous=match.index+match[0].length
 }return output+text.slice(previous)
}
function object(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null}
export async function listSessions(cwd:string):Promise<{id:string;name:string;path:string}[]>{
 const agent=process.env.PI_CODING_AGENT_DIR;const directory=agent?.startsWith('~')?join(homedir(),agent.slice(1)):agent??join(homedir(),'.pi','agent')
 const found:{id:string;name:string;path:string;time:number}[]=[]
 for(const path of await walk(join(directory,'sessions'),2,20000)){
  if(!path.endsWith('.jsonl'))continue
  try{
   const handle=await open(path,'r');let source=''
   // shortcut: read at most 2MB per session; a display name only in the omitted middle of a huge log is unavailable.
   try{const info=await handle.stat();const head=Buffer.alloc(Math.min(info.size,MAX_FILE));await handle.read(head,0,head.length,0);source=head.toString('utf8');if(info.size>MAX_FILE){const tail=Buffer.alloc(MAX_FILE);await handle.read(tail,0,tail.length,info.size-MAX_FILE);source=source.slice(0,source.lastIndexOf('\n'))+'\n'+tail.toString('utf8').split('\n').slice(1).join('\n')}}finally{await handle.close()}
   const entries:Record<string,unknown>[]=[]
   for(const line of source.split('\n')){try{const entry:unknown=JSON.parse(line);if(object(entry))entries.push(entry)}catch{}}
   const header=entries[0];if(header?.type!=='session'||typeof header.cwd!=='string'||resolve(header.cwd)!==resolve(cwd)||typeof header.id!=='string')continue
   let name='';let prompt='';let time=typeof header.timestamp==='string'?Date.parse(header.timestamp)||0:0
   for(const entry of entries){if(typeof entry.timestamp==='string')time=Math.max(time,Date.parse(entry.timestamp)||0);if(entry.type==='session_info'&&typeof entry.name==='string')name=entry.name
    if(!prompt&&entry.type==='message'&&object(entry.message)&&entry.message.role==='user'){const content=entry.message.content;prompt=typeof content==='string'?content:Array.isArray(content)?content.filter(object).filter(c=>c.type==='text'&&typeof c.text==='string').map(c=>c.text).join(' '):''}
   }found.push({id:header.id,name:(name||prompt||'Untitled session').replace(/\s+/g,' ').slice(0,120),path,time})
  }catch{}
 }return found.sort((a,b)=>b.time-a.time||a.path.localeCompare(b.path)).map(({id,name,path})=>({id,name,path}))
}
