import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  scalar,
  searchScalars,
  type SearchScalarsResult,
} from '@danielsimonjr/mathts-functions';
import { scalarCanonicalKey } from '@danielsimonjr/mathts-expression';

async function runSearch(parallel: boolean): Promise<SearchScalarsResult> {
  const n = 100;
  const col = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    col[i] = -1 + (2 * i) / (n - 1);
  }
  const planted = scalar.op('+', [
    scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]),
    scalar.symbol('x'),
  ]);
  const { values: observed } = compileScalar(planted, { variables: ['x'] }).evaluate([col]);

  const grammar = {
    variables: ['x'],
    parameters: [] as string[],
    binary: ['+', '*', '^'] as const,
    unary: [] as string[],
    literals: [1] as number[],
    maxSize: 7,
  };

  const rng = createSeededRng(7);
  const iter = searchScalars(
    { variables: ['x'], columns: [col], observed },
    {
      grammar,
      rng,
      populationSize: 12,
      maxEvaluations: 400,
      tournamentP: 0.982,
      optimizeProbability: 0,
      ...(parallel ? { parallel: { timeoutMs: 30_000 } } : {}),
    }
  );
  let result!: SearchScalarsResult;
  while (true) {
    const step = await iter.next();
    if (step.done) {
      result = step.value as SearchScalarsResult;
      break;
    }
  }
  return result;
}

describe('searchScalars parallel vs serial', () => {
  it('same seed yields equal front keys and losses', async () => {
    const serial = await runSearch(false);
    const parallelOn = await runSearch(true);

    const keys = (r: SearchScalarsResult) => r.front.map((row) => scalarCanonicalKey(row.item));
    const losses = (r: SearchScalarsResult) => r.front.map((row) => row.loss);

    expect(keys(parallelOn)).toEqual(keys(serial));
    expect(losses(parallelOn).every((l, i) => Object.is(l, losses(serial)[i]!))).toBe(true);
  }, 120_000);
});
