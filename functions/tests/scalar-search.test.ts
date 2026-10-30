import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  numericallyEquivalent,
  searchScalars,
  simplifyScalar,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type ScalarSearchResult,
  type SearchProgress,
} from '../src/index.js';

const b = createScalarBuilder();
const X = b.symbol('x');

function linspace(n: number, lo: number, hi: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = lo + ((hi - lo) * i) / (n - 1);
  }
  return out;
}

async function runSearch(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions
): Promise<{ progress: SearchProgress[]; result: ScalarSearchResult }> {
  const gen = searchScalars(problem, options);
  const progress: SearchProgress[] = [];
  for (;;) {
    const step = await gen.next();
    if (step.done) {
      return { progress, result: step.value };
    }
    progress.push(step.value);
  }
}

function bestRow(front: SearchProgress['front']): SearchProgress['front'][number] {
  return front.reduce((a, c) => (c.loss < a.loss ? c : a), front[0]!);
}

/** Evaluations at the first progress event whose best loss is below `1e-10`; -1 when none. */
function firstFound(progress: readonly SearchProgress[]): number {
  for (const event of progress) {
    if (event.front.length > 0 && bestRow(event.front).loss < 1e-10) {
      return event.evaluations;
    }
  }
  return -1;
}

function observedOf(node: ScalarNode, x: Float64Array): Float64Array {
  return compileScalar(node, { variables: ['x'] }).evaluate([x]).values;
}

const quadGrammar: ScalarGrammar = {
  variables: ['x'],
  binary: ['+', '*', '^'],
  unary: [],
  literals: [1],
  maxSize: 7,
};
const plantedQuad = b.op('+', [b.op('*', [X, X]), X]);
const xs = linspace(20, -1, 1);
const quadProblem: ScalarSearchProblem = {
  variables: ['x'],
  columns: [xs],
  observed: observedOf(plantedQuad, xs),
};

