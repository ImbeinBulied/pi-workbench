import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { builtinCommands, parseInput, type Command } from './commands';
import { expandReferences, listFiles, listSessions } from './workspace';
import { object, reduce, str, type State } from './state';
import { loadUsageCards } from './usage';
import { loadDeepSeekPeak } from './deepseek';

export interface Transport {
  request(type: string, fields?: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
  send(record: Record<string, unknown>): void;
  close(): Promise<void>;
}
type Item = { name: string; description: string; value: string };
const themes: { name: string; description: string; value: State['theme'] }[] = [
  { name: 'Dark', description: 'Charcoal with cyan accents', value: 'dark' },
  { name: 'Light', description: 'Bright with teal accents', value: 'light' },
  { name: 'Nord', description: 'Blue-gray with icy blue accents', value: 'nord' },
  { name: 'Dracula', description: 'Dark plum with lavender accents', value: 'dracula' },
  { name: 'Solarized Dark', description: 'Deep teal with green accents', value: 'solarized-dark' },
  { name: 'Aura', description: 'Deep violet with purple accents', value: 'aura' },
  { name: 'Ayu', description: 'Warm dark gray with amber accents', value: 'ayu' },
  { name: 'Carbonfox', description: 'Charcoal with bright blue accents', value: 'carbonfox' },
  { name: 'Cobalt2', description: 'Deep blue with golden accents', value: 'cobalt2' },
  { name: 'Cursor', description: 'Neutral editor dark with blue accents', value: 'cursor' },
  { name: 'Everforest', description: 'Forest green with warm text', value: 'everforest' },
  { name: 'Flexoki', description: 'Soft ink with olive accents', value: 'flexoki' },
  { name: 'Catppuccin Mocha', description: 'Pastel dark with lavender accents', value: 'catppuccin' },
  { name: 'Catppuccin Frappe', description: 'Muted blue-gray with mauve accents', value: 'catppuccin-frappe' },
  { name: 'Catppuccin Macchiato', description: 'Cool dark with lavender accents', value: 'catppuccin-macchiato' },
  { name: 'GitHub', description: 'GitHub dark with blue accents', value: 'github' },
  { name: 'Gruvbox', description: 'Retro warm dark with yellow accents', value: 'gruvbox' },
  { name: 'Kanagawa', description: 'Ink blue with soft blue accents', value: 'kanagawa' },
  { name: 'Material', description: 'Blue-gray with mint accents', value: 'material' },
  { name: 'Matrix', description: 'Green on black', value: 'matrix' },
  { name: 'Mercury', description: 'Soft light with blue accents', value: 'mercury' },
  { name: 'Monokai', description: 'Warm dark with vivid green accents', value: 'monokai' },
  { name: 'Night Owl', description: 'Deep navy with sky-blue accents', value: 'nightowl' },
  { name: 'One Dark', description: 'Atom editor dark with blue accents', value: 'one-dark' },
  { name: 'OpenCode', description: 'Neutral dark with blue accents', value: 'opencode' },
  { name: 'Orng', description: 'Dark charcoal with orange accents', value: 'orng' },
  { name: 'Lucent Orng', description: 'Warm brown with bright orange accents', value: 'lucent-orng' },
  { name: 'Osaka Jade', description: 'Deep green with jade accents', value: 'osaka-jade' },
  { name: 'Palenight', description: 'Muted indigo with violet accents', value: 'palenight' },
  { name: 'Rose Pine', description: 'Soft plum with rose accents', value: 'rosepine' },
  { name: 'Solarized', description: 'Warm light with teal accents', value: 'solarized' },
  { name: 'Synthwave 84', description: 'Neon purple with pink accents', value: 'synthwave84' },
  { name: 'Tokyo Night', description: 'Blue-gray night with violet accents', value: 'tokyonight' },
  { name: 'Vercel', description: 'Minimal black with electric blue accents', value: 'vercel' },
  { name: 'Vesper', description: 'Warm near-black with peach accents', value: 'vesper' },
  { name: 'Zenburn', description: 'Low-contrast gray with teal accents', value: 'zenburn' },
];
function titleFromFirstMessage(message: string): string {
  const firstLine = message.replace(/```[\s\S]*?```/g, ' ').split(/\r?\n/, 1)[0]?.trim() ?? '';
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/u, 1)[0]?.trim() ?? '';
  const topic = firstSentence
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/^(?:(?:please|kindly)\s+|(?:(?:can|could|would|will)\s+you\s+)|(?:i\s+(?:want|need)\s+you\s+to\s+)|(?:help me\s+)|(?:let's\s+))+/i, '')
    .replace(/^(?:what|why|how|when|where|who)\s+(?:(?:is|are|does|do|can|could|should|would)\s+)?/i, '')
    .replace(/^(?:fix|add|create|build|implement|update|change|remove|delete|refactor|review|investigate|find|debug|write|make|improve|check|compare|summarize|analyse|analyze|design|convert|migrate|test|run|open|search|explain|document|show|tell|describe)\b\s+/i, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`*_#\-–—:;,.!?]+|[\s"'`*_#\-–—:;,.!?]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(' ');
  if (!topic) return '';
  const title = `${topic.charAt(0).toLocaleUpperCase()}${topic.slice(1)}`;
  if (title.length <= 48) return title;
  const cutoff = title.lastIndexOf(' ', 47);
  return `${title.slice(0, cutoff > 20 ? cutoff : 47).trimEnd()}…`;
}
export interface Surface {
  editor: { readonly plainText: string; setText(text: string): void };
  update(): void;
  choose(title: string, items: Item[], onPick: (value: string) => void, onCancel?: () => void, onHover?: (value: string) => void): void;
  closePicker?(): void;
  setFiles?(files: string[]): void;
  showText(title: string, text: string): void;
  toggle(name: 'sidebar' | 'details' | 'thinking'): void;
  openDialog(prefill: string): void;
  closeDialog(): void;
}
interface Host {
  cwd: string; demo: boolean;
  quit(): Promise<void>;
  copy(text: string): Promise<void>;
  native(command: string): Promise<void>;
  editor(text: string): Promise<string>;
  reload?(sessionFile: string): Promise<void>;
}
export class Workbench {
  private stopped = false;
  private surfacePaused = false;
  private transport: Transport | undefined;
  private discovered: Command[] = [];
  private ready: boolean;
  private demoRun = 0;
  private usageTimer: ReturnType<typeof setInterval> | undefined;
  private usageRefreshing = false;
  private autoNamedSessions = new Set<string>();
  private pendingOperation = false;
  private sessionGeneration = 0;
  private dialog: { id: string; method: string; options: string[]; wasBusy: boolean; timer?: ReturnType<typeof setTimeout> } | undefined;
  private settings: { autoCompaction: boolean; autoRetry?: boolean; steering: string; followUp: string } = { autoCompaction: true, steering: 'one-at-a-time', followUp: 'one-at-a-time' };
  constructor(readonly state: State, private ui: Surface, private host: Host) { this.ready = host.demo; }
  attach(transport: Transport) { this.transport = transport; }
  pauseSurface() { this.surfacePaused = true; this.stopUsagePolling(); }
  replaceSurface(surface: Surface) { this.ui = surface; this.surfacePaused = false; if (this.ready) this.startUsagePolling(); }
  private update() { if (!this.stopped && !this.surfacePaused) this.ui.update(); }
  private inputPath(value: string) {
    const text = value.trim();
    return resolve(this.host.cwd, ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) ? text.slice(1, -1) : text);
  }
  fail(error: unknown) {
    if (this.stopped) return;
    this.state.error = error instanceof Error ? error.message : String(error);
    this.update();
  }
  private safely(work: Promise<unknown>) { void work.catch(error => this.fail(error)); }
  private choose(title: string, items: Item[], pick: (value: string) => Promise<void> | void, onCancel?: () => void, onHover?: (value: string) => void) {
    this.ui.choose(title, items, value => { this.safely(Promise.resolve().then(() => pick(value))); }, onCancel, onHover);
  }
  async request(type: string, fields: Record<string, unknown> = {}) {
    if (!this.transport) throw new Error('Pi is not connected');
    const response = await this.transport.request(type, fields, ['compact', 'bash', 'prompt', 'fork', 'new_session', 'switch_session'].includes(type) ? 300000 : 20000);
    reduce(this.state, response);
    this.update();
    if (response.success !== true) throw new Error(str(response.error) || `${type} failed`);
    return object(response.data);
  }
  async start() {
    if (this.host.demo) {
      this.state.model = 'Demo model'; this.state.provider = 'Local preview';
      this.state.commands = builtinCommands; this.rememberTab(); this.ready = true; this.update(); return;
    }
    const info = await this.request('get_state');
    this.settings.autoCompaction = info.autoCompactionEnabled !== false;
    this.settings.steering = str(info.steeringMode) || 'one-at-a-time';
    this.settings.followUp = str(info.followUpMode) || 'one-at-a-time';
    await this.request('get_commands');
    this.discovered = this.state.commands;
    await this.request('get_messages');
    await this.request('get_session_stats');
    this.rememberTab(); this.ready = true; this.startUsagePolling(); this.update();
  }
  private startUsagePolling() {
    if (this.host.demo || this.stopped || this.surfacePaused || this.usageTimer) return;
    void this.refreshUsage();
    this.usageTimer = setInterval(() => { void this.refreshUsage(); }, 60_000);
  }
  private stopUsagePolling() {
    if (this.usageTimer) clearInterval(this.usageTimer);
    this.usageTimer = undefined;
  }
  private async refreshUsage() {
    if (this.usageRefreshing || this.stopped || this.surfacePaused) return;
    this.usageRefreshing = true;
    try {
      const previous = new Map(this.state.usageCards.map(card => [card.id, card]));
      const [cards, peak] = await Promise.all([loadUsageCards(), loadDeepSeekPeak()]);
      this.state.usageCards = cards.map(card => {
        const lastGood = previous.get(card.id);
        if (!card.error || !lastGood || lastGood.error) return card;
        return { ...lastGood, details: [...lastGood.details.filter(line => !line.startsWith('Refresh failed ·')), 'Refresh failed · showing last data'] };
      });
      if (peak !== undefined) this.state.deepseekPeak = peak;
    }
    catch { this.state.usageCards = []; }
    finally { this.usageRefreshing = false; this.update(); }
  }
  private rememberTab() {
    const index = this.state.tabs.findIndex(x => x.id === this.state.sessionId);
    const existing = this.state.tabs[index];
    const fallbackName = this.state.sessionId.slice(0, 8);
    const name = this.state.session === fallbackName && existing?.name ? existing.name : this.state.session;
    const tab = { id: this.state.sessionId, name, path: this.state.sessionFile };
    if (index >= 0) this.state.tabs[index] = tab;
    else this.state.tabs.push(tab);
  }
  event(value: unknown) {
    if (this.stopped) return;
    const event = object(value);
    if (event.type === 'response') return;
    reduce(this.state, value);
    if (event.type === 'session_info_changed') this.rememberTab();
    if (event.type === 'extension_ui_request') {
      if (this.surfacePaused) {
        if (['select', 'confirm', 'input', 'editor'].includes(str(event.method))) this.transport?.send({ type: 'extension_ui_response', id: event.id, cancelled: true });
      } else this.extension(event);
    }
    if (event.type === 'agent_settled' && this.ready && !this.host.demo) this.safely(this.refresh(false));
    this.update();
  }
  disconnected(error: Error) { this.ready = false; this.cancelDialog(); this.state.busy = false; this.fail(error); }
  private async refresh(messages = true) {
    await this.request('get_state');
    if (messages) await this.request('get_messages');
    await this.request('get_session_stats');
    this.rememberTab(); this.update();
  }
  private extension(event: Record<string, unknown>) {
    const method = str(event.method);
    if (['select', 'confirm', 'input', 'editor'].includes(method)) {
      this.cancelDialog();
      const options = Array.isArray(event.options) ? event.options.filter((x): x is string => typeof x === 'string') : [];
      this.dialog = { id: str(event.id), method, options, wasBusy: this.state.busy };
      if (typeof event.timeout === 'number' && event.timeout > 0) {
        this.dialog.timer = setTimeout(() => { this.cancelDialog(); this.state.notice = 'Pi dialog expired'; this.update(); }, event.timeout);
      }
      if (method === 'select' || method === 'confirm') {
        this.ui.choose([str(event.title), str(event.message)].filter(Boolean).join(' · '),
          (method === 'confirm' ? ['Yes', 'No'] : options).map((name, index) => ({ name, description: '', value: String(index) })),
          value => this.replyDialog(method === 'confirm' ? { confirmed: value === '0' } : { value: options[Number(value)] }),
          () => this.cancelDialog());
      } else {
        this.state.busy = false;
        this.state.notice = `${str(event.title)} · Enter replies · Esc cancels`;
        this.ui.openDialog(str(event.prefill));
      }
    } else if (method === 'set_editor_text') this.ui.editor.setText(str(event.text));
  }
  private replyDialog(fields: Record<string, unknown>) {
    const dialog = this.dialog;
    if (!dialog) return;
    this.dialog = undefined;
    clearTimeout(dialog.timer);
    this.transport?.send({ type: 'extension_ui_response', id: dialog.id, ...fields });
    if (dialog.method === 'input' || dialog.method === 'editor') this.ui.closeDialog();
    else this.ui.closePicker?.();
    this.state.busy = dialog.wasBusy; this.state.notice = ''; this.update();
  }
  private cancelDialog() { if (this.dialog) this.replyDialog({ cancelled: true }); }
  async submit(text: string) {
    try { await this.dispatch(text); }
    catch (error) {
      if (!this.stopped && !this.dialog && !this.localName) {
        const newerDraft = this.ui.editor.plainText;
        this.ui.editor.setText(newerDraft === text ? text : [text, newerDraft].filter(Boolean).join('\n\n'));
      }
      throw error;
    }
  }
  private async dispatch(text: string) {
    if (this.dialog) { this.replyDialog({ value: text }); return; }
    const parsed = parseInput(text, this.discovered);
    this.state.error = '';
    if (parsed.kind === 'unknown') { this.state.error = `Unknown command /${parsed.name}. Type / for available commands.`; this.ui.editor.setText(text); this.update(); return; }
    if (parsed.kind === 'builtin') { await this.builtin(parsed.name, parsed.args); this.update(); return; }
    if (this.pendingOperation) { this.ui.editor.setText(text); throw new Error('Wait for the session action to finish before sending a prompt.'); }
    if (!this.ready) throw new Error('Pi is not connected. Open Pi directly to check configuration, then restart Workbench.');
    if (parsed.kind === 'shell') {
      if (this.state.busy) throw new Error('Cancel the current run before starting a shell command.');
      if (!parsed.command) return;
      if (this.host.demo) { this.ui.showText('Demo shell', 'Shell execution is disabled in demo mode.'); return; }
      this.state.busy = true;
      try { const result = await this.request('bash', { command: parsed.command }); this.ui.showText(`Shell · exit ${result.exitCode}`, str(result.output)); }
      finally { this.state.busy = false; this.update(); }
      return;
    }
    if (this.host.demo) { await this.demo(text); return; }
    const generation = this.sessionGeneration;
    const message = parsed.kind === 'extension' ? parsed.text : await expandReferences(parsed.text, this.host.cwd);
    if (this.pendingOperation || generation !== this.sessionGeneration) throw new Error('The session changed while preparing your prompt. Review the draft and send it again.');
    const wasBusy = this.state.busy;
    const sessionId = this.state.sessionId;
    const firstPrompt = parsed.kind === 'prompt' && !wasBusy && this.state.stats.userMessages === 0
      && (this.state.session === 'New session' || this.state.session === sessionId.slice(0, 8));
    this.state.busy = true; this.update();
    try {
      const result = await this.request('prompt', { message, ...(wasBusy ? { streamingBehavior: 'followUp' } : {}) });
      if (result.disposition === 'handled') await this.request('get_state');
      if (firstPrompt && sessionId && this.state.sessionId === sessionId && !this.autoNamedSessions.has(sessionId)) {
        const title = titleFromFirstMessage(parsed.text);
        if (title) {
          this.autoNamedSessions.add(sessionId);
          try { await this.renameSession(title); }
          catch { this.state.error = ''; this.state.notice = 'Prompt sent · session name could not be set'; }
        }
      }
      if (wasBusy) this.state.notice = 'Follow-up queued · Esc clears queue and cancels';
    } catch (error) { this.ui.editor.setText(text); this.state.busy = wasBusy; throw error; }
  }
  async action(name: string) {
    if (name.startsWith('close-tab:')) { await this.closeTab(name.slice('close-tab:'.length)); return; }
    if (name.startsWith('tab:')) {
      const path = name.slice(4);
      const tab = this.state.tabs.find(item => item.path === path);
      const tabName = tab && tab.name !== tab.id.slice(0, 8) ? tab.name : undefined;
      await this.switchSession(path, tabName); return;
    }
    if (name === 'commands') {
      this.choose('Commands', this.state.commands.map(x => ({ name: '/' + x.name, description: x.description, value: x.name })), async value => { this.ui.editor.setText('/' + value + ' '); });
    } else if (name === 'cycle-model') { if (this.state.busy) throw new Error('Finish the active run before switching model.'); await this.request('cycle_model'); await this.refresh(false); }
    else await this.builtin(name, '');
  }
  private async builtin(name: string, args: string) {
    if (name === 'quit') { ++this.demoRun; this.stopUsagePolling(); this.cancelDialog(); if (this.localName) { this.localName = false; this.ui.closeDialog(); } this.stopped = true; await this.host.quit(); return; }
    if (name === 'abort') {
      ++this.demoRun; this.cancelDialog();
      if (this.localName) { this.localName = false; this.ui.closeDialog(); }
      if (!this.host.demo && this.ready) {
        const queue = await this.request('clear_queue');
        const drafts = [...(Array.isArray(queue.steering) ? queue.steering : []), ...(Array.isArray(queue.followUp) ? queue.followUp : [])].filter((x): x is string => typeof x === 'string');
        if (drafts.length) this.ui.editor.setText([this.ui.editor.plainText, ...drafts].filter(Boolean).join('\n\n'));
        await this.request('abort'); await this.request('abort_bash');
      }
      this.state.busy = false; this.state.pendingCount = 0; this.state.notice = 'Cancelled'; return;
    }
    if (this.dialog || this.localName) throw new Error('Reply to or cancel the open dialog before another action.');
    if (['sidebar', 'details', 'thinking-display'].includes(name)) { this.ui.toggle(name === 'thinking-display' ? 'thinking' : name === 'sidebar' ? 'sidebar' : 'details'); return; }
    if (name === 'hotkeys') { this.ui.showText('Help & shortcuts', this.state.commands.map(x => `/${x.name}  ${x.description}`).join('\n') + '\n\nCtrl+P commands · Ctrl+X M model · Ctrl+X L sessions · Ctrl+X T theme · Ctrl+X H shortcuts\nCtrl+B sidebar · Ctrl+N new · Ctrl+T thinking level\nShift+Enter newline · PgUp/PgDn scroll · Esc cancel · Ctrl+C quit\n!command runs a shell command. @file attaches a text file.\nDrafts stay in the composer during a run. Ctrl+Enter steers; /followup queues after the run.'); return; }
    if (name === 'theme') {
      const previousTheme = this.state.theme;
      const applyTheme = (value: string) => { const theme = themes.find(item => item.value === value)?.value; if (theme) { this.state.theme = theme; this.update(); } };
      this.choose('Theme', themes.map(theme => ({ name: theme.name, description: `${theme.description}${theme.value === previousTheme ? ' · current' : ''}`, value: theme.value })), applyTheme,
        () => { this.state.theme = previousTheme; this.update(); }, applyTheme);
      return;
    }
    if (name === 'copy') { const message = this.state.messages.findLast(x => x.role === 'assistant'); if (!message?.text) throw new Error('No assistant response to copy.'); await this.host.copy(message.text); this.state.notice = 'Response copied'; return; }
    if (name === 'editor') { if (this.state.busy) throw new Error('Finish or cancel the active run before opening an external editor.'); this.ui.editor.setText(await this.host.editor(this.ui.editor.plainText)); return; }
    if (name === 'files') { const files = await listFiles(this.host.cwd); this.choose('Attach file', files.map(value => ({ name: value, description: 'Insert a file reference into your draft', value })), value => { this.ui.editor.setText(this.ui.editor.plainText + ` @${/\s/.test(value) ? JSON.stringify(value) : value} `); }); return; }
    if (name === 'undo' || name === 'redo' || name === 'plan') {
      this.ui.showText(name === 'plan' ? 'Plan mode' : 'File undo / redo', name === 'plan' ? 'Pi RPC does not provide OpenCode’s enforced read-only Plan agent. Configure a Pi planning extension, or use /native to work with your installed extensions. Workbench will not label unrestricted tools as read-only.' : 'Pi conversation forks do not revert working-tree files. Use /fork for conversation history; manage file undo/redo through your version control tools. Workbench will not silently reset your ERP changes.'); return;
    }
    if (name === 'build') { this.state.notice = 'Pi uses its configured tools and permissions. There is no separate Workbench agent mode.'; return; }
    if (this.state.busy && !['queue', 'followup', 'session'].includes(name)) throw new Error('Finish or cancel the active run before this action.');
    if (this.pendingOperation) throw new Error('A session action is still in progress.');
    if (['native', 'login', 'logout', 'share', 'bug', 'trust', 'scoped-models', 'reload', 'tree', 'changelog'].includes(name)) {
      if (this.host.demo) { this.ui.showText('Native Pi', 'This action opens your installed Pi TUI in live mode.'); return; }
      if (name === 'reload' && this.host.reload) { await this.host.reload(this.state.sessionFile); return; }
      this.choose('Continue in native Pi', [{ name: 'Open Pi TUI', description: `${name === 'native' ? args || 'Use commands' : '/' + name} in Pi’s native interface. /quit returns here.`, value: 'open' }], async () => {
        await this.host.native(name === 'native' ? args : '/' + name + (args ? ' ' + args : ''));
      }); return;
    }
    if (name === 'model') { await this.models(args); return; }
    if (name === 'sessions') {
      if (this.host.demo) { this.ui.showText('Demo sessions', 'Live mode lists saved Pi sessions for the selected project.'); return; }
      if (args) { await this.switchSession(this.inputPath(args)); return; }
      const sessions = await listSessions(this.host.cwd);
      this.choose('Sessions', sessions.map(x => ({ name: x.name, description: x.id, value: x.path })), value => {
        const session = sessions.find(item => item.path === value);
        return this.switchSession(value, session?.name);
      }); return;
    }
    if (name === 'settings') { this.settingsPicker(); return; }
    if (this.host.demo) {
      if (name === 'new') {
        const previousSessionId = this.state.sessionId;
        const closePrevious = this.isEmptySession();
        this.clearConversation(); this.state.sessionId = crypto.randomUUID(); this.state.session = 'New session'; this.state.sessionFile = '';
        this.closeEmptyTab(previousSessionId, closePrevious); this.rememberTab();
      }
      else if (name === 'thinking') this.choose('Thinking level', ['off', 'low', 'medium', 'high'].map(value => ({ name: value, description: 'Demo', value })), value => { this.state.thinking = value; this.update(); });
      else this.ui.showText('Demo mode', `/${name} uses the live Pi backend. Start without --demo to use it.`);
      return;
    }
    if (!this.ready) throw new Error('Pi is not connected.');
    switch (name) {
      case 'new': await this.sessionOperation(async () => {
        const previousSessionId = this.state.sessionId;
        const closePrevious = this.isEmptySession();
        const result = await this.request('new_session');
        if (!result.cancelled) {
          this.clearConversation();
          await this.refresh();
          this.closeEmptyTab(previousSessionId, closePrevious);
        }
      }); break;
      case 'clone': await this.sessionOperation(async () => { const result = await this.request('clone'); if (!result.cancelled) await this.refresh(); }); break;
      case 'thinking': {
        if (args) { await this.request('set_thinking_level', { level: args }); await this.refresh(false); }
        else { const data = await this.request('get_available_thinking_levels'); const levels = Array.isArray(data.levels) ? data.levels.filter((x): x is string => typeof x === 'string') : [];
          this.choose('Thinking level', levels.map(value => ({ name: value, description: value === this.state.thinking ? 'Current' : '', value })), async value => { await this.request('set_thinking_level', { level: value }); await this.refresh(false); }); }
        break;
      }
      case 'name':
        if (args) await this.renameSession(args);
        else { this.state.notice = 'Rename session · type the new name and press Enter'; this.localName = true; this.ui.openDialog(this.state.session); }
        break;
      case 'session': { const info = await this.request('get_session_stats'); this.ui.showText('Session information', JSON.stringify(info, null, 2)); break; }
      case 'compact': this.state.busy = true; try { await this.request('compact', args ? { customInstructions: args } : {}); await this.refresh(); } finally { this.state.busy = false; } break;
      case 'export': await this.exportSession(args); break;
      case 'import': if (!args) throw new Error('Usage: /import path/to/session.jsonl'); await this.switchSession(this.inputPath(args)); break;
      case 'fork': {
        const data = await this.request('get_fork_messages');
        const messages = Array.isArray(data.messages) ? data.messages.map(object) : [];
        this.choose('Fork from a user message', messages.map(x => ({ name: str(x.text).slice(0, 120), description: str(x.entryId), value: str(x.entryId) })), async value => {
          await this.sessionOperation(async () => { const result = await this.request('fork', { entryId: value }); if (!result.cancelled) { await this.refresh(); this.ui.editor.setText(str(result.text)); } });
        }); break;
      }
      case 'queue': case 'followup': if (!args) throw new Error(`Usage: /${name} message`); await this.request(name === 'queue' ? 'steer' : 'follow_up', { message: args }); this.state.notice = 'Message queued'; break;
      default: throw new Error(`/${name} has no Workbench handler.`);
    }
  }
  private localName = false;
  async submitEditor(text: string) {
    if (this.localName) {
      this.localName = false; this.ui.closeDialog();
      if (text.trim()) await this.renameSession(text.trim());
      this.state.notice = ''; this.update(); return;
    }
    await this.submit(text);
  }
  private clearConversation() { this.state.messages = []; this.state.tools = []; this.state.stats.userMessages = null; this.state.active = -1; this.state.error = ''; this.state.notice = ''; }
  private isEmptySession() { return this.state.messages.length === 0 && (this.state.stats.userMessages ?? 0) === 0; }
  private closeEmptyTab(sessionId: string, wasEmpty: boolean) {
    if (!wasEmpty || sessionId === this.state.sessionId) return;
    this.state.tabs = this.state.tabs.filter(tab => tab.id !== sessionId);
    this.update();
  }
  private async renameSession(name: string) {
    await this.request('set_session_name', { name });
    await this.refresh(false);
    this.state.session = name;
    this.rememberTab();
    this.update();
  }
  private async sessionOperation(work: () => Promise<void>) {
    if (this.pendingOperation || this.state.busy || this.dialog || this.localName) throw new Error('Finish the current action before changing sessions.');
    ++this.sessionGeneration;
    this.pendingOperation = true; try { await work(); } finally { this.pendingOperation = false; }
  }
  private async switchSession(path: string, name?: string) {
    if (!path || this.state.busy || this.pendingOperation || this.dialog || this.localName) throw new Error('Finish the current action before switching sessions.');
    if (!(await stat(path)).isFile()) throw new Error('Session path is not a file.');
    await this.sessionOperation(async () => {
      const previousSessionId = this.state.sessionId;
      const closePrevious = this.isEmptySession();
      const data = await this.request('switch_session', { sessionPath: path });
      if (!data.cancelled) {
        this.clearConversation();
        await this.refresh();
        this.closeEmptyTab(previousSessionId, closePrevious);
        if (name) { this.state.session = name; this.rememberTab(); this.update(); }
      }
    });
  }
  private async closeTab(sessionId: string) {
    const index = this.state.tabs.findIndex(tab => tab.id === sessionId);
    if (index < 0) return;
    if (sessionId !== this.state.sessionId) {
      this.state.tabs = this.state.tabs.filter(tab => tab.id !== sessionId);
      this.update();
      return;
    }

    const remaining = this.state.tabs.filter(tab => tab.id !== sessionId);
    const neighbor = remaining[Math.max(0, index - 1)];
    if (neighbor) {
      if (!neighbor.path) throw new Error('This tab cannot be reopened because its session is not saved yet.');
      const name = neighbor.name !== neighbor.id.slice(0, 8) ? neighbor.name : undefined;
      await this.switchSession(neighbor.path, name);
    } else {
      await this.builtin('new', '');
    }
    this.state.tabs = this.state.tabs.filter(tab => tab.id !== sessionId);
    this.update();
  }
  private async models(args: string) {
    if (this.host.demo) { this.ui.showText('Demo model', 'Live mode lists all models configured in Pi.'); return; }
    const data = await this.request('get_available_models');
    const models = Array.isArray(data.models) ? data.models.map(object).filter(x => typeof x.id === 'string' && typeof x.provider === 'string')
      .sort((a, b) => str(a.provider).localeCompare(str(b.provider)) || str(a.name || a.id).localeCompare(str(b.name || b.id))) : [];
    const select = async (value: string) => {
      if (this.pendingOperation || this.state.busy || this.dialog || this.localName) throw new Error('Finish the current action before changing models.');
      const model = models.find(x => `${x.provider}/${x.id}` === value || x.id === value);
      if (!model) throw new Error(`Model not found: ${value}`);
      await this.request('set_model', { provider: model.provider, modelId: model.id }); await this.refresh(false);
    };
    if (args) await select(args);
    else this.choose('Models', models.map(x => ({
      name: str(x.name) || str(x.id),
      description: `${x.provider === this.state.provider && x.id === this.state.model ? 'current · ' : ''}${x.contextWindow || '?'} context`,
      value: `${x.provider}/${x.id}`,
      group: str(x.provider),
    })), select);
  }
  private settingsPicker() {
    this.choose('Settings', [
      { name: 'Theme', description: this.state.theme, value: 'theme' },
      { name: 'Show tool details', description: String(this.state.showDetails), value: 'details' },
      { name: 'Show thinking', description: String(this.state.showThinking), value: 'thinking-display' },
      { name: 'Automatic compaction', description: String(this.settings.autoCompaction), value: 'autoCompaction' },
      { name: 'Automatic retry', description: this.settings.autoRetry === undefined ? 'Select enabled or disabled' : this.settings.autoRetry ? 'Enabled' : 'Disabled', value: 'autoRetry' },
      { name: 'Native Pi settings', description: 'All remaining Pi settings', value: 'native' },
    ], async value => {
      if (value === 'autoCompaction') {
        const enabled = !this.settings.autoCompaction;
        if (!this.host.demo) await this.request('set_auto_compaction', { enabled });
        this.settings.autoCompaction = enabled;
        this.state.notice = `Automatic compaction ${this.settings.autoCompaction ? 'enabled' : 'disabled'}`;
      } else if (value === 'autoRetry') {
        this.choose('Automatic retry', [
          { name: 'Enable', description: this.settings.autoRetry === true ? 'Current' : '', value: 'enabled' },
          { name: 'Disable', description: this.settings.autoRetry === false ? 'Current' : '', value: 'disabled' },
        ], async choice => {
          const enabled = choice === 'enabled';
          if (!this.host.demo) await this.request('set_auto_retry', { enabled });
          this.settings.autoRetry = enabled;
          this.state.notice = `Automatic retry ${enabled ? 'enabled' : 'disabled'}`;
          this.update();
        });
      } else if (value === 'native') {
        if (this.host.demo) this.ui.showText('Demo settings', 'Native Pi settings are available in live mode.');
        else await this.host.native('/settings');
      }
      else await this.builtin(value, '');
      this.update();
    });
  }
  private async exportSession(args: string) {
    const path = args ? this.inputPath(args) : '';
    if (!args || extname(path).toLowerCase() === '.html') {
      const data = await this.request('export_html', args ? { outputPath: path } : {});
      this.ui.showText('Session exported', str(data.path)); return;
    }
    if (extname(path) === '.jsonl') {
      if (!this.state.sessionFile) throw new Error('No persisted session yet.');
      await writeFile(path, await readFile(this.state.sessionFile), { flag: 'wx' });
    } else {
      await writeFile(path, this.state.messages.map(x => `## ${x.role === 'user' ? 'You' : 'Pi'}\n\n${x.text}`).join('\n\n'), { flag: 'wx' });
    }
    this.ui.showText('Session exported', path);
  }
  private async demo(text: string) {
    const run = ++this.demoRun;
    this.event({ type: 'agent_start' });
    this.event({ type: 'message_start', message: { role: 'user', content: text } });
    this.event({ type: 'message_start', message: { role: 'assistant', content: [] } });
    const answer = '## Pi, with a new interface\n\nThis preview runs locally. In live mode, Pi supplies models, tools, sessions, and commands.\n\n- Type `/` to discover commands\n- Use `/model` for the model picker\n- Use `/sessions` to open a saved session\n\n```ts\nconst frontend = "Workbench";\nconst backend = "Pi";\n```';
    for (const word of answer.split(/(?<=\s)/)) { if (run !== this.demoRun) return; this.event({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: word } }); await Bun.sleep(15); }
    this.event({ type: 'message_end', message: { role: 'assistant', model: 'Demo model', content: [{ type: 'text', text: answer }] } });
    this.event({ type: 'agent_settled' });
  }
}
