import { test, expect } from 'bun:test';
import { Workbench } from './app';
import { SessionWorkspace, type WorkspaceSurface } from './sessions';
import type { State } from './state';

function fixture() {
  let text = ''; let displayed: State | undefined; let renders = 0;
  const surface: WorkspaceSurface = {
    editor: { get plainText() { return text; }, setText(value) { text = value; } },
    scrollTop: 7, setState(state, draft) { displayed = state; text = draft; },
    update() { renders++; }, choose() {}, showText() {}, toggle() {}, openDialog(value) { text = value; }, closeDialog() {},
  };
  const closed: string[] = [];
  const workspace = new SessionWorkspace({ surface: () => surface, create(state, proxy, hooks) {
    const app = new Workbench(state, proxy, { cwd: process.cwd(), demo: true, quit: async () => {}, copy: async () => {}, native: async () => {}, editor: async value => value, openSession: hooks.open, closeTab: hooks.close });
    const id = state.sessionId;
    return { app, async start(path) { state.sessionFile = path || id + '.jsonl'; await app.start(); }, async close() { app.dispose(); closed.push(id); } };
  } });
  return { workspace, surface, closed, renders: () => renders, displayed: () => displayed };
}

test('tabs keep independent running state, drafts and unread output while switching', async () => {
  const f = fixture();
  try {
    await f.workspace.open();
    const first = f.workspace.current;
    first.state.messages.push({ role: 'user', text: 'first task' });
    first.app.event({ type: 'agent_start' });
    f.surface.editor.setText('draft for first');
    await first.app.action('new');
    const second = f.workspace.current;
    expect(second.state.sessionId).not.toBe(first.state.sessionId);
    expect(first.state.busy).toBe(true);
    expect(f.surface.editor.plainText).toBe('');
    f.surface.editor.setText('draft for second');
    first.app.event({ type: 'message_start', message: { role: 'assistant', content: [] } });
    first.app.event({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'background answer' } });
    first.app.event({ type: 'agent_settled' });
    expect(second.state.messages).toHaveLength(0);
    expect(second.state.tabs.find(tab => tab.id === first.state.sessionId)?.unread).toBe(true);
    await second.app.action('tab:' + first.state.sessionFile);
    expect(f.workspace.current === first).toBe(true);
    expect(f.surface.editor.plainText).toBe('draft for first');
    expect(first.state.messages.at(-1)?.text).toBe('background answer');
    expect(first.state.tabs.find(tab => tab.id === first.state.sessionId)?.unread).toBe(false);
    await first.app.action('tab:' + second.state.sessionFile);
    expect(f.surface.editor.plainText).toBe('draft for second');
  } finally { await f.workspace.shutdown(); }
});

test('new tabs prune empty sessions but retain drafts and never close a running tab silently', async () => {
  const f = fixture();
  try {
    await f.workspace.open(); const empty = f.workspace.current;
    await f.workspace.open();
    expect(f.closed).toContain(empty.state.sessionId);
    const draft = f.workspace.current; f.surface.editor.setText('unsent work');
    await f.workspace.open();
    expect(f.closed).not.toContain(draft.state.sessionId);
    draft.app.event({ type: 'agent_start' });
    await expect(f.workspace.close(draft.state.sessionId)).rejects.toThrow('Cancel');
    expect(f.closed).not.toContain(draft.state.sessionId);
  } finally { await f.workspace.shutdown(); }
});

