import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { State } from './state';

type UsageCard = State['usageCards'][number];
type RecordValue = Record<string, unknown>;
type UsageWindow = { kind: string; value: RecordValue; percent: number | undefined; reset: number | undefined };
type AvailableUsageWindow = UsageWindow & { percent: number };

const configPath = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode', 'usage-limits.jsonc');
const authFallbacks = [
  join(homedir(), '.local', 'share', 'opencode', 'auth.json'),
  join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode', 'auth.json'),
];

function object(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function jsonc(source: string): unknown {
  let output = '';
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; output += char; continue; }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') output += '\n';
        i++;
      }
      i++;
      continue;
    }
    if (char === ',') {
      let lookahead = i + 1;
      while (/\s/.test(source[lookahead] ?? '')) lookahead++;
      if (source[lookahead] === '}' || source[lookahead] === ']') continue;
    }
    output += char;
  }
  return JSON.parse(output);
}

async function readJson(path: string): Promise<RecordValue | undefined> {
  try { return object(JSON.parse(await readFile(path, 'utf8'))); }
  catch { return undefined; }
}

function localPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const path = value.trim().replace(/^~(?=$|[\\/])/, homedir());
  return isAbsolute(path) ? path : resolve(dirname(configPath), path);
}

async function authJson(config: RecordValue): Promise<RecordValue | undefined> {
  const path = localPath(config.authPath);
  if (path) return readJson(path);
  for (const fallback of authFallbacks) {
    const data = await readJson(fallback);
    if (data) return data;
  }
  return undefined;
}

function secret(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const env = /^\{env:([A-Za-z_][A-Za-z\d_]*)\}$/.exec(value.trim());
  const result = env ? process.env[env[1]!] : value;
  return typeof result === 'string' && result.trim() ? result.trim() : undefined;
}

function providerSecret(data: RecordValue | undefined, provider: string): string | undefined {
  if (!data) return undefined;
  const nested = object(data[provider]);
  const aliases = provider === 'opencode-go' ? [nested, object(data.opencode), data] : [data, nested];
  for (const source of aliases) {
    for (const key of ['key', 'apiKey']) {
      const value = secret(source[key]);
      if (value) return value;
    }
  }
  return undefined;
}

async function getJson(url: string, headers: Record<string, string>): Promise<RecordValue> {
  const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(12_000), redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error('Response too large');
  return object(JSON.parse(text));
}

function percent(value: unknown): number | undefined {
  const n = number(value);
  return n === undefined ? undefined : Math.max(0, Math.min(100, n));
}

function resetTime(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const n = number(value);
  return n === undefined ? undefined : n > 1e12 ? n : n * 1000;
}

function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'now';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) {
    if (remainder === 0) return `${hours}h`;
    if (remainder === 30) return `${hours}.5h`;
    return `${hours}h ${remainder}m`;
  }
  const days = Math.floor(hours / 24);
  const hourRemainder = hours % 24;
  return hourRemainder === 0 ? `${days}d` : `${days}d ${hourRemainder}h`;
}

function timeLeft(timestamp: number | undefined, now: Date): string | undefined {
  return timestamp === undefined ? undefined : `${duration(Math.ceil((timestamp - now.getTime()) / 1000))} left`;
}

function resetLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function clockTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function monthlyCycleStart(reset: number): number {
  const end = new Date(reset);
  const start = new Date(end);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(end.getUTCDate(), lastDay));
  return start.getTime();
}

function pacingDetails(used: number | undefined, reset: number | undefined, cycleStart: number | undefined, now: Date): string[] {
  if (used === undefined || reset === undefined) return [];
  const remainingDays = Math.max(0, (reset - now.getTime()) / 86_400_000);
  const lines = remainingDays > 0 ? [`Remaining ${((100 - used) / remainingDays).toFixed(1)}%/day`] : [];
  if (cycleStart !== undefined && reset > cycleStart) {
    const elapsedPercent = Math.max(0, Math.min(100, (now.getTime() - cycleStart) / (reset - cycleStart) * 100));
    const difference = used - elapsedPercent;
    lines.push(Math.abs(difference) < 0.05 ? 'On pace' : `${difference > 0 ? 'Over' : 'Under'} pace by ${Math.abs(difference).toFixed(1)}%`);
  }
  return lines;
}

function windowName(value: unknown): string {
  const seconds = number(value) ?? 0;
  if (seconds >= 604_000 && seconds <= 605_000) return 'Weekly';
  if (seconds >= 86_000 && seconds <= 87_000) return 'Daily';
  if (seconds >= 17_000 && seconds <= 18_100) return '5h';
  return seconds > 0 ? `${Math.max(1, Math.round(seconds / 3600))}h` : 'Usage';
}

