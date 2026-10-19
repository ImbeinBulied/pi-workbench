import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { piCommand } from './pi';

export function doctor(): number {
  process.stdout.write('Pi Workbench doctor\n');
  let failures = 0;
  function report(ok: boolean, name: string, detail: string) {
    if (!ok) failures++;
    process.stdout.write(`${ok ? 'OK' : 'FAIL'} ${name}: ${detail}\n`);
  }
  const version = Bun.version.split('.').map(Number);
  const supported = (version[0] ?? 0) > 1 || version[0] === 1 && ((version[1] ?? 0) > 3 || version[1] === 3 && (version[2] ?? 0) >= 14);
  report(supported, 'Bun', `${Bun.version}; requires 1.3.14+`);
  try {
    const command = piCommand();
    const executable = command[0];
    const executableFound = !!executable && (isAbsolute(executable) ? existsSync(executable) : !!Bun.which(executable));
    const cli = command[1];
    report(executableFound && (!cli || existsSync(cli)), 'Pi', executableFound && (!cli || existsSync(cli)) ? 'launcher found (not started)' : 'CLI not found; install Pi or set PI_CLI_PATH');
  } catch {
    report(false, 'Pi', 'launcher not found; install Pi or set PI_CLI_PATH');
  }
  const agent = join(homedir(), '.pi', 'agent');
  const config = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode');
  for (const [name, path] of [
    ['Pi settings', join(agent, 'settings.json')],
    ['Pi authentication', join(agent, 'auth.json')],
    ['Usage cards', join(config, 'usage-limits.jsonc')],
    ['DeepSeek tracker', join(config, 'deepseek-peak.mjs')],
  ]) {
    process.stdout.write(`${existsSync(path) ? 'OK' : 'Optional'} ${name}: ${existsSync(path) ? 'file found' : 'not configured'}\n`);
  }
  process.stdout.write('Configuration presence does not verify credentials, model access, or provider connectivity.\n');
  return failures ? 1 : 0;
}
