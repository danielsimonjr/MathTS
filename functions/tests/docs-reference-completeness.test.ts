import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as fns from '@danielsimonjr/mathts-functions';

/**
 * GC2 — drift guard. Every public export of @danielsimonjr/mathts-functions must
 * appear in docs/reference/functions.md (the generated export index keeps it
 * complete). If this fails, run `npm run docs:functions`.
 */
describe('GC2: functions.md export-reference completeness', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const docPath = resolve(here, '..', '..', 'docs', 'reference', 'functions.md');
  const doc = readFileSync(docPath, 'utf8');
  const documented = new Set([...doc.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));

  it('documents every public export', () => {
    const missing = Object.keys(fns).filter((name) => !documented.has(name));
    expect(missing, `Undocumented exports — run \`npm run docs:functions\`: ${missing.join(', ')}`).toEqual(
      []
    );
  });
});
