import { test, expect } from 'bun:test';
import { JsonLines, initialState, reduce } from './state';

test('JSONL preserves UTF-8 split across chunks and Unicode line separators', () => {
  const records: unknown[] = [];
  const parser = new JsonLines(record => records.push(record));
  const bytes = new TextEncoder().encode('{"text":"😀\u2028ok"}\r\n{"type":"agent_settled"}\n');
  for (const byte of bytes) parser.push(new Uint8Array([byte]));
  expect(records).toEqual([{ text: '😀\u2028ok' }, { type: 'agent_settled' }]);
});

test('streamed assistant text is replaced by authoritative final content', () => {
  const state = initialState();
  reduce(state, { type: 'agent_start' });
  reduce(state, { type: 'message_start', message: { role: 'assistant', content: [] } });
  reduce(state, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'hel' } });
  reduce(state, { type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } });
  expect(state.messages).toMatchObject([{ role: 'assistant', text: 'hello' }]);
  reduce(state, { type: 'agent_end' });
  expect(state.busy).toBe(true);
  reduce(state, { type: 'agent_settled' });
  expect(state.busy).toBe(false);
});

test('failed prompt clears busy state and exposes the error', () => {
  const state = initialState();
  state.busy = true;
  reduce(state, { type: 'response', command: 'prompt', success: false, error: 'No API key' });
  expect(state.busy).toBe(false);
  expect(state.error).toBe('No API key');
});

test('tool lifecycle records completed and failed tools separately', () => {
  const state = initialState();
  reduce(state, { type: 'tool_execution_start', toolCallId: '1', toolName: 'read', args: { path: 'README.md' } });
  reduce(state, { type: 'tool_execution_end', toolCallId: '1', isError: true });
  expect(state.tools[0]).toEqual({ id: '1', name: 'read', detail: 'README.md', status: 'error' });
});

test('backend metadata keeps actual context separate from cumulative token totals', () => {
  const state = initialState();
  reduce(state, {type:'response', command:'get_state', success:true, data:{sessionId:'abc',sessionFile:'x.jsonl',model:{id:'m',provider:'p',contextWindow:1000},pendingMessageCount:2}});
  reduce(state, {type:'response', command:'get_session_stats', success:true, data:{userMessages:2,tokens:{input:5000,output:20,cacheRead:2,cacheWrite:3},cost:0.25,contextUsage:{tokens:100,contextWindow:1000,percent:10}}});
  expect(state.sessionFile).toBe('x.jsonl');
  expect(state.pendingCount).toBe(2);
  expect(state.stats).toEqual({input:5000,output:20,cacheRead:2,cacheWrite:3,cost:0.25,contextTokens:100,contextWindow:1000,contextPercent:10,userMessages:2});
  reduce(state, {type:'response',command:'get_session_stats',success:true,data:{contextUsage:{tokens:null,contextWindow:1000,percent:null}}});
  expect(state.stats.contextTokens).toBeNull();
});

test('get_state without a session name preserves the name already reported for that session', () => {
  const state = initialState();
  state.sessionId = 's1';
  reduce(state, { type: 'session_info_changed', name: 'Invoice import' });
  reduce(state, { type: 'response', command: 'get_state', success: true, data: { sessionId: 's1', model: { id: 'm', provider: 'p' } } });
  expect(state.session).toBe('Invoice import');
});

test('final assistant content restores thinking and response metadata and tool results', () => {
  const state = initialState();
  reduce(state,{type:'message_start',message:{role:'assistant',content:[]}});
  reduce(state,{type:'message_update',assistantMessageEvent:{type:'thinking_delta',delta:'consider'}});
  expect(state.messages[0]?.thinking).toBe('consider');
  reduce(state,{type:'message_end',durationMs:40,message:{role:'assistant',model:'m',provider:'p',usage:{output:12},content:[{type:'thinking',thinking:'final thought'},{type:'text',text:'answer'}]}});
  expect(state.messages[0]).toEqual({role:'assistant',text:'answer',thinking:'final thought',model:'m',provider:'p',outputTokens:12,durationMs:40});
  reduce(state,{type:'tool_execution_start',toolCallId:'x',toolName:'edit',args:{path:'a'}});
  reduce(state,{type:'tool_execution_update',toolCallId:'x',partialResult:{content:[{type:'text',text:'working'}]}});
  expect(state.tools[0]?.output).toBe('working');
  reduce(state,{type:'tool_execution_end',toolCallId:'x',result:{content:[{type:'text',text:'done'}],details:{diff:'-a\n+b'}}});
  expect(state.tools[0]?.messageIndex).toBe(0);
  expect(state.tools[0]?.diff).toBe('-a\n+b');
});

