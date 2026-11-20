/**
 * Issue #1154: the `bootstrap` option of the hypothesis tests was not validated, and
 * `fisherExact` took a float entry and spent time on every table of its range.
 *
 * Oracle for `fisherExact`: SciPy 1.16.3 `scipy.stats.fisher_exact`. SciPy casts a float
 * entry to an integer without a message; MathTS throws, because a hypergeometric count has
 * no meaning for 3.7.
 */
import { describe, it, expect } from 'vitest';
import {
  chiSquareTest,
  kolmogorovSmirnovTest,
  mannWhitneyTest,
  shapiroWilkTest,
  fisherExact,
} from '../src/index.js';
import type { BootstrapOptions } from '../src/index.js';

type Runner = (opts: BootstrapOptions) => Promise<unknown>;

const RUNNERS: Record<string, Runner> = {
  chiSquareTest: (opts) => chiSquareTest([10, 20, 30], [20, 20, 20], opts),
  kolmogorovSmirnovTest: (opts) => kolmogorovSmirnovTest([0.1, 0.5, 0.9], undefined, opts),
  mannWhitneyTest: (opts) => mannWhitneyTest([1, 2, 3], [4, 5, 6.5], opts),
  shapiroWilkTest: (opts) => shapiroWilkTest([1, 2, 3, 4, 5.5], opts),
};

describe.each(Object.entries(RUNNERS))('%s validates the bootstrap count (#1154)', (name, run) => {
  const notInteger = new RegExp(`^${name}: bootstrap must be a non-negative integer`);

  it.each([2.5, -1, NaN, Infinity, -Infinity])(
    'rejects %s with a RangeError',
    async (bootstrap) => {
      await expect(run({ bootstrap })).rejects.toThrow(RangeError);
      await expect(run({ bootstrap })).rejects.toThrow(notInteger);
    }
  );

  it('rejects a string with a TypeError', async () => {
    const opts = { bootstrap: '3' as unknown as number };
    await expect(run(opts)).rejects.toThrow(TypeError);
    await expect(run(opts)).rejects.toThrow(notInteger);
  });

  it('rejects a count above 10,000,000 before it allocates or loops', async () => {
    await expect(run({ bootstrap: 1e12 })).rejects.toThrow(RangeError);
    await expect(run({ bootstrap: 1e12 })).rejects.toThrow(
      `${name}: bootstrap = 1000000000000 exceeds the supported maximum of 10000000`
    );
  });

  it('rejects a count of 10,000,001, the first value above the maximum', async () => {
    await expect(run({ bootstrap: 10_000_001 })).rejects.toThrow(RangeError);
  });

  it('returns the plain result for 0, undefined and an absent option', async () => {
    for (const opts of [{ bootstrap: 0 }, { bootstrap: undefined }, {}]) {
      const r = (await run(opts)) as Record<string, unknown>;
      expect(r).not.toHaveProperty('bootstrapStatistics');
      expect(r).toHaveProperty('pValue');
    }
  });

  it('returns one statistic per resample for a valid count', async () => {
    const r = (await run({ bootstrap: 5, bootstrapSeed: 1 })) as {
      bootstrapStatistics: Float64Array;
    };
    expect(r.bootstrapStatistics.length).toBe(5);
  });
});

describe('bootstrap validation runs before an early return (#1154)', () => {
  it('mannWhitneyTest: a NaN in a sample does not hide an invalid count', async () => {
    await expect(mannWhitneyTest([1, NaN], [2, 3], { bootstrap: 2.5 })).rejects.toThrow(RangeError);
  });

  it('mannWhitneyTest: a NaN in a sample with a valid count still gives NaN results', async () => {
    const r = (await mannWhitneyTest([1, NaN], [2, 3], { bootstrap: 2 })) as {
      bootstrapStatistics: Float64Array;
      pValueEmpirical: number;
    };
    expect(r.bootstrapStatistics.length).toBe(2);
    expect(r.pValueEmpirical).toBeNaN();
  });

  it('shapiroWilkTest: constant data does not hide an invalid count', async () => {
    await expect(shapiroWilkTest([2, 2, 2, 2], { bootstrap: NaN })).rejects.toThrow(RangeError);
    await expect(shapiroWilkTest([2, 2, 2, 2], { bootstrap: 1e12 })).rejects.toThrow(RangeError);
  });

  it('chiSquareTest: a 2D table does not hide an invalid count', async () => {
    await expect(
      chiSquareTest(
        [
          [10, 20],
          [30, 40],
        ],
        undefined,
        { bootstrap: -1 }
      )
    ).rejects.toThrow(RangeError);
  });
});

