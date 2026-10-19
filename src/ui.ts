import { BoxRenderable, TextRenderable, TextareaRenderable, ScrollBoxRenderable, MarkdownRenderable, SyntaxStyle, StyledText, bold, italic, fg, link, type CliRenderer } from '@opentui/core';
import type { State } from './state';

const darkColors = { bg: '#181818', panel: '#121212', input: '#222222', text: '#ededed', muted: '#ababab', accent: '#83d4d6', error: '#ff9c91' };
const palettes: Record<State['theme'], typeof darkColors> = {
  dark: darkColors,
  light: { bg: '#f5f5f5', panel: '#e8e8e8', input: '#dedede', text: '#202020', muted: '#555555', accent: '#17666c', error: '#a02020' },
  nord: { bg: '#2e3440', panel: '#242933', input: '#3b4252', text: '#eceff4', muted: '#aab4c5', accent: '#88c0d0', error: '#bf616a' },
  dracula: { bg: '#282a36', panel: '#21222c', input: '#343746', text: '#f8f8f2', muted: '#bdc0d0', accent: '#bd93f9', error: '#ff5555' },
  'solarized-dark': { bg: '#002b36', panel: '#073642', input: '#0b3a45', text: '#eee8d5', muted: '#93a1a1', accent: '#2aa198', error: '#dc322f' },
  aura: { bg: '#15141b', panel: '#1e1d27', input: '#262431', text: '#edecee', muted: '#6d6d6d', accent: '#a277ff', error: '#ff6767' },
  ayu: { bg: '#0f1419', panel: '#0b0e14', input: '#131a22', text: '#bfbdb6', muted: '#5c6773', accent: '#ffb454', error: '#f07178' },
  carbonfox: { bg: '#161616', panel: '#1f1f1f', input: '#2a2a2a', text: '#f2f4f8', muted: '#525252', accent: '#33b1ff', error: '#ee5396' },
  cobalt2: { bg: '#193549', panel: '#15232d', input: '#1f4662', text: '#ffffff', muted: '#8ca6a6', accent: '#ffc600', error: '#ff628c' },
  cursor: { bg: '#181818', panel: '#202020', input: '#292929', text: '#ededed', muted: '#858585', accent: '#7aa2f7', error: '#f7768e' },
  everforest: { bg: '#2d353b', panel: '#272e33', input: '#343f44', text: '#d3c6aa', muted: '#859289', accent: '#a7c080', error: '#e67e80' },
  flexoki: { bg: '#100f0f', panel: '#1c1b1a', input: '#282726', text: '#cecdc3', muted: '#6f6e69', accent: '#879a39', error: '#d14d41' },
  catppuccin: { bg: '#1e1e2e', panel: '#181825', input: '#313244', text: '#cdd6f4', muted: '#7f849c', accent: '#cba6f7', error: '#f38ba8' },
  'catppuccin-frappe': { bg: '#303446', panel: '#292c3c', input: '#414559', text: '#c6d0f5', muted: '#838ba7', accent: '#ca9ee6', error: '#e78284' },
  'catppuccin-macchiato': { bg: '#24273a', panel: '#1e2030', input: '#363a4f', text: '#cad3f5', muted: '#8087a2', accent: '#c6a0f6', error: '#ed8796' },
  github: { bg: '#0d1117', panel: '#010409', input: '#161b22', text: '#e6edf3', muted: '#7d8590', accent: '#2f81f7', error: '#ff7b72' },
  gruvbox: { bg: '#282828', panel: '#1d2021', input: '#3c3836', text: '#ebdbb2', muted: '#a89984', accent: '#fabd2f', error: '#fb4934' },
  kanagawa: { bg: '#1f1f28', panel: '#16161d', input: '#2a2a37', text: '#dcd7ba', muted: '#727169', accent: '#7e9cd8', error: '#e82424' },
  material: { bg: '#263238', panel: '#1e272c', input: '#314147', text: '#eeffff', muted: '#607d8b', accent: '#80cbc4', error: '#ff5370' },
  matrix: { bg: '#000000', panel: '#050a05', input: '#0c150c', text: '#d2ffd2', muted: '#6b9d6b', accent: '#00ff41', error: '#ff5555' },
  mercury: { bg: '#f5f5f5', panel: '#ffffff', input: '#e8e8e8', text: '#333333', muted: '#777777', accent: '#1976d2', error: '#d32f2f' },
  monokai: { bg: '#272822', panel: '#1e1f1c', input: '#3e3d32', text: '#f8f8f2', muted: '#75715e', accent: '#a6e22e', error: '#f92672' },
  nightowl: { bg: '#011627', panel: '#00111f', input: '#0b2942', text: '#d6deeb', muted: '#5f7e97', accent: '#82aaff', error: '#ef5350' },
  'one-dark': { bg: '#282c34', panel: '#21252b', input: '#2c313a', text: '#abb2bf', muted: '#5c6370', accent: '#61afef', error: '#e06c75' },
  opencode: { bg: '#0a0a0a', panel: '#111111', input: '#1b1b1b', text: '#e5e5e5', muted: '#777777', accent: '#5c9cf5', error: '#e06c75' },
  orng: { bg: '#101010', panel: '#191919', input: '#252525', text: '#f2f2f2', muted: '#777777', accent: '#ff7b00', error: '#ff4d4f' },
  'lucent-orng': { bg: '#19110d', panel: '#221813', input: '#342118', text: '#f3dfd0', muted: '#986e56', accent: '#ff9d5c', error: '#e05d44' },
  'osaka-jade': { bg: '#111c18', panel: '#17241f', input: '#20312a', text: '#d9e5dd', muted: '#789487', accent: '#55c9a6', error: '#ee6a70' },
  palenight: { bg: '#292d3e', panel: '#1f2233', input: '#32374d', text: '#a6accd', muted: '#676e95', accent: '#c792ea', error: '#f07178' },
  rosepine: { bg: '#191724', panel: '#1f1d2e', input: '#26233a', text: '#e0def4', muted: '#6e6a86', accent: '#c4a7e7', error: '#eb6f92' },
  solarized: { bg: '#fdf6e3', panel: '#eee8d5', input: '#f5efdc', text: '#586e75', muted: '#839496', accent: '#268bd2', error: '#dc322f' },
  synthwave84: { bg: '#262335', panel: '#241b2f', input: '#34294f', text: '#f0eff1', muted: '#848bbd', accent: '#ff7edb', error: '#fe4450' },
  tokyonight: { bg: '#1a1b26', panel: '#16161e', input: '#24283b', text: '#c0caf5', muted: '#565f89', accent: '#c099ff', error: '#f7768e' },
  vercel: { bg: '#000000', panel: '#111111', input: '#222222', text: '#ededed', muted: '#888888', accent: '#0070f3', error: '#e00b2d' },
  vesper: { bg: '#101010', panel: '#1a1a1a', input: '#252525', text: '#f0f0f0', muted: '#777777', accent: '#ffc799', error: '#ff8080' },
  zenburn: { bg: '#3f3f3f', panel: '#383838', input: '#484848', text: '#dcdccc', muted: '#9f9f9f', accent: '#8cd0d3', error: '#cc9393' },
};
export interface Actions { cwd: string; demo: boolean; submit: (text: string) => void; action: (name: string) => void }
type Choice = { name: string; description: string; value: string; group?: string };
type MarkdownToken = Parameters<NonNullable<ConstructorParameters<typeof MarkdownRenderable>[1]['renderNode']>>[0];
type InlineChunk = ReturnType<typeof bold>;