test('get_messages replaces stale messages and reconstructs chronological tools', () => {
  const state = initialState();
  reduce(state,{type:'tool_execution_start',toolCallId:'stale'});
  reduce(state,{type:'response',command:'get_messages',success:true,data:{messages:[{role:'user',content:'hi'},{role:'assistant',content:[{type:'toolCall',id:'a',name:'read',arguments:{path:'file'}}]},{role:'toolResult',toolCallId:'a',content:[{type:'text',text:'file data'}]},{role:'assistant',content:[{type:'text',text:'ok'}]}]}});
  expect(state.messages).toHaveLength(3);
  expect(state.tools).toHaveLength(1);
  expect(state.tools[0]).toMatchObject({id:'a',messageIndex:1,output:'file data',status:'done'});
  expect(state.active).toBe(-1);
});

test('extension text widgets and status clear safely while unsupported values are ignored', () => {
  const state = initialState();
  reduce(state,{type:'extension_ui_request',method:'setWidget',widgetKey:'w',widgetLines:['one']});
  reduce(state,{type:'extension_ui_request',method:'setWidget',widgetKey:'w',widgetLines:[1]});
  expect(state.widgets.w).toEqual(['one']);
  reduce(state,{type:'extension_ui_request',method:'setStatus',statusKey:'s',statusText:'ready'});
  expect(state.statuses.s).toBe('ready');
  reduce(state,{type:'extension_ui_request',method:'setWidget',widgetKey:'w'});
  expect(state.widgets.w).toBeUndefined();
  reduce(state,{type:'extension_ui_request',method:'setTitle',title:'Window'});
  expect(state.title).toBe('Window');
});

test('JSONL rejects malformed and oversized complete records', () => {
  const parser = new JsonLines(() => {});
  expect(() => parser.push(new TextEncoder().encode('{bad}\n'))).toThrow();
  expect(() => new JsonLines(() => {}).push(new TextEncoder().encode(JSON.stringify('x'.repeat(16*1024*1024))+'\n'))).toThrow('oversized');
});

test('state refresh preserves busy during dialogs and validates discovered commands', () => {
  const state = initialState();
  state.busy = true; state.inputMode = 'dialog';
  reduce(state,{type:'response',command:'get_state',success:true,data:{isStreaming:false}});
  expect(state.busy).toBe(true);
  reduce(state,{type:'response',command:'get_commands',success:true,data:{commands:[null,{name:'review',description:'Review',source:'extension'},{name:5}]}});
  expect(state.commands.filter(command => command.name === 'review')).toEqual([{name:'review',description:'Review',source:'extension'}]);
  expect(state.commands.some(command => command.name === 'model')).toBe(true);
  expect(new Set(state.commands.map(command => command.name)).size).toBe(state.commands.length);
  expect(state.theme).toBe('dark');
  expect(state.stats.contextTokens).toBeNull();
});

test('direct bash output chunks retain the whole stream until the command completes', () => {
  const state = initialState();
  reduce(state,{type:'bash_execution_update',id:'req',delta:'one'});
  reduce(state,{type:'bash_execution_update',id:'req',delta:'two'});
  reduce(state,{type:'response',command:'bash',id:'req',success:true,data:{output:'truncated',exitCode:0}});
  expect(state.tools[0]).toMatchObject({id:'bash:req',name:'bash',output:'onetwo',status:'done'});
});

test('handled extension command preserves an ongoing backend run', () => {
  const state = initialState();
  reduce(state, {type:'agent_start'});
  reduce(state, {type:'response',command:'prompt',success:true,data:{disposition:'handled'}});
  expect(state.busy).toBe(true);
});

test('live response measures elapsed time without inventing historical durations', async () => {
  const state = initialState();
  reduce(state,{type:'message_start',message:{role:'assistant',content:[]}});
  await Bun.sleep(5);
  reduce(state,{type:'message_end',message:{role:'assistant',content:[{type:'text',text:'done'}]}});
  expect(state.messages[0]?.durationMs).toBeGreaterThan(0);
  reduce(state,{type:'response',command:'get_messages',success:true,data:{messages:[{role:'assistant',content:'old'}]}});
  expect(state.messages[0]?.durationMs).toBeUndefined();
});
