import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The one fence parser of the repository (the runtime tag follows the language).
import { extractFences } from '../../tools/test/readme-fences.mjs';

const repoRoot = join(import.meta.dirname, '../..');

/**
 * Exports whose declared return type is a Promise (the typings of the built `functions`
 * package, checked 2026-11-13). Each sample that calls one must `await` it.
 */
const ASYNC_EXPORTS = [
  'shapiroWilkTest',
  'chiSquareTest',
  'kolmogorovSmirnovTest',
  'mannWhitneyTest',
  'casSimplify',
  'casDerivative',
  'casExpand',
  'casFactor',
  'distanceMatrix',
  'pageRank',
  'betweennessCentrality',
  'eigenvectorCentrality',
  'parallelGaussQuad',
  'parallelRomberg',
  'mapBinaryF64',
  'loadWasm',
  'evaluateScalarPopulation',
  'runScalarSearch',
];

const DOCS = [
  'statistics/README.md',
  'README.md',
  'functions/README.md',
  'parallel/README.md',
  'docs/advanced.md',
];

/** Lines of the fenced samples that call an async export without `await`. */
function unawaitedCalls(markdown: string): string[] {
  const found: string[] = [];
  for (const fence of extractFences(markdown)) {
    for (const line of fence.code.split('\n')) {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*(import|export)\b/.test(code)) continue;
      for (const name of ASYNC_EXPORTS) {
        const call = new RegExp('(^|[^\\w.])' + name + '\\(');
        if (call.test(code) && !/\bawait\b/.test(code)) found.push(`${name}: ${line.trim()}`);
      }
    }
  }
  return found;
}

describe('#900 — samples await Promise-returning exports', () => {
  for (const rel of DOCS) {
    it(`${rel} has no unawaited call to an async export`, () => {
      const markdown = readFileSync(join(repoRoot, rel), 'utf8');
      expect(unawaitedCalls(markdown)).toEqual([]);
    });
  }

  it('statistics/README.md shows the awaited form of a Promise-returning test', () => {
    const markdown = readFileSync(join(repoRoot, 'statistics/README.md'), 'utf8');
    const awaited = extractFences(markdown).some((f) => /await\s+shapiroWilkTest\(/.test(f.code));
    expect(awaited).toBe(true);
  });
});