describe('searchScalars: planted laws', () => {
  it('rediscovers x^2 + x with seed 7 (the plan fixture)', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 2_000,
      tournamentP: 0.982,
    });
    const best = bestRow(result.front);
    const equivalent = numericallyEquivalent(best.item, plantedQuad, {
      domain: { x: [-1, 1] },
      rng: createSeededRng(99),
      samples: 32,
    });
    const keyMatch =
      scalarCanonicalKey(simplifyScalar(best.item)) === scalarCanonicalKey(plantedQuad);
    expect(equivalent.verdict === 'consistent' || keyMatch).toBe(true);
    expect(best.loss).toBeLessThan(1e-10);
    // Recorded run: the 27 smallest enumerated trees already contain the law, so the
    // first progress event finds it. This fixture checks seeding, not evolution; the
    // next test is the one that needs the generations.
    expect(firstFound(progress)).toBe(27);
  });

  it('evolves x^4 + x^2, which the initial population does not contain', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+', '*'],
      unary: [],
      literals: [1],
      maxSize: 9,
    };
    const x4x2 = b.op('+', [b.op('*', [b.op('*', [X, X]), b.op('*', [X, X])]), b.op('*', [X, X])]);
    const problem = { ...quadProblem, observed: observedOf(x4x2, xs) };
    const { progress, result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 2_000,
    });
    const found = firstFound(progress);
    // Recorded: seed 7 finds it at evaluation 162; seeds 1 and 11 need 135 and 405.
    expect(found).toBeGreaterThan(27);
    expect(found).toBeLessThanOrEqual(2_000);
    const best = bestRow(result.front);
    expect(best.loss).toBeLessThan(1e-10);
    expect(scalarGrammarAccepts(grammar, best.item)).toBe(true);
    const equivalent = numericallyEquivalent(best.item, x4x2, {
      domain: { x: [-1, 1] },
      rng: createSeededRng(5),
      samples: 32,
    });
    expect(equivalent.verdict).toBe('consistent');
  });

  describe('fitted parameters', () => {
    const n = 16;
    const m1 = new Float64Array(n);
    const m2 = new Float64Array(n);
    const r = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      m1[i] = 1 + (i % 4);
      m2[i] = 2 + (i % 5) * 0.5;
      r[i] = 1 + i * 0.25;
    }
    const vars = ['m1', 'm2', 'r'];
    const planted = b.op('/', [
      b.op('*', [b.op('*', [b.number(2), b.symbol('m1')]), b.symbol('m2')]),
      b.op('*', [b.symbol('r'), b.symbol('r')]),
    ]);
    const observed = compileScalar(planted, { variables: vars }).evaluate([m1, m2, r]).values;
    const grammar: ScalarGrammar = {
      variables: vars,
      parameters: ['p'],
      binary: ['+', '*', '/'],
      unary: [],
      literals: [1],
      maxSize: 9,
    };
    const shape = b.op('/', [
      b.op('*', [b.op('*', [b.symbol('p'), b.symbol('m1')]), b.symbol('m2')]),
      b.op('*', [b.symbol('r'), b.symbol('r')]),
    ]);
    const problem: ScalarSearchProblem = {
      variables: vars,
      columns: [m1, m2, r],
      observed,
      parameters: ['p'],
    };
    const base = {
      grammar,
      seeds: [shape],
      rng: createSeededRng(7),
      maxEvaluations: 300,
    } as const;

    it('reports the fitted p within 1e-6 of 2 and a loss that those values reproduce', async () => {
      const { result } = await runSearch(problem, { ...base, optimizeProbability: 1 });
      expect(result.parameterNames).toEqual(['p']);
      expect(result.fittedParameters).toHaveLength(result.front.length);
      const row = result.front.findIndex(
        (c) => scalarCanonicalKey(c.item) === scalarCanonicalKey(shape)
      );
      expect(row).toBeGreaterThanOrEqual(0);
      expect(Math.abs(result.fittedParameters[row]![0]! - 2)).toBeLessThan(1e-6);
      expect(result.front[row]!.loss).toBeLessThan(1e-10);
      // The loss is not a private number: the reported tree and parameters reproduce it.
      const again = compileScalar(shape, { variables: vars, parameters: ['p'] }).evaluate(
        [m1, m2, r],
        result.fittedParameters[row]
      );
      let sse = 0;
      for (let i = 0; i < n; i += 1) {
        sse += (again.values[i]! - observed[i]!) ** 2;
      }
      expect(sse).toBeLessThan(1e-10);
    });

    it('optimizeProbability decides whether constants are fitted', async () => {
      const off = await runSearch(problem, { ...base, optimizeProbability: 0 });
      const on = await runSearch(problem, { ...base, optimizeProbability: 1 });
      // Without a fit every tree keeps p = 1, and no size-9 tree over {1, +, *, /} makes 2.
      expect(bestRow(off.result.front).loss).toBeGreaterThan(1);
      for (const params of off.result.fittedParameters) {
        expect([...params]).toEqual([1]);
      }
      expect(bestRow(on.result.front).loss).toBeLessThan(1e-10);
    });
  });
});

