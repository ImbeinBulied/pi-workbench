import { test, expect } from 'bun:test';
import { normalizeDeepSeekPeak } from './deepseek';

test('normalizes DSH peak tracker data for the sidebar', () => {
  expect(normalizeDeepSeekPeak({ label: 'Off-peak', next: 'Peak in 6h 43m', inPeak: false }))
    .toEqual({ label: 'Off-peak', next: 'Peak in 6h 43m', inPeak: false });
  expect(normalizeDeepSeekPeak({ label: 'Peak', next: 'Off-peak in 15m', inPeak: true }))
    .toEqual({ label: 'Peak', next: 'Off-peak in 15m', inPeak: true });
  expect(normalizeDeepSeekPeak(null)).toBeNull();
  expect(normalizeDeepSeekPeak({ inPeak: false })).toBeNull();
});
