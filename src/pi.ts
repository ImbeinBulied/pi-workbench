import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { JsonLines, object, str } from './state';

export function piCommand(homeDirectory = homedir()): string[] {
  const override = process.env.PI_CLI_PATH;
  if (override) return /\.[cm]?js$/.test(override) ? ['node', resolve(override)] : [override];
  const agentRoot = join(homeDirectory, '.pi', 'agent');
  const launcher = join(agentRoot, 'bin', 'pi-launcher.js');
  if (existsSync(launcher)) return ['node', launcher];
  const root = join(agentRoot, 'install');
  const current = join(root, 'current-version');
  if (existsSync(current)) {
    const version = readFileSync(current, 'utf8').trim();
    if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version)) throw new Error('Invalid managed Pi version');
    const cli = join(root, 'releases', version, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'bundle', 'cli.js');
    if (existsSync(cli)) return ['node', cli];
  }
  if (process.platform === 'win32') throw new Error('Set PI_CLI_PATH to your Pi cli.js or executable. Managed Pi was not found.');
  return ['pi'];
}

export class Pi {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<string, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private nextId = 0;
  private closing = false;
  private failed: Error | undefined;
  private exited: Promise<void>;
  onEvent: (value: unknown) => void = () => {};
  onError: (error: Error) => void = () => {};
  constructor(cwd: string, sessionFile?: string) {
    const [command, ...args] = piCommand();
    if (!command) throw new Error('Pi executable was not resolved');
    this.child = spawn(command, [...args, '--mode', 'rpc', ...(sessionFile ? ['--session', sessionFile] : [])], { cwd, stdio: 'pipe', windowsHide: true });
    const parser = new JsonLines(value => {
      const event = object(value);
      if (event.type === 'response') {
        const pending = this.pending.get(str(event.id));
        if (pending) { clearTimeout(pending.timer); this.pending.delete(str(event.id)); pending.resolve(event); }
      }
      this.onEvent(value);
    });
    this.child.stdout.on('data', (chunk: Buffer) => { try { parser.push(chunk); } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); this.child.kill(); } });
    // Drain diagnostics so the subprocess cannot block; never copy potential secrets into the UI.
    this.child.stderr.on('data', () => {});
    this.child.stdin.on('error', error => this.fail(error));
    this.child.on('error', error => this.fail(error));
    this.exited = new Promise(resolve => this.child.on('close', code => {
      if (!this.closing) this.fail(new Error(`Pi exited (${code ?? 'signal'}). Run pi directly to inspect its diagnostics.`));
      resolve();
    }));
  }
  private fail(error: Error) {
    this.failed = error;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    if (!this.closing) this.onError(error);
  }
  send(record: Record<string, unknown>) {
    if (this.failed) throw this.failed;
    if (this.closing) throw new Error('Pi is closing');
    this.child.stdin.write(JSON.stringify(record) + '\n');
  }
  request(type: string, fields: Record<string, unknown> = {}, timeoutMs = 20000): Promise<Record<string, unknown>> {
    const id = String(++this.nextId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Pi did not answer ${type} within ${timeoutMs / 1000} seconds`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ ...fields, type, id }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async close() {
    if (this.closing) return this.exited;
    this.closing = true;
    this.fail(new Error('Pi connection closed'));
    this.child.stdin.end();
    const timer = setTimeout(() => this.child.kill(), 1500);
    await this.exited;
    clearTimeout(timer);
  }
}