describe('searchScalars: reproducibility', () => {
  // Recorded with seed 7 on x^2 + x; the island PR must reproduce it for populations: 1.
  const pinned = {
    populationSize: 8,
    tournamentSize: 4,
    maxEvaluations: 120,
  } as const;
  const PINNED_ROWS = [
    { complexity: 1, loss: 4.870097681877825, key: '{"k":"s","v":"x"}' },
    {
      complexity: 5,
      loss: 6.317050217590134e-32,
      key: '{"k":"*","a":[{"k":"+","a":[{"k":"n","v":"1"},{"k":"s","v":"x"}]},{"k":"s","v":"x"}]}',
    },
    {
      complexity: 7,
      loss: 0,
      key: '{"k":"+","a":[{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"2"}},{"k":"s","v":"x"}]}',
    },
  ] as const;

  it('reproduces the recorded front for seed 7', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      ...pinned,
    });
    expect(result.front.map((row) => row.complexity)).toEqual(PINNED_ROWS.map((r) => r.complexity));
    expect(result.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      PINNED_ROWS.map((r) => r.key)
    );
    result.front.forEach((row, i) => {
      expect(Object.is(row.loss, PINNED_ROWS[i]!.loss)).toBe(true);
    });
    expect(progress.map((p) => p.evaluations)).toEqual(
      Array.from({ length: 15 }, (_, i) => 8 * (i + 1))
    );
    expect(result.evaluations).toBe(120);
    expect(result.stopReason).toBe('max-evaluations');
    expect(result.seed).toBe(7);
  });

  it('is identical across runs, event by event, and does not advance options.rng', async () => {
    const rng = createSeededRng(7);
    const options = { grammar: quadGrammar, rng, tournamentP: 0.982, ...pinned } as const;
    const a = await runSearch(quadProblem, options);
    const c = await runSearch(quadProblem, options);
    expect(a.progress).toHaveLength(c.progress.length);
    a.progress.forEach((event, i) => {
      const other = c.progress[i]!;
      expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        other.front.map((row) => scalarCanonicalKey(row.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
      });
    });
    expect(rng.next()).toBe(createSeededRng(7).next());
  });

  it('differs for another seed', async () => {
    const fingerprint = async (seed: number): Promise<string> => {
      const { progress } = await runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(seed),
        ...pinned,
      });
      return progress
        .map((p) => p.front.map((r) => `${r.complexity}:${r.loss}`).join('|'))
        .join('/');
    };
    expect(await fingerprint(7)).not.toBe(await fingerprint(8));
  });

  it('accepts the island options and ignores them until islands exist', async () => {
    const plain = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      ...pinned,
    });
    const withIslandOptions = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      ...pinned,
      populations: 4,
      fractionReplaced: 0.5,
      annealing: true,
      initialTemperature: 9,
      adaptiveParsimony: true,
      adaptiveParsimonyScaling: 10,
    });
    expect(withIslandOptions.result.front.map((r) => [scalarCanonicalKey(r.item), r.loss])).toEqual(
      plain.result.front.map((r) => [scalarCanonicalKey(r.item), r.loss])
    );
  });
});

describe('searchScalars: budget and result shape', () => {
  const run = (extra: Partial<ScalarSearchOptions>) =>
    runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 100,
      ...extra,
    });

  it('never evaluates more than maxEvaluations, the initial population included', async () => {
    for (const maxEvaluations of [1, 5, 27, 28, 60, 60.5]) {
      const { result } = await run({ maxEvaluations });
      expect(result.evaluations).toBe(Math.floor(maxEvaluations));
      expect(result.stopReason).toBe('max-evaluations');
    }
  });

  it('a zero budget still returns a front object', async () => {
    const { progress, result } = await run({ maxEvaluations: 0 });
    expect(result.front).toEqual([]);
    expect(result.evaluations).toBe(0);
    expect(progress).toHaveLength(1);
  });

  it('maxCandidates is its own stop reason only when it binds', async () => {
    const binding = await run({ maxEvaluations: 100, maxCandidates: 40 });
    expect(binding.result.evaluations).toBe(40);
    expect(binding.result.stopReason).toBe('max-candidates');
    const slack = await run({ maxEvaluations: 40, maxCandidates: 100 });
    expect(slack.result.evaluations).toBe(40);
    expect(slack.result.stopReason).toBe('max-evaluations');
  });

  it('uses one status value and ends on the last progress front', async () => {
    const { progress, result } = await run({ maxEvaluations: 60 });
    for (const event of progress) {
      expect(event.status).toBe('fitted');
    }
    const last = progress[progress.length - 1]!;
    expect(result.front.map((r) => scalarCanonicalKey(r.item))).toEqual(
      last.front.map((r) => scalarCanonicalKey(r.item))
    );
    expect(progress.map((p) => p.evaluations)).toEqual(
      [...progress.map((p) => p.evaluations)].sort((a, c) => a - c)
    );
  });

  it('selects a model only when asked', async () => {
    const without = await run({ maxEvaluations: 60 });
    expect(without.result.selected).toBeUndefined();
    const accuracy = await run({ maxEvaluations: 60, modelSelection: 'accuracy' });
    expect(accuracy.result.selected).toBeDefined();
    expect(accuracy.result.selected!.loss).toBe(bestRow(accuracy.result.front).loss);
  });

  it('every reported tree satisfies the grammar', async () => {
    const { progress } = await run({ maxEvaluations: 300 });
    for (const event of progress) {
      for (const row of event.front) {
        expect(scalarGrammarAccepts(quadGrammar, row.item)).toBe(true);
      }
    }
  });

  it('injects only seeds the grammar accepts', async () => {
    const outside = b.op('-', [X, X]);
    const inside = b.op('*', [b.op('+', [X, b.number(1)]), X]);
    const { progress } = await run({
      maxEvaluations: 4,
      seeds: [outside, inside],
      populationSize: 4,
    });
    const keys = progress[0]!.front.map((r) => scalarCanonicalKey(r.item));
    expect(keys).toContain(scalarCanonicalKey(inside));
    expect(keys).not.toContain(scalarCanonicalKey(outside));
  });
});

