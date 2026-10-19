import { test, expect } from 'bun:test'
import { builtinCommands, mergeCommands, parseInput } from './commands'
test('routes canonical commands and rejects duplicate aliases safely', () => {
 const names = builtinCommands.map(command => command.name)
 expect(new Set(names).size).toBe(names.length)
 for(const name of ['settings','model','tree','thinking','scoped-models','export','import','share','bug','copy','name','session','sessions','changelog','hotkeys','fork','clone','trust','login','logout','new','compact','reload','quit','undo','redo','editor','sidebar','details']) {expect(builtinCommands.some(c=>c.name===name)).toBe(true);expect(parseInput('/'+name,[]).kind).toBe('builtin')}
 for (const alias of ['models','clear','continue','help','exit','q','themes','summarize','rename','connect']) {
  expect(builtinCommands.some(command => command.name === alias)).toBe(false)
  expect(parseInput('/'+alias+' argument',[])).toEqual({kind:'unknown',name:alias})
 }
 expect(builtinCommands.some(command => command.name === 'resume')).toBe(false)
 expect(parseInput('/resume',[])).toEqual({kind:'builtin',name:'sessions',args:''})
 expect(parseInput('/sessions',[{name:'sessions',description:'Extension collision',source:'extension'}])).toEqual({kind:'builtin',name:'sessions',args:''})
 expect(parseInput('/unknown x',[])).toEqual({kind:'unknown',name:'unknown'})
 expect(parseInput('/__proto__',[])).toEqual({kind:'unknown',name:'__proto__'})
 expect(parseInput('/model x',[{name:'model',description:'',source:'extension'}])).toEqual({kind:'extension',text:'/model x'})
 expect(parseInput('!git status',[])).toEqual({kind:'shell',command:'git status'})
 expect(parseInput('hello',[])).toEqual({kind:'prompt',text:'hello'})
})

test('merges discovered commands without duplicate names and lets extensions override built-ins', () => {
 const commands = mergeCommands([
  {name:'model',description:'Built-in from Pi',source:'builtin'},
  {name:'model',description:'Extension override',source:'extension'},
  {name:'sessions',description:'Extension collision',source:'extension'},
  {name:'resume',description:'Resume alias collision',source:'extension'},
  {name:'review',description:'Review',source:'extension'},
  {name:'review',description:'Duplicate review',source:'extension'},
 ])
 expect(commands.filter(command => command.name === 'model')).toEqual([{name:'model',description:'Extension override',source:'extension'}])
 expect(commands.filter(command => command.name === 'review')).toEqual([{name:'review',description:'Review',source:'extension'}])
 expect(commands.filter(command => command.name === 'sessions')).toEqual([{name:'sessions',description:'List and switch saved sessions',source:'builtin'}])
 expect(commands.some(command => command.name === 'resume')).toBe(false)
 expect(new Set(commands.map(command => command.name)).size).toBe(commands.length)
})
