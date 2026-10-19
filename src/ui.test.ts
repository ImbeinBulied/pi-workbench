import { test, expect } from 'bun:test';
import { createTestRenderer } from '@opentui/core/testing';
import { mount } from './ui';
import { initialState } from './state';

test('terminal composer submits text and retains a draft while busy', async () => {
  const screen = await createTestRenderer({ width: 110, height: 32 });
  const state = initialState();
  state.model = 'test-model';
  const sent: string[] = [];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: text => sent.push(text), action: () => {} });
  try {
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Context');
    await screen.mockInput.typeText('hello');
    screen.mockInput.pressEnter();
    expect(sent).toEqual(['hello']);
    state.busy = true;
    ui.update();
    await screen.mockInput.typeText('keep this');
    screen.mockInput.pressEnter();
    expect(sent).toEqual(['hello']);
    expect(ui.editor.plainText).toBe('keep this');
    screen.resize(70, 24);
    ui.update();
    await screen.renderOnce();
    expect(screen.captureCharFrame()).not.toContain('Context');
  } finally { await screen.dispose(); }
});

test('model status is anchored to the bottom row of the composer', async () => {
  const screen = await createTestRenderer({ width: 110, height: 32 });
  const state = initialState();
  state.model = 'current-model'; state.provider = 'test-provider'; state.thinking = 'medium';
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const rows = screen.captureCharFrame().split('\n');
    const promptRow = rows.findIndex(line => line.includes('Ask Pi anything'));
    const modelRow = rows.findIndex(line => line.includes('current-model · test-provider · medium'));
    const footerRow = rows.findIndex(line => line.includes('C:/project'));
    expect(modelRow - promptRow).toBeLessThanOrEqual(3);
    expect(modelRow).toBeGreaterThanOrEqual(0);
    expect(footerRow - modelRow).toBe(1);
  } finally { await screen.dispose(); }
});

test('Nord theme applies its accent color to Markdown headings', async () => {
  const screen = await createTestRenderer({ width: 100, height: 28 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: '# Nord palette' }];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    state.theme = 'nord'; ui.update(); await screen.renderOnce();
    const heading = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('Nord palette'));
    expect(heading?.fg.toInts().slice(0, 3)).toEqual([136, 192, 208]);
  } finally { await screen.dispose(); }
});

test('Tokyo Night theme updates Markdown heading colors after switching', async () => {
  const screen = await createTestRenderer({ width: 100, height: 28 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: '# Tokyo Night palette' }];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    state.theme = 'tokyonight'; ui.update(); await screen.renderOnce();
    const heading = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('Tokyo Night palette'));
    expect(heading?.fg.toInts().slice(0, 3)).toEqual([192, 153, 255]);
  } finally { await screen.dispose(); }
});

test('hovering a theme previews it and cancelling restores the previous theme', async () => {
  const screen = await createTestRenderer({ width: 100, height: 28 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: '# Theme preview' }];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    ui.choose('Theme', [{ name: 'Dark', description: 'Current', value: 'dark' }, { name: 'Tokyo Night', description: 'Blue-gray night', value: 'tokyonight' }], value => {
      if (value === 'tokyonight') state.theme = value;
      ui.update();
    }, () => { state.theme = 'dark'; ui.update(); }, value => {
      if (value === 'tokyonight') state.theme = value;
      ui.update();
    });
    await screen.renderOnce();
    const row = screen.captureCharFrame().split('\n').findIndex(line => line.includes('Tokyo Night'));
    await screen.mockMouse.moveTo(20, row);
    await screen.renderOnce();
    await screen.renderOnce();
    expect(state.theme).toBe('tokyonight');
    const preview = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('C:/project'));
    expect(preview?.fg.toInts().slice(0, 3)).toEqual([86, 95, 137]);
    const highlightedTheme = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('Tokyo Night'));
    expect(highlightedTheme?.fg.toInts().slice(0, 3)).toEqual([192, 153, 255]);
    screen.mockInput.pressEscape();
    await Bun.sleep(30);
    await screen.renderOnce();
    expect(state.theme).toBe('dark');
    const restored = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('C:/project'));
    expect(restored?.fg.toInts().slice(0, 3)).toEqual([171, 171, 171]);
  } finally { await screen.dispose(); }
});