function normalizePipeTables(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  let fence: '`' | '~' | undefined;
  let index = 0;

  const cellsIn = (line: string): string[] | undefined => {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return undefined;
    const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
    return cells.length >= 3 ? cells : undefined;
  };
  const isDivider = (cells: string[]) => cells.every(cell => /^:?-{3,}:?$/.test(cell));

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      output.push(line);
      if (marker?.[0] === fence) fence = undefined;
      index++;
      continue;
    }
    if (marker) {
      fence = marker.startsWith('`') ? '`' : '~';
      output.push(line);
      index++;
      continue;
    }

    const firstRow = cellsIn(line);
    if (!firstRow) {
      output.push(line);
      index++;
      continue;
    }

    const rows = [firstRow];
    let end = index + 1;
    while (end < lines.length) {
      const row = cellsIn(lines[end] ?? '');
      if (!row) break;
      rows.push(row);
      end++;
    }
    const secondRow = rows[1];
    const consistentColumns = rows.every(row => row.length === firstRow.length);
    if (rows.length > 1 && secondRow && consistentColumns) {
      let titleIndex = output.length - 1;
      while (titleIndex >= 0 && output[titleIndex]?.trim() === '') titleIndex--;
      const title = output[titleIndex]?.trim();
      if (output.length - titleIndex <= 2 && title && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(title)) {
        output[titleIndex] = `### Project: ${title}`;
      }
      output.push(line);
      if (!isDivider(secondRow)) output.push(`| ${firstRow.map(() => '---').join(' | ')} |`);
      output.push(...lines.slice(index + 1, end));
      index = end;
    } else {
      output.push(line);
      index++;
    }
  }
  return output.join('\n');
}

