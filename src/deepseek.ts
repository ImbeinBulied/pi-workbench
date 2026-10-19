import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface DeepSeekPeak {
  label: string;
  next: string;
  inPeak: boolean;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeDeepSeekPeak(value: unknown): DeepSeekPeak | null {
  if (value === null) return null;
  const phase = record(value);
  if (typeof phase.label !== 'string' || typeof phase.next !== 'string') return null;
  return { label: phase.label, next: phase.next, inPeak: phase.inPeak === true };
}

/** Read the same local phase calculation configured for OpenCode's DSH plugin. */
export async function loadDeepSeekPeak(now = Date.now()): Promise<DeepSeekPeak | null | undefined> {
  const configRoot = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const pluginPath = join(configRoot, 'opencode', 'deepseek-peak.mjs');
  const script = "import { pathToFileURL } from 'node:url'; const plugin = await import(pathToFileURL(process.argv[1]).href); process.stdout.write(JSON.stringify(plugin.deepseekPeakAt(Number(process.argv[2]))));";
  try {
    const { stdout } = await promisify(execFile)('node', ['--input-type=module', '-e', script, pluginPath, String(now)], { timeout: 3000, windowsHide: true });
    return normalizeDeepSeekPeak(JSON.parse(stdout));
  } catch {
    return undefined;
  }
}
