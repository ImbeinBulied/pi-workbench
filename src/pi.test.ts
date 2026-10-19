import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { piCommand } from './pi';

test('managed Pi uses its stable launcher so version updates are picked up automatically', async () => {
  const home = await mkdtemp(join(tmpdir(), 'piw-home-'));
  const launcher = join(home, '.pi', 'agent', 'bin', 'pi-launcher.js');
  try {
    await mkdir(dirname(launcher), { recursive: true });
    await writeFile(launcher, '// Pi managed launcher');
    expect(piCommand(home)).toEqual(['node', launcher]);
  } finally { await rm(home, { recursive: true, force: true }); }
});
