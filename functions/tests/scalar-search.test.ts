import { describe, expect, it, vi } from 'vitest';
import {
  createScalarBuilder,
  forEachScalar,
  scalarCanonicalKey,
  scalarComplexity,
  scalarGrammarAccepts,
  ScalarBuildError,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng, Fraction } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  frontToJson,
  frontToLatexTable,
  numericallyEquivalent,
  searchScalars,
  simplifyScalar,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type ScalarSearchResult,
  type SearchProgress,
} from '../src/index.js';
import type { RationalDimension } from '../src/scalar-dimension.js';
import {
  inferScalarDimension,
  rationalDimensionsEqual,
  solveParameterDimensions,
} from '../src/scalar-dimension.js';
import {
  ComplexityFrequency,
  migrateIslands,
  parsimonyKey,
  tournamentSelect,
  simplifyCandidateForTest,
  hallFrontForTest,
  type EvaluatedIndividual,
  type Island,
} from '../src/scalar-search.js';

// Records the temperature every mutation is given and otherwise passes through, so the
// search runs exactly as shipped. `failMutations` is for the crossover wiring test:
// only a successful crossover can introduce a new tree. `forceCrossover` /
// `replaceMutation` pin the fallthrough path: an admit-rejected or null
// crossover must still reach mutation.
const seenTemperatures = vi.hoisted(() => ({
  values: [] as number[],
  failMutations: false,
  forceCrossover: undefined as unknown,
  replaceMutation: undefined as unknown,
}));
vi.mock('../src/scalar-mutate.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/scalar-mutate.js')>();
  return {
    ...original,
    crossoverSubtrees: (...args: Parameters<typeof original.crossoverSubtrees>) => {
      if (seenTemperatures.forceCrossover !== undefined) {
        return seenTemperatures.forceCrossover as ReturnType<typeof original.crossoverSubtrees>;
      }
      return original.crossoverSubtrees(...args);
    },
    weightedMutation: (...args: Parameters<typeof original.weightedMutation>) => {
      const operator = original.weightedMutation(...args);
      return (...call: Parameters<typeof operator>) => {
        seenTemperatures.values.push(call[2].temperature);
        if (seenTemperatures.failMutations) {
          return null;
        }
        if (seenTemperatures.replaceMutation !== undefined) {
          return seenTemperatures.replaceMutation as ReturnType<typeof operator>;
        }
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

    it('fit: { restarts: 0, maxIterations: 0 } does not move a parameter off its start', async () => {
      const { result } = await runSearch(problem, {
        ...base,
        optimizeProbability: 1,
        fit: { restarts: 0, maxIterations: 0 },
      });
      // The fitter returns the start vector when it may not iterate, so every
      // refit is discarded and every tree keeps the ones it started with.
      expect(bestRow(result.front).loss).toBeGreaterThan(1);
      for (const params of result.fittedParameters) {
        expect([...params]).toEqual([1]);
      }
    });

    it('a fit bound that excludes the planted value keeps the reported p inside the bound', async () => {
      const { result } = await runSearch(problem, {
        ...base,
        optimizeProbability: 1,
        fit: { bounds: [[0, 1]] },
      });
      // p cannot reach the planted 2, so the bound costs accuracy, and every
      // refit the search reports stays inside [0, 1].
      expect(bestRow(result.front).loss).toBeGreaterThan(1e-6);
      expect(result.fittedParameters.length).toBeGreaterThan(0);
      for (const params of result.fittedParameters) {
        expect(params[0]!).toBeGreaterThanOrEqual(0);
        expect(params[0]!).toBeLessThanOrEqual(1);
      }
    });

    it('clamps inherited parameters into bounds when a refit is discarded', async () => {
      const { result } = await runSearch(problem, {
        ...base,
        optimizeProbability: 1,
        fit: { restarts: 0, maxIterations: 0, bounds: [[50, 60]] },
      });
      for (const params of result.fittedParameters) {
        expect(params[0]!).toBeGreaterThanOrEqual(50);
        expect(params[0]!).toBeLessThanOrEqual(60);
      }
    });

    it('discards an advisory refit when the fitter has no valid rows', async () => {
      const oneOverP = b.op('/', [b.number(1), b.symbol('p')]);
      const grammar1p: ScalarGrammar = {
        variables: ['x'],
        parameters: ['p'],
        binary: ['+', '*', '/'],
        unary: [],
        literals: [1],
        maxSize: 5,
      };
      const x = linspace(8, 0.5, 1.2);
      const problem1p: ScalarSearchProblem = {
        variables: ['x'],
        columns: [x],
        observed: compileScalar(oneOverP, { variables: ['x'], parameters: ['p'] }).evaluate(
          [x],
          new Float64Array([1])
        ).values,
        parameters: ['p'],
      };
      await expect(
        runSearch(problem1p, {
          grammar: grammar1p,
          seeds: [oneOverP],
          rng: createSeededRng(1),
          maxEvaluations: 24,
          optimizeProbability: 1,
          fit: { initial: [0] },
        })
      ).resolves.toBeDefined();

      const pOverPMinus2 = b.op('/', [b.symbol('p'), b.op('-', [b.symbol('p'), b.number(2)])]);
      const grammarRat: ScalarGrammar = {
        variables: ['x'],
        parameters: ['p'],
        binary: ['+', '-', '*', '/'],
        unary: [],
        literals: [1, 2],
        maxSize: 7,
      };
      const problemRat: ScalarSearchProblem = {
        variables: ['x'],
        columns: [x],
        observed: linspace(8, 1, 8),
        parameters: ['p'],
      };
      await expect(
        runSearch(problemRat, {
          grammar: grammarRat,
          seeds: [pOverPMinus2],
          rng: createSeededRng(1),
          maxEvaluations: 24,
          optimizeProbability: 1,
          fit: { bounds: [[2, 2]] },
        })
      ).resolves.toBeDefined();

      await expect(
        runSearch(problem1p, {
          grammar: grammar1p,
          seeds: [oneOverP],
          rng: createSeededRng(1),
          maxEvaluations: 24,
          optimizeProbability: 1,
          fit: { bounds: [[0, 0]] },
        })
      ).resolves.toBeDefined();
    });

    it('rejects bad fit options with RangeError before the first yield', async () => {
      const expectReject = async (
        fit: ScalarSearchOptions['fit'],
        extra?: Partial<ScalarSearchOptions>
      ) => {
        await expect(
          runSearch(problem, { ...base, optimizeProbability: 1, fit, ...extra })
        ).rejects.toThrow(RangeError);
      };
      // lower > upper
      await expectReject({ bounds: [[2, 1]] });
      // a length other than the parameter count (1 here)
      await expectReject({ bounds: [] });
      await expectReject({
        bounds: [
          [0, 1],
          [0, 1],
        ],
      });
      await expectReject({ bounds: [[Number.NaN, 1]] });
      await expectReject({ initial: [1, 2] });
      await expectReject({ initial: [Number.NaN] });
      await expectReject({ restarts: -1 });
      await expectReject({ restarts: 1.5 });
      await expectReject({ maxIterations: -2 });
      await expectReject({ algorithm: 'gd' as 'lm' });
      await expectReject({ bounds: [5] } as unknown as ScalarSearchOptions['fit']);
      await expectReject({ bounds: [null] } as unknown as ScalarSearchOptions['fit']);
      await expectReject(5 as unknown as ScalarSearchOptions['fit']);
      await expectReject(null as unknown as ScalarSearchOptions['fit']);
      await expectReject({ algorithm: 'lm' }, { loss: 'l1' });
      await expectReject({ algorithm: 'lm' }, { loss: 'huber' });
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

  it('crossoverProbability 0 reproduces the recorded front because the coin is not drawn', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      crossoverProbability: 0,
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

  it('an always-true admit leaves the recorded seed-7 front unchanged', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      grammar: { ...quadGrammar, admit: () => true },
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
    expect(result.seed).toBe(7);
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

describe('searchScalars: one front row per canonical key (SR-8)', () => {
  // Two stored shapes of one canonical tree: `x*x` and `(x*x)*1` canonicalize to
  // the same key (`x^2`) but are stored at complexities 3 and 5.
  const square = b.op('*', [b.symbol('x'), b.symbol('x')]);
  const padded = b.op('*', [b.op('*', [b.symbol('x'), b.symbol('x')]), b.number(1)]);
  const ind = (node: ScalarNode, loss: number, complexity: number): EvaluatedIndividual => ({
    node,
    key: scalarCanonicalKey(node),
    loss,
    complexity,
    parameters: new Float64Array([3]),
  });

  it('keeps one front row when two stored shapes share a canonical key', () => {
    expect(scalarCanonicalKey(padded)).toBe(scalarCanonicalKey(square));
    const { front, fittedParameters } = hallFrontForTest([ind(square, 4, 3), ind(padded, 2, 5)]);
    expect(front).toHaveLength(1);
    expect(front[0]!.loss).toBe(2);
    expect(front[0]!.complexity).toBe(5);
    expect(front[0]!.item).toBe(padded);
    expect([...fittedParameters[0]!]).toEqual([3]);
  });

  it('a duplicate with a smaller loss replaces the survivor even at larger complexity', () => {
    const { front } = hallFrontForTest([ind(square, 4, 3), ind(padded, 1, 5)]);
    expect(front).toHaveLength(1);
    expect(front[0]!.loss).toBe(1);
    expect(front[0]!.item).toBe(padded);
  });

  it('at equal complexity the smaller loss wins; a full tie keeps the first recorded', () => {
    const smaller = hallFrontForTest([ind(square, 4, 3), ind(padded, 1, 3)]);
    expect(smaller.front).toHaveLength(1);
    expect(smaller.front[0]!.item).toBe(padded);
    const tied = hallFrontForTest([ind(square, 4, 3), ind(padded, 4, 3)]);
    expect(tied.front).toHaveLength(1);
    expect(tied.front[0]!.item).toBe(square);
  });

  it('B1: the better-loss same-key tree is not dropped from the front by Pareto domination', () => {
    const other = b.number(2);
    const { front } = hallFrontForTest([
      ind(other, 1, 1),
      ind(square, 10, 3),
      ind(padded, 0.01, 5),
    ]);
    const keys = front.map((row) => scalarCanonicalKey(row.item));
    expect(keys).toContain(scalarCanonicalKey(square));
    const squareRow = front.find(
      (row) => scalarCanonicalKey(row.item) === scalarCanonicalKey(square)
    );
    expect(squareRow!.loss).toBe(0.01);
    expect(front).toHaveLength(2);
  });

  it('B4: evicting a same-key duplicate does not remove a Pareto-optimal tree at that complexity', () => {
    const other = b.op('+', [b.symbol('x'), b.symbol('x')]);
    expect(scalarCanonicalKey(other)).not.toBe(scalarCanonicalKey(square));
    const { front } = hallFrontForTest([
      ind(other, 2, 3),
      ind(square, 10, 3),
      ind(padded, 0.01, 5),
    ]);
    expect(front).toHaveLength(2);
    expect(new Set(front.map((row) => row.item))).toEqual(new Set([other, padded]));
  });

  it('B2: penalized x/x does not hide a loss-0 same-key offspring on the front', () => {
    const div = b.op('/', [X, X]);
    const one = b.op('*', [b.op('^', [X, b.number(0)]), b.number(1)]);
    expect(scalarCanonicalKey(div)).toBe(scalarCanonicalKey(one));
    const { front } = hallFrontForTest([ind(div, 1e8, 3), ind(one, 0, 5)]);
    expect(front).toHaveLength(1);
    expect(front[0]!.loss).toBe(0);
    expect(front[0]!.item).toBe(one);
  });

  it('B3: complexityWeights do not change which same-key survivor the hall keeps', () => {
    const div = b.op('/', [X, X]);
    const one = b.op('*', [b.op('^', [X, b.number(0)]), b.number(1)]);
    const weightsList = [{}, { op: { '/': 100 } }, { op: { '^': 100 } }] as const;
    const losses = weightsList.map((weights) => {
      const cDiv = scalarComplexity(div, weights);
      const cOne = scalarComplexity(one, weights);
      const { front } = hallFrontForTest([ind(div, 1e8, cDiv), ind(one, 0, cOne)]);
      expect(front).toHaveLength(1);
      return front[0]!.loss;
    });
    expect(losses).toEqual([0, 0, 0]);
  });

  it('a unique-key row still ranks beside the survivor', () => {
    const other = b.op('+', [b.symbol('x'), b.symbol('x')]);
    expect(scalarCanonicalKey(other)).not.toBe(scalarCanonicalKey(square));
    const { front } = hallFrontForTest([ind(square, 4, 3), ind(other, 2, 5)]);
    expect(front).toHaveLength(2);
    expect(new Set(front.map((row) => row.item))).toEqual(new Set([square, other]));
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

describe('searchScalars: ranking loss', () => {
  // A constant tree against y = x except one huge outlier. The three named losses
  // then disagree on a finite number, and a zero weight on the outlier recovers SSE
  // of the other rows.
  const outlierX = new Float64Array([0, 1, 2, 3]);
  const outlierY = new Float64Array([0, 1, 2, 100]);
  const constantZero = b.number(0);
  const outlierGrammar: ScalarGrammar = {
    variables: ['x'],
    binary: [],
    unary: [],
    literals: [0],
    maxSize: 1,
  };
  const outlierProblem: ScalarSearchProblem = {
    variables: ['x'],
    columns: [outlierX],
    observed: outlierY,
  };

  async function lossOf(extra: Partial<ScalarSearchOptions>): Promise<number> {
    const { result } = await runSearch(outlierProblem, {
      grammar: outlierGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      seeds: [constantZero],
      ...extra,
    });
    expect(result.front).toHaveLength(1);
    return result.front[0]!.loss;
  }

  it('ranks l1 and huber differently from l2 on a fixed outlier, stably', async () => {
    const l2a = await lossOf({ loss: 'l2' });
    const l2b = await lossOf({ loss: 'l2' });
    const l1a = await lossOf({ loss: 'l1' });
    const l1b = await lossOf({ loss: 'l1' });
    const ha = await lossOf({ loss: 'huber' });
    const hb = await lossOf({ loss: 'huber' });
    expect(Number.isFinite(l2a)).toBe(true);
    expect(Number.isFinite(l1a)).toBe(true);
    expect(Number.isFinite(ha)).toBe(true);
    expect(l1a).not.toBe(l2a);
    expect(ha).not.toBe(l2a);
    expect(ha).not.toBe(l1a);
    expect(Object.is(l2a, l2b)).toBe(true);
    expect(Object.is(l1a, l1b)).toBe(true);
    expect(Object.is(ha, hb)).toBe(true);
  });

  it('a zero weight removes that row from an l2 loss', async () => {
    const withoutOutlier = new Float64Array([0, 1, 2]);
    const sseOthers = await runSearch(
      {
        variables: ['x'],
        columns: [withoutOutlier],
        observed: new Float64Array([0, 1, 2]),
      },
      {
        grammar: outlierGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 1,
        optimizeProbability: 0,
        seeds: [constantZero],
      }
    );
    const weighted = await lossOf({
      loss: 'l2',
      rowWeights: new Float64Array([1, 1, 1, 0]),
    });
    expect(Object.is(weighted, sseOthers.result.front[0]!.loss)).toBe(true);
  });

  it('optimizeProbability 0 still leaves parameters at ones under l1', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['*'],
      unary: [],
      literals: [],
      maxSize: 3,
    };
    const planted = b.op('*', [b.symbol('p'), X]);
    const x = linspace(8, 1, 4);
    const { result } = await runSearch(
      {
        variables: ['x'],
        columns: [x],
        observed: observedOf(b.op('*', [b.number(2), X]), x),
        parameters: ['p'],
      },
      {
        grammar,
        rng: createSeededRng(7),
        maxEvaluations: 20,
        optimizeProbability: 0,
        loss: 'l1',
        seeds: [planted],
      }
    );
    for (const params of result.fittedParameters) {
      expect([...params]).toEqual([1]);
    }
  });

  it('does not refit when every positive-weight row is invalid', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['+'],
      unary: ['log'],
      literals: [],
      maxSize: 5,
    };
    const x = new Float64Array([1, -1]);
    const tree = b.op('+', [b.symbol('p'), b.call('log', X)]);
    const { result } = await runSearch(
      {
        variables: ['x'],
        columns: [x],
        observed: new Float64Array([0, 1]),
        parameters: ['p'],
      },
      {
        grammar,
        rng: createSeededRng(7),
        maxEvaluations: 20,
        optimizeProbability: 1,
        rowWeights: new Float64Array([0, 1]),
        seeds: [tree],
      }
    );
    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.stopReason).toBe('max-evaluations');
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

describe('searchScalars: invalidRows policy', () => {
  // log(x) is invalid exactly on the negative rows: one invalid row in the first
  // fixture, every row in the third.
  const logGrammar: ScalarGrammar = {
    variables: ['x'],
    binary: [],
    unary: ['log'],
    literals: [],
    maxSize: 2,
  };
  const mixedX = new Float64Array([1, -1, 2]);
  const logTree = b.call('ln', X); // the builder lowers 'ln' to the natural-log node 'log'
  const logPTimesX = b.call('ln', b.op('*', [b.symbol('p'), X]));

  async function frontOf(
    problem: ScalarSearchProblem,
    extra: Partial<ScalarSearchOptions>
  ): Promise<ScalarSearchResult> {
    const { result } = await runSearch(problem, {
      grammar: logGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 2,
      optimizeProbability: 0,
      ...extra,
    });
    return result;
  }

  it('reject is the default: an invalid-on-any-row tree is not scored', async () => {
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [mixedX],
      observed: new Float64Array([0, 0, Math.log(2)]),
    };
    for (const invalidRows of [undefined, 'reject'] as const) {
      const result = await frontOf(problem, {
        seeds: [logTree],
        maxEvaluations: 1,
        invalidRows: invalidRows as ScalarSearchOptions['invalidRows'],
      });
      expect(result.front).toEqual([]);
    }
  });

  it('penalize reports one invalid row as exactly one penalty when the rest are exact', async () => {
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [mixedX],
      observed: new Float64Array([0, 0, Math.log(2)]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree],
      maxEvaluations: 1,
      invalidRows: 'penalize',
    });
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 1e8)).toBe(true);
  });

  it('penalize ranks an exact-but-for-one-row log tree ahead of a costlier valid tree', async () => {
    // Any valid tree pays at least (1e5)² per row; the penalized log tree pays one
    // penalty plus the squared error of its two exact rows.
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [mixedX],
      observed: new Float64Array([1e5, 1e5, 1e5]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree, b.number(0)],
      invalidRows: 'penalize',
    });
    expect(result.front.length).toBeGreaterThan(0);
    for (const row of result.front) {
      expect(Number.isFinite(row.loss)).toBe(true);
    }
    const logRow = result.front.find((row) => row.item === logTree);
    const validRow = result.front.find((row) => row.item !== logTree);
    expect(logRow).toBeDefined();
    expect(validRow).toBeDefined();
    expect(logRow!.loss).toBeLessThan(validRow!.loss);
  });

  it('penalize reports no valid row as the penalty times positively weighted rows', async () => {
    const negative = new Float64Array([-1, -2, -3]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negative],
      observed: new Float64Array([0, 0, 0]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree],
      maxEvaluations: 1,
      invalidRows: 'penalize',
    });
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 3e8)).toBe(true);
  });

  it('penalize with rowWeights counts only positively weighted invalid rows when none are valid', async () => {
    const negative = new Float64Array([-1, -2, -3]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negative],
      observed: new Float64Array([0, 0, 0]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree],
      maxEvaluations: 1,
      invalidRows: 'penalize',
      rowWeights: new Float64Array([1, 0, 1]),
    });
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 2e8)).toBe(true);
  });

  it('penalize refits when every weighted row is invalid and fit.initial yields a valid start', async () => {
    const mulLogGrammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['*'],
      unary: ['log'],
      literals: [],
      maxSize: 4,
    };
    const negX = new Float64Array([-2, -3]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negX],
      observed: new Float64Array([Math.log(2), Math.log(3)]),
      parameters: ['p'],
    };
    const { result } = await runSearch(problem, {
      grammar: mulLogGrammar,
      seeds: [logPTimesX],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 1,
      invalidRows: 'penalize',
      fit: { initial: [-1] },
    });
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 0)).toBe(true);
    expect(Object.is(result.fittedParameters[0]![0]!, -1)).toBe(true);
  });

  it('reject still skips refit when no row is valid', async () => {
    const mulLogGrammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['*'],
      unary: ['log'],
      literals: [],
      maxSize: 4,
    };
    const negX = new Float64Array([-2, -3]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negX],
      observed: new Float64Array([Math.log(2), Math.log(3)]),
      parameters: ['p'],
    };
    const { result } = await runSearch(problem, {
      grammar: mulLogGrammar,
      seeds: [logPTimesX],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 1,
      invalidRows: 'reject',
      fit: { initial: [-1] },
    });
    expect(result.front).toEqual([]);
  });

  it('a valid tree whose loss is below that product ranks ahead of the all-invalid tree', async () => {
    const negative = new Float64Array([-1, -2, -3]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [negative],
      observed: new Float64Array([0, 0, 0]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree, b.number(0)],
      invalidRows: 'penalize',
    });
    // The valid tree is cheaper at a smaller complexity, so the front keeps only it.
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 0)).toBe(true);
  });

  it('a zero-weight invalid row is dropped on both sides of the penalize sum', async () => {
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [mixedX],
      observed: new Float64Array([0, 0, Math.log(2)]),
    };
    const result = await frontOf(problem, {
      seeds: [logTree],
      maxEvaluations: 1,
      invalidRows: 'penalize',
      rowWeights: new Float64Array([1, 0, 1]),
    });
    expect(result.front).toHaveLength(1);
    expect(Object.is(result.front[0]!.loss, 0)).toBe(true);
  });

  it('an unknown policy throws before the first yield', async () => {
    await expect(
      runSearch(
        { variables: ['x'], columns: [mixedX], observed: new Float64Array(3) },
        {
          grammar: logGrammar,
          rng: createSeededRng(7),
          maxEvaluations: 2,
          invalidRows: 'discard' as unknown as ScalarSearchOptions['invalidRows'],
        }
      )
    ).rejects.toThrow(RangeError);
  });
});

