/**
 * PR 8 — every `typedSpecial` export must name a test file that cites an external
 * oracle (mpmath / scipy / DLMF / Abramowitz / closed form).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typedSpecial } from '../src/typed/special.js';
import inventory from './special-oracle-inventory.json' with { type: 'json' };

export interface SpecialOracleInventoryRow {
  test: string;
  substring: string;
}

const ALLOWED_NEEDLES = ['mpmath', 'scipy', 'DLMF', 'Abramowitz', 'closed form'] as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

/** Keys of `live` that `rows` does not list. Pure, so a test can run it on a doctored copy. */
export function missingInventoryKeys(
  live: Readonly<Record<string, unknown>>,
  rows: Readonly<Record<string, unknown>>
): string[] {
  return Object.keys(live)
    .filter((k) => !(k in rows))
    .sort();
}

describe('typedSpecial external-oracle inventory', () => {
  const keys = Object.keys(typedSpecial).sort();

  it('inventory covers every typedSpecial key', () => {
    const missing = missingInventoryKeys(typedSpecial, inventory);
    expect(missing, `add rows to special-oracle-inventory.json`).toEqual([]);
  });

  it('fails when a key is deleted from the inventory', () => {
    const { airyAi: _removed, ...withoutAiry } = inventory as Record<string, unknown>;
    expect(missingInventoryKeys(typedSpecial, withoutAiry)).toEqual(['airyAi']);
  });

  it('inventory has no stray keys', () => {
    const extra = Object.keys(inventory).filter((k) => !(k in typedSpecial));
    expect(extra).toEqual([]);
  });

  for (const key of keys) {
    it(`${key} → cited test file contains an allowed oracle tag`, () => {
      const row = (inventory as Record<string, SpecialOracleInventoryRow>)[key]!;
      expect(ALLOWED_NEEDLES as readonly string[]).toContain(row.substring);
      const path = join(repoRoot, row.test);
      expect(existsSync(path), `${row.test} must exist`).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text.includes(row.substring), `${row.test} must mention ${row.substring}`).toBe(true);
      const keyRe = new RegExp(`\\b${key}\\s*\\(`);
      expect(keyRe.test(text), `${row.test} should call ${key}(...)`).toBe(true);
    });
  }
});
