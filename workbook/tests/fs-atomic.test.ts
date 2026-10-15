import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from '../src/fs-atomic.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-atomic-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A rename that fails `times` times with `code`, then renames for real. */
function flakyRename(times: number, code: string): typeof renameSync {
  let left = times;
  return ((from: string, to: string) => {
    if (left-- > 0) {
      throw Object.assign(new Error(`${code}: operation not permitted, rename`), { code });
    }
    renameSync(from, to);
  }) as typeof renameSync;
}

describe('writeFileAtomic', () => {
  it('writes the content and leaves no temp file', () => {
    const file = join(dir, 'plain.mtsw');
    writeFileAtomic(file, 'a: 1\n');
    expect(readFileSync(file, 'utf-8')).toBe('a: 1\n');
    expect(readdirSync(dir).filter((n) => n.startsWith('plain.mtsw.'))).toEqual([]);
  });

  it('retries a rename that a reader of the target makes fail with EPERM', () => {
    const file = join(dir, 'busy.mtsw');
    writeFileSync(file, 'old', 'utf-8');
    writeFileAtomic(file, 'new', { rename: flakyRename(3, 'EPERM'), sleepMs: () => {} });
    expect(readFileSync(file, 'utf-8')).toBe('new');
    expect(readdirSync(dir).filter((n) => n.startsWith('busy.mtsw.'))).toEqual([]);
  });

  it('gives up after its attempts, removes the temp file and rethrows the error', () => {
    const file = join(dir, 'stuck.mtsw');
    writeFileSync(file, 'old', 'utf-8');
    expect(() =>
      writeFileAtomic(file, 'new', { rename: flakyRename(1000, 'EBUSY'), sleepMs: () => {} })
    ).toThrow(/EBUSY/);
    expect(readFileSync(file, 'utf-8')).toBe('old');
    expect(readdirSync(dir).filter((n) => n.startsWith('stuck.mtsw.'))).toEqual([]);
  });

  it('does not retry an error that is not a lock (ENOENT)', () => {
    const file = join(dir, 'missing-dir', 'x.mtsw');
    let calls = 0;
    const counting = ((from: string, to: string) => {
      calls++;
      return renameSync(from, to);
    }) as typeof renameSync;
    expect(() => writeFileAtomic(file, 'x', { rename: counting, sleepMs: () => {} })).toThrow();
    expect(calls).toBe(0); // the temp write itself fails first
    const file2 = join(dir, 'enoent.mtsw');
    let n = 0;
    const enoent = ((): void => {
      n++;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }) as unknown as typeof renameSync;
    expect(() => writeFileAtomic(file2, 'x', { rename: enoent, sleepMs: () => {} })).toThrow(
      /ENOENT/
    );
    expect(n).toBe(1);
  });
});
