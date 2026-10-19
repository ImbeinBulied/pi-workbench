import { mergeCommands } from './commands';

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function str(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function textContent(value: unknown): string {
  if (typeof value === 'string') return value;
  return Array.isArray(value) ? value.map(object).filter(x => x.type === 'text').map(x => str(x.text)).join('\n') : '';
}
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const optionalNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const messageStarts = new WeakMap<State, number>();

export class JsonLines {
  private decoder = new TextDecoder();
  private buffer = '';
  constructor(private receive: (record: unknown) => void) {}
  push(chunk: Uint8Array) {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      if (end > 16 * 1024 * 1024) throw new Error('Pi sent an oversized protocol record');
      const line = this.buffer.slice(0, end).replace(/\r$/, '');
      this.buffer = this.buffer.slice(end + 1);
      if (line.trim()) this.receive(JSON.parse(line));
    }
    if (this.buffer.length > 16 * 1024 * 1024) throw new Error('Pi sent an oversized protocol record');
  }
}

export interface State {
  messages: { role: 'user' | 'assistant'; text: string; thinking?: string; model?: string; provider?: string; durationMs?: number; outputTokens?: number }[];
  tools: { id: string; name: string; detail: string; status: 'running' | 'done' | 'error'; messageIndex?: number; output?: string; diff?: string }[];
  stats: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; contextTokens: number | null; contextWindow: number; contextPercent: number | null; userMessages: number | null };
  deepseekPeak: { label: string; next: string; inPeak: boolean } | null;
  usageCards: { id: string; label: string; headline: string; percent?: number; details: string[]; updatedAt: string; error?: boolean }[];
  commands: { name: string; description: string; source: string }[];
  tabs: { id: string; name: string; path: string }[];
  sessionId: string;
  sessionFile: string;
  workspaceBranch: string;
  widgets: Record<string, string[]>;
  statuses: Record<string, string>;
  title: string;
  showThinking: boolean;
  showDetails: boolean;
  theme: 'dark' | 'light' | 'nord' | 'dracula' | 'solarized-dark' | 'aura' | 'ayu' | 'carbonfox' | 'cobalt2' | 'cursor' | 'everforest' | 'flexoki' | 'catppuccin' | 'catppuccin-frappe' | 'catppuccin-macchiato' | 'github' | 'gruvbox' | 'kanagawa' | 'material' | 'matrix' | 'mercury' | 'monokai' | 'nightowl' | 'one-dark' | 'opencode' | 'orng' | 'lucent-orng' | 'osaka-jade' | 'palenight' | 'rosepine' | 'solarized' | 'synthwave84' | 'tokyonight' | 'vercel' | 'vesper' | 'zenburn';
  pendingCount: number;
  busy: boolean;
  error: string;
  model: string;
  provider: string;
  session: string;
  thinking: string;
  active: number;
  notice: string;
  inputMode: 'prompt' | 'dialog';
}
export function initialState(): State {
  return { messages: [], tools: [], stats: {input:0,output:0,cacheRead:0,cacheWrite:0,cost:0,contextTokens:null,contextWindow:0,contextPercent:null,userMessages:null}, deepseekPeak:null, usageCards:[], commands:[], tabs:[], sessionId:'', sessionFile:'', workspaceBranch:'', widgets:{}, statuses:{}, title:'', showThinking:false, showDetails:false, theme:'dark', pendingCount:0, busy: false, error: '', model: 'Connecting…', provider: '', session: 'New session', thinking: '', active: -1, notice: '', inputMode: 'prompt' };
}
function setMessageMetadata(target: State['messages'][number], message: Record<string, unknown>, duration?: unknown) {
  const blocks = Array.isArray(message.content) ? message.content.map(object) : [];
  const thinking = blocks.filter(x => x.type === 'thinking').map(x => str(x.thinking)).join('\n');
  if (thinking) target.thinking = thinking;
  else delete target.thinking;
  if (typeof message.model === 'string') target.model = message.model;
  if (typeof message.provider === 'string') target.provider = message.provider;
  const elapsed = optionalNumber(duration ?? message.durationMs);
  if (elapsed !== undefined) target.durationMs = elapsed;
  const output = optionalNumber(object(message.usage).output);
  if (output !== undefined) target.outputTokens = output;
}
function setToolResult(tool: State['tools'][number], raw: unknown) {
  const result = object(raw);
  if (result.content !== undefined) tool.output = textContent(result.content);
  const diff = object(result.details).diff;
  if (typeof diff === 'string') tool.diff = diff;
}
export function hydrateMessages(state: State, raw: unknown) {
  if (!Array.isArray(raw)) return;
  messageStarts.delete(state);
  state.messages = [];
  state.tools = [];
  state.active = -1;
  for (const item of raw) {
    const message = object(item);
    if (message.role === 'user' || message.role === 'assistant') {
      const target: State['messages'][number] = {role:message.role,text:textContent(message.content)};
      if (message.role === 'assistant') setMessageMetadata(target,message);
      state.messages.push(target);
      if (Array.isArray(message.content)) for (const block of message.content.map(object)) {
        if (block.type !== 'toolCall') continue;
        const args = object(block.arguments);
        state.tools.push({id:str(block.id),name:str(block.name),detail:str(args.path)||str(args.command),status:'done',messageIndex:state.messages.length-1});
      }
    } else if (message.role === 'toolResult') {
      const tool = state.tools.find(x => x.id === message.toolCallId);
      if (tool) { tool.status = message.isError === true ? 'error' : 'done'; setToolResult(tool,message); }
    }
  }
}
export function reduce(state: State, value: unknown) {
  const event = object(value);
  const message = object(event.message);
  switch (event.type) {
    case 'agent_start': state.busy = true; state.error = ''; break;
    case 'agent_settled': state.busy = false; state.active = -1; messageStarts.delete(state); break;
    case 'message_start':
      if (message.role === 'assistant' || message.role === 'user') {
        const target: State['messages'][number] = {role:message.role,text:textContent(message.content)};
        if (message.role === 'assistant') { state.active = state.messages.length; messageStarts.set(state,performance.now()); setMessageMetadata(target,message); }
        state.messages.push(target);
      }
      break;
    case 'message_update': {
      const update = object(event.assistantMessageEvent);
      const active = state.messages[state.active];
      if (active && update.type === 'text_delta') active.text += str(update.delta);
      if (active && update.type === 'thinking_delta') active.thinking = (active.thinking || '') + str(update.delta);
      const output = optionalNumber(object(event.usage).output);
      if (active && output !== undefined) active.outputTokens = output;
      break;
    }
    case 'message_end':
      if (message.role === 'assistant') {
        const active = state.messages[state.active];
        if (active) {
          active.text = textContent(message.content);
          const started = messageStarts.get(state);
          const elapsed = started === undefined ? undefined : Math.max(0,performance.now()-started);
          setMessageMetadata(active,message,optionalNumber(event.durationMs) ?? optionalNumber(message.durationMs) ?? elapsed);
        }
        messageStarts.delete(state);
        if (message.errorMessage) state.error = str(message.errorMessage);
        state.active = -1;
      }
      break;
    case 'tool_execution_start': {
      const args = object(event.args);
      const tool: State['tools'][number] = { id: str(event.toolCallId), name: str(event.toolName), detail: str(args.path) || str(args.command), status: 'running' };
      if (state.messages.length) tool.messageIndex = state.active >= 0 ? state.active : state.messages.length-1;
      state.tools.push(tool);
      break;
    }
    case 'tool_execution_update':
    case 'tool_execution_end': {
      const tool = state.tools.find(x => x.id === event.toolCallId);
      if (tool) {
        if (event.type === 'tool_execution_end') tool.status = event.isError === true ? 'error' : 'done';
        setToolResult(tool,event.type === 'tool_execution_end' ? event.result : event.partialResult);
      }
      break;
    }
    case 'queue_update': state.pendingCount = (Array.isArray(event.steering) ? event.steering.length : 0) + (Array.isArray(event.followUp) ? event.followUp.length : 0); break;
    case 'session_info_changed': state.session = str(event.name) || state.sessionId.slice(0,8) || 'New session'; break;
    case 'thinking_level_changed': state.thinking = str(event.level); break;
    case 'bash_execution_update': {
      const id = 'bash:' + str(event.id);
      let tool = state.tools.find(x => x.id === id);
      if (!tool) {
        tool = {id,name:'bash',detail:'Shell command',status:'running',output:''};
        if (state.messages.length) tool.messageIndex = state.messages.length - 1;
        state.tools.push(tool);
      }
      tool.output = (tool.output || '') + str(event.delta);
      break;
    }
    case 'extension_ui_request': {
      const key = str(event.widgetKey);
      if (event.method === 'notify' && typeof event.message === 'string') state.notice = event.message;
      if (event.method === 'setTitle' && typeof event.title === 'string') state.title = event.title;
      if (event.method === 'setStatus' && typeof event.statusKey === 'string') {
        if (event.statusText === undefined) delete state.statuses[event.statusKey];
        else if (typeof event.statusText === 'string') state.statuses[event.statusKey] = event.statusText;
      }
      if (event.method === 'setWidget' && key) {
        if (event.widgetLines === undefined) delete state.widgets[key];
        else if (Array.isArray(event.widgetLines) && event.widgetLines.every((line): line is string => typeof line === 'string')) state.widgets[key] = event.widgetLines;
      }
      break;
    }
    case 'response': {
      if (event.command === 'bash') {
        const tool = state.tools.find(x => x.id === 'bash:' + str(event.id));
        if (tool) tool.status = event.success === false || number(object(event.data).exitCode) !== 0 ? 'error' : 'done';
      }
      if (event.success === false) {
        state.error = str(event.error) || 'Pi command failed';
        if (event.command === 'prompt') state.busy = false;
        break;
      }
      const data = object(event.data);
      if (event.success !== true) break;
      if (event.command === 'get_messages') hydrateMessages(state,data.messages);
      if (event.command === 'get_commands' && Array.isArray(data.commands)) state.commands = mergeCommands(data.commands.map(object).filter(x => typeof x.name === 'string').map(x => ({name:str(x.name),description:str(x.description),source:str(x.source) || 'extension'})));
      if (event.command === 'get_state') {
        const model = object(data.model);
        const sessionId = str(data.sessionId);
        const previousSessionName = state.sessionId === sessionId ? state.session : '';
        state.model = str(model.id) || 'No model configured';
        state.provider = str(model.provider);
        state.sessionId = sessionId;
        state.sessionFile = str(data.sessionFile);
        state.session = str(data.sessionName) || previousSessionName || sessionId.slice(0, 8) || 'New session';
        state.thinking = str(data.thinkingLevel);
        if (typeof data.isStreaming === 'boolean' && state.inputMode !== 'dialog') state.busy = data.isStreaming || data.isCompacting === true;
        state.pendingCount = number(data.pendingMessageCount);
        if (optionalNumber(model.contextWindow) !== undefined) state.stats.contextWindow = number(model.contextWindow);
      }
      if (event.command === 'get_session_stats') {
        const tokens = object(data.tokens);
        const context = object(data.contextUsage);
        for (const key of ['input','output','cacheRead','cacheWrite'] satisfies (keyof typeof state.stats)[]) state.stats[key] = number(tokens[key]);
        state.stats.cost = number(data.cost);
        state.stats.contextTokens = optionalNumber(context.tokens) ?? null;
        state.stats.contextPercent = optionalNumber(context.percent) ?? null;
        state.stats.userMessages = optionalNumber(data.userMessages) ?? null;
        if (optionalNumber(context.contextWindow) !== undefined) state.stats.contextWindow = number(context.contextWindow);
        if (typeof data.sessionFile === 'string') state.sessionFile = data.sessionFile;
        if (typeof data.sessionId === 'string') state.sessionId = data.sessionId;
      }
      break;
    }
  }
}
