import { describe, expect, it, vi } from 'vitest';
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
import {
  ComplexityFrequency,
  migrateIslands,
  parsimonyKey,
  tournamentSelect,
  type EvaluatedIndividual,
  type Island,
} from '../src/scalar-search.js';

// Records the temperature every mutation is given and otherwise passes through, so the
// search runs exactly as shipped.
const seenTemperatures = vi.hoisted(() => ({ values: [] as number[] }));
vi.mock('../src/scalar-mutate.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/scalar-mutate.js')>();
  return {
    ...original,
    weightedMutation: (...args: Parameters<typeof original.weightedMutation>) => {
      const operator = original.weightedMutation(...args);
      return (...call: Parameters<typeof operator>) => {
        seenTemperatures.values.push(call[2].temperature);
        return operator(...call);
      };
    },
  };
});

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

// x^4 + x^2 is not among the smallest enumerated trees, so the run has to evolve it:
// its front changes from generation to generation, which is what the tests of the
// island options compare. (x^2 + x is found by the first population, after which every
// run reports the same front.)
const hardGrammar: ScalarGrammar = {
  variables: ['x'],
  binary: ['+', '*'],
  unary: [],
  literals: [1],
  maxSize: 9,
};
const plantedHard = b.op('+', [
  b.op('*', [b.op('*', [X, X]), b.op('*', [X, X])]),
  b.op('*', [X, X]),
]);
const hardProblem: ScalarSearchProblem = { ...quadProblem, observed: observedOf(plantedHard, xs) };

/** One string per run: the front after every progress event. */
function trace(progress: readonly SearchProgress[]): string {
  return progress
    .map((p) => `${p.evaluations}:${p.front.map((x) => `${x.complexity}=${x.loss}`).join('|')}`)
    .join('/');
}

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
  // Recorded with seed 7 on x^2 + x by the single-population search (M13a). It is the
  // contract of the island code too: populations: 1 must reproduce it unchanged.
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

  it('populations: 1 reproduces the recorded front whatever migration is asked for', async () => {
    const plain = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      ...pinned,
    });
    const single = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      ...pinned,
      populations: 1,
      fractionReplaced: 0.5,
    });
    expect(single.result.front.map((r) => scalarCanonicalKey(r.item))).toEqual(
      PINNED_ROWS.map((r) => r.key)
    );
    expect(single.progress).toHaveLength(plain.progress.length);
    single.progress.forEach((event, i) => {
      const other = plain.progress[i]!;
      expect(event.evaluations).toBe(other.evaluations);
      expect(event.front.map((r) => scalarCanonicalKey(r.item))).toEqual(
        other.front.map((r) => scalarCanonicalKey(r.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
      });
    });
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
    await reject(quadProblem, { ...base, populations: 0 });
    await reject(quadProblem, { ...base, populations: 1.5 });
    await reject(quadProblem, { ...base, fractionReplaced: -0.1 });
    await reject(quadProblem, { ...base, fractionReplaced: 1.1 });
    await reject(quadProblem, { ...base, initialTemperature: -1 });
    await reject(quadProblem, { ...base, initialTemperature: Number.POSITIVE_INFINITY });
    await reject(quadProblem, { ...base, adaptiveParsimonyScaling: Number.NaN });
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

describe('searchScalars: islands', () => {
  const islandOptions = {
    grammar: quadGrammar,
    populationSize: 8,
    tournamentSize: 4,
    maxEvaluations: 240,
    tournamentP: 0.982,
    populations: 2,
  } as const;

  const sameRun = (a: SearchProgress[], c: SearchProgress[]): void => {
    expect(a).toHaveLength(c.length);
    a.forEach((event, i) => {
      const other = c[i]!;
      expect(event.evaluations).toBe(other.evaluations);
      expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        other.front.map((row) => scalarCanonicalKey(row.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
      });
    });
  };

  it('is byte-identical across runs for a fixed seed and does not advance options.rng', async () => {
    const rng = createSeededRng(7);
    const a = await runSearch(quadProblem, { ...islandOptions, rng, fractionReplaced: 0.5 });
    const c = await runSearch(quadProblem, { ...islandOptions, rng, fractionReplaced: 0.5 });
    sameRun(a.progress, c.progress);
    expect(a.result.evaluations).toBe(240);
    expect(rng.next()).toBe(createSeededRng(7).next());
  });

  it('counts evaluations across islands and never exceeds the budget', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      ...islandOptions,
      rng: createSeededRng(7),
      maxEvaluations: 50,
    });
    // 2 islands x 8 trees at the start, then 8 offspring per island and generation, the last cut short.
    expect(progress.map((p) => p.evaluations)).toEqual([16, 32, 48, 50]);
    expect(result.evaluations).toBe(50);
  });

  it('runs on its own streams: another island count gives another search', async () => {
    const run = async (populations: number): Promise<string> =>
      trace(
        (
          await runSearch(hardProblem, {
            ...islandOptions,
            grammar: hardGrammar,
            rng: createSeededRng(7),
            populations,
          })
        ).progress
      );
    expect(await run(2)).not.toBe(await run(1));
    expect(await run(2)).not.toBe(await run(3));
  });

  it('migration changes the run when it is asked for and not otherwise', async () => {
    const run = async (fractionReplaced: number): Promise<string> =>
      trace(
        (
          await runSearch(hardProblem, {
            ...islandOptions,
            grammar: hardGrammar,
            rng: createSeededRng(7),
            fractionReplaced,
          })
        ).progress
      );
    expect(await run(0)).toBe(await run(0));
    expect(await run(0.5)).not.toBe(await run(0));
  });

  it('rediscovers x^4 + x^2 with four islands', async () => {
    const { result } = await runSearch(hardProblem, {
      grammar: hardGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 4_000,
      populations: 4,
    });
    expect(bestRow(result.front).loss).toBeLessThan(1e-10);
    for (const row of result.front) {
      expect(scalarGrammarAccepts(hardGrammar, row.item)).toBe(true);
    }
  });

  it('survives a grammar with fewer trees than islands', async () => {
    const tiny: ScalarGrammar = {
      variables: ['x'],
      binary: [],
      unary: [],
      literals: [],
      maxSize: 1,
    };
    const { result } = await runSearch(quadProblem, {
      grammar: tiny,
      rng: createSeededRng(7),
      maxEvaluations: 20,
      populations: 5,
    });
    expect(result.front.map((r) => scalarCanonicalKey(r.item))).toEqual([scalarCanonicalKey(X)]);
    expect(result.evaluations).toBe(20);
  });
});

