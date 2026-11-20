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

describe('seeded resamples keep their order of rng draws (#1154)', () => {
  // The resamples run in a loop, not as one promise each. The values are those of the
  // promise version (same seed, same order of draws).
  const opts = { bootstrap: 5, bootstrapSeed: 7 };

  it('kolmogorovSmirnovTest', async () => {
    const r = (await kolmogorovSmirnovTest([0.1, 0.5, 0.9, 0.3, 0.7], undefined, opts)) as {
      bootstrapStatistics: Float64Array;
    };
    expect(Array.from(r.bootstrapStatistics)).toEqual([
      0.539827837277029, 0.6179114221889526, 0.539827837277029, 0.6179114221889526,
      0.539827837277029,
    ]);
  });

  it('shapiroWilkTest', async () => {
    const r = (await shapiroWilkTest([1, 2, 3, 4, 5.5, 9, 2.2], opts)) as {
      bootstrapStatistics: Float64Array;
    };
    expect(Array.from(r.bootstrapStatistics)).toEqual([
      0.8027355528828096, 0.7664370164276403, 0.5501303115397279, 0.7242876997894997,
      0.8436553859889866,
    ]);
  });

  it('chiSquareTest', async () => {
    const r = (await chiSquareTest([10, 20, 30], [20, 20, 20], opts)) as {
      bootstrapStatistics: Float64Array;
    };
    expect(Array.from(r.bootstrapStatistics)).toEqual([1.3, 5.7, 2.0999999999999996, 3.1, 4.9]);
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
  it('rejects bootstrap * total count above 200,000,000 draws', async () => {
    await expect(chiSquareTest([1e9, 1e9], [1e9, 1e9], { bootstrap: 2 })).rejects.toThrow(
      RangeError
    );
    await expect(chiSquareTest([1e9, 1e9], [1e9, 1e9], { bootstrap: 2 })).rejects.toThrow(
      /^chiSquareTest: bootstrap \* total count = 4000000000 exceeds the supported maximum of 200000000/
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

describe('fisherExact keeps its accuracy for large counts and for very small p-values (#1146, #1154)', () => {
  const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
  const p = (a: number, b: number, c: number, d: number): number =>
    fisherExact([
      [a, b],
      [c, d],
    ]).pValue;

  // Oracle for the large tables: log P(k) from a 50-digit log-gamma (mpmath), the two tail
  // limits by bisection on it, and each tail sum anchored on it every 50,000 tables. A sum of
  // double log-gamma terms gave 0.1138667 for the first table (relative error 1.3e-5) and 1 for
  // the third. SciPy 1.16.3 gives 0.11386527324621518 for the first (1.2e-9 from the oracle)
  // and overflows int64 above 1e10.
  it.each([
    [1e9, 1e9 + 1e5, 1e9, 1e9, 0.11386527461183898],
    [1e11, 1e11 + 1e5, 1e11, 1e11, 0.8743695685267159],
    [1e12, 1e12 + 1e5, 1e12, 1e12, 0.9601231857091571],
    [49996000000, 5e10, 50004000000, 50000012345, 2.3761754421477215e-71],
    [1e6, 3e15, 2090000, 6e15, 2.101995431353479e-288],
  ])('[[%d, %d], [%d, %d]] gives %d', (a, b, c, d, want) => {
    expect(rel(p(a, b, c, d), want)).toBeLessThan(1e-10);
  });

  // A table counts when its probability is at most the observed one times 1 + 1e-14 (SciPy).
  // The table with 999984 in the first cell is 4.1e-9 more probable than the observed one, so
  // it does not count; with a tolerance of 1e-7 it counted and the result was 0.98803.
  // SciPy 1.16.3: 0.9872343474111872. Oracle: 0.9872343472827956.
  it('[[999968, 1e6], [1e6, 1e6]] does not count a table that is 4e-9 more probable', () => {
    expect(rel(p(999968, 1e6, 1e6, 1e6), 0.9872343472827956)).toBeLessThan(1e-10);
  });

  // Oracle: exact integers (math.comb) and a correctly rounded division. A p-value that a
  // double can hold is not 0: the smallest double is 5e-324.
  it.each([
    [504, 0, 0, 504, 2.901965752735433e-302],
    [483, 29, 23, 479, 1.2977061270013185e-217],
  ])('[[%d, %d], [%d, %d]] gives %d', (a, b, c, d, want) => {
    expect(rel(p(a, b, c, d), want)).toBeLessThan(1e-13);
  });

  it.each([
    [738, 88, 41, 838, 2.750325e-318],
    [516, 0, 0, 516, 1.75016689427636e-309],
    [556, 5, 7, 596, 8e-322],
    [540, 0, 0, 540, 5e-324],
  ])('[[%d, %d], [%d, %d]] gives the subnormal %d', (a, b, c, d, want) => {
    // 1e-323 is two units in the last place of a subnormal.
    expect(Math.abs(p(a, b, c, d) - want)).toBeLessThanOrEqual(1e-323);
    expect(p(a, b, c, d)).toBeGreaterThan(0);
  });

  // The same oracle as for the large tables: 38 standard deviations from the mode.
  it('a large table far in the tail keeps a subnormal p-value', () => {
    const got = p(999400000, 1000600000, 1000600000, 999400000);
    expect(Math.abs(got - 4.27497448e-315)).toBeLessThanOrEqual(1e-323);
    expect(
      rel(p(999415000, 1000585000, 1000585000, 999415000), 1.2052327404521215e-299)
    ).toBeLessThan(1e-10);
  });

  // 2 / C(1088, 544) is below half of the smallest double, so 0 is the correctly rounded result.
  it('gives 0 only below the smallest double', () => {
    expect(p(544, 0, 0, 544)).toBe(0);
    expect(p(10, 1e6, 1e6, 10)).toBe(0);
  });

  // The old loop did not end for these. The bound on the tail probability gives 0 at once.
  it('a table far in the tail of a huge table gives 0 at once', () => {
    expect(p(0, 1e15, 1e15, 0)).toBe(0);
    expect(p(7, 1e15, 1e15, 7)).toBe(0);
  });

  it('throws a RangeError when the walk would need more than 400,000,000 steps', () => {
    const far = (): number => p(4e15 - 5e8, 4e15 + 5e8, 4e15 + 5e8, 4e15 - 5e8);
    expect(far).toThrow(RangeError);
    expect(far).toThrow(/^fisherExact: the number of steps for this table/);
  });

  it('throws a RangeError when the sum of the entries is not finite', () => {
    expect(() => p(1, 1, 1e308, 1e308)).toThrow(RangeError);
    expect(() => p(1, 1, 1e308, 1e308)).toThrow(/^fisherExact: the sum of the table entries/);
  });
});

describe('the resampling tests bound bootstrap * sample size (#1154)', () => {
  // Without the bound each call below runs for about 5 to 23 s before it returns.
  const sample = Array.from({ length: 1000 }, (_, i) => Math.sin(i) * 3 + i / 500);

  it('kolmogorovSmirnovTest rejects bootstrap * sample size above 20,000,000', async () => {
    await expect(
      kolmogorovSmirnovTest(sample, undefined, { bootstrap: 20001, bootstrapSeed: 1 })
    ).rejects.toThrow(
      /^kolmogorovSmirnovTest: bootstrap \* sample size = 20001000 exceeds the supported maximum of 20000000$/
    );
  });

  it('shapiroWilkTest rejects bootstrap * sample size above 100,000,000', async () => {
    await expect(shapiroWilkTest(sample, { bootstrap: 100001, bootstrapSeed: 1 })).rejects.toThrow(
      /^shapiroWilkTest: bootstrap \* sample size = 100001000 exceeds the supported maximum of 100000000$/
    );
  });

  it('mannWhitneyTest rejects bootstrap * pooled size above 300,000,000', async () => {
    const other = sample.map((v) => v + 0.25);
    await expect(
      mannWhitneyTest(sample, other, { bootstrap: 150001, bootstrapSeed: 1 })
    ).rejects.toThrow(
      /^mannWhitneyTest: bootstrap \* pooled size = 300002000 exceeds the supported maximum of 300000000$/
    );
  });

  it('each test still runs a bootstrap of 100 on 1,000 values', async () => {
    const ks = await kolmogorovSmirnovTest(sample, undefined, { bootstrap: 100, bootstrapSeed: 1 });
    const sw = await shapiroWilkTest(sample, { bootstrap: 100, bootstrapSeed: 1 });
    const mw = await mannWhitneyTest(sample, sample, { bootstrap: 100, bootstrapSeed: 1 });
    for (const r of [ks, sw, mw]) {
      expect((r as { bootstrapStatistics: Float64Array }).bootstrapStatistics).toHaveLength(100);
    }
  });
});

describe('chiSquareTest with a NaN statistic gives NaN bootstrap fields (#1154)', () => {
  it('[NaN, 5] against [3, 3] gives NaN for pValueEmpirical, bootstrapMean and bootstrapStd', async () => {
    const r = (await chiSquareTest([NaN, 5], [3, 3], { bootstrap: 3, bootstrapSeed: 1 })) as {
      statistic: number;
      bootstrapStatistics: Float64Array;
      pValueEmpirical: number;
      bootstrapMean: number;
      bootstrapStd: number;
    };
    expect(r.statistic).toBeNaN();
    expect(r.pValueEmpirical).toBeNaN();
    expect(r.bootstrapMean).toBeNaN();
    expect(r.bootstrapStd).toBeNaN();
    // The same shape as mannWhitneyTest for a NaN sample: B statistics, each NaN.
    expect(r.bootstrapStatistics).toHaveLength(3);
    expect(Array.from(r.bootstrapStatistics).every(Number.isNaN)).toBe(true);
  });
});

describe('fisherExact moves a rounded mode estimate to the true mode (#1154)', () => {
  // Oracle: exact rational sums (Python fractions, SciPy's 1 + 1e-14 rule). In both tables the
  // float quotient floor((c1 + 1)(r1 + 1) / (N + 2)) is one away from the exact mode, and the
  // estimate is the observed table, so without the correction the result is 1.
  it('[[4116953074265712, 2], [2134782147411396, 0]]: the estimate is one below the mode', () => {
    const p = fisherExact([
      [4116953074265712, 2],
      [2134782147411396, 0],
    ]).pValue;
    expect(Math.abs(p - 0.5502633066380852)).toBeLessThanOrEqual(1e-15);
  });

  it('[[1679133894013118, 1652517130518410], [1, 2]]: the estimate is one above the mode', () => {
    const p = fisherExact([
      [1679133894013118, 1652517130518410],
      [1, 2],
    ]).pValue;
    expect(Math.abs(p - 0.6220282277239815)).toBeLessThanOrEqual(1e-15);
  });
});
