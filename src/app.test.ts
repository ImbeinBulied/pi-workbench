import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workbench, type Transport, type Surface } from './app';
import { initialState } from './state';

function fixture() {
  const calls: { type: string; fields: Record<string, unknown> }[] = [];
  const state = initialState();
  let sessionNumber = 1;
  let choose: ((value: string) => void) | undefined;
  let cancelChoice: (() => void) | undefined;
  let hoverChoice: ((value: string) => void) | undefined;
  let choiceTitle = '';
  let choices: { name: string; description: string; value: string }[] = [];
  let text = '';
  let closed = false;
  const transport: Transport = {
    async request(type, fields = {}) {
      calls.push({ type, fields });
      const data = type === 'get_available_models' ? { models: [{ id: 'one', provider: 'test' }, { id: 'two', provider: 'test' }] }
        : type === 'new_session' ? (sessionNumber++, {})
        : type === 'switch_session' ? (sessionNumber++, {})
        : type === 'get_state' ? { sessionId: `s${sessionNumber}`, model: { id: 'one', provider: 'test' }, isStreaming: false }
        : type === 'get_commands' ? { commands: [{ name: 'custom', description: 'Custom extension', source: 'extension' }] }
        : type === 'get_messages' ? { messages: [] }
        : type === 'get_session_stats' ? { userMessages: 0, totalMessages: 0 } : {};
      return { type: 'response', command: type, success: true, data };
    }, send() {}, async close() {},
  };
  const surface: Surface = {
    editor: { get plainText() { return text; }, setText(value) { text = value; } }, update() { if (closed) throw new Error('Renderer is destroyed'); },
    choose(title, items, callback, onCancel, onHover) { choiceTitle = title; choices = items; choose = callback; cancelChoice = onCancel; hoverChoice = onHover; }, showText() {}, toggle() {}, openDialog(prefill) { text = prefill; }, closeDialog() {},
  };
  const app = new Workbench(state, surface, { cwd: process.cwd(), demo: false, quit: async () => { closed = true; }, copy: async () => {}, native: async () => {}, editor: async value => value });
  app.attach(transport);
  return { app, state, calls, transport, pick: (value: string) => choose?.(value), hover: (value: string) => hoverChoice?.(value), cancelChoice: () => cancelChoice?.(), choices: () => choices, choiceTitle: () => choiceTitle, draft: () => text };
}