describe('searchScalars: complexityWeights', () => {
  // The same recorded rows the reproducibility pin holds; restated here because the
  // pin's own `describe` scopes it.
  const WEIGHT_PIN = [
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

  // Seeds only: with `maxEvaluations: 2` the initial population is exactly the two
  // seeds, so the front is these two trees and nothing enumerated joins it.
  const weightsGrammar: ScalarGrammar = {
    variables: ['x'],
    binary: ['+'],
    unary: ['sin'],
    literals: [],
    maxSize: 5,
  };
  const sinTree = b.call('sin', X);
  const plusTree = b.op('+', [X, X]);
  const twoSeedProblem: ScalarSearchProblem = {
    ...quadProblem,
    observed: xs, // y = x: neither seed is exact, both are finite on every row
  };
  const twoSeeds = {
    grammar: weightsGrammar,
    seeds: [sinTree, plusTree],
    rng: createSeededRng(7),
    maxEvaluations: 2,
    optimizeProbability: 0,
  } as const;

  it('weights omitted: the seed-7 pin holds, including the complexities 1, 5, 7', async () => {
    const pinned = {
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 120,
    } as const;
    for (const complexityWeights of [undefined, {}] as const) {
      const { progress, result } = await runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        tournamentP: 0.982,
        complexityWeights,
        ...pinned,
      });
      expect(result.front.map((row) => row.complexity)).toEqual(
        WEIGHT_PIN.map((r) => r.complexity)
      );
      expect(result.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        WEIGHT_PIN.map((r) => r.key)
      );
      result.front.forEach((row, i) => {
        expect(Object.is(row.loss, WEIGHT_PIN[i]!.loss)).toBe(true);
      });
      expect(progress.map((p) => p.evaluations)).toEqual(
        Array.from({ length: 15 }, (_, i) => 8 * (i + 1))
      );
      expect(result.seed).toBe(7);
    }
  });

  it('call weights make a sin tree report the weighted complexity and a +-only tree keep its own', async () => {
    const weights = { call: { sin: 5 } } as const;
    const weighted = await runSearch(twoSeedProblem, { ...twoSeeds, complexityWeights: weights });
    // sin(x) no longer shares the complexity-1 hall slot with x, so both seeds survive.
    expect(weighted.result.front.map((row) => row.complexity)).toEqual([3, 6]);
    expect(weighted.result.front.map((row) => row.item)).toEqual([plusTree, sinTree]);
    expect(weighted.result.front[1]!.complexity).toBe(scalarComplexity(sinTree, weights));
    expect(weighted.result.front[0]!.complexity).toBe(scalarComplexity(plusTree));

    // Unweighted: sin(x) competes with x at complexity 1 and loses the slot to it.
    const unweighted = await runSearch(twoSeedProblem, {
      ...twoSeeds,
      seeds: [sinTree, X],
    });
    expect(unweighted.result.front.map((row) => row.complexity)).toEqual([1]);
    expect(scalarCanonicalKey(unweighted.result.front[0]!.item)).toBe(scalarCanonicalKey(X));
  });

  it('the front stays ordered by the weighted complexity', async () => {
    const { result } = await runSearch(twoSeedProblem, {
      ...twoSeeds,
      maxEvaluations: 40,
      complexityWeights: { call: { sin: 5 }, number: 0.5, symbol: { x: 2 } },
    });
    const complexities = result.front.map((row) => row.complexity);
    expect(complexities).toEqual([...complexities].sort((a, b) => a - b));
    for (const row of result.front) {
      expect(Number.isFinite(row.complexity)).toBe(true);
      expect(Number.isInteger(row.complexity)).toBe(true);
    }
  });

  it('the truncation tie-break and adaptive parsimony rank by the weighted complexity', async () => {
    // Same seed, same problem: weighting x triples its complexity, which moves the
    // parsimony share keys, so a multi-island run evolves differently. The run is
    // still deterministic under the weights.
    const run = (complexityWeights?: ScalarSearchOptions['complexityWeights']) =>
      runSearch(hardProblem, {
        grammar: hardGrammar,
        rng: createSeededRng(7),
        populationSize: 8,
        tournamentSize: 4,
        maxEvaluations: 160,
        populations: 2,
        complexityWeights,
      });
    const plain = await run();
    const weighted = await run({ symbol: { x: 3 } });
    expect(trace(plain.progress)).not.toBe(trace(weighted.progress));
    const again = await run({ symbol: { x: 3 } });
    expect(trace(weighted.progress)).toBe(trace(again.progress));
    expect(weighted.progress).toHaveLength(again.progress.length);
    weighted.progress.forEach((event, i) => {
      expect(event.front.map((r) => scalarCanonicalKey(r.item))).toEqual(
        again.progress[i]!.front.map((r) => scalarCanonicalKey(r.item))
      );
    });
  });

  it('two runs with the same weights match event by event and do not advance options.rng', async () => {
    const rng = createSeededRng(7);
    const options = {
      ...twoSeeds,
      rng,
      maxEvaluations: 40,
      complexityWeights: { call: { sin: 5 } },
    } as const;
    const a = await runSearch(twoSeedProblem, options);
    const c = await runSearch(twoSeedProblem, options);
    expect(a.progress).toHaveLength(c.progress.length);
    a.progress.forEach((event, i) => {
      expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        c.progress[i]!.front.map((row) => scalarCanonicalKey(row.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, c.progress[i]!.front[j]!.loss)).toBe(true);
      });
    });
    expect(rng.next()).toBe(createSeededRng(7).next());
  });

  it('zero weights are accepted and the front stays ordered', async () => {
    const { result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      maxEvaluations: 30,
      optimizeProbability: 0,
      complexityWeights: { number: 0 },
    });
    const complexities = result.front.map((row) => row.complexity);
    expect(complexities).toEqual([...complexities].sort((a, b) => a - b));
    for (const c of complexities) {
      expect(Number.isFinite(c)).toBe(true);
      expect(Number.isInteger(c)).toBe(true);
    }
    // A tree of only symbols costs 0 now, and it exists on the front.
    expect(complexities).toContain(0);
  });

  it('a non-finite weight anywhere throws RangeError before the first yield', async () => {
    const bad = async (weights: unknown) => {
      await expect(
        runSearch(twoSeedProblem, {
          ...twoSeeds,
          complexityWeights: weights as ScalarSearchOptions['complexityWeights'],
        })
      ).rejects.toThrow(RangeError);
    };
    await bad({ number: Number.NaN });
    await bad({ number: Number.POSITIVE_INFINITY });
    await bad({ op: { '+': Number.NaN } });
    await bad({ op: { '+': 1 }, call: { sin: Number.NEGATIVE_INFINITY } });
    await bad({ symbol: Number.NaN });
    await bad({ symbol: { x: Number.POSITIVE_INFINITY, y: 1 } });
    await bad({ op: { '*': -10 } });
    await bad({ number: -1 });
    // Shape errors, for the same reason a bad `fit` is rejected up front.
    await bad(5);
    await bad(null);
    await bad({ op: 5 });
    await bad({ call: [1] });
    await bad({ symbol: ['x'] });
    // An explicitly undefined weight is the omitted weight, not an error.
    await expect(
      runSearch(twoSeedProblem, {
        ...twoSeeds,
        complexityWeights: { number: undefined, op: { '+': undefined } } as never,
      })
    ).resolves.toBeDefined();
  });

  it('rejects non-plain weight containers and accessor or non-enumerable keys', async () => {
    const reject = async (weights: unknown) => {
      await expect(
        runSearch(twoSeedProblem, {
          ...twoSeeds,
          complexityWeights: weights as ScalarSearchOptions['complexityWeights'],
        })
      ).rejects.toThrow(RangeError);
    };
    await reject(new Map([['number', 1]]));
    await reject(new Date());
    await reject(new Float64Array([1]));
    await reject(/x/);
    class Weights {
      op = { '+': 1 };
    }
    await reject(new Weights());
    await reject({
      op: Object.defineProperty({ '+': 1 }, 'sin', {
        value: 2,
        enumerable: false,
      }),
    });
    await reject({
      get op() {
        return { '+': 1 };
      },
    });
    await reject({
      op: Object.defineProperty({}, '+', {
        get: () => 1,
        enumerable: true,
        configurable: true,
      }),
    });
  });

  it('rejects finite weights that would overflow complexity at grammar.maxSize', async () => {
    await expect(
      runSearch(twoSeedProblem, {
        ...twoSeeds,
        grammar: { ...weightsGrammar, maxSize: 4 },
        complexityWeights: { symbol: Number.MAX_VALUE },
      })
    ).rejects.toThrow(RangeError);
  });

  it('uses a snapshot so mutating caller weights after validation does not change the run', async () => {
    const weights: { call: Record<string, number> } = { call: { sin: 5 } };
    const gen = searchScalars(twoSeedProblem, {
      ...twoSeeds,
      maxEvaluations: 40,
      complexityWeights: weights,
    });
    const progress: Awaited<ReturnType<typeof runSearch>>['progress'] = [];
    let step = await gen.next();
    while (!step.done) {
      progress.push(step.value);
      if (progress.length === 1) {
        weights.call.sin = 0.001;
      }
      step = await gen.next();
    }
    const mutatedResult = step.value;
    const baseline = await runSearch(twoSeedProblem, {
      ...twoSeeds,
      maxEvaluations: 40,
      complexityWeights: { call: { sin: 5 } },
    });
    expect(trace(progress)).toBe(trace(baseline.progress));
    expect(mutatedResult.front.map((row) => row.complexity)).toEqual(
      baseline.result.front.map((row) => row.complexity)
    );
  });

  it('call record keys use lowered names: ln is stored as log', () => {
    const lnTree = b.call('ln', X);
    expect(scalarComplexity(lnTree, { call: { log: 5 } })).toBe(6);
    expect(scalarComplexity(lnTree, { call: { ln: 5 } } as never)).toBe(2);
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
    await reject(quadProblem, { ...base, crossoverProbability: -0.1 });
    await reject(quadProblem, { ...base, crossoverProbability: 1.1 });
    await reject(quadProblem, { ...base, crossoverProbability: Number.NaN });
    await reject(quadProblem, {
      ...base,
      loss: 'mae' as unknown as ScalarSearchOptions['loss'],
    });
    await reject(quadProblem, {
      ...base,
      rowWeights: new Float64Array(quadProblem.observed.length - 1),
    });
    await reject(quadProblem, {
      ...base,
      rowWeights: new Float64Array(quadProblem.observed.length).fill(-1),
    });
    await reject(quadProblem, {
      ...base,
      rowWeights: Float64Array.from({ length: quadProblem.observed.length }, (_, i) =>
        i === 0 ? Number.NaN : 1
      ),
    });
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

describe('searchScalars: admit', () => {
  function containsSin(node: ScalarNode): boolean {
    let found = false;
    forEachScalar(node, (n) => {
      if (n.kind === 'call' && n.fn === 'sin') {
        found = true;
      }
    });
    return found;
  }

  function reportedNodes(
    progress: readonly SearchProgress[],
    result: ScalarSearchResult
  ): ScalarNode[] {
    return [
      ...progress.flatMap((event) => event.front.map((row) => row.item)),
      ...result.front.map((row) => row.item),
    ];
  }

  const noSin = (node: ScalarNode): boolean => !containsSin(node);

  // unary-only `sin` so addNode / randomizeTree wrap a subtree in `sin`. The planted
  // law is `sin(x)` so a `sin` seed or wrap has the lowest loss and stays on the
  // front (on `x^2+x` it is Pareto-dominated by `x`). Enumeration already applies
  // `admit`; any `sin` that still appears is a seed or a mutation.
  const sinGrammar: ScalarGrammar = {
    variables: ['x'],
    binary: [],
    unary: ['sin'],
    literals: [],
    maxSize: 5,
  };
  const plantedSin = b.call('sin', X);
  const sinProblem: ScalarSearchProblem = {
    ...quadProblem,
    observed: observedOf(plantedSin, xs),
  };

  it('never reports a sin node when admit rejects sin, including a sin seed and a mutation wrap', async () => {
    const shared = {
      rng: createSeededRng(7),
      seeds: [plantedSin],
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 80,
    } as const;

    const open = await runSearch(sinProblem, { ...shared, grammar: sinGrammar });
    expect(reportedNodes(open.progress, open.result).some(containsSin)).toBe(true);

    const closed = await runSearch(sinProblem, {
      ...shared,
      grammar: { ...sinGrammar, admit: noSin },
    });
    for (const node of reportedNodes(closed.progress, closed.result)) {
      expect(containsSin(node)).toBe(false);
    }
  });

  it('never reports a sin node from a mutation wrap when admit rejects sin and no sin seed is given', async () => {
    // No seed: enumeration already applies admit, so the initial population is
    // only `x`. Any later `sin` would be an addNode / randomizeTree wrap.
    const closed = await runSearch(sinProblem, {
      grammar: { ...sinGrammar, admit: noSin },
      rng: createSeededRng(7),
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 80,
    });
    expect(closed.result.front.length).toBeGreaterThan(0);
    for (const node of reportedNodes(closed.progress, closed.result)) {
      expect(containsSin(node)).toBe(false);
    }
  });

  it('is identical across two runs with the same seed and the same admit', async () => {
    const rng = createSeededRng(11);
    const options = {
      grammar: { ...sinGrammar, admit: noSin, binary: ['+', '*'] as const, literals: [1] },
      rng,
      seeds: [b.call('sin', X)],
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 64,
    } as const;
    const a = await runSearch(sinProblem, options);
    const c = await runSearch(sinProblem, options);
    expect(a.progress).toHaveLength(c.progress.length);
    a.progress.forEach((event, i) => {
      const other = c.progress[i]!;
      expect(event.evaluations).toBe(other.evaluations);
      expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        other.front.map((row) => scalarCanonicalKey(row.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
      });
    });
    expect(rng.next()).toBe(createSeededRng(11).next());
    for (const node of reportedNodes(a.progress, a.result)) {
      expect(containsSin(node)).toBe(false);
    }
  });

  it('throws the existing RangeError when admit rejects every tree', async () => {
    const grammar: ScalarGrammar = { ...quadGrammar, admit: () => false };
    // A structure-ok seed that admit rejects: without the search-side check this
    // seed would enter the population and the run would return a front.
    await expect(
      runSearch(quadProblem, {
        grammar,
        rng: createSeededRng(7),
        seeds: [X],
        maxEvaluations: 10,
      })
    ).rejects.toThrow('searchScalars: the grammar admits no tree');
  });

  it('scalarGrammarAccepts still does not call admit', () => {
    const grammar: ScalarGrammar = { ...sinGrammar, admit: () => false };
    expect(scalarGrammarAccepts(grammar, b.call('sin', X))).toBe(true);
    expect(scalarGrammarAccepts(grammar, X)).toBe(true);
  });
});

describe('searchScalars: crossover', () => {
  const Y = b.symbol('y');
  const left = b.op('+', [X, Y]);
  const right = b.number(7);
  const graft = b.op('+', [X, right]);
  const allowed = new Set([
    scalarCanonicalKey(left),
    scalarCanonicalKey(right),
    scalarCanonicalKey(graft),
  ]);
  // The operator test already owns the graft shape (x+y with donor 7 at y).
  // admit rejects the other structure-legal grafts (7+y, bare 7 as a replacement
  // of the root is already a seed). Mutations are forced to fail, so the search
  // can introduce x+7 only through crossoverSubtrees.
  const graftGrammar: ScalarGrammar = {
    variables: ['x', 'y'],
    binary: ['+'],
    unary: [],
    literals: [7],
    maxSize: 3,
    admit: (node) => allowed.has(scalarCanonicalKey(node)),
  };
  const graftProblem: ScalarSearchProblem = {
    variables: ['x', 'y'],
    columns: [xs, xs],
    // The hall keeps one tree per complexity. x+y and x+7 are both size 3, so
    // the graft only appears on the front when its loss wins that slot.
    observed: compileScalar(graft, { variables: ['x', 'y'] }).evaluate([xs, xs]).values,
  };

  it('probability 0.5 matches itself event by event and does not advance options.rng', async () => {
    const rng = createSeededRng(7);
    const options = {
      grammar: quadGrammar,
      rng,
      tournamentP: 0.982,
      crossoverProbability: 0.5,
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 120,
    } as const;
    const a = await runSearch(quadProblem, options);
    const c = await runSearch(quadProblem, options);
    expect(a.progress).toHaveLength(c.progress.length);
    a.progress.forEach((event, i) => {
      const other = c.progress[i]!;
      expect(event.evaluations).toBe(other.evaluations);
      expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        other.front.map((row) => scalarCanonicalKey(row.item))
      );
      event.front.forEach((row, j) => {
        expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
      });
    });
    expect(rng.next()).toBe(createSeededRng(7).next());
  });

  it('probability 1 with two parents whose only legal crossover is one graft reports that graft', async () => {
    seenTemperatures.failMutations = true;
    try {
      const { result } = await runSearch(graftProblem, {
        grammar: graftGrammar,
        rng: createSeededRng(7),
        seeds: [left, right],
        populationSize: 2,
        tournamentSize: 1,
        crossoverProbability: 1,
        optimizeProbability: 0,
        maxEvaluations: 80,
      });
      expect(result.front.map((row) => scalarCanonicalKey(row.item))).toContain(
        scalarCanonicalKey(graft)
      );
    } finally {
      seenTemperatures.failMutations = false;
    }
  });

  // Target is x so a size-1 mutation to x wins the hall. x+y and x+7 share
  // complexity 3 and would not prove the mutation child was kept.
  const fallthroughProblem: ScalarSearchProblem = {
    variables: ['x', 'y'],
    columns: [xs, xs],
    observed: xs,
  };
  const fallthroughGrammar: ScalarGrammar = {
    variables: ['x', 'y'],
    binary: ['+'],
    unary: [],
    literals: [7],
    maxSize: 3,
  };

  it('an admit-rejected crossover falls through to mutation', async () => {
    const graftKey = scalarCanonicalKey(graft);
    const mutatedKey = scalarCanonicalKey(X);
    seenTemperatures.forceCrossover = graft;
    seenTemperatures.replaceMutation = X;
    try {
      const { result } = await runSearch(fallthroughProblem, {
        grammar: {
          ...fallthroughGrammar,
          admit: (node) => scalarCanonicalKey(node) !== graftKey,
        },
        rng: createSeededRng(7),
        seeds: [left, right],
        populationSize: 2,
        tournamentSize: 1,
        crossoverProbability: 1,
        optimizeProbability: 0,
        maxEvaluations: 8,
      });
      const keys = result.front.map((row) => scalarCanonicalKey(row.item));
      expect(keys).not.toContain(graftKey);
      expect(keys).toContain(mutatedKey);
    } finally {
      seenTemperatures.forceCrossover = undefined;
      seenTemperatures.replaceMutation = undefined;
    }
  });

  it('a null crossover falls through to mutation', async () => {
    seenTemperatures.forceCrossover = null;
    seenTemperatures.replaceMutation = X;
    try {
      const { result } = await runSearch(fallthroughProblem, {
        grammar: fallthroughGrammar,
        rng: createSeededRng(7),
        seeds: [left, right],
        populationSize: 2,
        tournamentSize: 1,
        crossoverProbability: 1,
        optimizeProbability: 0,
        maxEvaluations: 8,
      });
      expect(result.front.map((row) => scalarCanonicalKey(row.item))).toContain(
        scalarCanonicalKey(X)
      );
    } finally {
      seenTemperatures.forceCrossover = undefined;
      seenTemperatures.replaceMutation = undefined;
    }
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

describe('searchScalars: simplify', () => {
  // Restated from the reproducibility pin, which scopes PINNED_ROWS to its own
  // describe. The expectations here are the same rows; the pin itself is untouched.
  const SIMPLIFY_PIN = [
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
  const pinned = {
    populationSize: 8,
    tournamentSize: 4,
    maxEvaluations: 120,
  } as const;

  for (const simplify of [undefined, 'off'] as const) {
    it(`simplify ${String(simplify)}: the seed-7 pin is unchanged`, async () => {
      const { progress, result } = await runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        tournamentP: 0.982,
        simplify,
        ...pinned,
      });
      expect(result.front.map((row) => row.complexity)).toEqual(
        SIMPLIFY_PIN.map((r) => r.complexity)
      );
      expect(result.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
        SIMPLIFY_PIN.map((r) => r.key)
      );
      result.front.forEach((row, i) => {
        expect(Object.is(row.loss, SIMPLIFY_PIN[i]!.loss)).toBe(true);
      });
      expect(progress.map((p) => p.evaluations)).toEqual(
        Array.from({ length: 15 }, (_, i) => 8 * (i + 1))
      );
      expect(result.seed).toBe(7);
      expect(result.simplifyFallbacks).toBe(0);
    });
  }

  it('rejects an unknown simplify mode before the first yield', async () => {
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        simplify: 'fold' as unknown as ScalarSearchOptions['simplify'],
      })
    ).rejects.toThrow(RangeError);
  });

  // (2*3)*x and the folded 6*x are both structure-legal: literals [2,3,6] is the pool
  // `randomizeTree` samples from (with replacement), not a whitelist of allowed numbers.
  // One seed, one evaluation, no refit: the front row is exactly that tree.
  const constGrammar: ScalarGrammar = {
    variables: ['x'],
    binary: ['*'],
    unary: [],
    literals: [2, 3, 6],
    maxSize: 7,
  };
  const seed23x = b.op('*', [b.op('*', [b.number(2), b.number(3)]), X]);
  const folded6x = b.op('*', [b.number(6), X]);
  const constProblem: ScalarSearchProblem = {
    variables: ['x'],
    columns: [xs],
    observed: observedOf(folded6x, xs),
  };
  const constSeed = {
    grammar: constGrammar,
    seeds: [seed23x],
    rng: createSeededRng(7),
    maxEvaluations: 1,
    optimizeProbability: 0,
  } as const;

  it("'constants' scores (2*3)*x as the canonical key of 6*x", async () => {
    const { result } = await runSearch(constProblem, { ...constSeed, simplify: 'constants' });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(folded6x));
    // The keys alone cannot prove the fold (the canonical form already folds
    // 2*3): the stored tree is the folded shape, at the folded tree's complexity,
    // not the seed's.
    expect(result.front[0]!.item).toEqual(folded6x);
    expect(result.front[0]!.complexity).toBe(scalarComplexity(folded6x));
    // The folded tree is the one scored: its loss is bit-equal to a run seeded with
    // 6*x itself.
    const direct = await runSearch(constProblem, { ...constSeed, seeds: [folded6x] });
    expect(Object.is(result.front[0]!.loss, direct.result.front[0]!.loss)).toBe(true);
  });

  it("'constants' reports the folded tree's complexity under complexityWeights", async () => {
    const weights = { number: 0.5 } as const;
    const { result } = await runSearch(constProblem, {
      ...constSeed,
      simplify: 'constants',
      complexityWeights: weights,
    });
    expect(result.front).toHaveLength(1);
    expect(result.front[0]!.complexity).toBe(scalarComplexity(folded6x, weights));
  });

  it("'algebraic' scores a/(b/c) as the canonical key simplifyScalar produces", async () => {
    const A = b.symbol('a');
    const B = b.symbol('b');
    const C = b.symbol('c');
    const quotientGrammar: ScalarGrammar = {
      variables: ['a', 'b', 'c'],
      binary: ['/', '*'],
      unary: [],
      literals: [],
      maxSize: 5,
    };
    const quotientSeed = b.op('/', [A, b.op('/', [B, C])]);
    const simplified = simplifyScalar(quotientSeed);
    // The premise of the acceptance item: the simplify result is still in the grammar.
    expect(scalarGrammarAccepts(quotientGrammar, simplified)).toBe(true);
    const columns = [xs, xs, xs];
    const problem: ScalarSearchProblem = {
      variables: ['a', 'b', 'c'],
      columns,
      observed: compileScalar(simplified, { variables: ['a', 'b', 'c'] }).evaluate(columns).values,
    };
    const { result } = await runSearch(problem, {
      grammar: quotientGrammar,
      seeds: [quotientSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      simplify: 'algebraic',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(simplified));
    // The stored tree is the simplified shape (a/(b/c) and a*c/b share a canonical
    // key, so only the structure and the rounding-sensitive loss tell them apart).
    expect(result.front[0]!.item).toEqual(simplified);
    const direct = await runSearch(problem, {
      grammar: quotientGrammar,
      seeds: [simplified],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
    });
    expect(Object.is(result.front[0]!.loss, direct.result.front[0]!.loss)).toBe(true);
  });

  it('a simplify result with an operator outside the grammar is discarded and the original is scored', async () => {
    const A = b.symbol('a');
    const B = b.symbol('b');
    const C = b.symbol('c');
    // '*' is not in the grammar, so simplifyScalar's a*c/b is not acceptable.
    const quotientGrammar: ScalarGrammar = {
      variables: ['a', 'b', 'c'],
      binary: ['/'],
      unary: [],
      literals: [],
      maxSize: 5,
    };
    const quotientSeed = b.op('/', [A, b.op('/', [B, C])]);
    expect(scalarGrammarAccepts(quotientGrammar, simplifyScalar(quotientSeed))).toBe(false);
    const columns = [xs, xs, xs];
    const problem: ScalarSearchProblem = {
      variables: ['a', 'b', 'c'],
      columns,
      observed: compileScalar(quotientSeed, { variables: ['a', 'b', 'c'] }).evaluate(columns)
        .values,
    };
    const { result } = await runSearch(problem, {
      grammar: quotientGrammar,
      seeds: [quotientSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      simplify: 'algebraic',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(quotientSeed));
    // The stored tree is the unsimplified shape, and its loss is bit-equal to a run
    // without the option.
    expect(result.front[0]!.item).toEqual(quotientSeed);
    const direct = await runSearch(problem, {
      grammar: quotientGrammar,
      seeds: [quotientSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
    });
    expect(Object.is(result.front[0]!.loss, direct.result.front[0]!.loss)).toBe(true);
  });

  it('a ScalarBuildError from simplifyScalar keeps the unsimplified tree', async () => {
    // (-8)^(1/3) simplifies into the complex numbers, which the bridge refuses with
    // ScalarBuildError; the search must keep the unsimplified tree and score it.
    const third = b.op('/', [b.number(1), b.number(3)]);
    const complexSeed = b.op('+', [b.op('^', [b.number(-8), third]), X]);
    expect(() => simplifyScalar(complexSeed)).toThrow(ScalarBuildError);
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+', '^', '/'],
      unary: [],
      literals: [-8, 1, 3],
      maxSize: 7,
    };
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [xs],
      // The seed itself is invalid on every row (a negative base to a fractional
      // power is NaN), so 'penalize' keeps it on the front at one penalty a row.
      observed: new Float64Array(xs.length),
    };
    const { progress, result } = await runSearch(problem, {
      grammar,
      seeds: [complexSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      invalidRows: 'penalize',
      simplify: 'algebraic',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(complexSeed));
    expect(Object.is(result.front[0]!.loss, xs.length * 1e8)).toBe(true);
    // The unsimplified tree scores exactly as it would without the option.
    const plain = await runSearch(problem, {
      grammar,
      seeds: [complexSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      invalidRows: 'penalize',
    });
    expect(progress).toHaveLength(plain.progress.length);
    expect(Object.is(result.front[0]!.loss, plain.result.front[0]!.loss)).toBe(true);
  });

  it('admit can keep the unsimplified seed when the simplified shape is rejected', async () => {
    // The canonical keys of (2*3)*x and 6*x already agree, so admit must reject the
    // folded shape structurally.
    const isFoldedShape = (node: ScalarNode): boolean =>
      node.kind === 'op' &&
      node.op === '*' &&
      node.args[0]!.kind === 'number' &&
      node.args[0]!.value === 6;
    const { result } = await runSearch(constProblem, {
      ...constSeed,
      simplify: 'constants',
      grammar: { ...constGrammar, admit: (node) => !isFoldedShape(node) },
    });
    expect(result.front).toHaveLength(1);
    expect(result.front[0]!.item).toEqual(seed23x);
  });

  it('the scored tree is the simplified one: its refitted parameters reproduce the loss', async () => {
    const P = b.symbol('p');
    const pGrammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['p'],
      binary: ['*'],
      unary: [],
      literals: [2, 3, 6],
      maxSize: 9,
    };
    const pSeed = b.op('*', [P, b.op('*', [b.op('*', [b.number(2), b.number(3)]), X])]);
    const pFolded = b.op('*', [P, b.op('*', [b.number(6), X])]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [xs],
      observed: observedOf(b.op('*', [b.number(12), X]), xs),
      parameters: ['p'],
    };
    const { result } = await runSearch(problem, {
      grammar: pGrammar,
      seeds: [pSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 1,
      simplify: 'constants',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(pFolded));
    expect(Math.abs(result.fittedParameters[0]![0]! - 2)).toBeLessThan(1e-6);
    expect(result.front[0]!.loss).toBeLessThan(1e-10);
  });

  it('a fold to a non-finite constant is not scored as a number node', async () => {
    // 2/0 folds to Infinity, which simplifyConstants refuses; the original division
    // stays and is invalid on every row, so 'penalize' reports 3 penalties.
    const divGrammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['/'],
      unary: [],
      literals: [2, 0],
      maxSize: 3,
    };
    const divSeed = b.op('/', [b.number(2), b.number(0)]);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [new Float64Array([1, 2, 3])],
      observed: new Float64Array([0, 0, 0]),
    };
    const { result } = await runSearch(problem, {
      grammar: divGrammar,
      seeds: [divSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      invalidRows: 'penalize',
      simplify: 'constants',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(divSeed));
    expect(Object.is(result.front[0]!.loss, 3e8)).toBe(true);
  });

  it("'algebraic' does not accept x/x as 1 when x=0 is invalid under invalidRows:'reject'", async () => {
    const fiveX = new Float64Array([0, 1, 2, 3, 4]);
    const divSeed = b.op('/', [X, X]);
    const divGrammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['/'],
      unary: [],
      literals: [],
      maxSize: 3,
    };
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [fiveX],
      observed: new Float64Array([1, 1, 1, 1, 1]),
    };
    expect(() => simplifyScalar(divSeed)).not.toThrow();
    expect(scalarGrammarAccepts(divGrammar, simplifyScalar(divSeed))).toBe(true);
    const { result } = await runSearch(problem, {
      grammar: divGrammar,
      seeds: [divSeed],
      rng: createSeededRng(7),
      maxEvaluations: 1,
      optimizeProbability: 0,
      invalidRows: 'penalize',
      simplify: 'algebraic',
    });
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(divSeed));
    expect(result.front[0]!.loss).toBeGreaterThan(1e7);
    expect(result.simplifyFallbacks).toBe(1);
  });

  it('RangeError from simplifyScalar keeps the original tree', async () => {
    const factories = await import('../src/factories/index.js');
    const spy = vi.spyOn(factories, 'simplifyScalar').mockImplementation(() => {
      throw new RangeError('stack');
    });
    try {
      expect(simplifyCandidateForTest(X, 'algebraic')).toEqual(X);
      const { result } = await runSearch(constProblem, {
        ...constSeed,
        simplify: 'algebraic',
      });
      expect(result.front).toHaveLength(1);
      expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(seed23x));
      expect(result.simplifyFallbacks).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('calls admit once when constants simplify is a canonical no-op', async () => {
    let admitCalls = 0;
    const { result } = await runSearch(constProblem, {
      ...constSeed,
      seeds: [folded6x],
      simplify: 'constants',
      grammar: {
        ...constGrammar,
        admit: (node) => {
          admitCalls += 1;
          return scalarGrammarAccepts(constGrammar, node);
        },
      },
    });
    expect(result.front).toHaveLength(1);
    expect(admitCalls).toBe(1);
  });

  it("'algebraic' at seed 7 can drop the exact loss-0 x^2+x row; SR-8 does not fix simplify:'algebraic'", async () => {
    const { result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      simplify: 'algebraic',
      ...pinned,
    });
    const lossZero = result.front.filter((row) => row.loss === 0);
    expect(lossZero.some((row) => row.complexity === 7)).toBe(false);
    expect(
      result.front.some(
        (row) =>
          row.complexity === 5 &&
          scalarCanonicalKey(row.item) ===
            '{"k":"*","a":[{"k":"+","a":[{"k":"n","v":"1"},{"k":"s","v":"x"}]},{"k":"s","v":"x"}]}'
      )
    ).toBe(true);
  });

  it('two runs with the same seed and simplify mode match event by event and do not advance options.rng', async () => {
    for (const simplify of ['constants', 'algebraic'] as const) {
      const rng = createSeededRng(7);
      const options = {
        grammar: quadGrammar,
        rng,
        tournamentP: 0.982,
        simplify,
        ...pinned,
      } as const;
      const a = await runSearch(quadProblem, options);
      const c = await runSearch(quadProblem, options);
      expect(a.progress).toHaveLength(c.progress.length);
      a.progress.forEach((event, i) => {
        expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
          c.progress[i]!.front.map((row) => scalarCanonicalKey(row.item))
        );
        event.front.forEach((row, j) => {
          expect(Object.is(row.loss, c.progress[i]!.front[j]!.loss)).toBe(true);
        });
      });
      expect(rng.next()).toBe(createSeededRng(7).next());
    }
  });
});

describe('searchScalars: dimensions (SR-9)', () => {
  // Restated from the reproducibility pin, which scopes PINNED_ROWS to its own
  // describe. The pin itself is untouched; omitted `dimensions` must leave the
  // recorded search byte for byte.
  const DIM_PIN = [
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
  const pinned = {
    populationSize: 8,
    tournamentSize: 4,
    maxEvaluations: 120,
  } as const;

  const frac = (n: number, d: number): Fraction => new Fraction(BigInt(n), BigInt(d));
  /** `[L, M, T, I, Θ, N, J]` in whole exponents. */
  const si = (
    l: number,
    m: number,
    t: number,
    i: number,
    th: number,
    n: number,
    j: number
  ): RationalDimension => [
    frac(l, 1),
    frac(m, 1),
    frac(t, 1),
    frac(i, 1),
    frac(th, 1),
    frac(n, 1),
    frac(j, 1),
  ];
  const length = si(1, 0, 0, 0, 0, 0, 0);
  const time = si(0, 0, 1, 0, 0, 0, 0);
  const dimensionless = si(0, 0, 0, 0, 0, 0, 0);
  const lengthSquared = si(2, 0, 0, 0, 0, 0, 0);

  it('omitted dimensions: the seed-7 pin is unchanged', async () => {
    const { progress, result } = await runSearch(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      ...pinned,
    });
    expect(result.front.map((row) => row.complexity)).toEqual(DIM_PIN.map((r) => r.complexity));
    expect(result.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      DIM_PIN.map((r) => r.key)
    );
    result.front.forEach((row, i) => {
      expect(Object.is(row.loss, DIM_PIN[i]!.loss)).toBe(true);
    });
    expect(progress.map((p) => p.evaluations)).toEqual(
      Array.from({ length: 15 }, (_, i) => 8 * (i + 1))
    );
  });

  it('x + x enters the front for a length target and is absent for a time target', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['sin'],
      literals: [],
      maxSize: 3,
    };
    const problem: ScalarSearchProblem = {
      ...quadProblem,
      observed: observedOf(b.op('+', [X, X]), xs),
    };
    const base = {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 50,
      dimensions: { symbols: { x: length }, target: length },
    } as const;
    const lengthRun = await runSearch(problem, base);
    const sumKey = '{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"x"}]}';
    const lengthKeys = lengthRun.result.front.map((row) => scalarCanonicalKey(row.item));
    expect(lengthKeys).toContain(sumKey);
    expect(lengthKeys.some((key) => key.includes('sin'))).toBe(false);
    for (const row of lengthRun.result.front) {
      expect(Number.isFinite(row.loss)).toBe(true);
    }

    const timeRun = await runSearch(problem, {
      ...base,
      dimensions: { symbols: { x: length }, target: time },
    });
    const timeKeys = timeRun.result.front.map((row) => scalarCanonicalKey(row.item));
    expect(timeKeys).not.toContain(sumKey);
    expect(timeKeys.some((key) => key.includes('sin'))).toBe(false);
  });

  it('a violating tree still counts as an evaluation but never enters the hall', async () => {
    const sinX = b.call('sin', X);
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: [],
      unary: ['sin'],
      literals: [],
      maxSize: 2,
      admit: (node) => scalarCanonicalKey(node) === scalarCanonicalKey(sinX),
    };
    const { result } = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [sinX],
      dimensions: { symbols: { x: length }, target: length },
    });
    expect(result.evaluations).toBe(1);
    expect(result.front).toHaveLength(0);
    expect(result.stopReason).toBe('max-evaluations');
  });

  it('a variable omitted from symbols is unknown: an empty symbols record rejects every tree', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: [],
      unary: [],
      literals: [],
      maxSize: 1,
    };
    const { result } = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [X],
      dimensions: { symbols: {}, target: dimensionless },
    });
    expect(result.evaluations).toBe(1);
    expect(result.front).toHaveLength(0);
  });

  it('a parameter in p * x with a length target solves as dimensionless and is scored', async () => {
    const product = b.op('*', [b.symbol('p'), X]);
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['*'],
      unary: [],
      literals: [],
      parameters: ['p'],
      maxSize: 3,
      admit: (node) => scalarCanonicalKey(node) === scalarCanonicalKey(product),
    };
    const { result } = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [product],
      dimensions: { symbols: { x: length }, target: length },
    });
    expect(result.evaluations).toBe(1);
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(product));
    expect(Number.isFinite(result.front[0]!.loss)).toBe(true);
  });

  it('p + x with p fixed dimensionless is inconsistent and does not enter the hall', async () => {

    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: [],
      literals: [],

      parameters: ['p'],
      maxSize: 3,
    };
    const { result } = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 5,
      seeds: [b.op('+', [b.symbol('p'), X])],
      dimensions: {
        symbols: { x: length, p: dimensionless },
        target: length,
      },
    });
    const keys = result.front.map((row) => scalarCanonicalKey(row.item));
    expect(keys).not.toContain(scalarCanonicalKey(b.op('+', [b.symbol('p'), X])));
  });

  it('onUnderdetermined reject still scores a tree when a listed parameter is unused', async () => {
    const law = b.op('+', [b.op('^', [X, b.number(2)]), X]);
    const lawKey = scalarCanonicalKey(law);
    const { result } = await runSearch(
      { ...quadProblem, parameters: ['p'] },
      {
        grammar: {
          ...quadGrammar,
          parameters: ['p'],
          admit: (node) => scalarCanonicalKey(node) === lawKey,
        },
        rng: createSeededRng(7),
        maxEvaluations: 1,
        seeds: [law],
        dimensions: {
          symbols: { x: dimensionless },
          target: dimensionless,
          onUnderdetermined: 'reject',
        },
      }
    );
    expect(result.evaluations).toBe(1);
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(lawKey);
    expect(result.front[0]!.complexity).toBe(5);
    expect(result.front[0]!.loss).toBe(0);
  });

  it('infer and solve both reject x^3 and x + x when the target dimension disagrees', () => {
    const cube = b.op('^', [X, b.number(3)]);
    const sum = b.op('+', [X, X]);
    const cubeInf = inferScalarDimension(cube, { x: length });
    const sumInf = inferScalarDimension(sum, { x: length });
    expect(cubeInf.ok).toBe(true);
    expect(sumInf.ok).toBe(true);
    if (cubeInf.ok) {
      expect(rationalDimensionsEqual(cubeInf.dimension, length)).toBe(false);
    }
    if (sumInf.ok) {
      expect(rationalDimensionsEqual(sumInf.dimension, time)).toBe(false);
    }
    expect(solveParameterDimensions(cube, { x: length }, length, [])).toEqual({
      inconsistent: true,
    });
    expect(solveParameterDimensions(sum, { x: length }, time, [])).toEqual({ inconsistent: true });
  });

  it('empty problem.parameters forces infer mode but still checks target', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: [],
      literals: [],
      maxSize: 2,
      parameters: ['p'],
    };
    const problem: ScalarSearchProblem = { ...quadProblem, parameters: [] };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [b.op('+', [X, X])],
      dimensions: { symbols: { x: length }, target: time },
    });
    expect(result.evaluations).toBe(1);
    expect(result.front).toHaveLength(0);
  });

  it('an underdetermined solve is scored by default (keep) and dropped with reject', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['*'],
      unary: [],
      literals: [],
      parameters: ['p1', 'p2'],
      maxSize: 3,
    };
    const product = b.op('*', [b.symbol('p1'), b.symbol('p2')]);
    const options = {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [product],
      dimensions: {
        symbols: { x: length },
        target: length,
        onUnderdetermined: undefined as 'keep' | 'reject' | undefined,
      },
    };
    const kept = await runSearch(quadProblem, options);
    expect(kept.result.evaluations).toBe(1);
    expect(kept.result.front.map((row) => scalarCanonicalKey(row.item))).toContain(
      scalarCanonicalKey(product)
    );
    const rejected = await runSearch(quadProblem, {
      ...options,
      rng: createSeededRng(7),
      dimensions: { ...options.dimensions, onUnderdetermined: 'reject' },
    });
    expect(rejected.result.evaluations).toBe(1);
    expect(rejected.result.front).toHaveLength(0);
  });

  it('simplify constants folds an exponent before the dimension check against target', async () => {
    const exponentTree = b.op('^', [X, b.op('+', [b.number(1), b.number(1)])]);
    const squared = b.op('^', [X, b.number(2)]);
    const simplifiedKey = scalarCanonicalKey(squared);
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['^', '+'],
      unary: [],
      literals: [1],
      maxSize: 5,
      admit: (node) => scalarCanonicalKey(node) === scalarCanonicalKey(exponentTree),
    };
    const withSimplify = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [exponentTree],
      simplify: 'constants',
      dimensions: { symbols: { x: length }, target: lengthSquared },
    });
    expect(withSimplify.result.evaluations).toBe(1);
    expect(withSimplify.result.front).toHaveLength(1);
    expect(scalarCanonicalKey(withSimplify.result.front[0]!.item)).toBe(simplifiedKey);
    expect(Number.isFinite(withSimplify.result.front[0]!.loss)).toBe(true);

    const withoutSimplify = await runSearch(quadProblem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [exponentTree],
      simplify: 'off',
      dimensions: { symbols: { x: length }, target: lengthSquared },
    });
    expect(withoutSimplify.result.evaluations).toBe(1);
    expect(withoutSimplify.result.front).toHaveLength(0);
  });

  it('rejects a target that is not seven Fractions with TypeError before the first yield', async () => {
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        dimensions: {
          symbols: { x: length },
          target: [1, 0, 0, 0, 0, 0, 0] as unknown as RationalDimension,
        },
      })
    ).rejects.toThrow(TypeError);
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        dimensions: {
          symbols: { x: [frac(1, 1)] as unknown as RationalDimension },
          target: length,
        },
      })
    ).rejects.toThrow(TypeError);
  });

  it('rejects an unknown onUnderdetermined mode with RangeError', async () => {
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        dimensions: {
          symbols: { x: length },
          target: length,
          onUnderdetermined: 'drop' as 'keep' | 'reject',
        },
      })
    ).rejects.toThrow(RangeError);
  });

  it('rejects dimensions null and non-plain symbols before the first yield', async () => {
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        dimensions: null as unknown as ScalarSearchOptions['dimensions'],
      })
    ).rejects.toThrow(RangeError);
    await expect(
      runSearch(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        dimensions: {
          symbols: new Map([['x', length]]) as unknown as Record<string, RationalDimension>,
          target: length,
        },
      })
    ).rejects.toThrow(RangeError);

