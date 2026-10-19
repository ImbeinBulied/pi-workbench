export type Command = { name: string; description: string; source: string }
const descriptions: Record<string,string> = {
 settings:'Open settings',model:'Select model',tree:'Inspect session branches',thinking:'Set thinking level','scoped-models':'Configure model cycling in native Pi',export:'Export session',import:'Import JSONL session',share:'Share through native Pi',bug:'Report a bug in native Pi',copy:'Copy latest response',name:'Rename session',session:'Show session information',sessions:'List and switch saved sessions',changelog:'Show Pi changelog',hotkeys:'Show shortcuts',fork:'Fork conversation',clone:'Duplicate session',trust:'Manage project trust in native Pi',login:'Authenticate in native Pi',logout:'Remove authentication in native Pi',new:'New session',compact:'Compact context',reload:'Reload Pi resources',quit:'Exit workbench',theme:'Select theme',details:'Toggle tool details',sidebar:'Toggle context sidebar',editor:'Open external editor',undo:'Explain Git undo boundary',redo:'Explain Git redo boundary',native:'Open native Pi',files:'Browse project files',queue:'Queue a message',followup:'Queue follow-up',abort:'Abort active turn',plan:'Explain plan mode boundary',build:'Continue normal build workflow'
}
export const builtinCommands: Command[] = Object.entries(descriptions).map(([name,description])=>({name,description,source:'builtin'}))
export function mergeCommands(discovered: Command[]): Command[] {
 const commands = new Map<string,Command>()
 for (const command of discovered) {
  if (!command.name) continue
  if (command.name === 'resume' || command.name === 'sessions') continue
  const previous = commands.get(command.name)
  if (!previous || (previous.source === 'builtin' && command.source !== 'builtin')) commands.set(command.name,command)
 }
 for (const command of builtinCommands) if (!commands.has(command.name)) commands.set(command.name,command)
 return [...commands.values()]
}
type Input = {kind:'builtin';name:string;args:string}|{kind:'extension';text:string}|{kind:'shell';command:string}|{kind:'prompt';text:string}|{kind:'unknown';name:string}
export function parseInput(text:string,discovered:Command[]):Input {
 const trimmed=text.trim()
 if(trimmed.startsWith('!'))return {kind:'shell',command:trimmed.slice(1).trimStart()}
 if(!trimmed.startsWith('/'))return {kind:'prompt',text}
 const match=/^\/([^\s]*)(?:\s+([\s\S]*))?$/.exec(trimmed)
 const name=match?.[1] ?? '';const args=match?.[2] ?? ''
 const canonicalName = name === 'resume' ? 'sessions' : name
 if(canonicalName==='sessions')return {kind:'builtin',name:canonicalName,args}
 if(discovered.some(command=>command.name===name && command.source!=='builtin'))return {kind:'extension',text:trimmed}
 if(Object.hasOwn(descriptions,canonicalName))return {kind:'builtin',name:canonicalName,args}
 return {kind:'unknown',name}
}