test('sidebar gives its cards more room on a wide terminal', async () => {
  const screen = await createTestRenderer({ width: 180, height: 36 });
  const ui = mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const cardTop = screen.captureCharFrame().split('\n').find(line => line.includes('┌'));
    const border = cardTop?.match(/┌(─+)┐/)?.[1] ?? '';
    expect(border.length).toBeGreaterThanOrEqual(34);
  } finally { await screen.dispose(); }
});

test('provider quota cards use the OpenCode 20-dot bar and compact provider titles', async () => {
  const screen = await createTestRenderer({ width: 120, height: 32 });
  const state = initialState();
  state.usageCards = [
    { id: 'codex', label: 'ChatGPT (Codex)', headline: '17%', percent: 17, details: ['5h 5%', '5h 4h 3m left', 'Resets: Oct 25, 15:11', '6d 6h left', 'Remaining 13.6%/day', 'Over pace by 4.5%'], updatedAt: '15:00' },
    { id: 'opencode-go', label: 'OpenCode Go', headline: '18%', percent: 18, details: ['5h 0% · Wk 0%', '5h 1m left · Wk 6d 17h left', 'Resets: Nov 10, 22:45', '22d 10h left', 'Remaining 3.7%/day', 'Under pace by 9.6%'], updatedAt: '15:00' },
  ];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    expect(frame).toContain('ChatGPT (Codex)');
    expect(frame).toContain('OpenCode Go');
    expect(frame).toContain('███···············');
    expect(frame).toContain('████··············');
    expect(frame).toContain('Remaining 13.6%/day');
    expect(frame).toContain('Under pace by 9.6%');
  } finally { await screen.dispose(); }
});

test('provider quota bars keep one filled cell for small nonzero usage', async () => {
  const screen = await createTestRenderer({ width: 120, height: 24 });
  const state = initialState();
  state.usageCards = [{ id: 'codex', label: 'ChatGPT (Codex)', headline: '1%', percent: 1, details: [], updatedAt: '15:00' }];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('█···················');
  } finally { await screen.dispose(); }
});

test('sidebar shows the session name and compact Pi stats without a separate context block', async () => {
  const screen = await createTestRenderer({ width: 180, height: 44 });
  const state = initialState();
  state.session = 'Fix invoice import';
  state.stats = { input: 17812, output: 412, cacheRead: 6230, cacheWrite: 128, cost: 0.0491, contextTokens: 17812, contextWindow: 128000, contextPercent: 13.9, userMessages: 2 };
  state.tools = [
    { id: '1', name: 'read', detail: 'a.ts', status: 'done' },
    { id: '2', name: 'edit', detail: 'b.ts', status: 'done' },
    { id: '3', name: 'bash', detail: 'bun test', status: 'done' },
  ];
  state.messages = [{ role: 'user', text: 'Fix the import' }, { role: 'assistant', text: 'Done' }, { role: 'user', text: 'Check it' }, { role: 'assistant', text: 'Passed' }];
  state.deepseekPeak = { label: 'Off-peak', next: 'Peak in 6h 43m', inPeak: false };
  state.widgets = { build: ['Ready'] };
  state.usageCards = [
    { id: 'codex', label: 'ChatGPT (Codex)', headline: '5%', percent: 5, details: ['5h 29% · 4h 37m left', 'Updated 21:05'], updatedAt: '21:05' },
    { id: 'opencode-go', label: 'OpenCode Go', headline: '18%', percent: 18, details: ['5h 1% · Wk 33%', 'Updated 21:05'], updatedAt: '21:05' },
    { id: 'commandcode', label: 'CommandCode', headline: '$0.00', details: ['Available credits  $0.00', 'Updated 21:05'], updatedAt: '21:05' },
  ];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    const sessionRow = frame.split('\n').findIndex(line => line.includes('Fix invoice import'));
    const piCardRow = frame.split('\n').findIndex(line => line.includes('Pi session'));
    expect(sessionRow).toBeGreaterThanOrEqual(0);
    expect(sessionRow).toBeLessThan(piCardRow);
    expect(frame).toContain('Context 17.8K/128K · 13.9%');
    expect(frame).toContain('3 calls · 4 messages');
    expect(frame).not.toContain('Ctrl+B sidebar');
    expect(frame).toContain('ChatGPT (Codex)');
    expect(frame).toContain('CommandCode');
    expect(frame).toContain('build');
    expect(frame).toContain('Ready');
    expect(frame).toContain('DeepSeek pricing');
    expect(frame).toContain('Off-peak · Peak in 6h 43m');
    expect(frame).not.toContain('\nContext\n');
  } finally { await screen.dispose(); }
});