test('native keyboard starts a second session while the first continues streaming', async () => {
  const { createTestRenderer } = await import('@opentui/core/testing');
  const { mount } = await import('./ui');
  const { initialState } = await import('./state');
  const screen = await createTestRenderer({ width: 110, height: 32, kittyKeyboard: true });
  let workspace: SessionWorkspace;
  const pending: Promise<unknown>[] = [];
  const errors: unknown[] = [];
  const track = (work: Promise<unknown>) => pending.push(work.catch(error => errors.push(error)));
  const ui = mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true,
    submit: text => track(workspace.current.app.submitEditor(text)), action: name => track(workspace.current.app.action(name)),
  });
  workspace = new SessionWorkspace({ surface: () => ui, create(state, proxy, hooks) {
    const app = new Workbench(state, proxy, { cwd: process.cwd(), demo: true, quit: async () => {}, copy: async () => {}, native: async () => {}, editor: async value => value, openSession: hooks.open, closeTab: hooks.close, activateTab: id => workspace.select(id) });
    return { app, async start() { await app.start(); }, async close() { app.dispose(); } };
  } });
  try {
    await workspace.open();
    ui.editor.setText('first task'); screen.mockInput.pressEnter();
    await Bun.sleep(20);
    const first = workspace.current;
    expect(first.state.busy).toBe(true);
    screen.mockInput.pressKey('n', { ctrl: true }); await Bun.sleep(20);
    const second = workspace.current;
    expect(second === first).toBe(false);
    ui.editor.setText('second task'); screen.mockInput.pressEnter(); await Bun.sleep(20);
    expect(first.state.busy).toBe(true);
    expect(second.state.busy).toBe(true);
    expect(first.state.messages[0]?.text).toBe('first task');
    expect(second.state.messages[0]?.text).toBe('second task');
    screen.mockInput.pressTab({ ctrl: true }); await Bun.sleep(20);
    expect(workspace.current === first).toBe(true);
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('… New session');
    expect(errors).toHaveLength(0);
  } finally { await workspace.shutdown(); await Promise.all(pending); await screen.dispose(); }
});

test('background extension input waits for its own tab and prevents switching until answered', async () => {
  const f = fixture();
  try {
    await f.workspace.open(); const first = f.workspace.current;
    first.state.messages.push({ role: 'user', text: 'Keep the tab' });
    f.surface.editor.setText('first draft'); await f.workspace.open();
    const second = f.workspace.current;
    f.surface.editor.setText('second draft');
    first.app.event({ type: 'extension_ui_request', id: 'question', method: 'input', title: 'Name', prefill: 'answer' });
    expect(f.surface.editor.plainText).toBe('second draft');
    expect(second.state.tabs.find(tab => tab.id === first.state.sessionId)?.attention).toBe(true);
    await f.workspace.open(first.state.sessionFile);
    expect(f.surface.editor.plainText).toBe('answer');
    await expect(f.workspace.open()).rejects.toThrow('dialog');
    await first.app.submit('accepted');
    await f.workspace.open(second.state.sessionFile);
    expect(f.surface.editor.plainText).toBe('second draft');
  } finally { await f.workspace.shutdown(); }
});


test('already unread background output does not keep redrawing the active conversation', async () => {
  const f = fixture();
  try {
    await f.workspace.open(); const first = f.workspace.current;
    first.state.messages.push({ role: 'user', text: 'Keep this session' });
    await f.workspace.open();
    first.app.event({ type: 'message_start', message: { role: 'assistant', content: [] } });
    const renders = f.renders();
    first.app.event({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'completed in background' }] } });
    expect(first.state.messages.at(-1)?.text).toBe('completed in background');
    expect(f.renders()).toBe(renders);
  } finally { await f.workspace.shutdown(); }
});

test('closing an active tab selects its neighbor and shutdown closes each backend once', async () => {
  const f = fixture();
  await f.workspace.open(); const first = f.workspace.current;
  first.state.messages.push({ role: 'user', text: 'Keep first' });
  await f.workspace.open(); const second = f.workspace.current;
  await f.workspace.close(second.state.sessionId);
  expect(f.workspace.current === first).toBe(true);
  await f.workspace.shutdown(); await f.workspace.shutdown();
  expect(f.closed.filter(id => id === first.state.sessionId)).toHaveLength(1);
  expect(f.closed.filter(id => id === second.state.sessionId)).toHaveLength(1);
});