export function codexUsageDisplay(primary: RecordValue, secondary: RecordValue, now = new Date()): { percent?: number; details: string[] } {
  const windows = [primary, secondary].map<UsageWindow>(value => ({
    kind: windowName(value.limit_window_seconds).toLowerCase(),
    value,
    percent: percent(value.used_percent),
    reset: resetTime(value.reset_at),
  })).filter((window): window is AvailableUsageWindow => window.percent !== undefined);
  const main = windows.find(window => window.kind === 'weekly') ?? windows[0];
  if (!main || main.percent === undefined) return { percent: undefined, details: [] };
  const shortLabel = (kind: string) => kind === 'rolling' || kind === '5h' ? '5h' : kind === 'weekly' ? 'Wk' : kind;
  const otherWindows = windows.filter(window => window !== main);
  const lines = [
    otherWindows.length ? otherWindows.map(window => `${shortLabel(window.kind)} ${Math.round(window.percent)}%`).join(' · ') : undefined,
    otherWindows.some(window => window.reset !== undefined) ? otherWindows.filter((window): window is AvailableUsageWindow & { reset: number } => window.reset !== undefined).map(window => `${shortLabel(window.kind)} ${timeLeft(window.reset, now)}`).join(' · ') : undefined,
    main.reset === undefined ? undefined : `Resets: ${resetLabel(main.reset)}`,
    timeLeft(main.reset, now),
    ...pacingDetails(main.percent, main.reset, main.kind === 'weekly' && main.reset !== undefined ? main.reset - 7 * 86_400_000 : undefined, now),
  ].filter((line): line is string => Boolean(line));
  return { percent: main.percent, details: lines };
}

export function openCodeGoUsageDisplay(usage: RecordValue, now = new Date()): { percent?: number; details: string[] } {
  const windows = ['rolling', 'weekly', 'monthly'].map<UsageWindow>(kind => ({
    kind,
    value: object(usage[kind]),
    percent: percent(object(usage[kind]).percent),
    reset: resetTime(object(usage[kind]).resetsAt),
  })).filter((window): window is AvailableUsageWindow => window.percent !== undefined);
  const main = windows.find(window => window.kind === 'monthly') ?? windows.find(window => window.kind === 'weekly') ?? windows[0];
  if (!main || main.percent === undefined) return { percent: undefined, details: [] };
  const secondary = windows.filter(window => window !== main);
  const shortLabel = (kind: string) => kind === 'rolling' ? '5h' : kind === 'weekly' ? 'Wk' : kind;
  const usageLine = secondary.length ? secondary.map(window => `${shortLabel(window.kind)} ${Math.round(window.percent)}%`).join(' · ') : undefined;
  const resetLine = secondary.map(window => {
    if (window.kind === 'rolling') {
      if (window.reset === undefined || window.reset <= now.getTime() || window.percent === 0) return '5h 1m left';
      const remaining = Math.min(18_000, Math.ceil((window.reset - now.getTime()) / 1000));
      return `5h ${duration(remaining)} left (resets ${clockTime(window.reset)})`;
    }
    return window.reset === undefined ? undefined : `${shortLabel(window.kind)} ${timeLeft(window.reset, now)}`;
  }).filter((line): line is string => Boolean(line));
  const lines = [
    usageLine,
    resetLine.length ? resetLine.join(' · ') : undefined,
    main.reset === undefined ? undefined : `Resets: ${resetLabel(main.reset)}`,
    timeLeft(main.reset, now),
    ...pacingDetails(main.percent, main.reset, main.kind === 'monthly' && main.reset !== undefined ? monthlyCycleStart(main.reset) : undefined, now),
  ].filter((line): line is string => Boolean(line));
  return { percent: main.percent, details: lines };
}

function updatedLine(now: Date): string { return `Updated ${now.toLocaleTimeString()}`; }

function unavailable(id: string, label: string, error: unknown): UsageCard {
  const detail = error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? error.message : 'Credentials or network unavailable';
  return { id, label, headline: 'Unavailable', details: [detail], updatedAt: updatedLine(new Date()), error: true };
}

async function codexCard(config: RecordValue, label: string): Promise<UsageCard> {
  try {
    const auth = await authJson(config);
    const tokens = object(auth?.tokens);
    const access = secret(tokens.access_token);
    const account = secret(tokens.account_id);
    if (!access || !account) throw new Error('No credentials');
    const data = await getJson('https://chatgpt.com/backend-api/wham/usage', {
      Accept: 'application/json', Authorization: `Bearer ${access}`, 'ChatGPT-Account-Id': account, 'User-Agent': 'opencode-usage-limits',
    });
    const limits = object(data.rate_limit);
    const primary = object(limits.primary_window);
    const secondary = object(limits.secondary_window);
    const display = codexUsageDisplay(primary, secondary);
    if (display.details.length === 0) throw new Error('No usage windows');
    const now = new Date();
    return { id: 'codex', label, headline: display.percent === undefined ? 'Usage' : `${Math.round(display.percent)}%`, percent: display.percent, details: display.details, updatedAt: updatedLine(now) };
  } catch (error) { return unavailable('codex', label, error); }
}

