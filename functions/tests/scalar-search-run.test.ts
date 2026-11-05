import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  runScalarSearch,
  searchScalars,
  selectFrontModel,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type ScalarSearchResult,
  type ScoredCandidate,
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
const quadRecordProblem = {
  variables: ['x'],
  columns: { x: xs },
  observed: quadProblem.observed,
};

const pinnedOptions = {
  grammar: quadGrammar,
  seed: 7,
  tournamentP: 0.982,
  populationSize: 8,
  tournamentSize: 4,
  maxEvaluations: 120,
} as const;

async function searchResult(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions
): Promise<ScalarSearchResult> {
  const gen = searchScalars(problem, options);
  let step = await gen.next();
  while (!step.done) {
    step = await gen.next();
  }
  return step.value;
}

function bestRow(front: readonly ScoredCandidate<ScalarNode>[]): ScoredCandidate<ScalarNode> {
  return front.reduce((a, c) => (c.loss < a.loss ? c : a), front[0]!);
}

describe('runScalarSearch', () => {
  it('with seed 7 and the pin options returns the same front as searchScalars', async () => {
    const reference = await searchResult(quadProblem, {
      grammar: quadGrammar,
      rng: createSeededRng(7),
      tournamentP: 0.982,
      populationSize: 8,
      tournamentSize: 4,
      maxEvaluations: 120,
    });
    const wrapped = await runScalarSearch(quadProblem, pinnedOptions);
    expect(wrapped.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      reference.front.map((row) => scalarCanonicalKey(row.item))
    );
    expect(wrapped.front.map((row) => row.complexity)).toEqual(
      reference.front.map((row) => row.complexity)
    );
    wrapped.front.forEach((row, i) => {
      expect(Object.is(row.loss, reference.front[i]!.loss)).toBe(true);
    });
    expect(wrapped.seed).toBe(7);
    expect(wrapped.stopReason).toBe(reference.stopReason);
    expect(wrapped.evaluations).toBe(reference.evaluations);
  });

  it('rejects seed and rng together and neither', async () => {
    await expect(
      runScalarSearch(quadProblem, {
        ...pinnedOptions,
        rng: createSeededRng(7),
      })
    ).rejects.toThrow(RangeError);
    const { seed: _seed, ...noRng } = pinnedOptions;
    await expect(runScalarSearch(quadProblem, noRng)).rejects.toThrow(RangeError);
  });

  it('two runs with the same seed match event for event', async () => {
    const a = await runScalarSearch(quadProblem, pinnedOptions);
    const c = await runScalarSearch(quadProblem, pinnedOptions);
    expect(a.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      c.front.map((row) => scalarCanonicalKey(row.item))
    );
    a.front.forEach((row, i) => {
      expect(Object.is(row.loss, c.front[i]!.loss)).toBe(true);
    });
  });

  it('accepts columns as a record keyed by variable name', async () => {
    const reference = await runScalarSearch(quadProblem, pinnedOptions);
    const fromRecord = await runScalarSearch(quadRecordProblem, pinnedOptions);
    expect(fromRecord.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      reference.front.map((row) => scalarCanonicalKey(row.item))
    );
    fromRecord.front.forEach((row, i) => {
      expect(Object.is(row.loss, reference.front[i]!.loss)).toBe(true);
    });
  });

  it('throws when the columns record is missing a variable', async () => {
    await expect(
      runScalarSearch({ ...quadRecordProblem, columns: {} }, pinnedOptions)
    ).rejects.toThrow(/no Float64Array for variable 'x'/);
  });

  it('throws when a record column has the wrong length', async () => {
    await expect(
      runScalarSearch({ ...quadRecordProblem, columns: { x: new Float64Array(3) } }, pinnedOptions)
    ).rejects.toThrow(RangeError);
  });

  it('throws when a record column is not a Float64Array', async () => {
    await expect(
      runScalarSearch(
        { ...quadRecordProblem, columns: { x: [1, 2, 3] as unknown as Float64Array } },
        pinnedOptions
      )
    ).rejects.toThrow(RangeError);
  });

  it('runs with empty variables and an empty record', async () => {
    const observed = new Float64Array([1, 2, 3]);
    const result = await runScalarSearch(
      { variables: [], columns: {}, observed },
      {
        grammar: { variables: [], binary: ['+'], unary: [], literals: [1, 2], maxSize: 3 },
        seed: 3,
        maxEvaluations: 10,
      }
    );
    expect(result.stopReason).toBe('max-evaluations');
    expect(result.evaluations).toBeGreaterThan(0);
  });
});

describe('bestLossFactor', () => {
  it('with modelSelection best and factor 1 selects the minimum-loss row', async () => {
    const result = await runScalarSearch(quadProblem, {
      ...pinnedOptions,
      modelSelection: 'best',
      bestLossFactor: 1,
    });
    const min = bestRow(result.front);
    expect(result.selected).toBeDefined();
    expect(Object.is(result.selected!.loss, min.loss)).toBe(true);
    expect(scalarCanonicalKey(result.selected!.item)).toBe(scalarCanonicalKey(min.item));
  });

  it('omitted bestLossFactor matches selectFrontModel with the default factor 1.5', async () => {
    const result = await runScalarSearch(quadProblem, {
      ...pinnedOptions,
      modelSelection: 'best',
    });
    const expected = selectFrontModel(result.front, 'best');
    expect(scalarCanonicalKey(result.selected!.item)).toBe(scalarCanonicalKey(expected.item));
    expect(Object.is(result.selected!.loss, expected.loss)).toBe(true);
  });

  it('is ignored without modelSelection', async () => {
    const without = await runScalarSearch(quadProblem, pinnedOptions);
    const withFactor = await runScalarSearch(quadProblem, {
      ...pinnedOptions,
      bestLossFactor: 1,
    });
    expect(without.selected).toBeUndefined();
    expect(withFactor.selected).toBeUndefined();
    expect(withFactor.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      without.front.map((row) => scalarCanonicalKey(row.item))
    );
  });

  it('throws on a non-finite factor before the search starts', async () => {
    for (const bestLossFactor of [Number.NaN, Number.POSITIVE_INFINITY, -Infinity]) {
      await expect(
        runScalarSearch(quadProblem, { ...pinnedOptions, bestLossFactor })
      ).rejects.toThrow(RangeError);
      await expect(
        runScalarSearch(quadProblem, {
          ...pinnedOptions,
          modelSelection: 'best',
          bestLossFactor,
        })
      ).rejects.toThrow(RangeError);
    }
    await expect(
      searchScalars(quadProblem, {
        grammar: quadGrammar,
        rng: createSeededRng(7),
        maxEvaluations: 10,
        bestLossFactor: Number.NaN,
      }).next()
    ).rejects.toThrow(RangeError);
  });
});
