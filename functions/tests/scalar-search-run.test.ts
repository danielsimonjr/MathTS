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

function noisyObserved(clean: Float64Array, noiseSeed: number, amplitude: number): Float64Array {
  const rng = createSeededRng(noiseSeed);
  const out = new Float64Array(clean.length);
  for (let i = 0; i < clean.length; i += 1) {
    out[i] = clean[i] + (rng.next() - 0.5) * amplitude;
  }
  return out;
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

  it('reads a columns record in variables order (asymmetric 3u + 2v target)', async () => {
    const U = b.symbol('u');
    const V = b.symbol('v');
    const us = linspace(10, 0, 1);
    const vs = linspace(10, -0.5, 0.5);
    const target = b.op('+', [b.op('*', [b.number(3), U]), b.op('*', [b.number(2), V])]);
    const observed = compileScalar(target, { variables: ['u', 'v'] }).evaluate([us, vs]).values;
    const twoVarGrammar: ScalarGrammar = {
      variables: ['u', 'v'],
      binary: ['+', '*'],
      unary: [],
      literals: [1, 2, 3],
      maxSize: 5,
    };
    const searchOpts = {
      grammar: twoVarGrammar,
      seed: 5,
      maxEvaluations: 80,
      populationSize: 8,
    };
    const fromArray = await runScalarSearch(
      { variables: ['u', 'v'], columns: [us, vs], observed },
      searchOpts
    );
    const fromRecord = await runScalarSearch(
      { variables: ['u', 'v'], columns: { u: us, v: vs }, observed },
      searchOpts
    );
    expect(fromRecord.front.map((row) => row.loss)).toEqual(fromArray.front.map((row) => row.loss));
    const swappedRecord = await runScalarSearch(
      { variables: ['u', 'v'], columns: { u: vs, v: us }, observed },
      searchOpts
    );
    expect(swappedRecord.front.map((row) => row.loss)).not.toEqual(
      fromRecord.front.map((row) => row.loss)
    );
  });

  it('accepts rng without seed and reproduces for the same stream', async () => {
    const { seed: _seed, ...withoutSeed } = pinnedOptions;
    const rngA = createSeededRng(11);
    const a = await runScalarSearch(quadProblem, { ...withoutSeed, rng: rngA });
    const rngB = createSeededRng(11);
    const b = await runScalarSearch(quadProblem, { ...withoutSeed, rng: rngB });
    expect(a.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      b.front.map((row) => scalarCanonicalKey(row.item))
    );
    a.front.forEach((row, i) => {
      expect(Object.is(row.loss, b.front[i]!.loss)).toBe(true);
    });
    expect(a.seed).toBe(11);
    expect(b.seed).toBe(11);
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
  it('forwards to selectFrontModel so factor 1 and 1.5 can pick different rows', async () => {
    const noisyProblem = {
      ...quadProblem,
      observed: noisyObserved(quadProblem.observed, 7, 0.05),
    };
    const searchOpts = {
      ...pinnedOptions,
      modelSelection: 'best' as const,
    };
    const result = await runScalarSearch(noisyProblem, searchOpts);
    const at1 = selectFrontModel(result.front, 'best', { bestLossFactor: 1 });
    const at15 = selectFrontModel(result.front, 'best', { bestLossFactor: 1.5 });
    expect(at1).not.toBe(at15);

    const run1 = await runScalarSearch(noisyProblem, { ...searchOpts, bestLossFactor: 1 });
    const run15 = await runScalarSearch(noisyProblem, { ...searchOpts, bestLossFactor: 1.5 });
    expect(run1.selected).toBe(selectFrontModel(run1.front, 'best', { bestLossFactor: 1 }));
    expect(run15.selected).toBe(selectFrontModel(run15.front, 'best', { bestLossFactor: 1.5 }));
    expect(scalarCanonicalKey(run1.selected!.item)).toBe(scalarCanonicalKey(at1.item));
    expect(scalarCanonicalKey(run15.selected!.item)).toBe(scalarCanonicalKey(at15.item));
    expect(Object.is(run1.selected!.loss, at1.loss)).toBe(true);
    expect(Object.is(run15.selected!.loss, at15.loss)).toBe(true);
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