function member(
  key: string,
  loss: number,
  complexity: number,
  parameters: number[] = []
): EvaluatedIndividual {
  return {
    node: b.symbol(key),
    key,
    loss,
    complexity,
    parameters: new Float64Array(parameters),
  };
}

function island(seed: number, members: EvaluatedIndividual[]): Island {
  return { rng: createSeededRng(seed), population: members };
}

const keysOf = (isl: Island): string[] => isl.population.map((m) => m.key);

describe('migrateIslands', () => {
  const makeIslands = (): [Island, Island] => [
    island(1, [member('a1', 1, 1), member('a2', 2, 1), member('a3', 3, 1), member('a4', 4, 1)]),
    island(2, [member('b1', 0.5, 1), member('b2', 5, 1), member('b3', 6, 1), member('b4', 7, 1)]),
  ];

  it('replaces the worst trees with the best trees of the other islands', () => {
    const [a, c] = makeIslands();
    // 0.5 * 4 trees is exactly 2 replacements per island.
    migrateIslands([a, c], 0.5, createSeededRng(3));
    expect(a.population).toHaveLength(4);
    expect(c.population).toHaveLength(4);
    // a's two worst (a3, a4) are gone, replaced by b's trees; its best two survive.
    expect(keysOf(a)).toContain('a1');
    expect(keysOf(a)).toContain('a2');
    expect(keysOf(a)).not.toContain('a3');
    expect(keysOf(a)).not.toContain('a4');
    expect(keysOf(a).filter((k) => k.startsWith('b'))).toHaveLength(2);
    // c lost b3 and b4 and holds a's best, read before a changed.
    expect(keysOf(c)).not.toContain('b3');
    expect(keysOf(c)).not.toContain('b4');
    expect(keysOf(c).filter((k) => k.startsWith('a'))).toHaveLength(2);
    for (const k of keysOf(c).filter((key) => key.startsWith('a'))) {
      expect(['a1', 'a2', 'a3', 'a4']).toContain(k);
    }
    // Still best first.
    for (const isl of [a, c]) {
      const losses = isl.population.map((m) => m.loss);
      expect(losses).toEqual([...losses].sort((x, y) => x - y));
    }
  });

  it('reads every donor before any island changes', () => {
    const [a, c] = makeIslands();
    migrateIslands([a, c], 0.25, createSeededRng(3));
    // One replacement each. c may only receive a tree that a held before migrating.
    const incoming = keysOf(c).filter((k) => k.startsWith('a'));
    expect(incoming).toHaveLength(1);
    expect(['a1', 'a2', 'a3', 'a4']).toContain(incoming[0]);
    const received = keysOf(a).filter((k) => k.startsWith('b'));
    expect(received).toHaveLength(1);
    expect(['b1', 'b2', 'b3', 'b4']).toContain(received[0]);
  });

  it('gives a migrant its own parameter array', () => {
    const [a, c] = makeIslands();
    const donor = member('b1', 0.5, 1, [4, 2]);
    c.population[0] = donor;
    migrateIslands([a, c], 1, createSeededRng(3));
    const migrant = a.population.find((m) => m.key === 'b1');
    if (migrant !== undefined) {
      expect(migrant.parameters).not.toBe(donor.parameters);
      expect([...migrant.parameters]).toEqual([4, 2]);
    }
  });

  it('never brings in a tree the island already holds', () => {
    const shared = (): EvaluatedIndividual[] => [member('s', 1, 1), member('t', 2, 1)];
    const a = island(1, shared());
    const c = island(2, shared());
    migrateIslands([a, c], 1, createSeededRng(3));
    expect(keysOf(a).sort()).toEqual(['s', 't']);
    expect(keysOf(c).sort()).toEqual(['s', 't']);
  });

  it('does nothing for one island or a zero fraction', () => {
    const [a, c] = makeIslands();
    migrateIslands([a], 1, createSeededRng(3));
    expect(keysOf(a)).toEqual(['a1', 'a2', 'a3', 'a4']);
    migrateIslands([a, c], 0, createSeededRng(3));
    expect(keysOf(a)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(keysOf(c)).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('rounds the expected count at random: 0.3 replacements on average', () => {
    const rng = createSeededRng(11);
    let replaced = 0;
    const trials = 4_000;
    for (let t = 0; t < trials; t += 1) {
      const a = island(1, [member('a1', 1, 1), member('a2', 2, 1), member('a3', 3, 1)]);
      const c = island(2, [member('b1', 0.5, 1), member('b2', 5, 1), member('b3', 6, 1)]);
      // 0.1 * 3 trees = 0.3 expected replacements per island.
      migrateIslands([a, c], 0.1, rng);
      replaced += keysOf(a).filter((k) => k.startsWith('b')).length;
    }
    const mean = replaced / trials;
    // Binomial(4000, 0.3) has a standard deviation of 0.0072 for the mean; 6 sigma is wide.
    expect(Math.abs(mean - 0.3)).toBeLessThan(0.05);
  });
});

describe('adaptive parsimony', () => {
  it('tracks the share of each size over a window', () => {
    const f = new ComplexityFrequency();
    expect(f.share(3)).toBe(0);
    f.record(3);
    f.record(3);
    f.record(5);
    f.record(7);
    expect(f.share(3)).toBe(0.5);
    expect(f.share(5)).toBe(0.25);
    expect(f.share(9)).toBe(0);
  });

  it('forgets evaluations that left the window', () => {
    const f = new ComplexityFrequency();
    f.record(1);
    for (let i = 0; i < 100_000; i += 1) {
      f.record(2);
    }
    expect(f.share(1)).toBe(0);
    expect(f.share(2)).toBe(1);
  });

  it('keeps an order where exp(1040 * share) overflows', () => {
    // A share of 0.9 puts exp(936) past the largest double, so loss * exp(...) is
    // Infinity for every contestant and a zero loss turns into NaN.
    expect(Math.exp(1040 * 0.9)).toBe(Number.POSITIVE_INFINITY);
    const crowded = parsimonyKey(member('c', 1e-3, 5), 0.9, 1040);
    const rare = parsimonyKey(member('r', 1e-3, 9), 0.1, 1040);
    expect(Number.isFinite(crowded)).toBe(true);
    expect(rare).toBeLessThan(crowded);
    const perfectCrowded = parsimonyKey(member('p', 0, 5), 0.9, 1040);
    const perfectRare = parsimonyKey(member('q', 0, 9), 0.1, 1040);
    expect(Number.isNaN(perfectCrowded)).toBe(false);
    expect(perfectRare).toBeLessThan(perfectCrowded);
    // A finite loss still beats a larger one at the same share.
    expect(parsimonyKey(member('l', 1, 5), 0.5, 1040)).toBeLessThan(
      parsimonyKey(member('m', 2, 5), 0.5, 1040)
    );
    expect(parsimonyKey(member('u', Number.POSITIVE_INFINITY, 5), 0.5, 1040)).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it('lets a rare size beat a crowded size that has a slightly smaller loss', () => {
    const frequency = new ComplexityFrequency();
    for (let i = 0; i < 9; i += 1) {
      frequency.record(5);
    }
    frequency.record(9);
    const population = [member('crowded', 1.0, 5), member('rare', 1.05, 9)];
    const wins = { crowded: 0, rare: 0 };
    const rng = createSeededRng(5);
    for (let i = 0; i < 400; i += 1) {
      // tournamentP = 1: the best-ranked contestant always wins, so the key decides.
      const winner = tournamentSelect(population, rng, 2, 1, { frequency, scaling: 10 });
      wins[winner.key as 'crowded' | 'rare'] += 1;
    }
    // With two draws a tournament sometimes sees only one kind; when it sees both, rare wins.
    expect(wins.rare).toBeGreaterThan(wins.crowded);
    const plain = { crowded: 0, rare: 0 };
    const rng2 = createSeededRng(5);
    for (let i = 0; i < 400; i += 1) {
      plain[tournamentSelect(population, rng2, 2, 1).key as 'crowded' | 'rare'] += 1;
    }
    expect(plain.crowded).toBeGreaterThan(plain.rare);
  });

  it('changes the run of a single population and still finds the law', async () => {
    const run = (adaptiveParsimony: boolean) =>
      runSearch(hardProblem, {
        grammar: hardGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 1_500,
        adaptiveParsimony,
        adaptiveParsimonyScaling: 1040,
      });
    const on = await run(true);
    const off = await run(false);
    expect(bestRow(on.result.front).loss).toBeLessThan(1e-10);
    expect(trace(on.progress)).not.toBe(trace(off.progress));
  });
});

describe('annealing', () => {
  const run = async (extra: Partial<ScalarSearchOptions>): Promise<number[]> => {
    seenTemperatures.values.length = 0;
    await runSearch(hardProblem, {
      grammar: hardGrammar,
      rng: createSeededRng(7),
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 160,
      ...extra,
    });
    // One context per generation: keep each temperature once, in order.
    return seenTemperatures.values.filter((t, i, all) => i === 0 || t !== all[i - 1]);
  };

  it('holds the temperature at 1 for a single population', async () => {
    expect(await run({})).toEqual([1]);
    expect(await run({ annealing: false, initialTemperature: 9 })).toEqual([1]);
  });

  it('cools from initialTemperature by 0.995 per generation', async () => {
    const temperatures = await run({ annealing: true, initialTemperature: 3.17 });
    // 160 evaluations, 8 initial, then 8 per generation: 19 generations.
    expect(temperatures).toHaveLength(19);
    let expected = 3.17;
    for (const t of temperatures) {
      expect(t).toBeCloseTo(expected, 12);
      expected *= 0.995;
    }
  });

  it('starts at 3.17 when the options are left at their defaults and there are several islands', async () => {
    const temperatures = await run({ populations: 2 });
    expect(temperatures[0]).toBe(3.17);
    expect(temperatures[1]).toBeCloseTo(3.17 * 0.995, 12);
  });

  it('a temperature of 0 never perturbs', async () => {
    expect(await run({ annealing: true, initialTemperature: 0 })).toEqual([0]);
  });
});

describe('island defaults', () => {
  const run = (extra: Partial<ScalarSearchOptions>) =>
    runSearch(hardProblem, {
      grammar: hardGrammar,
      rng: createSeededRng(7),
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 400,
      ...extra,
    });

  it('annealing and adaptive parsimony are on for several islands and off for one', async () => {
    const one = trace((await run({})).progress);
    expect(one).toBe(trace((await run({ annealing: false, adaptiveParsimony: false })).progress));
    expect(one).not.toBe(trace((await run({ adaptiveParsimony: true })).progress));
    const several = trace((await run({ populations: 2 })).progress);
    expect(several).toBe(
      trace((await run({ populations: 2, annealing: true, adaptiveParsimony: true })).progress)
    );
    expect(several).not.toBe(
      trace((await run({ populations: 2, annealing: true, adaptiveParsimony: false })).progress)
    );
  });
});
