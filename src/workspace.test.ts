import { test, expect } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listFiles, listSessions, expandReferences } from './workspace'
test('references reject unsafe files and preserve email addresses',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pi-ref-'))
 try {
 await writeFile(join(root,'notes file.txt'),'reference contents');await writeFile(join(root,'binary.bin'),Buffer.from([0,1]));await writeFile(join(root,'large.txt'),'x'.repeat(1048577))
 expect(await expandReferences('@"notes file.txt" a@b.com',root)).toContain('reference contents')
 expect(await expandReferences('a@b.com @someone',root)).toBe('a@b.com @someone')
 for(const token of ['@binary.bin','@large.txt','@../escape.txt','@missing.txt','@./'])await expect(expandReferences(token,root)).rejects.toThrow()
 }finally{await rm(root,{recursive:true,force:true})}
})
test('lists project files respecting ignore and dependency directories',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pi-files-'))
 try{await writeFile(join(root,'.gitignore'),'ignored.txt\n');await writeFile(join(root,'visible.txt'),'yes');await writeFile(join(root,'ignored.txt'),'no');await mkdir(join(root,'node_modules'));await writeFile(join(root,'node_modules','dep.txt'),'no');const files=await listFiles(root);expect(files).toContain('visible.txt');expect(files).not.toContain('ignored.txt');expect(files).not.toContain('node_modules/dep.txt')}finally{await rm(root,{recursive:true,force:true})}
})
test.skipIf(process.platform==='win32')('rejects references through a directory symlink outside project',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pi-link-'));const outside=await mkdtemp(join(tmpdir(),'pi-outside-'))
 try{await writeFile(join(outside,'secret.txt'),'private');await symlink(outside,join(root,'linked'),'junction');await expect(expandReferences('@linked/secret.txt',root)).rejects.toThrow('escapes project')}finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
})
test('sessions match header cwd and prefer latest display name',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pi-session-'));const previous=process.env.PI_CODING_AGENT_DIR
 try{process.env.PI_CODING_AGENT_DIR=root;await mkdir(join(root,'sessions','project'),{recursive:true});
 const session=(id:string,cwd:string,timestamp:string,entries:unknown[])=>[{type:'session',id,cwd,timestamp},...entries].map(e=>JSON.stringify(e)).join('\n')
 await writeFile(join(root,'sessions','project','a.jsonl'),session('a',root,'2026-01-01',[{type:'message',message:{role:'user',content:[{type:'text',text:'first prompt'}]}}]))
 await writeFile(join(root,'sessions','project','b.jsonl'),session('b',root,'2026-01-02',[{type:'session_info',name:'old'},{type:'session_info',name:'new'}]))
 await writeFile(join(root,'sessions','project','c.jsonl'),session('c',join(root,'other'),'2026-01-03',[]))
 expect((await listSessions(root)).map(s=>[s.id,s.name])).toEqual([['b','new'],['a','first prompt']])
 }finally{if(previous===undefined)delete process.env.PI_CODING_AGENT_DIR;else process.env.PI_CODING_AGENT_DIR=previous;await rm(root,{recursive:true,force:true})}
})
