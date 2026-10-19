import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('doctor reports missing Pi without opening a terminal UI or revealing environment secrets', async () => {
  const home = await mkdtemp(join(tmpdir(), 'piw-doctor-'));
  try {
    const result = Bun.spawnSync([process.execPath, 'src/cli.ts', 'doctor'], {
      env: { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, 'config'), PI_CLI_PATH: join(home, 'missing-pi.js'), OPENAI_API_KEY: 'secret-must-not-appear' },
      stdout: 'pipe', stderr: 'pipe',
    });
    const output = result.stdout.toString() + result.stderr.toString();
    expect(output).toContain('Pi Workbench doctor');
    expect(output).toContain('FAIL Pi');
    expect(output).toContain('Optional');
    expect(output).not.toContain('secret-must-not-appear');
    expect(output).not.toContain('\u001b[');
    expect(result.exitCode).toBe(1);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('doctor accepts an existing Pi CLI and detects optional sidebar configuration', async () => {
  const home = await mkdtemp(join(tmpdir(), 'piw-doctor-'));
  try {
    const config = join(home, 'config');
    await mkdir(join(config, 'opencode'), { recursive: true });
    await writeFile(join(config, 'opencode', 'usage-limits.jsonc'), '{}');
    const cli = join(home, 'pi.js');
    await writeFile(cli, '');
    const result = Bun.spawnSync([process.execPath, 'src/cli.ts', 'doctor'], {
      env: { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: config, PI_CLI_PATH: cli }, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.stdout.toString()).toContain('OK Pi');
    expect(result.stdout.toString()).toContain('OK Usage cards');
    expect(result.exitCode).toBe(0);
  } finally { await rm(home, { recursive: true, force: true }); }
});

test.skipIf(process.platform !== 'win32')('installer can register a launcher twice without modifying PATH or requiring dependency downloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'piw-install-'));
  const userPath = () => Bun.spawnSync(['powershell.exe', '-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path', 'User')"], { stdout: 'pipe', stderr: 'pipe' }).stdout.toString();
  const before = userPath();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = Bun.spawnSync(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'install.ps1', '-InstallDirectory', directory, '-NoPath', '-SkipDependencies'], { stdout: 'pipe', stderr: 'pipe' });
      expect(result.exitCode).toBe(0);
    }
    const shim = await readFile(join(directory, 'piw.cmd'), 'utf8');
    expect(shim).toContain(resolve('piw.cmd'));
    const help = Bun.spawnSync(['cmd.exe', '/d', '/c', join(directory, 'piw.cmd'), '--help'], { stdout: 'pipe', stderr: 'pipe' });
    expect(help.exitCode).toBe(0);
    expect(help.stdout.toString()).toContain('Usage: piw');
    expect(userPath()).toBe(before);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