test('session tabs switch sessions and provide a new-session tab button', async () => {
  const screen = await createTestRenderer({ width: 120, height: 32 });
  const state = initialState();
  state.sessionId = 'two'; state.session = 'Current session'; state.sessionFile = 'C:/sessions/two.jsonl';
  state.tabs = [
    { id: 'one', name: 'ERP issues', path: 'C:/sessions/one.jsonl' },
    { id: 'two', name: 'two', path: 'C:/sessions/two.jsonl' },
  ];
  const calls: string[] = [];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: value => calls.push(value) });
  try {
    await screen.renderOnce();
    const rows = screen.captureCharFrame().split('\n');
    const tabRow = rows.findIndex(line => line.includes('ERP issues'));
    expect(tabRow).toBeGreaterThanOrEqual(0);
    expect(rows[tabRow]).toContain('Current session');
    expect(rows[tabRow]).toContain('×');
    expect(rows[tabRow]).toContain('+');
    await screen.mockMouse.click(rows[tabRow].indexOf('ERP issues'), tabRow);
    await screen.mockMouse.click(rows[tabRow].indexOf('+'), tabRow);
    await screen.mockMouse.click(rows[tabRow].indexOf('×', rows[tabRow].indexOf('Current session')), tabRow);
    expect(calls).toEqual(['tab:C:/sessions/one.jsonl', 'new', 'close-tab:two']);
  } finally { await screen.dispose(); }
});

test('extension editor accepts empty and whitespace-preserving replies', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const state = initialState();
  state.inputMode = 'dialog';
  const sent: string[] = [];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: text => sent.push(text), action: () => {} });
  try {
    await screen.renderOnce();
    ui.editor.setText('  keep spacing  ');
    screen.mockInput.pressEnter();
    screen.mockInput.pressEnter();
    expect(sent).toEqual(['  keep spacing  ', '']);
  } finally { await screen.dispose(); }
});

test('extension dialog restores the draft it temporarily replaces', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const state = initialState();
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    ui.editor.setText('my unsent draft');
    ui.openDialog('prefilled answer');
    expect(ui.editor.plainText).toBe('prefilled answer');
    ui.closeDialog();
    expect(ui.editor.plainText).toBe('my unsent draft');
    expect(state.inputMode).toBe('prompt');
  } finally { await screen.dispose(); }
});

test('searchable picker owns focus and restores a busy draft', async () => {
  const screen = await createTestRenderer({ width: 110, height: 32 });
  const state = initialState();
  const picked: string[] = [];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    state.busy = true;
    ui.editor.setText('unsent');
    ui.choose('Models', [{ name: 'Alpha', description: 'first', value: 'a' }, { name: 'Beta', description: 'second', value: 'b' }], value => picked.push(value));
    await screen.mockInput.typeText('second');
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Beta');
    expect(screen.captureCharFrame()).not.toContain('Alpha');
    screen.mockInput.pressEnter();
    expect(picked).toEqual(['b']);
    expect(ui.editor.plainText).toBe('unsent');
  } finally { await screen.dispose(); }
});

test('native shortcuts dispatch palette and leader actions', async () => {
  const screen = await createTestRenderer({ width: 80, height: 28 });
  const calls: string[] = [];
  mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true, submit: () => {}, action: value => calls.push(value) });
  try {
    screen.mockInput.pressKey('p', { ctrl: true });
    screen.mockInput.pressKey('x', { ctrl: true });
    screen.mockInput.pressKey('m');
    screen.mockInput.pressKey('x', { ctrl: true });
    screen.mockInput.pressKey('l');
    screen.mockInput.pressKey('x', { ctrl: true });
    screen.mockInput.pressKey('t');
    screen.mockInput.pressKey('t', { ctrl: true });
    expect(calls).toEqual(['commands', 'model', 'sessions', 'theme', 'thinking']);
  } finally { await screen.dispose(); }
});

