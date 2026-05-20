import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as fns from '../src/index.js';

/**
 * Guards against `docs/reference/functions.md` drifting out of sync with the
 * package's real export surface (EXPANSION_PLAN W11). Every `` `name(` `` token
 * documented in the reference must resolve to a real export.
 */
const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, '../../docs/reference/functions.md');
const doc = readFileSync(docPath, 'utf8');

// Scan the first cell of each table row only — that is the canonical
// function-signature column. Description columns contain math notation
// (`Ei(x)`, `P(a, x)`, …) that must not be mistaken for API names.
const documented = new Set<string>();
for (const line of doc.split('\n')) {
  if (!/^\s*\|/.test(line)) continue;
  const firstCell = line.split('|')[1] ?? '';
  for (const m of firstCell.matchAll(/`([a-zA-Z][a-zA-Z0-9]*)\(/g)) {
    documented.add(m[1]);
  }
}

// Documented names that intentionally map to a differently-named export.
const aliases: Record<string, string> = {
  createUnit: 'factory_createUnit',
};

const exported = new Set(Object.keys(fns));

describe('functions.md ↔ export surface', () => {
  it('extracts a non-trivial set of documented function names', () => {
    expect(documented.size).toBeGreaterThan(100);
  });

  it('every documented function name is a real export', () => {
    const missing: string[] = [];
    for (const name of documented) {
      if (exported.has(name)) continue;
      if (aliases[name] && exported.has(aliases[name])) continue;
      if (exported.has('factory_' + name)) continue;
      missing.push(name);
    }
    expect(missing.sort()).toEqual([]);
  });
});
