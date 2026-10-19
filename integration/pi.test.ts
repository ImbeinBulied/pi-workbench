import { test, expect } from 'bun:test';
import { Pi } from '../src/pi';

test('installed Pi answers get_state and closes without a model call', async () => {
  const pi = new Pi(process.cwd());
  try {
    const response = await pi.request('get_state');
    expect(response.success).toBe(true);
    expect(typeof response.data).toBe('object');
  } finally { await pi.close(); }
}, 30000);

test('two live tab backends use independent Pi session IDs', async () => {
  const first = new Pi(process.cwd());
  const second = new Pi(process.cwd());
  try {
    const [left, right] = await Promise.all([first.request('get_state'), second.request('get_state')]);
    expect(left.success).toBe(true); expect(right.success).toBe(true);
    const leftData = left.data;
    const rightData = right.data;
    expect(leftData && typeof leftData === 'object' && 'sessionId' in leftData && typeof leftData.sessionId === 'string').toBe(true);
    expect(rightData && typeof rightData === 'object' && 'sessionId' in rightData && typeof rightData.sessionId === 'string').toBe(true);
    if (leftData && typeof leftData === 'object' && 'sessionId' in leftData && rightData && typeof rightData === 'object' && 'sessionId' in rightData) {
      expect(leftData.sessionId).not.toBe(rightData.sessionId);
    }
  } finally { await Promise.all([first.close(), second.close()]); }
}, 60000);
