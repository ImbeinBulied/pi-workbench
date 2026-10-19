import { createCliRenderer, createHostClipboard } from '@opentui/core';
import { resolve, join } from 'node:path';
import { stat, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pi, piCommand } from './pi';
import { initialState } from './state';
import { mount } from './ui';
import { Workbench } from './app';
import { listFiles } from './workspace';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const sessionIndex = args.indexOf('--session');
const sessionFile = sessionIndex >= 0 ? args[sessionIndex + 1] : undefined;
const cwd = resolve(args.find((arg, index) => !arg.startsWith('--') && (sessionIndex < 0 || index !== sessionIndex + 1)) || process.cwd());
if (!(await stat(cwd)).isDirectory()) throw new Error('Workspace must be a directory');
const state = initialState();
async function createRenderer() { return createCliRenderer({ exitOnCtrlC: false, backgroundColor: '#181818', consoleMode: 'disabled', screenMode: 'alternate-screen' }); }
let renderer = await createRenderer();
const clipboard = createHostClipboard();
let pi: Pi | undefined;
let closing = false;
let suspended = false;
function mountUi() { return mount(renderer, state, { cwd, demo, submit: text => { void app.submitEditor(text).catch(error => app.fail(error)); }, action: name => { void app.action(name).catch(error => app.fail(error)); } }); }
let ui = mountUi();
const app = new Workbench(state, ui, {
  cwd, demo,
  async quit() {
    if (closing) return;
    closing = true;
    await pi?.close(); await clipboard.dispose();
    renderer.destroy(); await renderer.closed;
  },
  async copy(text) {
    const result = await clipboard.writeText(text);
    if (result.status !== 'written' && !renderer.copyToClipboardOSC52(text)) throw new Error('Clipboard unavailable in this terminal. Use /export instead.');
  },
  async editor(text) {
    const directory = await mkdtemp(join(tmpdir(), 'pi-workbench-editor-'));
    const file = join(directory, 'prompt.md');
    await writeFile(file, text);
    const command = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad.exe' : 'vi');
    try { return await outsideTerminal(async () => { await run([command, file]); return readFile(file, 'utf8'); }); }
    finally { await rm(directory, { recursive: true, force: true }); }
  },
  async native(command) {
    const currentSession = state.sessionFile;
    await pi?.close();
    const directory = await mkdtemp(join(tmpdir(), 'pi-workbench-native-'));
    const extension = join(directory, 'prefill.ts');
    await writeFile(extension, `export default function(pi) { pi.on('session_start', (_event, ctx) => { ctx.ui.setEditorText(${JSON.stringify(command)}); }); }\n`);
    try {
      await outsideTerminal(async () => {
        process.stdout.write('\nNative Pi · press Enter to run the prefilled command. /quit returns to Workbench.\n');
        await run([...piCommand(), ...(currentSession ? ['--session', currentSession] : []), '--extension', extension]);
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
      if (!closing) await connect(currentSession);
    }
  },
  async reload(path) { await pi?.close(); await connect(path); state.notice = 'Pi resources reloaded'; ui.update(); },
});
async function outsideTerminal<T>(work: () => Promise<T>): Promise<T> {
  const draft = ui.editor.plainText;
  const keepAlive = setInterval(() => {}, 1000);
  suspended = true; app.pauseSurface();
  try {
    // Recreate the renderer: OpenTUI suspend() can throw on Bun's Windows raw-mode transition.
    renderer.destroy(); await renderer.closed;
    return await work();
  } finally {
    try {
      if (!closing) { renderer = await createRenderer(); ui = mountUi(); app.replaceSurface(ui); ui.editor.setText(draft); void listFiles(cwd).then(files => ui.setFiles?.(files)).catch(() => {}); }
    } finally { suspended = false; clearInterval(keepAlive); }
  }
}
async function run(command: string[]) {
  const [executable, ...arguments_] = command;
  if (!executable) throw new Error('Executable was not specified');
  await new Promise<void>((done, reject) => {
    const child = spawn(executable, arguments_, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? done() : reject(new Error(`${executable} exited with code ${code}`)));
  });
}
async function connect(path?: string) {
  pi = new Pi(cwd, path || undefined);
  app.attach(pi);
  pi.onEvent = value => app.event(value);
  pi.onError = error => app.disconnected(error);
  await app.start();
}
try {
  const execute = promisify(execFile);
  const branch = await execute('git', ['branch', '--show-current'], { cwd, timeout: 3000 });
  state.workspaceBranch = branch.stdout.trim();
} catch { /* Non-Git projects remain usable. */ }
try { if (demo) await app.start(); else await connect(sessionFile); }
catch (error) { app.fail(error); }
void listFiles(cwd).then(files => ui.setFiles?.(files)).catch(() => {});
process.on('SIGINT', () => { if (!suspended) void app.action('quit').catch(error => app.fail(error)); });
process.on('SIGTERM', () => { void app.action('quit').catch(error => app.fail(error)); });