describe('searchScalars: sqrt and atan', () => {
  it('a grammar that does not list sqrt or atan still rejects their nodes', () => {
    expect(scalarGrammarAccepts(quadGrammar, b.call('sqrt', X))).toBe(false);
    expect(scalarGrammarAccepts(quadGrammar, b.call('atan', X))).toBe(false);
  });

  it('a seeded sqrt tree over a non-negative column scores exactly and enters the front', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['sqrt'],
      literals: [],
      maxSize: 3,
    };
    const nonNegative = linspace(12, 0, 11);
    const law = b.call('sqrt', X);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [nonNegative],
      observed: observedOf(law, nonNegative),
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 60,
      seeds: [law],
    });
    expect(
      result.front.some(
        (row) =>
          row.loss === 0 &&
          row.complexity === 2 &&
          scalarCanonicalKey(row.item) === scalarCanonicalKey(law)
      )
    ).toBe(true);
  });

  it('a seeded atan tree over a non-negative column scores exactly and enters the front', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['atan'],
      literals: [],
      maxSize: 3,
    };
    const nonNegative = linspace(12, 0, 5);
    const law = b.call('atan', X);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [nonNegative],
      observed: observedOf(law, nonNegative),
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 60,
      seeds: [law],
    });
    expect(
      result.front.some(
        (row) =>
          row.loss === 0 &&
          row.complexity === 2 &&
          scalarCanonicalKey(row.item) === scalarCanonicalKey(law)
      )
    ).toBe(true);
  });

  it('a seed the grammar rejects is skipped without throwing', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: [],
      literals: [],
      maxSize: 3,
    };
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [xs],
      observed: observedOf(plantedQuad, xs),
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 20,
      seeds: [b.call('sqrt', X)],
    });
    for (const row of result.front) {
      expect(scalarCanonicalKey(row.item)).not.toBe(scalarCanonicalKey(b.call('sqrt', X)));
    }
  });

  it("'algebraic' simplify does not fall back on a plain sqrt seed", async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['sqrt'],
      literals: [],
      maxSize: 3,
    };
    const nonNegative = linspace(8, 0, 7);
    const law = b.call('sqrt', X);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [nonNegative],
      observed: observedOf(law, nonNegative),
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [law],
      optimizeProbability: 0,
      simplify: 'algebraic',
    });
    expect(result.simplifyFallbacks).toBe(0);
    expect(result.front).toHaveLength(1);
    expect(scalarCanonicalKey(result.front[0]!.item)).toBe(scalarCanonicalKey(law));
  });

  it('exports a sqrt front row through frontToJson and frontToLatexTable', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['sqrt'],
      literals: [],
      maxSize: 3,
    };
    const nonNegative = linspace(6, 0, 5);
    const law = b.call('sqrt', X);
    const problem: ScalarSearchProblem = {
      variables: ['x'],
      columns: [nonNegative],
      observed: observedOf(law, nonNegative),
    };
    const { result } = await runSearch(problem, {
      grammar,
      rng: createSeededRng(7),
      maxEvaluations: 1,
      seeds: [law],
      optimizeProbability: 0,
    });
    expect(() => frontToJson(result.front)).not.toThrow();
    expect(frontToLatexTable(result.front).includes('\\sqrt')).toBe(true);
  });
});