test('unknown and UI slash commands never become model prompts', async () => {
  const f = fixture();
  await f.app.start(); f.calls.length = 0;
  await f.app.submit('/not-a-command');
  expect(f.state.error).toContain('Unknown');
  await f.app.submit('/model');
  expect(f.choices().map(x => x.value)).toEqual(['test/one', 'test/two']);
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

test('model picker sends provider and model id without a prompt', async () => {
  const f = fixture(); await f.app.start();
  await f.app.submit('/model test/two');
  expect(f.calls.find(x => x.type === 'set_model')?.fields).toEqual({ provider: 'test', modelId: 'two' });
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

test('/sessions opens the saved-session picker instead of session stats', async () => {
  const f = fixture(); await f.app.start(); f.calls.length = 0;
  await f.app.submit('/sessions');
  expect(f.choiceTitle()).toBe('Sessions');
  expect(f.state.error).toBe('');
  expect(f.calls.some(x => x.type === 'get_session_stats')).toBe(false);
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

test('/theme offers named palettes and applies the selected theme', async () => {
  const f = fixture(); await f.app.start();
  await f.app.submit('/theme');
  expect(f.choices().map(item => item.value)).toEqual([
    'dark', 'light', 'nord', 'dracula', 'solarized-dark',
    'aura', 'ayu', 'carbonfox', 'cobalt2', 'cursor', 'everforest', 'flexoki',
    'catppuccin', 'catppuccin-frappe', 'catppuccin-macchiato', 'github', 'gruvbox', 'kanagawa', 'material', 'matrix', 'mercury', 'monokai', 'nightowl', 'one-dark',
    'opencode', 'orng', 'lucent-orng', 'osaka-jade', 'palenight', 'rosepine', 'solarized', 'synthwave84', 'tokyonight', 'vercel', 'vesper', 'zenburn',
  ]);
  f.pick('tokyonight');
  await Bun.sleep(0);
  expect(f.state.theme).toBe('tokyonight');
});

test('/theme previews hovered palettes and restores the previous choice when cancelled', async () => {
  const f = fixture(); await f.app.start();
  await f.app.submit('/theme');
  f.hover('tokyonight');
  expect(f.state.theme).toBe('tokyonight');
  f.cancelChoice();
  expect(f.state.theme).toBe('dark');
});

test('/settings asks for an explicit retry state when Pi does not report it', async () => {
  const f = fixture(); await f.app.start(); f.calls.length = 0;
  await f.app.submit('/settings');
  expect(f.choices().find(item => item.value === 'autoRetry')?.description).toBe('Select enabled or disabled');
  f.pick('autoRetry');
  await Bun.sleep(0);
  expect(f.choiceTitle()).toBe('Automatic retry');
  expect(f.choices().map(item => item.value)).toEqual(['enabled', 'disabled']);
  f.pick('disabled');
  await Bun.sleep(0);
  expect(f.calls.find(call => call.type === 'set_auto_retry')?.fields).toEqual({ enabled: false });
  expect(f.state.notice).toBe('Automatic retry disabled');
});

test('discovered extension command preserves its arguments for Pi', async () => {
  const f = fixture(); await f.app.start();
  await f.app.submit('/custom argument with spaces');
  expect(f.calls.find(x => x.type === 'prompt')?.fields).toEqual({ message: '/custom argument with spaces' });
});

test('busy prompt is queued with explicit delivery behavior', async () => {
  const f = fixture(); await f.app.start(); f.state.busy = true;
  await f.app.submit('do this next');
  expect(f.calls.find(x => x.type === 'prompt')?.fields).toEqual({ message: 'do this next', streamingBehavior: 'followUp' });
});

test('first successful prompt creates a concise topic title from the opening message', async () => {
  const f = fixture(); await f.app.start(); f.calls.length = 0;
  await f.app.submit('Fix the invoice import\nKeep existing ERP behavior');
  expect(f.calls.find(x => x.type === 'set_session_name')?.fields).toEqual({ name: 'Invoice import' });
  expect(f.state.session).toBe('Invoice import');
  expect(f.state.tabs.find(tab => tab.id === f.state.sessionId)?.name).toBe('Invoice import');
  await f.app.submit('Also add a test');
  expect(f.calls.filter(x => x.type === 'set_session_name')).toHaveLength(1);
});

test('first prompt never replaces an explicit session name or names a resumed session', async () => {
  const named = fixture(); await named.app.start(); named.state.session = 'My explicit name'; named.calls.length = 0;
  await named.app.submit('First prompt');
  expect(named.calls.some(x => x.type === 'set_session_name')).toBe(false);

  const resumed = fixture(); await resumed.app.start(); resumed.state.stats.userMessages = 3; resumed.calls.length = 0;
  await resumed.app.submit('Next prompt');
  expect(resumed.calls.some(x => x.type === 'set_session_name')).toBe(false);
});

test('cancel clears queued messages before aborting', async () => {
  const f = fixture(); await f.app.start(); f.calls.length = 0;
  await f.app.action('abort');
  expect(f.calls.slice(0, 2).map(x => x.type)).toEqual(['clear_queue', 'abort']);
});

test('cancelling manual rename leaves the next prompt intact while auto-naming the new session', async () => {
  const f = fixture(); await f.app.start();
  await f.app.submit('/name');
  await f.app.action('abort');
  await f.app.submitEditor('actual prompt');
  expect(f.calls.find(x => x.type === 'set_session_name')?.fields).toEqual({ name: 'Actual prompt' });
  expect(f.calls.find(x => x.type === 'prompt')?.fields.message).toBe('actual prompt');
});

test('an empty session tab closes automatically when a new session is opened', async () => {
  const f = fixture(); await f.app.start();
  const emptySessionId = f.state.sessionId;
  await f.app.action('new');
  expect(f.state.sessionId).not.toBe(emptySessionId);
  expect(f.state.tabs.some(tab => tab.id === emptySessionId)).toBe(false);
  expect(f.state.tabs.map(tab => tab.id)).toEqual([f.state.sessionId]);
});

test('opening a new session keeps the previous tab when it contains messages', async () => {
  const f = fixture(); await f.app.start();
  const previousSessionId = f.state.sessionId;
  f.state.messages = [{ role: 'user', text: 'Keep this conversation' }];
  f.state.stats.userMessages = 1;
  await f.app.action('new');
  expect(f.state.tabs.some(tab => tab.id === previousSessionId)).toBe(true);
});

test('closing a background tab leaves the active session alone', async () => {
  const f = fixture(); await f.app.start();
  f.state.tabs.push({ id: 'background', name: 'Background', path: '' });
  await f.app.action('close-tab:background');
  expect(f.state.sessionId).toBe('s1');
  expect(f.state.tabs.map(tab => tab.id)).toEqual(['s1']);
});

test('closing the only tab opens a fresh session and removes the closed tab', async () => {
  const f = fixture(); await f.app.start();
  f.state.messages = [{ role: 'user', text: 'Keep the current work' }];
  f.state.stats.userMessages = 1;
  await f.app.action('close-tab:s1');
  expect(f.state.sessionId).toBe('s2');
  expect(f.state.tabs.map(tab => tab.id)).toEqual(['s2']);
});

test('closing the active tab switches to its neighbor before removing it', async () => {
  const f = fixture(); await f.app.start();
  const directory = await mkdtemp(join(tmpdir(), 'pi-workbench-tab-'));
  const path = join(directory, 'neighbor.jsonl');
  try {
    await writeFile(path, '{}\n');
    f.state.tabs.push({ id: 's2', name: 'Neighbor session', path });
    await f.app.action('close-tab:s1');
    expect(f.state.sessionId).toBe('s2');
    expect(f.state.session).toBe('Neighbor session');
    expect(f.state.tabs.map(tab => tab.id)).toEqual(['s2']);
    expect(f.calls.find(call => call.type === 'switch_session')?.fields).toEqual({ sessionPath: path });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('new session cannot replace an outstanding extension input dialog', async () => {
  const f = fixture(); await f.app.start(); f.calls.length = 0;
  f.app.event({ type: 'extension_ui_request', id: 'permission', method: 'input', title: 'Enter a value' });
  await expect(f.app.action('new')).rejects.toThrow('dialog');
  expect(f.calls.some(x => x.type === 'new_session')).toBe(false);
});

test('pending session switch rejects a prompt until hooks finish', async () => {
  const f = fixture(); await f.app.start();
  const request = f.transport.request.bind(f.transport);
  let release: (() => void) | undefined;
  f.transport.request = async (type, fields) => {
    if (type === 'new_session') await new Promise<void>(done => { release = done; });
    return request(type, fields);
  };
  const switching = f.app.submit('/new');
  await Bun.sleep(1);
  try { await expect(f.app.submit('should wait')).rejects.toThrow('session'); }
  finally { release?.(); await switching; }
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

test('invalid file references restore the submitted draft', async () => {
  const f = fixture(); await f.app.start();
  const input = 'Please inspect @missing-file-that-does-not-exist.ts';
  await expect(f.app.submit(input)).rejects.toThrow('not found');
  expect(f.draft()).toBe(input);
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

test('quit never updates a destroyed renderer', async () => {
  const f = fixture(); await f.app.start();
  await expect(f.app.submit('/quit')).resolves.toBeUndefined();
  f.app.event({ type: 'agent_settled' });
  f.app.fail(new Error('late backend error'));
});

test('a local command error does not mark an active backend idle', async () => {
  const f = fixture(); await f.app.start(); f.state.busy = true;
  try { await f.app.action('new'); } catch (error) { f.app.fail(error); }
  expect(f.state.busy).toBe(true);
  f.app.disconnected(new Error('Pi exited'));
  expect(f.state.busy).toBe(false);
});

test('a session change during file expansion cannot redirect the submitted prompt', async () => {
  const f = fixture(); await f.app.start();
  const prompt = f.app.submit('Inspect @src/app.ts');
  const outcome = prompt.then(() => '', error => String(error));
  await f.app.submit('/new');
  expect(await outcome).toContain('session');
  expect(f.calls.some(x => x.type === 'prompt')).toBe(false);
});

 test('streaming deltas update state immediately but batch redraws and flush final messages', async () => {
  const f = fixture();
  await f.app.start();
  let renders = 0;
  const surface: Surface = { editor: { plainText: '', setText() {} }, update() { renders++; }, choose() {}, showText() {}, toggle() {}, openDialog() {}, closeDialog() {} };
  f.app.replaceSurface(surface);
  f.app.event({ type: 'message_start', message: { role: 'assistant', content: [] } });
  renders = 0;
  for (let i = 0; i < 100; i++) f.app.event({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'x' } });
  expect(f.state.messages.at(-1)?.text).toBe('x'.repeat(100));
  expect(renders).toBe(0);
  await Bun.sleep(35);
  expect(renders).toBe(1);
  f.app.event({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'y' } });
  f.app.event({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'final' }] } });
  expect(renders).toBe(2);
  await f.app.action('quit');
  await Bun.sleep(35);
  expect(renders).toBe(2);
 });

test('a new independent backend inherits the selected model and thinking level', async () => {
  const f = fixture();
  await f.app.start({ model: 'two', provider: 'test', thinking: 'high' });
  expect(f.calls.find(call => call.type === 'set_model')?.fields).toEqual({ provider: 'test', modelId: 'two' });
  expect(f.calls.find(call => call.type === 'set_thinking_level')?.fields).toEqual({ level: 'high' });
  await f.app.action('quit');
});
