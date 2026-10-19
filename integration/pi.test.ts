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
