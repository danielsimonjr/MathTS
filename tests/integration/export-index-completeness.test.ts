import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as expression from '../../expression/src/index.js';
import * as workbook from '../../workbook/src/index.js';
import * as plot from '../../plot/src/index.js';

const BEGIN = '<!-- BEGIN GENERATED EXPORT INDEX (tools/generate-functions-reference.mjs) -->';
const END = '<!-- END GENERATED EXPORT INDEX -->';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CASES = [
  {
    pkg: 'expression',
    mod: expression,
    apiDoc: 'docs/api/expression.md',
    forbiddenInIndex: [] as string[],
  },
  {
    pkg: 'workbook',
    mod: workbook,
    apiDoc: 'docs/api/workbook.md',
    forbiddenInIndex: ['runCommand'],
  },
  {
    pkg: 'plot',
    mod: plot,
    apiDoc: 'docs/api/plot.md',
    forbiddenInIndex: ['renderToFile'],
  },
] as const;

function indexSlice(doc: string): string {
  const bi = doc.indexOf(BEGIN);
  const ei = doc.indexOf(END);
  expect(bi, 'BEGIN marker missing — run `npm run docs:functions`').not.toBe(-1);
  expect(ei, 'END marker missing — run `npm run docs:functions`').not.toBe(-1);
  return doc.slice(bi, ei + END.length);
}

function backtickedNames(slice: string): Set<string> {
  return new Set([...slice.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
}

function bannerTotal(slice: string, pkg: string): number {
  const m = slice.match(new RegExp(`@danielsimonjr/mathts-${pkg}[^\n]*\\((\\d+) exports\\)`));
  expect(m, 'export count in generated banner').not.toBeNull();
  return Number(m![1]);
}

describe('export-index completeness (expression, workbook, plot)', () => {
  for (const { pkg, mod, apiDoc, forbiddenInIndex } of CASES) {
    const docPath = resolve(REPO, apiDoc);
    const doc = readFileSync(docPath, 'utf8');
    const slice = indexSlice(doc);
    const names = backtickedNames(slice);
    const exportKeys = Object.keys(mod);

    it(`${pkg}: generated index lists every public export between markers`, () => {
      const missing = exportKeys.filter((name) => !names.has(name));
      expect(
        missing,
        `Missing from index between markers — run \`npm run docs:functions\`: ${missing.join(', ')}`
      ).toEqual([]);
    });

    it(`${pkg}: banner export count matches Object.keys length`, () => {
      expect(bannerTotal(slice, pkg)).toBe(exportKeys.length);
    });

    it(`${pkg}: non-dot entry points stay out of the generated index`, () => {
      for (const forbidden of forbiddenInIndex) {
        expect(
          names.has(forbidden),
          `\`${forbidden}\` must not appear in the \`.\` export index`
        ).toBe(false);
      }
    });
  }
});
