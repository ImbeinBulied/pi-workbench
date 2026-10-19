import { resolve } from 'node:path';
import type { Surface, Workbench } from './app';
import { initialState, type State } from './state';

export interface WorkspaceSurface extends Surface {
  setState(state: State, draft: string, scrollTop?: number): void;
  readonly scrollTop: number;
  readonly canSwitch?: boolean;
}
type Runtime = { app: Workbench; start(path?: string): Promise<void>; close(): Promise<void> };
type Entry = Runtime & { state: State; surface: Surface; draft: string; scrollTop: number; unread: boolean; pending?: () => void; lastContent: unknown[] };
type Options = {
  surface(): WorkspaceSurface;
  create(state: State, surface: Surface, hooks: { open(path?: string, name?: string): Promise<void>; close(id: string): Promise<void> }): Runtime;
};
const samePath = (left: string, right: string) => process.platform === 'win32' ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);

/** Each open session owns its backend and state; only its surface is shared. */
export class SessionWorkspace {
  private entries: Entry[] = [];
  private active: Entry | undefined;
  private opening = false;
  private stopped = false;
  private paused = false;
  private tabSignature = '';
  constructor(private options: Options) {}
  get current() { if (!this.active) throw new Error('No session is open'); return this.active; }
  private sync(source?: Entry) {
    if (this.stopped || !this.active) return;
    for (const entry of this.entries) {
      const last = entry.state.messages.at(-1);
      const tool = entry.state.tools.at(-1);
      const content = [entry.state.messages.length, last?.text, last?.thinking, entry.state.tools.length, tool?.output, tool?.status, entry.state.busy, entry.state.error];
      if (entry !== this.active && content.some((value, index) => value !== entry.lastContent[index])) entry.unread = true;
      entry.lastContent = content;
    }
    const tabs = this.entries.map(entry => ({ id: entry.state.sessionId, name: entry.state.session, path: entry.state.sessionFile,
      busy: entry.state.busy, unread: entry.unread, attention: !!entry.pending }));
    const signature = JSON.stringify(tabs);
    const tabsChanged = signature !== this.tabSignature;
    this.tabSignature = signature;
    for (const entry of this.entries) entry.state.tabs = tabs;
    if (!this.paused && (!source || source === this.active || tabsChanged)) this.options.surface().update();
  }
  select(id: string) {
    if (this.opening || this.options.surface().canSwitch === false || this.active && !this.active.app.canLeave) throw new Error('Finish the open dialog or session action before switching tabs.');
    const entry = this.entries.find(item => item.state.sessionId === id);
    if (entry && entry !== this.active) this.activate(entry);
  }
  private activate(entry: Entry) {
    const surface = this.options.surface();
    const previous = this.active;
    if (previous) {
      previous.draft = surface.editor.plainText;
      previous.scrollTop = surface.scrollTop;
      previous.app.setForeground(false);
      entry.state.theme = previous.state.theme;
      entry.state.showThinking = previous.state.showThinking;
      entry.state.showDetails = previous.state.showDetails;
      entry.state.workspaceBranch = previous.state.workspaceBranch;
      entry.state.usageCards = previous.state.usageCards;
      entry.state.deepseekPeak = previous.state.deepseekPeak;
    }
    this.active = entry; entry.unread = false;
    surface.setState(entry.state, entry.draft, entry.scrollTop);
    entry.app.setForeground(true);
    const pending = entry.pending; entry.pending = undefined; pending?.();
    this.sync();
  }
  async open(path?: string, name?: string) {
    if (this.stopped) return;
    if (this.opening || this.options.surface().canSwitch === false || this.active && !this.active.app.canLeave) throw new Error('Finish the open dialog or session action before switching tabs.');
    const existing = path ? this.entries.find(entry => entry.state.sessionFile && samePath(entry.state.sessionFile, path)) : undefined;
    if (existing) { if (existing !== this.active) this.activate(existing); return; }
    this.opening = true;
    const previous = this.active;
    const state = initialState(); state.sessionId = crypto.randomUUID();
    if (!path && previous) { state.model = previous.state.model; state.provider = previous.state.provider; state.thinking = previous.state.thinking; }
    if (name) state.session = name;
    let entry: Entry;
    const show = (work: () => void) => { if (entry === this.active && !this.paused) work(); else { entry.pending = work; entry.unread = true; this.sync(); } };
    const proxy: Surface = {
      editor: {
        get plainText() { return entry === owner.active && !owner.paused ? owner.options.surface().editor.plainText : entry.draft; },
        setText(value) { entry.draft = value; if (entry === owner.active && !owner.paused) owner.options.surface().editor.setText(value); },
      },
      update: () => this.sync(entry),
      choose: (...args) => show(() => this.options.surface().choose(...args)),
      showText: (...args) => show(() => this.options.surface().showText(...args)),
      openDialog: value => show(() => this.options.surface().openDialog(value)),
      closeDialog: () => { entry.pending = undefined; if (entry === this.active) this.options.surface().closeDialog(); },
      closePicker: () => { entry.pending = undefined; if (entry === this.active) this.options.surface().closePicker?.(); },
      toggle: value => { if (entry === this.active) this.options.surface().toggle(value); },
      setFiles: files => { if (entry === this.active) this.options.surface().setFiles?.(files); },
    };
    const owner = this;
    const runtime = this.options.create(state, proxy, { open: (file, title) => this.open(file, title), close: id => this.close(id) });
    entry = { ...runtime, state, surface: proxy, draft: '', scrollTop: Number.MAX_SAFE_INTEGER, unread: false, lastContent: [] };
    this.entries.push(entry); this.activate(entry);
    try {
      await entry.start(path);
      if (this.stopped) return;
      if (name) entry.state.session = name;
      if (previous && !previous.state.busy && previous.app.canLeave && !previous.draft.trim() && !previous.state.messages.length && (previous.state.stats.userMessages ?? 0) === 0) {
        await this.remove(previous);
      }
      this.sync();
    } catch (error) { entry.app.fail(error); throw error; }
    finally { this.opening = false; }
  }
  async close(id: string) {
    const entry = this.entries.find(item => item.state.sessionId === id);
    if (!entry) return;
    if (this.opening || !entry.app.canLeave) throw new Error('Finish the open dialog or session action before closing this tab.');
    if (entry.state.busy) throw new Error('Cancel the running session before closing this tab.');
    if (entry === this.active) {
      const index = this.entries.indexOf(entry);
      const neighbor = this.entries[index - 1] ?? this.entries[index + 1];
      if (neighbor) this.activate(neighbor); else await this.open();
    }
    if (this.entries.includes(entry)) await this.remove(entry);
    this.sync();
  }
  private async remove(entry: Entry) {
    this.entries = this.entries.filter(item => item !== entry);
    entry.app.dispose(); await entry.close();
  }
  restoreSurface() {
    const entry = this.current;
    this.paused = false;
    this.options.surface().setState(entry.state, entry.draft, entry.scrollTop);
    entry.app.replaceSurface(entry.surface); this.sync();
    const pending = entry.pending; entry.pending = undefined; pending?.();
  }
  pauseSurface() {
    const entry = this.current;
    entry.draft = this.options.surface().editor.plainText;
    entry.scrollTop = this.options.surface().scrollTop;
    this.paused = true; entry.app.pauseSurface();
  }
  async shutdown() {
    this.stopped = true;
    const entries = this.entries.splice(0);
    for (const entry of entries) entry.app.dispose();
    await Promise.allSettled(entries.map(entry => entry.close()));
  }
}