test('renders Markdown, response metadata and real context without fences', async () => {
  const screen = await createTestRenderer({ width: 120, height: 40 });
  const state = initialState();
  state.messages = [{ role: 'user', text: 'Explain this' }, { role: 'assistant', text: '# Result\n\n**Works**\n\n```text\nhello code\n```', model: 'test-model', durationMs: 1200, outputTokens: 42 }];
  state.stats.contextTokens = 123; state.stats.contextWindow = 1000;
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    expect(frame).toContain('Result');
    expect(frame).toContain('hello code');
    expect(frame).not.toContain('```');
    expect(frame).toContain('test-model · 1.2s · 42 tokens');
    expect(frame).toContain('Context 123/1K');
    ui.showText('Help', 'Read this help');
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Read this help');
    screen.mockInput.pressEscape();
    await Bun.sleep(30);
  } finally { await screen.dispose(); }
});

test('conversation highlights user prompts on hover and colors emphasized assistant text', async () => {
  const screen = await createTestRenderer({ width: 120, height: 40 });
  const state = initialState();
  state.showThinking = true;
  state.messages = [
    { role: 'user', text: 'whats pstack' },
    { role: 'assistant', text: '*pstack* is a **call stack** for `<process_id>`', thinking: 'Considering tech stack options\nI am exploring several approaches.', model: 'test-model', durationMs: 1700, outputTokens: 21 },
  ];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const userLine = screen.captureCharFrame().split('\n').findIndex(line => line.includes('whats pstack'));
    const userText = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('whats pstack'));
    expect(userText?.bg.toInts().slice(0, 3)).toEqual([18, 18, 18]);
    expect(screen.captureCharFrame()).toContain('Thought:');
    expect(screen.captureCharFrame()).toContain('Build');

    const x = screen.captureCharFrame().split('\n')[userLine]?.indexOf('whats pstack') ?? 0;
    await screen.mockMouse.moveTo(x + 2, userLine);
    await screen.renderOnce();
    const hoveredText = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('whats pstack'));
    expect(hoveredText?.bg.toInts().slice(0, 3)).toEqual([34, 34, 34]);

    const spans = screen.captureSpans().lines.flatMap(line => line.spans);
    expect(spans.find(span => span.text === 'pstack')?.fg.toInts().slice(0, 3)).toEqual([131, 212, 214]);
    expect(spans.find(span => span.text.includes('call stack'))?.fg.toInts().slice(0, 3)).toEqual([255, 200, 87]);
    expect(spans.find(span => span.text.includes('<process_id>'))?.fg.toInts().slice(0, 3)).toEqual([231, 139, 232]);
    expect(spans.find(span => span.text.includes('Thought:'))?.fg.toInts().slice(0, 3)).toEqual([177, 132, 63]);
    expect(spans.find(span => span.text.includes('Build'))?.fg.toInts().slice(0, 3)).toEqual([139, 165, 189]);
  } finally { await screen.dispose(); }
});

test('slash selection retains arguments and history restores sent prompts', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const state = initialState();
  state.commands = [{ name: 'model', description: 'Choose model', source: 'builtin' }];
  const sent: string[] = [];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: text => sent.push(text), action: () => {} });
  try {
    await screen.mockInput.typeText('/mod test-provider/model');
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('/model');
    screen.mockInput.pressEnter();
    expect(sent).toEqual(['/model test-provider/model']);
    screen.mockInput.pressArrow('up');
    expect(ui.editor.plainText).toBe('/model test-provider/model');
  } finally { await screen.dispose(); }
});


test('picker cancellation notifies caller and text overlay protects editor', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const ui = mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  let cancelled = false;
  try {
    ui.editor.setText('protected');
    ui.choose('Select', [], () => {}, () => { cancelled = true; });
    screen.mockInput.pressEscape();
    await Bun.sleep(30);
    expect(cancelled).toBe(true);
    ui.showText('Help', 'Content');
    await screen.mockInput.typeText('accidental');
    screen.mockInput.pressEscape();
    await Bun.sleep(30);
    expect(ui.editor.plainText).toBe('protected');
  } finally { await screen.dispose(); }
});


