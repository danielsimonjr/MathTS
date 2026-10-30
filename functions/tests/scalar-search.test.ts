import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarGrammar,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  fitScalarParameters,
  numericallyEquivalent,
  searchScalars,
  simplifyScalar,
  type SearchProgress,
  type ScalarSearchResult,
} from '../src/index.js';

const b = createScalarBuilder();

function linspace(n: number, lo: number, hi: number): Float64Array {
  const out = new Float64Array(n);
  if (n === 1) {
    out[0] = lo;
    return out;
  }
  const step = (hi - lo) / (n - 1);
  for (let i = 0; i < n; i += 1) {
    out[i] = lo + step * i;
  }
  return out;
}

async function runSearch(
  opts: Parameters<typeof searchScalars>[1] & { problem: Parameters<typeof searchScalars>[0] }
): Promise<{ progress: SearchProgress[]; result: ScalarSearchResult; maxEvaluationsUsed: number }> {
  const { problem, ...searchOpts } = opts;
  const gen = searchScalars(problem, searchOpts);
  const progress: SearchProgress[] = [];
  let result: ScalarSearchResult | undefined;
  while (true) {
    const step = await gen.next();
    if (step.done) {
      result = step.value;
      break;
    }
    progress.push(step.value);
  }
  return { progress, result: result!, maxEvaluationsUsed: result!.evaluations };
}

function frontKeys(result: ScalarSearchResult): string[] {
  return result.front.map((row) => scalarCanonicalKey(row.item));
}

const quadGrammar: ScalarGrammar = {
  variables: ['x'],
  binary: ['+', '*', '^'],
  unary: [],
  literals: [1],
  maxSize: 7,
};

const plantedQuad = b.op('+', [b.op('*', [b.symbol('x'), b.symbol('x')]), b.symbol('x')]);

/** Recorded evaluation budget that rediscovers `x^2 + x` with seed 7. */
export const QUAD_MAX_EVALUATIONS = 20_000;

describe('searchScalars', () => {
  it('rediscovers x^2 + x with seed 7 within evaluation budget', async () => {
    const x = linspace(20, -1, 1);
    const observed = compileScalar(plantedQuad, { variables: ['x'] }).evaluate([x]).values;
    const { result, maxEvaluationsUsed } = await runSearch({
      problem: { variables: ['x'], columns: [x], observed },
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: QUAD_MAX_EVALUATIONS,
      tournamentP: 0.982,
    });
    expect(maxEvaluationsUsed).toBeLessThanOrEqual(QUAD_MAX_EVALUATIONS);
    const best = result.front.reduce((a, c) => (c.loss < a.loss ? c : a), result.front[0]!);
    const equiv = numericallyEquivalent(best.item, plantedQuad, {
      domain: { x: [-1, 1] },
      rng: createSeededRng(99),
      samples: 32,
    });
    const keyMatch =
      scalarCanonicalKey(simplifyScalar(best.item)) === scalarCanonicalKey(plantedQuad);
    expect(equiv.verdict === 'consistent' || keyMatch).toBe(true);
    expect(best.loss).toBeLessThan(1e-10);
  });

  it('fits Newton law 2*m1*m2/r^2 with parameter p near 2', async () => {
    const m1 = new Float64Array([1, 2, 3]);
    const m2 = new Float64Array([2, 3, 4]);
    const r = new Float64Array([1, 2, 3]);
    const planted = b.op('/', [
      b.op('*', [b.op('*', [b.number(2), b.symbol('m1')]), b.symbol('m2')]),
      b.op('*', [b.symbol('r'), b.symbol('r')]),
    ]);
    const observed = compileScalar(planted, { variables: ['m1', 'm2', 'r'] }).evaluate([
      m1,
      m2,
      r,
    ]).values;
    const grammar: ScalarGrammar = {
      variables: ['m1', 'm2', 'r'],
      parameters: ['p'],
      binary: ['+', '*', '/'],
      unary: [],
      literals: [1, 2],
      maxSize: 11,
    };
    const candidate = b.op('/', [
      b.op('*', [b.op('*', [b.symbol('p'), b.symbol('m1')]), b.symbol('m2')]),
      b.op('*', [b.symbol('r'), b.symbol('r')]),
    ]);
    const { result } = await runSearch({
      problem: {
        variables: ['m1', 'm2', 'r'],
        columns: [m1, m2, r],
        observed,
        parameters: ['p'],
      },
      grammar,
      seeds: [candidate],
      rng: createSeededRng(7),
      maxEvaluations: QUAD_MAX_EVALUATIONS,
      tournamentP: 0.982,
      optimizeProbability: 0.5,
    });
    const best = result.front.reduce((a, c) => (c.loss < a.loss ? c : a), result.front[0]!);
    const fit = fitScalarParameters(best.item, [m1, m2, r], observed, ['m1', 'm2', 'r'], {
      parameters: ['p'],
      restarts: 0,
    });
    expect(Math.abs(fit.parameters[0]! - 2)).toBeLessThan(1e-6);
    expect(best.loss).toBeLessThan(1e-10);
  });

  it('is byte-identical across two serial runs with seed 7', async () => {
    const x = linspace(20, -1, 1);
    const observed = compileScalar(plantedQuad, { variables: ['x'] }).evaluate([x]).values;
    const base = {
      problem: { variables: ['x'], columns: [x], observed },
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 500,
      tournamentP: 0.982,
    } as const;
    const a = await runSearch(base);
    const bRun = await runSearch(base);
    expect(frontKeys(a.result)).toEqual(frontKeys(bRun.result));
    for (let i = 0; i < a.result.front.length; i += 1) {
      expect(Object.is(a.result.front[i]!.loss, bRun.result.front[i]!.loss)).toBe(true);
    }
  });

  it('populations:1 matches single-population PR7 behavior for x^2+x seed 7', async () => {
    const x = linspace(20, -1, 1);
    const observed = compileScalar(plantedQuad, { variables: ['x'] }).evaluate([x]).values;
    const opts = {
      problem: { variables: ['x'], columns: [x], observed },
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 500,
      tournamentP: 0.982,
      populations: 1,
    } as const;
    const explicit = await runSearch(opts);
    const implicit = await runSearch({ ...opts, populations: undefined });
    expect(frontKeys(explicit.result)).toEqual(frontKeys(implicit.result));
    for (let i = 0; i < explicit.result.front.length; i += 1) {
      expect(Object.is(explicit.result.front[i]!.loss, implicit.result.front[i]!.loss)).toBe(true);
    }
  });

  it('two-island runs are reproducible for the same seed', async () => {
    const x = linspace(20, -1, 1);
    const observed = compileScalar(plantedQuad, { variables: ['x'] }).evaluate([x]).values;
    const base = {
      problem: { variables: ['x'], columns: [x], observed },
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 800,
      tournamentP: 0.982,
      populations: 2,
      fractionReplaced: 0.05,
    } as const;
    const a = await runSearch(base);
    const bRun = await runSearch(base);
    expect(frontKeys(a.result)).toEqual(frontKeys(bRun.result));
    for (let i = 0; i < a.result.front.length; i += 1) {
      expect(Object.is(a.result.front[i]!.loss, bRun.result.front[i]!.loss)).toBe(true);
    }
  });
});
