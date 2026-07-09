import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let n = 0;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wb-json-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
function fixture(content: string): string {
  const p = join(dir, `wb-${n++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('mtsw export --format json', () => {
  it('emits the executed run report as JSON', async () => {
    const file = fixture('cells:\n  - code: "6 * 7"\n    id: answer\n');
    const res = await dispatch(['export', file, '--format', 'json']);
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(true);
    const cell = parsed.cells.find((c: { id: string }) => c.id === 'answer');
    expect(cell.status).toBe('success');
    expect(cell.output).toContain('42');
  });

  it('honors -o to write the JSON to a file', async () => {
    const file = fixture('cells:\n  - code: "1 + 1"\n    id: two\n');
    const out = join(dir, 'report.json');
    const res = await dispatch(['export', file, '--format', 'json', '-o', out, '--json']);
    expect(res.exitCode).toBe(0);
    const env = JSON.parse(res.stdout);
    expect(env.ok).toBe(true);
    expect(env.data.path).toBe(out);
  });

  it('rejects --no-run (json needs the executed report)', async () => {
    const file = fixture('cells:\n  - code: "1 + 1"\n    id: two\n');
    const res = await dispatch(['export', file, '--format', 'json', '--no-run']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('--no-run');
  });

  it('still rejects an unrecognized format', async () => {
    const file = fixture('cells:\n  - code: "1 + 1"\n    id: two\n');
    const res = await dispatch(['export', file, '--format', 'bogus']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr).toContain('Unknown format');
  });
});