test('tool details expand inline and thinking toggle reveals retained reasoning', async () => {
  const screen = await createTestRenderer({ width: 110, height: 36 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: 'Done', thinking: 'Considered the alternatives' }];
  state.showThinking = false;
  state.tools = [{ id: 'read', name: 'read', detail: 'app.ts', status: 'done', messageIndex: 0, output: 'file content', diff: '+new line' }];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    expect(screen.captureCharFrame()).not.toContain('file content');
    ui.toggle('details'); ui.toggle('thinking');
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('file content');
    expect(screen.captureCharFrame()).toContain('+new line');
    expect(screen.captureCharFrame()).toContain('Considered the alternatives');
  } finally { await screen.dispose(); }
});

test('file completion quotes paths and busy queue command remains available', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const state = initialState(); const sent: string[] = [];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: text => sent.push(text), action: () => {} });
  try {
    ui.setFiles(['src/my file.ts']);
    await screen.mockInput.typeText('Read @src/my');
    screen.mockInput.pressTab();
    expect(ui.editor.plainText).toBe('Read @"src/my file.ts"');
    state.busy = true;
    ui.editor.setText('/queue do next');
    screen.mockInput.pressEnter();
    expect(sent).toEqual(['/queue do next']);
  } finally { await screen.dispose(); }
});

test('long text overlays scroll while Ctrl+C remains global', async () => {
  const screen = await createTestRenderer({ width: 80, height: 24 });
  const calls: string[] = [];
  const ui = mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true, submit: () => {}, action: value => calls.push(value) });
  try {
    ui.showText('Help', Array.from({ length: 50 }, (_, i) => `Help command ${i}`).join('\n'));
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Help command 0');
    for (let i = 0; i < 8; i++) { screen.mockInput.pressKey('\u001b[6~'); await screen.renderOnce(); }
    expect(screen.captureCharFrame()).toContain('Help command 49');
    screen.mockInput.pressCtrlC();
    expect(calls).toContain('quit');
  } finally { await screen.dispose(); }
});

test('short picker keeps selected long options visible through keyboard navigation', async () => {
  const screen = await createTestRenderer({ width: 70, height: 24 });
  const ui = mount(screen.renderer, initialState(), { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    ui.choose('Models', Array.from({ length: 20 }, (_, i) => ({ name: `Model-${i}`, description: 'A long provider description '.repeat(6), value: String(i) })), () => {});
    for (let i = 0; i < 19; i++) screen.mockInput.pressArrow('down');
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('› Model-19');
    expect(screen.captureCharFrame()).toContain('Esc close');
  } finally { await screen.dispose(); }
});

test('documented leader shortcuts and rich inline Markdown render', async () => {
  const screen = await createTestRenderer({ width: 100, height: 30 });
  const state = initialState(); const calls: string[] = [];
  state.messages = [{ role: 'assistant', text: '**Strong** and *emphasis* with [documentation](https://example.com) and `code`' }];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: value => calls.push(value) });
  try {
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Strong and emphasis with documentation and code');
    for (const key of ['l', 'x', 'e']) { screen.mockInput.pressKey('x', { ctrl: true }); screen.mockInput.pressKey(key); }
    expect(calls).toEqual(['sessions', 'export', 'editor']);
  } finally { await screen.dispose(); }
});


test('extension statuses and measured token rate appear in the native output', async () => {
  const screen = await createTestRenderer({ width: 120, height: 36 });
  const state = initialState();
  state.statuses = { monitor: 'Watching files', empty: '' };
  state.messages = [{ role: 'assistant', text: 'Completed', outputTokens: 50, durationMs: 2000 }];
  const ui = mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    expect(screen.captureCharFrame()).toContain('Watching files');
    expect(screen.captureCharFrame()).toContain('25.0 tok/s');
    state.statuses = {};
    ui.update(); await screen.renderOnce();
    expect(screen.captureCharFrame()).not.toContain('Watching files');
  } finally { await screen.dispose(); }
});

test('assistant Markdown preserves lists, quotes and clearly separates table cells', async () => {
  const screen = await createTestRenderer({ width: 120, height: 45 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: 'Features:\n\n- **First** feature\n- Second *feature*\n- [Third feature](https://example.com)\n  - Nested feature\n\n> Quoted guidance\n\n| Name | Status |\n| --- | --- |\n| Widget | Ready |' }];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    for (const text of ['First feature', 'Second feature', 'Third feature', 'Nested feature', 'Quoted guidance', 'Widget', 'Ready']) expect(frame).toContain(text);
    expect(frame).toContain('┌');
    expect(frame).toContain('└');
    expect(frame.split('\n').some(line => line.includes('Widget') && line.includes('│') && line.includes('Ready'))).toBe(true);
  } finally { await screen.dispose(); }
});