export function mount(renderer: CliRenderer, state: State, actions: Actions) {
  const colors = { ...palettes[state.theme] };
  let files: string[] = [];
  let picker: { title: string; items: Choice[]; onPick: (value: string) => void; onCancel?: () => void; onHover?: (value: string) => void; index: number; draft: string } | undefined;
  let savedDraft: string | undefined;
  const history: string[] = [];
  let historyIndex = 0, historyDraft = '', slashIndex = 0, leader = false, sidebarVisible = true;
  let tabSignature = '', terminalTitle = '';
  const expanded = new Set<string>();
  const messageRows: { values: unknown[]; box: BoxRenderable; markdown?: MarkdownRenderable }[] = [];
  let renderedSession = state.sessionId;
  const root = new BoxRenderable(renderer, { width: '100%', height: '100%', backgroundColor: colors.bg, flexDirection: 'column' }); renderer.root.add(root);
  const tabs = new BoxRenderable(renderer, { height: 2, flexDirection: 'row', paddingLeft: 2, backgroundColor: colors.panel }); root.add(tabs);
  const body = new BoxRenderable(renderer, { flexGrow: 1, minHeight: 0, flexDirection: 'row' }); root.add(body);
  const main = new BoxRenderable(renderer, { flexGrow: 1, minWidth: 0, paddingX: 2, flexDirection: 'column' }); body.add(main);
  const scroll = new ScrollBoxRenderable(renderer, { flexGrow: 1, minHeight: 0, scrollY: true, scrollX: false, stickyScroll: true, stickyStart: 'bottom', scrollAcceleration: { tick: () => 3, reset: () => {} }, contentOptions: { flexDirection: 'column', gap: 1, paddingTop: 1 } }); main.add(scroll);
  const status = new TextRenderable(renderer, { height: 1, fg: colors.muted }); main.add(status);
  const completion = new TextRenderable(renderer, { height: 4, fg: colors.accent, visible: false, bg: colors.panel }); main.add(completion);
  const composer = new BoxRenderable(renderer, { height: 5, flexShrink: 0, paddingX: 2, paddingTop: 1, paddingBottom: 0, backgroundColor: colors.input, flexDirection: 'column' }); main.add(composer);
  const syntaxStyle = SyntaxStyle.fromStyles({ default: { fg: colors.text }, 'markup.heading': { fg: colors.accent, bold: true }, 'markup.strong': { bold: true }, 'markup.raw': { fg: colors.accent }, keyword: { fg: colors.accent }, comment: { fg: colors.muted } }, renderer.nativeScene);
  let syntaxTheme = state.theme;
  const editor = new TextareaRenderable(renderer, {
    height: 2, width: '100%', backgroundColor: colors.input, focusedBackgroundColor: colors.input,
    textColor: colors.text, focusedTextColor: colors.text, placeholderColor: colors.muted, placeholder: 'Ask Pi anything…',
    keyBindings: [{ name: 'return', action: 'submit' }, { name: 'return', shift: true, action: 'newline' }],
    onContentChange: () => { slashIndex = 0; updateCompletion(); updatePicker(); },
    onSubmit: () => {
      if (picker) { const selected = filtered()[picker.index]; if (selected) { const callback = picker.onPick; closePicker(false); callback(selected.value); } return; }
      const text = state.inputMode === 'dialog' ? editor.plainText : editor.plainText.trim();
      if ((!text && state.inputMode === 'prompt') || (state.busy && !text.startsWith('/'))) return;
      if (state.inputMode === 'prompt') { history.push(text); historyIndex = history.length; }
      editor.setText(''); actions.submit(text);
    },
  }); composer.add(editor);
  composer.add(new BoxRenderable(renderer, { flexGrow: 1, minHeight: 0 }));
  const model = new TextRenderable(renderer, { height: 1, fg: colors.accent }); composer.add(model);
  const latest = new TextRenderable(renderer, { content: '↓ Latest', position: 'absolute', right: 4, bottom: 7, height: 1, paddingX: 1, fg: colors.accent, bg: colors.panel, visible: false, onMouseDown: () => { scroll.scrollTop = scroll.scrollHeight; queueMicrotask(syncLatest); } }); main.add(latest);
  const sidebar = new BoxRenderable(renderer, { width: 36, flexShrink: 0, padding: 2, backgroundColor: colors.panel, flexDirection: 'column' }); body.add(sidebar);
  const sessionName = new TextRenderable(renderer, { width: '100%', height: 1, fg: colors.accent, wrapMode: 'none', flexShrink: 0 }); sidebar.add(sessionName);
  const costCard = new BoxRenderable(renderer, { width: '100%', flexShrink: 0, paddingX: 1, border: true, borderColor: colors.muted, flexDirection: 'column' }); sidebar.add(costCard);
  const costHeader = new BoxRenderable(renderer, { width: '100%', height: 1, flexDirection: 'row', justifyContent: 'space-between' }); costCard.add(costHeader);
  const costTitle = new TextRenderable(renderer, { content: 'Pi session', fg: colors.accent }); costHeader.add(costTitle);
  const costAmount = new TextRenderable(renderer, { fg: colors.text }); costHeader.add(costAmount);
  const costDetails = new TextRenderable(renderer, { fg: colors.muted, wrapMode: 'word', flexShrink: 0 }); costCard.add(costDetails);
  const providerCards = new BoxRenderable(renderer, { width: '100%', flexShrink: 0, flexDirection: 'column' }); sidebar.add(providerCards);
  let usageSignature = '';
  const widgets = new TextRenderable(renderer, { width: '100%', fg: colors.muted, wrapMode: 'word', flexShrink: 1, minHeight: 0, visible: false }); sidebar.add(widgets);
  sidebar.add(new BoxRenderable(renderer, { flexGrow: 1, minHeight: 0 }));
  const deepseekTracker = new BoxRenderable(renderer, { width: '100%', height: 2, flexShrink: 0, alignItems: 'flex-end', flexDirection: 'column' }); sidebar.add(deepseekTracker);
  const deepseekTitle = new TextRenderable(renderer, { height: 1, fg: colors.text }); deepseekTracker.add(deepseekTitle);
  const deepseekStatus = new TextRenderable(renderer, { height: 1, fg: colors.accent }); deepseekTracker.add(deepseekStatus);
  const footer = new TextRenderable(renderer, { height: 1, paddingLeft: 2, fg: colors.muted, bg: colors.panel }); root.add(footer);
  const overlay = new BoxRenderable(renderer, { position: 'absolute', left: '10%', top: 3, width: '80%', height: 16, padding: 2, backgroundColor: colors.input, border: true, borderColor: colors.accent, flexDirection: 'column', visible: false }); root.add(overlay);
  const overlayScroll = new ScrollBoxRenderable(renderer, { flexGrow: 1, minHeight: 0, scrollY: true, scrollX: false, contentOptions: { flexDirection: 'column' } }); overlay.add(overlayScroll);
  const overlayText = new TextRenderable(renderer, { fg: colors.text, wrapMode: 'word', flexShrink: 0 }); overlayScroll.add(overlayText);
  const overlayRows = new BoxRenderable(renderer, { width: '100%', flexDirection: 'column', flexShrink: 0 }); overlayScroll.add(overlayRows);
  const overlayHint = new TextRenderable(renderer, { fg: colors.muted, wrapMode: 'word', flexShrink: 0 }); overlayScroll.add(overlayHint);

  function syncLatest() {
    const bottom = Math.max(0, scroll.scrollHeight - scroll.viewport.height);
    latest.visible = bottom > 0 && scroll.scrollTop < bottom - 1;
  }
  scroll.onMouse = event => { if (['scroll', 'drag', 'up'].includes(event.type)) queueMicrotask(syncLatest); };
  function overlaySize() { overlay.top = Math.min(3, Math.max(0, renderer.height - 12)); overlay.height = Math.max(6, renderer.height - 5); }
  function inlineChunks(tokens: MarkdownToken[]): InlineChunk[] {
    const emphasis = state.theme === 'dark';
    return tokens.flatMap(token => {
      const children = 'tokens' in token && token.tokens ? inlineChunks(token.tokens) : [{ __isChunk: true, text: 'text' in token && typeof token.text === 'string' ? token.text : token.raw } satisfies InlineChunk];
      if (token.type === 'strong') return children.map(chunk => emphasis ? bold(fg('#ffc857')(chunk)) : bold(chunk));
      if (token.type === 'em') return children.map(chunk => italic(fg(colors.accent)(chunk)));
      if (token.type === 'codespan') return children.map(fg(emphasis ? '#e78be8' : colors.accent));
      if (token.type === 'link' && 'href' in token) return children.map(chunk => link(token.href)(fg(colors.accent)(chunk)));
      if (token.type === 'br') return [{ __isChunk: true, text: '\n' } satisfies InlineChunk];
      return children;
    });
  }
  function blockChunks(token: MarkdownToken, depth = 0): InlineChunk[] {
    if (token.type === 'list') {
      return token.items.flatMap((item: { tokens: MarkdownToken[] }, index: number) => [
        { __isChunk: true, text: `${'  '.repeat(depth)}${token.ordered ? String(Number(token.start || 1) + index) + '.' : '•'} ` } satisfies InlineChunk,
        ...item.tokens.flatMap((child: MarkdownToken) => blockChunks(child, depth + 1)),
        { __isChunk: true, text: '\n' } satisfies InlineChunk,
      ]);
    }
    if (token.type === 'blockquote') return (token.tokens ?? []).flatMap((child: MarkdownToken) => [{ __isChunk: true, text: '│ ' } satisfies InlineChunk, ...blockChunks(child, depth), { __isChunk: true, text: '\n' } satisfies InlineChunk]);
    if (token.type === 'table') return [token.header, ...token.rows].flatMap((row: { tokens: MarkdownToken[] }[]) => row.flatMap((cell, index) => [...(index ? [{ __isChunk: true, text: '  │  ' } satisfies InlineChunk] : []), ...inlineChunks(cell.tokens), ...(index === row.length - 1 ? [{ __isChunk: true, text: '\n' } satisfies InlineChunk] : [])]));
    if ('tokens' in token && token.tokens) return token.tokens.flatMap(child => child.type === 'list' ? [{ __isChunk: true, text: '\n' } satisfies InlineChunk, ...blockChunks(child, depth)] : inlineChunks([child]));
    return [{ __isChunk: true, text: 'text' in token && typeof token.text === 'string' ? token.text : token.raw } satisfies InlineChunk];
  }
  function filtered() { const query = editor.plainText.toLowerCase(); return picker?.items.filter(item => `${item.group ?? ''} ${item.name} ${item.description}`.toLowerCase().includes(query)) ?? []; }
  function updatePicker() {
    if (!picker) return;
    overlaySize();
    const items = filtered(); picker.index = Math.min(picker.index, Math.max(0, items.length - 1));
    const rows: ({ kind: 'group'; label: string } | { kind: 'item'; item: Choice; index: number })[] = [];
    let previousGroup = '';
    items.forEach((item, index) => {
      const group = item.group?.trim() || '';
      if (group && group !== previousGroup) rows.push({ kind: 'group', label: group });
      rows.push({ kind: 'item', item, index });
      previousGroup = group;
    });
    const selectedRow = rows.findIndex(row => row.kind === 'item' && row.index === picker!.index);
    const visibleCount = Math.max(1, renderer.height - 17), start = Math.max(0, Math.min(selectedRow, rows.length - visibleCount));
    const columns = Math.max(8, Math.floor(renderer.width * 0.8) - 6);
    const truncate = (text: string) => text.length > columns ? text.slice(0, columns - 1) + '…' : text;
    overlayText.content = `${truncate(picker.title)}\n${truncate('Search: ' + editor.plainText)}\n`;
    overlayRows.visible = true; overlayHint.visible = true;
    overlayRows.getChildren().forEach(child => child.destroyRecursively());
    const visibleRows = rows.slice(start, start + visibleCount);
    if (!visibleRows.length) overlayRows.add(new TextRenderable(renderer, { content: 'No matches', height: 1, fg: colors.muted }));
    for (const row of visibleRows) {
      if (row.kind === 'group') {
        overlayRows.add(new TextRenderable(renderer, { content: truncate(`── ${row.label} ──`), height: 1, fg: colors.muted, wrapMode: 'none' }));
        continue;
      }
      const selected = row.index === picker.index;
      overlayRows.add(new TextRenderable(renderer, {
        content: truncate(`${selected ? '›' : ' '} ${row.item.name}  ${row.item.description}`), height: 1,
        fg: selected ? colors.accent : colors.text, bg: selected ? colors.panel : undefined, wrapMode: 'none',
        onMouseOver: () => {
          if (!picker) return;
          const changed = picker.index !== row.index;
          picker.index = row.index;
          picker.onHover?.(row.item.value);
          if (changed) updatePicker();
          renderer.requestRender();
        },
        onMouseDown: () => {
          if (!picker) return;
          const callback = picker.onPick;
          closePicker(false);
          callback(row.item.value);
        },
      }));
    }
    overlayHint.content = '\n↑↓ select · Enter confirm · Esc close';
    overlayScroll.scrollTop = 0;
  }
  function closePicker(cancel = true) {
    const activePicker = picker;
    if (activePicker) {
      const draft = activePicker.draft;
      picker = undefined;
      if (cancel) activePicker.onCancel?.();
      editor.setText(draft);
    }
    overlay.visible = false; overlayRows.visible = false; overlayHint.visible = false; editor.focus();
  }
  function slashMatches() { const match = /^\/(\S*)/.exec(editor.plainText); return match ? state.commands.filter(command => command.name.startsWith(match[1] ?? '')) : []; }
  function updateCompletion() {
    if (picker || state.inputMode === 'dialog') { completion.visible = false; return; }
    const commands = slashMatches(); completion.visible = commands.length > 0 && !editor.plainText.includes('\n');
    completion.content = commands.slice(slashIndex, slashIndex + 4).map((command, i) => `${i === 0 ? '›' : ' '} /${command.name}  ${command.description}`).join('\n');
  }
  function addText(parent: BoxRenderable | ScrollBoxRenderable, content: string, muted = false) { parent.add(new TextRenderable(renderer, { content, fg: muted ? colors.muted : colors.text, wrapMode: 'word', flexShrink: 0 })); }
  function addTools(parent: BoxRenderable, tools: State['tools']) {
    tools.forEach(tool => {
      const box = new BoxRenderable(renderer, { flexDirection: 'column', flexShrink: 0, paddingLeft: 1 }); parent.add(box);
      const open = state.showDetails || expanded.has(tool.id);
      box.add(new TextRenderable(renderer, { content: `${open ? '▾' : '▸'} ${tool.status === 'running' ? '…' : tool.status === 'error' ? '!' : '✓'} ${tool.name}  ${tool.detail}`, fg: colors.muted, wrapMode: 'word', onMouseDown: () => { expanded.has(tool.id) ? expanded.delete(tool.id) : expanded.add(tool.id); update(); } }));
      if (open && (tool.output || tool.diff)) addText(box, [tool.output, tool.diff].filter(Boolean).join('\n'), true);
    });
  }
  function update() {
    if (state.title !== terminalTitle) { terminalTitle = state.title; renderer.setTerminalTitle(terminalTitle); }
    overlaySize(); sidebar.visible = sidebarVisible && renderer.width >= 90;
    sidebar.width = Math.min(44, Math.max(36, Math.round(renderer.width * 0.22)));
    Object.assign(colors, palettes[state.theme]);
    if (syntaxTheme !== state.theme) {
      syntaxTheme = state.theme;
      syntaxStyle.registerStyle('default', { fg: colors.text });
      syntaxStyle.registerStyle('markup.heading', { fg: colors.accent, bold: true });
      syntaxStyle.registerStyle('markup.raw', { fg: colors.accent });
      syntaxStyle.registerStyle('keyword', { fg: colors.accent });
      syntaxStyle.registerStyle('comment', { fg: colors.muted });
    }
    root.backgroundColor = colors.bg; tabs.backgroundColor = colors.panel; sidebar.backgroundColor = colors.panel; composer.backgroundColor = colors.input; overlay.backgroundColor = colors.input;
    editor.backgroundColor = colors.input; editor.focusedBackgroundColor = colors.input; editor.textColor = colors.text; editor.focusedTextColor = colors.text; editor.placeholderColor = colors.muted;
    completion.fg = colors.accent; completion.bg = colors.panel; sessionName.fg = colors.accent; widgets.fg = colors.muted; model.fg = colors.accent; latest.fg = colors.accent; latest.bg = colors.panel; footer.fg = colors.muted; footer.bg = colors.panel; overlayText.fg = colors.text;
    costCard.backgroundColor = colors.panel; costCard.borderColor = colors.muted; costTitle.fg = colors.accent; costAmount.fg = colors.text; costDetails.fg = colors.muted;
    deepseekTitle.fg = colors.text; deepseekStatus.fg = colors.accent;
    const nextTabs = JSON.stringify([state.tabs, state.session, state.sessionFile, state.theme]);
    if (nextTabs !== tabSignature) {
      tabSignature = nextTabs; tabs.getChildren().forEach(child => child.destroyRecursively());
      const sessions = state.tabs.length ? state.tabs : [{ id: state.sessionId, name: state.session, path: state.sessionFile }];
      sessions.forEach(tab => {
        const active = tab.id === state.sessionId;
        const label = active ? state.session : tab.name;
        const tabView = new BoxRenderable(renderer, { height: 1, flexDirection: 'row', backgroundColor: active ? colors.input : colors.panel });
        tabView.add(new TextRenderable(renderer, {
          content: ` ${tab.attention ? '! ' : tab.busy ? '… ' : tab.unread ? '• ' : ''}${label} `, fg: active ? colors.accent : colors.muted,
          bg: active ? colors.input : colors.panel,
          onMouseDown: () => { if (!active) actions.action(tab.path ? 'tab:' + tab.path : 'tab-id:' + tab.id); },
        }));
        tabView.add(new TextRenderable(renderer, {
          content: '×', fg: colors.muted, bg: active ? colors.input : colors.panel,
          onMouseDown: () => actions.action('close-tab:' + tab.id),
        }));
        tabs.add(tabView);
      });
      tabs.add(new TextRenderable(renderer, { content: ' + ', fg: colors.accent, onMouseDown: () => actions.action('new') }));
    }
    if (renderedSession !== state.sessionId) {
      messageRows.splice(0).forEach(row => row.box.destroyRecursively());
      renderedSession = state.sessionId;
    }
    const groupedTools = new Map<number, State['tools']>();
    for (const tool of state.tools) {
      const index = tool.messageIndex ?? state.messages.length - 1;
      const group = groupedTools.get(index) ?? [];
      group.push(tool); groupedTools.set(index, group);
    }
    const rowCount = Math.max(1, state.messages.length);
    while (messageRows.length > rowCount) messageRows.pop()?.box.destroyRecursively();
    {
      const conversationBlue = state.theme === 'dark' ? '#8ba5bd' : colors.accent;
      for (let index = 0; index < rowCount; index++) {
        const message = state.messages[index];
        const tools = groupedTools.get(message ? index : -1) ?? [];
        const values = [message?.role, message?.text, message?.thinking, message?.model, message?.provider, message?.durationMs, message?.outputTokens,
          state.showThinking, state.showDetails, state.theme, message?.model ? '' : state.model,
          message?.role === 'assistant' && (!message.text || index === state.active) ? state.busy : false,
          ...tools.flatMap(tool => [tool.id, tool.name, tool.detail, tool.status, tool.output, tool.diff, expanded.has(tool.id)])];
        const previous = messageRows[index];
        if (previous && previous.values.length === values.length && values.every((value, i) => value === previous.values[i])) continue;
        if (previous?.markdown && previous.values.length === values.length && values.every((value, i) => i === 1 || value === previous.values[i])) {
          previous.markdown.content = normalizePipeTables(message?.text || (state.busy ? 'Thinking…' : ''));
          previous.values = values;
          continue;
        }
        const row = previous?.box ?? new BoxRenderable(renderer, { flexDirection: 'column', flexShrink: 0 });
        if (previous) row.getChildren().forEach(child => child.destroyRecursively()); else scroll.add(row);
        messageRows[index] = { values, box: row };
        if (!message) { addText(row, 'pi workbench\n\nWhat are we building?\nAsk about your code, investigate a bug, or make a change.', true); addTools(row, tools); continue; }
        const isUser = message.role === 'user';
        const box = new BoxRenderable(renderer, { flexDirection: 'column', flexShrink: 0, paddingY: 1, paddingX: isUser ? 2 : 0, backgroundColor: isUser ? colors.panel : colors.bg, border: isUser ? ['left'] : [], borderColor: isUser ? conversationBlue : colors.accent }); row.add(box);
        if (isUser) {
          box.add(new TextRenderable(renderer, {
            content: message.text, fg: colors.text, wrapMode: 'word', flexShrink: 0,
            onMouseOver: () => { box.backgroundColor = colors.input; },
            onMouseOut: () => { box.backgroundColor = colors.panel; },
          }));
        }
        else {
          if (state.showThinking && message.thinking) {
            box.add(new TextRenderable(renderer, { content: new StyledText([fg('#b1843f')({ __isChunk: true, text: 'Thought:' })]), fg: colors.muted, wrapMode: 'word', flexShrink: 0 }));
            const [heading, ...body] = message.thinking.split('\n');
            if (heading) box.add(new TextRenderable(renderer, { content: new StyledText([bold(fg(colors.muted)({ __isChunk: true, text: heading }))]), fg: colors.muted, wrapMode: 'word', flexShrink: 0 }));
            if (body.length) addText(box, body.join('\n'), true);
          }
          const markdown = new MarkdownRenderable(renderer, {
            content: normalizePipeTables(message.text || (state.busy ? 'Thinking…' : '')), syntaxStyle, fg: colors.text, flexShrink: 0, internalBlockMode: 'top-level', conceal: true, streaming: state.busy && index === state.active,
            tableOptions: { style: 'grid', widthMode: 'content', wrapMode: 'word', cellPaddingX: 1, borders: true, borderColor: colors.muted },
            renderNode: token => {
              if (['list', 'blockquote'].includes(token.type)) return new TextRenderable(renderer, { content: new StyledText(blockChunks(token)), fg: colors.text, wrapMode: 'word', flexShrink: 0 });
              if ('text' in token && typeof token.text === 'string' && ['heading', 'paragraph', 'code'].includes(token.type)) {
                const content = token.type !== 'code' && 'tokens' in token && token.tokens ? new StyledText(inlineChunks(token.tokens).map(chunk => token.type === 'heading' ? bold(chunk) : chunk)) : token.text;
                return new TextRenderable(renderer, { content, fg: ['code', 'heading'].includes(token.type) ? colors.accent : colors.text, wrapMode: 'word', flexShrink: 0 });
              }
              return undefined;
            },
          });
          box.add(markdown);
          const record = messageRows[index];
          if (record) record.markdown = markdown;
          const metadata = [message.model || state.model, message.durationMs === undefined ? '' : `${(message.durationMs / 1000).toFixed(1)}s`, message.outputTokens === undefined ? '' : `${message.outputTokens} tokens`, message.outputTokens !== undefined && message.durationMs !== undefined && message.durationMs > 0 ? `${(message.outputTokens * 1000 / message.durationMs).toFixed(1)} tok/s` : ''].filter(Boolean).join(' · ');
          box.add(new TextRenderable(renderer, { content: new StyledText([fg(conversationBlue)({ __isChunk: true, text: 'Build' }), fg(colors.muted)({ __isChunk: true, text: ` · ${metadata}` })]), fg: colors.muted, wrapMode: 'word', flexShrink: 0 }));
        }
        addTools(row, tools);
      }
    }
    model.content = `${state.model} · ${state.provider || 'provider unavailable'} · ${state.thinking || 'off'}${state.pendingCount ? ` · ${state.pendingCount} queued` : ''}`;
    status.content = state.error || state.notice || (state.busy ? 'Working · Esc cancel · draft retained' : 'Enter send · Shift+Enter newline · Ctrl+P commands'); status.fg = state.error ? colors.error : colors.muted;
    const stats = state.stats;
    const percent = stats.contextPercent === null ? null : Math.max(0, Math.min(100, stats.contextPercent));
    const barWidth = 10;
    const filled = percent === null ? 0 : Math.round(barWidth * percent / 100);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(barWidth - filled)}`;
    const compact = (value: number | null) => {
      if (value === null) return '—';
      const absolute = Math.abs(value);
      if (absolute >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
      if (absolute >= 1_000) return `${Number((value / 1_000).toFixed(1))}K`;
      return value.toLocaleString();
    };
    costAmount.content = `$${stats.cost.toFixed(4)}`;
    sessionName.content = state.session || 'New session';
    costDetails.content = `Context ${compact(stats.contextTokens)}/${compact(stats.contextWindow || null)}${percent === null ? '' : ` · ${percent.toFixed(1)}%`}\n${bar}\nIn ${compact(stats.input)} · Out ${compact(stats.output)}\nCache ${compact(stats.cacheRead)}\n${state.tools.length} calls · ${state.messages.length} messages`;
    widgets.content = Object.entries(state.widgets).map(([name, lines]) => `${name}\n${lines.join('\n')}`).join('\n');
    widgets.visible = Boolean(widgets.content);
    const nextUsage = JSON.stringify([state.theme, state.usageCards]);
    if (nextUsage !== usageSignature) {
      usageSignature = nextUsage;
      providerCards.getChildren().forEach(child => child.destroyRecursively());
      for (const card of state.usageCards) {
        const box = new BoxRenderable(renderer, { width: '100%', flexShrink: 0, paddingX: 1, border: true, borderColor: colors.muted, flexDirection: 'column' });
        const header = new BoxRenderable(renderer, { width: '100%', height: 1, flexDirection: 'row', justifyContent: 'space-between' });
        header.add(new TextRenderable(renderer, { content: card.label, fg: colors.text }));
        header.add(new TextRenderable(renderer, { content: card.headline, fg: card.error ? colors.error : colors.text }));
        box.add(header);
        if (card.percent !== undefined) {
          const barWidth = 20;
          const usagePercent = Math.max(0, Math.min(100, card.percent));
          const count = usagePercent === 0 ? 0 : Math.max(1, Math.round(barWidth * usagePercent / 100));
          const bar = new BoxRenderable(renderer, { width: '100%', height: 1, flexDirection: 'row' });
          if (count) bar.add(new TextRenderable(renderer, { content: '█'.repeat(count), fg: card.error ? colors.error : '#b8b8b8', flexShrink: 0 }));
          if (count < barWidth) bar.add(new TextRenderable(renderer, { content: '·'.repeat(barWidth - count), fg: colors.muted, flexShrink: 0 }));
          box.add(bar);
        }
        for (const line of card.details) box.add(new TextRenderable(renderer, { content: line, fg: card.error ? colors.muted : colors.text, wrapMode: 'word', flexShrink: 0 }));
        providerCards.add(box);
      }
    }
    deepseekTitle.content = state.deepseekPeak ? 'DeepSeek pricing' : '';
    deepseekStatus.content = state.deepseekPeak ? `${state.deepseekPeak.label} · ${state.deepseekPeak.next}` : '';
    footer.content = `${actions.cwd}${state.workspaceBranch ? '  ·  ' + state.workspaceBranch : ''}${actions.demo ? '  DEMO' : ''}${Object.values(state.statuses).filter(value => value.trim()).map(value => '  ·  ' + value).join('')}`;
    updateCompletion(); updatePicker(); queueMicrotask(syncLatest);
  }
  renderer.on('resize', update);
  renderer.keyInput.on('keypress', key => {
    if (key.ctrl && key.name === 'c') { key.preventDefault(); actions.action('quit'); return; }
    if (picker || overlay.visible) {
      if (key.name === 'escape') { key.preventDefault(); closePicker(); }
      else if (picker && (key.name === 'up' || key.name === 'down')) { key.preventDefault(); const items = filtered(), count = items.length; picker.index = count ? (picker.index + (key.name === 'up' ? -1 : 1) + count) % count : 0; const selected = items[picker.index]; if (selected) picker.onHover?.(selected.value); updatePicker(); }
      else if (!picker && ['up', 'down', 'pageup', 'pagedown'].includes(key.name)) { key.preventDefault(); overlayScroll.scrollBy(key.name === 'up' ? -1 : key.name === 'down' ? 1 : key.name === 'pageup' ? -Math.max(1, renderer.height - 12) : Math.max(1, renderer.height - 12)); }
      return;
    }
    if (leader) { leader = false; key.preventDefault(); const commands: Record<string, string> = { m: 'model', l: 'sessions', t: 'theme', n: 'new', h: 'hotkeys', x: 'export', e: 'editor' }; const command = commands[key.name]; if (command) actions.action(command); return; }
    if (key.ctrl && key.name === 'return') { key.preventDefault(); if (editor.plainText.trim()) { actions.submit('/queue ' + editor.plainText); editor.setText(''); } return; }
    const fileMatch = /(?:^|\s)@([^\s"']*)$/.exec(editor.plainText);
    if (key.name === 'tab' && fileMatch) { const file = files.find(path => path.toLowerCase().startsWith((fileMatch[1] ?? '').toLowerCase())); if (file) { key.preventDefault(); editor.setText(editor.plainText.replace(/@[^\s"']*$/, '@' + (file.includes(' ') ? JSON.stringify(file) : file))); } return; }
    if (key.ctrl && key.name === 'x') { key.preventDefault(); leader = true; return; }
    if (key.ctrl && key.name === 'tab') { key.preventDefault(); if (!state.tabs.length) return; const index = state.tabs.findIndex(tab => tab.id === state.sessionId); const tab = state.tabs[(index + 1) % state.tabs.length]; if (tab && tab.id !== state.sessionId) actions.action(tab.path ? 'tab:' + tab.path : 'tab-id:' + tab.id); return; }
    if (key.ctrl && ['b', 'n', 'p', 't'].includes(key.name)) { key.preventDefault(); if (key.name === 'b') { sidebarVisible = !sidebarVisible; update(); } else actions.action(({ n: 'new', p: 'commands', t: 'thinking' })[key.name] ?? ''); return; }
    if (state.inputMode === 'dialog') { if (key.name === 'escape') { key.preventDefault(); actions.action('abort'); } return; }
    const matches = slashMatches();
    if (completion.visible && matches.length && ['up', 'down', 'tab', 'return'].includes(key.name) && !key.shift) {
      if (key.name === 'up' || key.name === 'down') { key.preventDefault(); slashIndex = (slashIndex + (key.name === 'up' ? -1 : 1) + matches.length) % matches.length; completion.content = matches.slice(slashIndex, slashIndex + 4).map((command, index) => `${index ? ' ' : '›'} /${command.name}  ${command.description}`).join('\n'); }
      else { key.preventDefault(); const command = matches[slashIndex]; if (command) { const args = editor.plainText.replace(/^\/\S*/, ''); editor.setText('/' + command.name + args); if (key.name === 'return') { const text = editor.plainText; editor.setText(''); history.push(text); historyIndex = history.length; actions.submit(text); } } } return;
    }
    if ((key.name === 'up' || key.name === 'down') && !editor.plainText.includes('\n') && history.length) { key.preventDefault(); if (historyIndex === history.length) historyDraft = editor.plainText; historyIndex = Math.max(0, Math.min(history.length, historyIndex + (key.name === 'up' ? -1 : 1))); editor.setText(history[historyIndex] ?? historyDraft); }
    else if (key.name === 'escape') { key.preventDefault(); actions.action('abort'); }
    else if (key.name === 'pageup' || key.name === 'pagedown') { key.preventDefault(); scroll.scrollBy(key.name === 'pageup' ? -10 : 10); queueMicrotask(syncLatest); }
  });
  editor.focus(); update();
  return {
    setState(next: State, draft: string, scrollTop = 0) {
      closePicker(); state = next; expanded.clear();
      messageRows.splice(0).forEach(row => row.box.destroyRecursively());
      renderedSession = state.sessionId; tabSignature = '';
      editor.setText(draft); update();
      setTimeout(() => { if (!scroll.isDestroyed && state === next) { scroll.scrollTop = scrollTop; syncLatest(); } }, 0);
    },
    get scrollTop() { return scroll.scrollTop; },
    get canSwitch() { return !picker && !overlay.visible && state.inputMode !== 'dialog'; },
    editor, update, setFiles(value: string[]) { files = value; }, closePicker,
    choose(title: string, items: Choice[], onPick: (value: string) => void, onCancel?: () => void, onHover?: (value: string) => void) { const draft = picker?.draft ?? editor.plainText; if (picker) closePicker(); picker = { title, items, onPick, onCancel, onHover, index: 0, draft }; editor.setText(''); overlay.visible = true; updatePicker(); editor.focus(); },
    showText(title: string, text: string) { closePicker(); editor.blur(); overlay.visible = true; overlaySize(); overlayText.content = `${title}\n\n${text}\n\nEsc close`; overlayScroll.scrollTop = 0; },
    toggle(name: 'sidebar' | 'details' | 'thinking') { if (name === 'sidebar') sidebarVisible = !sidebarVisible; else if (name === 'details') state.showDetails = !state.showDetails; else state.showThinking = !state.showThinking; update(); },
    openDialog(prefill: string) { closePicker(); savedDraft ??= editor.plainText; state.inputMode = 'dialog'; editor.setText(prefill); },
    closeDialog() { state.inputMode = 'prompt'; editor.setText(savedDraft ?? ''); savedDraft = undefined; },
  };
}