describe('chiSquareTest bounds the bootstrap work (#1154)', () => {
  // Each resample draws as many values as the total count: 2 * 4e9 draws would not end.
  it('rejects bootstrap * total count above 1,000,000,000 draws', async () => {
    await expect(chiSquareTest([1e9, 1e9], [1e9, 1e9], { bootstrap: 2 })).rejects.toThrow(
      RangeError
    );
    await expect(chiSquareTest([1e9, 1e9], [1e9, 1e9], { bootstrap: 2 })).rejects.toThrow(
      /^chiSquareTest: bootstrap \* total count = 4000000000 exceeds the supported maximum of 1000000000/
    );
  });

  it('still runs a bootstrap of 100 on a small total count', async () => {
    const r = (await chiSquareTest([10, 20, 30], [20, 20, 20], {
      bootstrap: 100,
      bootstrapSeed: 3,
    })) as { bootstrapStatistics: Float64Array };
    expect(r.bootstrapStatistics.length).toBe(100);
  });
});

describe('fisherExact entries must be non-negative integers (#1154)', () => {
  it('throws a RangeError for a float entry', () => {
    const table = [
      [3.7, 1.2],
      [2.9, 5.5],
    ] as const;
    expect(() => fisherExact(table)).toThrow(RangeError);
    expect(() => fisherExact(table)).toThrow(
      /^fisherExact: every table entry must be a non-negative integer/
    );
    expect(() =>
      fisherExact([
        [3, 1],
        [2, 5.5],
      ])
    ).toThrow(RangeError);
  });

  it('still throws a RangeError with the fisherExact prefix for NaN, Infinity and negative entries', () => {
    for (const bad of [NaN, Infinity, -1]) {
      expect(() =>
        fisherExact([
          [bad, 1],
          [2, 5],
        ])
      ).toThrow(/^fisherExact:/);
    }
  });
});

describe('fisherExact matches scipy.stats.fisher_exact and sums only the tail tables (#1146, #1154)', () => {
  const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

  it('[[3, 1], [2, 5]] gives 0.24242424242424238', () => {
    const r = fisherExact([
      [3, 1],
      [2, 5],
    ]);
    expect(r.pValue).toBeCloseTo(0.24242424242424238, 12);
  });

  it('[[8, 2], [1, 5]] gives 0.034965034965034975', () => {
    const r = fisherExact([
      [8, 2],
      [1, 5],
    ]);
    expect(r.pValue).toBeCloseTo(0.034965034965034975, 12);
  });

  it('[[1e6, 1e6], [1e6, 1e6]] gives 1', () => {
    const r = fisherExact([
      [1e6, 1e6],
      [1e6, 1e6],
    ]);
    expect(r.pValue).toBe(1);
  });

  it('[[1e6, 1e6 + 5000], [1e6, 1e6]] gives 0.01261540617411859', () => {
    const r = fisherExact([
      [1e6, 1e6 + 5000],
      [1e6, 1e6],
    ]);
    expect(rel(r.pValue, 0.01261540617411859)).toBeLessThan(1e-6);
  });

  it('[[10, 1e6], [1e6, 10]] gives a value that SciPy rounds to 0', () => {
    const r = fisherExact([
      [10, 1e6],
      [1e6, 10],
    ]);
    expect(r.pValue).toBeLessThan(1e-300);
  });

  it('[[500, 520], [480, 500]] gives 1', () => {
    const r = fisherExact([
      [500, 520],
      [480, 500],
    ]);
    expect(r.pValue).toBe(1);
  });

  it('keeps the sample odds ratio', () => {
    const r = fisherExact([
      [8, 2],
      [1, 5],
    ]);
    expect(r.oddsRatio).toBe(20);
    expect(
      fisherExact([
        [1, 0],
        [0, 1],
      ]).oddsRatio
    ).toBe(Infinity);
  });
});