async function openCodeGoCard(config: RecordValue, label: string): Promise<UsageCard> {
  try {
    const key = providerSecret(await authJson(config), 'opencode-go') || secret(config.apiKey);
    if (!key) throw new Error('No credentials');
    const data = await getJson('https://opencode.ai/zen/go/v1/usage', { Accept: 'application/json', Authorization: `Bearer ${key}` });
    const usage = object(data.usage);
    const display = openCodeGoUsageDisplay(usage);
    if (display.percent === undefined || display.details.length === 0) throw new Error('No usage windows');
    const now = new Date();
    return { id: 'opencode-go', label, headline: `${Math.round(display.percent)}%`, percent: display.percent, details: display.details, updatedAt: updatedLine(now) };
  } catch (error) { return unavailable('opencode-go', label, error); }
}

function commandCodeIdentity(data: RecordValue): string | undefined {
  if (data.success === false || object(data.data).success === false) return undefined;
  const scope = object(data.data);
  const source = Object.keys(scope).length ? scope : data;
  const org = object(source.org ?? source.organization);
  const orgValue = source.org ?? source.organization;
  if (orgValue !== undefined && orgValue !== null) return typeof org.id === 'string' && org.id.trim() ? org.id : undefined;
  return typeof object(source.user).id === 'string' ? '' : undefined;
}

async function commandCodeCard(config: RecordValue, label: string): Promise<UsageCard> {
  try {
    const key = providerSecret(await authJson(config), 'commandcode') || secret(config.apiKey);
    if (!key) throw new Error('No credentials');
    const headers = { Accept: 'application/json', Authorization: `Bearer ${key}` };
    const identity = await getJson('https://api.commandcode.ai/alpha/whoami?limits=1', headers);
    const orgId = commandCodeIdentity(identity);
    if (orgId === undefined) throw new Error('Invalid account');
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
    const [creditsPayload, summary] = await Promise.all([
      getJson(`https://api.commandcode.ai/alpha/billing/credits${query}`, headers),
      getJson(`https://api.commandcode.ai/alpha/usage/summary${query}`, headers).catch((): RecordValue => ({})),
    ]);
    const credits = object(creditsPayload.credits);
    const parts = ['monthlyCredits', 'purchasedCredits', 'freeCredits'].map(key => number(credits[key])).filter((value): value is number => value !== undefined);
    const remaining = parts.length === 3 ? parts.reduce((sum, value) => sum + value, 0) : undefined;
    const spent = number(summary.totalCredits ?? summary.totalCost);
    if (remaining === undefined && spent === undefined) throw new Error('No credit data');
    const limits = object(creditsPayload.windowLimits);
    const fiveHour = object(limits.fiveHour);
    const weekly = object(limits.weekly);
    const details = [
      remaining === undefined ? undefined : `Available credits  $${remaining.toFixed(2)}`,
      spent === undefined ? undefined : `Spent: $${spent.toFixed(2)}`,
      spent === undefined ? undefined : 'Last 30 days',
      percent(number(fiveHour.used) !== undefined && number(fiveHour.cap) ? (number(fiveHour.used)! / number(fiveHour.cap)!) * 100 : undefined) === undefined
        ? undefined : `5h ${Math.round(percent((number(fiveHour.used)! / number(fiveHour.cap)!) * 100)!)}%`,
      percent(number(weekly.used) !== undefined && number(weekly.cap) ? (number(weekly.used)! / number(weekly.cap)!) * 100 : undefined) === undefined
        ? undefined : `Weekly ${Math.round(percent((number(weekly.used)! / number(weekly.cap)!) * 100)!)}%`,
    ].filter((line): line is string => Boolean(line));
    const now = new Date();
    return { id: 'commandcode', label, headline: remaining === undefined ? 'Credits' : `$${remaining.toFixed(2)}`, details: [...details, updatedLine(now)], updatedAt: updatedLine(now) };
  } catch (error) { return unavailable('commandcode', label, error); }
}

export async function loadUsageCards(): Promise<UsageCard[]> {
  let config: RecordValue;
  try { config = object(jsonc(await readFile(configPath, 'utf8'))); }
  catch { return []; }
  if (config.enabled === false) return [];
  const providers = object(config.providers);
  const cards: Promise<UsageCard>[] = [];
  for (const [id, fallback, load] of [
    ['codex', 'ChatGPT (Codex)', codexCard],
    ['opencode-go', 'OpenCode Go', openCodeGoCard],
    ['commandcode', 'CommandCode', commandCodeCard],
  ] as const) {
    const provider = object(providers[id]);
    if (provider.enabled === false || provider.showSidebarBar === false) continue;
    const label = typeof provider.label === 'string' && provider.label.trim() ? provider.label.trim() : fallback;
    cards.push(load(provider, label));
  }
  return Promise.all(cards);
}
