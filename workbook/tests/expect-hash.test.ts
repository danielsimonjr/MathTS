import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-hash-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const WB = `cells:\n  - code: "2 + 3"\n    id: a\n`;

describe('mtsw run --expect-hash', () => {
  it('runs when the SHA-256 matches', async () => {
    const file = join(dir, 'ok.mtsw');
    writeFileSync(file, WB, 'utf8');
    const hash = createHash('sha256').update(WB, 'utf8').digest('hex');
    const r = await dispatch(['run', file, '--expect-hash', hash]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('5');
  });

  it('refuses to run on a mismatch', async () => {
    const file = join(dir, 'bad.mtsw');
    writeFileSync(file, WB, 'utf8');
    const r = await dispatch(['run', file, '--expect-hash', '0'.repeat(64)]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/expect-hash mismatch/);
  });
});