test('pipe-delimited assistant output aligns columns and wraps long cells', async () => {
  const screen = await createTestRenderer({ width: 120, height: 45 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: [
    'erp-backend-fastify-supabase',
    '| Worktree | Branch | PR | Status |',
    '| wt-1 | fix/ui | #12 | Merged safely |',
    '| wt-372-truck-directory | perf/truck-directory-batching-372 | #445 | Open, active work with a long status that should wrap cleanly |',
  ].join('\n') }];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const frame = screen.captureCharFrame();
    const rows = frame.split('\n');
    const titleRow = rows.findIndex(line => line.includes('erp-backend-fastify-supabase'));
    const tableBorderRow = rows.findIndex((line, index) => index > titleRow && line.includes('┌') && line.includes('┬'));
    const header = rows.find(line => line.includes('Worktree') && line.includes('Branch')) ?? '';
    const firstRow = rows.find(line => line.includes('wt-1') && line.includes('fix/ui')) ?? '';
    const titleSpan = screen.captureSpans().lines.flatMap(line => line.spans).find(span => span.text.includes('erp-backend-fastify-supabase'));
    expect(header.indexOf('Branch')).toBeGreaterThan(0);
    expect(titleRow).toBeGreaterThanOrEqual(0);
    expect(tableBorderRow).toBeGreaterThan(titleRow);
    expect(rows[titleRow]).toContain('Project: erp-backend-fastify-supabase');
    expect(titleSpan?.fg.toInts().slice(0, 3)).toEqual([131, 212, 214]);
    expect(firstRow.indexOf('fix/ui')).toBe(header.indexOf('Branch'));
    expect(firstRow.indexOf('#12')).toBe(header.indexOf('PR'));
    expect(rows.some(line => line.includes('long status'))).toBe(true);
    expect(rows.some(line => line.includes('wrap cleanly'))).toBe(true);
  } finally { await screen.dispose(); }
});

test('short pipe tables use content width instead of stretching the last column', async () => {
  const screen = await createTestRenderer({ width: 140, height: 30 });
  const state = initialState();
  state.messages = [{ role: 'assistant', text: [
    'erp-backend-fastify-supabase',
    '| Worktree | Branch | PR | Status |',
    '| wt-372 | perf | #445 | Open |',
  ].join('\n') }];
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const tableTop = screen.captureCharFrame().split('\n').find(line => line.includes('┌') && line.includes('┬')) ?? '';
    expect(tableTop.indexOf('┐')).toBeGreaterThan(0);
    expect(tableTop.indexOf('┐')).toBeLessThan(70);
  } finally { await screen.dispose(); }
});

test('mouse wheel scrolls multiple rows and the latest control returns to the bottom', async () => {
  const screen = await createTestRenderer({ width: 120, height: 32 });
  const state = initialState();
  state.messages = Array.from({ length: 40 }, (_, index) => ({ role: 'user' as const, text: `Scroll marker ${index}` }));
  mount(screen.renderer, state, { cwd: 'C:/project', demo: true, submit: () => {}, action: () => {} });
  try {
    await screen.renderOnce();
    const before = screen.captureCharFrame().split('\n').filter(line => line.includes('Scroll marker')).map(line => line.match(/Scroll marker \d+/)?.[0]).filter(Boolean);
    await screen.mockMouse.scroll(10, 8, 'up');
    await screen.renderOnce();
    const afterFrame = screen.captureCharFrame();
    const after = afterFrame.split('\n').filter(line => line.includes('Scroll marker')).map(line => line.match(/Scroll marker \d+/)?.[0]).filter(Boolean);
    expect(afterFrame).toContain('↓ Latest');
    expect(after[0]).not.toBe(before[0]);

    const rows = afterFrame.split('\n');
    const latestRow = rows.findIndex(line => line.includes('↓ Latest'));
    await screen.mockMouse.click(rows[latestRow]?.indexOf('↓ Latest') ?? 0, latestRow);
    await screen.renderOnce();
    const latestFrame = screen.captureCharFrame();
    expect(latestFrame).toContain('Scroll marker 39');
    expect(latestFrame).not.toContain('↓ Latest');
  } finally { await screen.dispose(); }
});
