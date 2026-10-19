import { createTestRenderer } from '@opentui/core/testing';
import { rgbToHex } from '@opentui/core';
import { mount } from '../src/ui';
import { initialState } from '../src/state';

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [width, height, name] of [[160, 44, 'wide'], [70, 26, 'narrow']] as const) {
  const screen = await createTestRenderer({ width, height });
  try {
    const state = initialState();
    state.model = 'gpt-6.1-sol'; state.provider = 'openai-codex'; state.thinking = 'low';
    state.stats = { input: 17812, output: 412, cacheRead: 6230, cacheWrite: 128, cost: 0.0491, contextTokens: 17812, contextWindow: 128000, contextPercent: 13.9, userMessages: 1 };
    state.deepseekPeak = { label: 'Off-peak', next: 'Peak in 6h 43m', progress: 0.25, inPeak: false };
    state.usageCards = [
      { id: 'codex', label: 'ChatGPT (Codex)', headline: '5%', percent: 5, details: ['5h 29% · 4h 37m left', 'Weekly resets in 6d 18h', 'Remaining 14.1%/day · over pace 1.5%', 'Updated 21:05'], updatedAt: '21:05' },
      { id: 'opencode-go', label: 'OpenCode Go', headline: '18%', percent: 18, details: ['5h 1% · Wk 33%', 'Reset in 8h 40m', 'Monthly resets in 23d 1h', 'Updated 21:05'], updatedAt: '21:05' },
      { id: 'commandcode', label: 'CommandCode', headline: '$0.00', details: ['Available credits  $0.00', 'Spent: $49.09', 'Last 30 days', 'Updated 21:05'], updatedAt: '21:05' },
    ];
    state.session = 'ERP workspace · sample'; state.sessionId = 'sample'; state.sessionFile = 'sample.jsonl'; state.workspaceBranch = 'master';
    state.tabs = [{ id: 'sample', name: 'ERP workspace · sample', path: 'sample.jsonl' }, { id: 'second', name: 'Model configuration', path: 'second.jsonl' }];
    state.commands = [{ name: 'model', description: 'Select model', source: 'builtin' }, { name: 'sessions', description: 'List saved sessions', source: 'builtin' }];
    state.messages = [{ role: 'user', text: 'What can I do in the new interface?' }, { role: 'assistant', text: '## Your Pi setup, in an OpenCode-style workspace\n\nUse **/model** for a searchable model picker, **/sessions** for saved sessions, and **Ctrl+P** for commands.\n\n- Rendered Markdown and code blocks\n- Expandable tool output alongside the conversation\n- Context, cost, and session activity in the compact sidebar\n\n```ts\nconst backend = "Pi";\nconst frontend = "Workbench";\n```\n\nThis is sample content. No ERP code was read or changed.', model: 'gpt-6.1-sol', durationMs: 2400, outputTokens: 96 }];
    const ui = mount(screen.renderer, state, { cwd: '~/project', demo: true, submit: () => {}, action: () => {} });
    await screen.renderOnce();
    await screen.renderOnce();
    const frame = screen.captureSpans();
    const parts: string[] = [];
    frame.lines.forEach((line, row) => {
      let column = 0;
      for (const span of line.spans) {
        parts.push(`<rect x="${column * 8}" y="${row * 18}" width="${span.width * 8}" height="18" fill="${rgbToHex(span.bg)}"/>`);
        parts.push(`<text x="${column * 8}" y="${row * 18 + 14}" fill="${rgbToHex(span.fg)}" textLength="${span.width * 8}" lengthAdjust="spacingAndGlyphs">${escape(span.text)}</text>`);
        column += span.width;
      }
    });
    await Bun.write(`preview-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 8}" height="${height * 18}" viewBox="0 0 ${width * 8} ${height * 18}"><title>Actual OpenTUI frame with sample content</title><g font-family="Consolas,monospace" font-size="13" xml:space="preserve">${parts.join('')}</g></svg>`);
    await Bun.write(`preview-${name}.txt`, screen.captureCharFrame());
    if (name === 'wide') {
      ui.choose('Models · sample', [
        { name: 'GPT-6.1 Sol', description: '128K context · current', value: 'one', group: 'openai-codex' },
        { name: 'GPT-5.6', description: '128K context', value: 'two', group: 'openai-codex' },
        { name: 'Claude Sonnet', description: '200K context', value: 'three', group: 'anthropic' },
        { name: 'GPT-5 Go', description: '128K context', value: 'four', group: 'opencode-go' },
      ], () => {});
      await screen.renderOnce();
      await Bun.write('preview-models.txt', screen.captureCharFrame());
    }
  } finally { await screen.dispose(); }
}