describe('searchScalars: unusable candidates', () => {
  it('ranks a tree that is invalid on any row below every valid tree, whatever the scale', async () => {
    // y = 1e6 everywhere. Any valid tree has a huge residual; `log(x)` is invalid on the
    // negative half, and a flat per-row penalty would let it outrank all of them.
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['log'],
      literals: [1],
      maxSize: 5,
    };
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [xs],
      observed: new Float64Array(xs.length).fill(1e6),
    };
    const { progress, result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 300,
    });
    expect(result.front.length).toBeGreaterThan(0);
    for (const event of progress) {
      for (const row of event.front) {
        const evaluated = compileScalar(row.item, { variables: ['x'] }).evaluate([xs]);
        expect(evaluated.allValid).toBe(true);
        expect(Number.isFinite(row.loss)).toBe(true);
      }
    }
  });

  it('survives candidates with no valid row while fitting parameters', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['+', '*'],
      unary: ['log'],
      literals: [],
      maxSize: 5,
    };
    const negative = linspace(10, -2, -1);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negative],
      observed: negative.map((v) => 3 * v),
      parameters: ['p'],
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(3),
      maxEvaluations: 200,
      optimizeProbability: 1,
    });
    expect(result.evaluations).toBe(200);
    expect(result.front.length).toBeGreaterThan(0);
  });
});

describe('searchScalars: arguments', () => {
  const base = { grammar: quadGrammar, rng: createSeededRng(7), maxEvaluations: 10 };
  const reject = async (problem: ScalarSearchProblem, options: ScalarSearchOptions) => {
    await expect(runSearch(problem, options)).rejects.toThrow(RangeError);
  };

  it('rejects options that are not a configuration', async () => {
    await reject(quadProblem, { ...base, populationSize: 0 });
    await reject(quadProblem, { ...base, populationSize: 2.5 });
    await reject(quadProblem, { ...base, tournamentSize: 0 });
    await reject(quadProblem, { ...base, tournamentP: 0 });
    await reject(quadProblem, { ...base, tournamentP: 1.5 });
    await reject(quadProblem, { ...base, optimizeProbability: -0.1 });
    await reject(quadProblem, { ...base, optimizeProbability: Number.NaN });
    await reject(quadProblem, { ...base, maxEvaluations: Number.NaN });
    await reject(quadProblem, { ...base, maxEvaluations: -1 });
    await reject(quadProblem, { ...base, maxCandidates: Number.NaN });
  });

  it('rejects a problem whose columns do not line up', async () => {
    await reject({ ...quadProblem, columns: [] }, base);
    await reject({ ...quadProblem, columns: [xs.subarray(0, 5)] }, base);
    await reject(
      { ...quadProblem, observed: new Float64Array(0), columns: [new Float64Array(0)] },
      base
    );
    const withNaN = new Float64Array(quadProblem.observed);
    withNaN[3] = Number.NaN;
    await reject({ ...quadProblem, observed: withNaN }, base);
  });

  it('rejects a grammar that admits no tree instead of failing later', async () => {
    const empty: ScalarGrammar = { variables: [], binary: ['+'], unary: [], maxSize: 5 };
    await reject(quadProblem, { ...base, grammar: empty });
  });
});
