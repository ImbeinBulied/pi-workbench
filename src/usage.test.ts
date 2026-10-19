import { test, expect } from 'bun:test';
import { codexUsageDisplay, openCodeGoUsageDisplay } from './usage';

test('Codex sidebar matches the weekly card with short-window usage, reset, and pace rows', () => {
  const now = Date.UTC(2026, 9, 19, 12);
  const weeklyReset = Date.UTC(2026, 9, 23, 0);
  const rollingReset = Date.UTC(2026, 9, 19, 16, 3);
  const display = codexUsageDisplay(
    { used_percent: 5, limit_window_seconds: 18_000, reset_at: rollingReset / 1000 },
    { used_percent: 55, limit_window_seconds: 604_800, reset_at: weeklyReset / 1000 },
    new Date(now),
  );
  const resetLabel = new Date(weeklyReset).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

  expect(display.percent).toBe(55);
  expect(display.details).toEqual([
    '5h 5%',
    '5h 4h 3m left',
    `Resets: ${resetLabel}`,
    '3d 12h left',
    'Remaining 12.9%/day',
    'Over pace by 5.0%',
  ]);
});

test('Codex sidebar falls back to its first available window when no weekly window is returned', () => {
  const display = codexUsageDisplay(
    { used_percent: 5, limit_window_seconds: 18_000 },
    { used_percent: 33, limit_window_seconds: 86_400 },
    new Date(Date.UTC(2026, 9, 19, 12)),
  );
  expect(display.percent).toBe(5);
});

test('OpenCode Go sidebar matches the monthly card and secondary-window reset rows', () => {
  const now = Date.UTC(2026, 9, 19, 12);
  const monthlyReset = Date.UTC(2026, 10, 10, 22, 45);
  const display = openCodeGoUsageDisplay({
    rolling: { percent: 0, resetsAt: new Date(now).toISOString() },
    weekly: { percent: 0, resetsAt: new Date(Date.UTC(2026, 9, 26, 5)).toISOString() },
    monthly: { percent: 18, resetsAt: new Date(monthlyReset).toISOString() },
  }, new Date(now));
  const resetLabel = new Date(monthlyReset).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

  expect(display.percent).toBe(18);
  expect(display.details).toEqual([
    '5h 0% · Wk 0%',
    '5h 1m left · Wk 6d 17h left',
    `Resets: ${resetLabel}`,
    '22d 10h left',
    'Remaining 3.7%/day',
    'Under pace by 9.6%',
  ]);
});
