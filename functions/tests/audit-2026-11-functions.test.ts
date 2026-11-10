/**
 * Regression tests for the 2026-11 functions audit: seeded-bootstrap invariance,
 * multi-quantile, multiplicativeOrder overflow, polynomialGCD on rationals,
 * sparse qr, combinations collections, linregress single fit, and precise
 * return types of solveODE / freqz / zpk2tf.
 */
import { describe, it, expect } from 'vitest';
import {
  kolmogorovSmirnovTest,
  shapiroWilkTest,
  mannWhitneyTest,
  parallelStatQuantile,
  parallelStatMode,
  multiplicativeOrder,
  polynomialGCD,
  combinations,
  polymul,
  qr,
  matrix,
  linregress,
  linearRegression,
  skewness,
  kurtosis,
  evaluate,
  integrate,
  fourierSeries,
  solve,
  solveODE,
  freqz,
  zpk2tf,
  spectrogram,
  periodogram,
} from '../src/index.js';
import type { FrequencyResponse, TransferFunction, SolveODESolution } from '../src/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createCombinations } from '../src/probability/combinations.js';
import type { TypedFunction } from '../src/core/function/typed.js';

// ---------------------------------------------------------------------------
// Seeded bootstrap: O(n) resample / permutation must not change results.
// Golds were produced by the pre-optimisation implementation (sort-based).
// ---------------------------------------------------------------------------

function lcgSample(n: number, seed: number): number[] {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return Math.round((s / 4294967296) * 20) / 2; // ties on purpose
  });
}

describe('seeded bootstrap results are unchanged by the O(n) rewrites', () => {
  const x = lcgSample(25, 25);
  const y = lcgSample(28, 32);
  const opts = { bootstrap: 200, bootstrapSeed: 123 };

  it('kolmogorovSmirnovTest', async () => {
    const r = (await kolmogorovSmirnovTest(x, undefined, opts)) as unknown as {
      pValueEmpirical: number;
      bootstrapMean: number;
    };
    expect(r.pValueEmpirical).toBe(0.625);
    expect(r.bootstrapMean).toBe(0.7442822477617146);
  });

  it('shapiroWilkTest', async () => {
    const r = (await shapiroWilkTest(x, opts)) as unknown as {
      pValueEmpirical: number;
      bootstrapMean: number;
    };
    expect(r.pValueEmpirical).toBe(0.81);
    expect(r.bootstrapMean).toBe(0.8764750223345699);
  });

  it('mannWhitneyTest (permutation by shuffled ranks)', async () => {
    const r = (await mannWhitneyTest(x, y, opts)) as unknown as {
      pValueEmpirical: number;
      bootstrapMean: number;
      bootstrapStd: number;
    };
    expect(r.pValueEmpirical).toBe(0.555);
    expect(r.bootstrapMean).toBe(304.2975);
    expect(r.bootstrapStd).toBe(33.37329211936428);
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

describe('parallelStatQuantile multi-q', () => {
  const data = new Float64Array([9, 1, 7, 3, 5, 2, 8, 4, 6, 10, 0.5]);
  const qs = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

  it('equals mapping the scalar overload', () => {
    const multi = parallelStatQuantile(data, qs) as number[];
    const mapped = qs.map((q) => parallelStatQuantile(data, q) as number);
    expect(multi).toEqual(mapped);
  });

  it('keeps scalar edge behaviour (empty, single, out of range)', () => {
    expect(parallelStatQuantile(new Float64Array(0), [0.5]) as number[]).toEqual([NaN]);
    expect(parallelStatQuantile(new Float64Array([4]), [0, 1]) as number[]).toEqual([4, 4]);
    expect(() => parallelStatQuantile(data, [0.5, 1.5])).toThrow(/between 0 and 1/);
  });

  it('does not mutate its input', () => {
    const copy = Float64Array.from(data);
    parallelStatQuantile(data, qs);
    expect(Array.from(data)).toEqual(Array.from(copy));
  });
});

describe('parallelStatMode shares one implementation for Array and Float64Array', () => {
  it('agrees across input kinds', () => {
    const a = [3, 1, 3, 2, 1, 5];
    expect(parallelStatMode(a)).toEqual([1, 3]);
    expect(parallelStatMode(Float64Array.from(a))).toEqual([1, 3]);
    expect(parallelStatMode([])).toEqual([]);
  });
});

describe('skewness / kurtosis (centralMoment k = 3, 4 specialisations)', () => {
  it('match a Math.pow oracle', () => {
    const d = lcgSample(40, 7);
    const m = d.reduce((s, v) => s + v, 0) / d.length;
    const mom = (k: number) => d.reduce((s, v) => s + Math.pow(v - m, k), 0) / d.length;
    expect(skewness(d) as number).toBeCloseTo(mom(3) / Math.pow(mom(2), 1.5), 12);
    expect(kurtosis(d) as number).toBeCloseTo(mom(4) / (mom(2) * mom(2)) - 3, 12);
  });
});

describe('linregress fits once and agrees with linearRegression', () => {
  it('shares slope / intercept / r / p / stdErr', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7];
    const ys = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8];
    const a = linregress(xs, ys);
    const b = linearRegression(xs, ys);
    expect(a.slope).toBe(b.slope);
    expect(a.intercept).toBe(b.intercept);
    expect(a.rValue).toBe(b.rValue);
    expect(a.pValue).toBe(b.pValue);
    expect(a.stdErr).toBe(b.stdErr);
    expect(a.interceptStdErr).toBeGreaterThan(0);
  });
  it('zero-variance predictor still yields NaN, not a throw', () => {
    expect(linregress([1, 1, 1], [1, 2, 3]).slope).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Number theory
// ---------------------------------------------------------------------------

function bigPow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

describe('multiplicativeOrder beyond 2^53 products', () => {
  it('matches the old brute-force results on small moduli', () => {
    for (let n = 2; n < 60; n++) {
      for (let a = 1; a < n; a++) {
        let g = a;
        let h = n;
        while (h) [g, h] = [h, g % h];
        if (g !== 1) {
          expect(multiplicativeOrder(a, n)).toBe(-1);
          continue;
        }
        let cur = a % n;
        let k = 1;
        while (cur !== 1) {
          cur = (cur * a) % n;
          k++;
        }
        expect(multiplicativeOrder(a, n)).toBe(k);
      }
    }
    expect(multiplicativeOrder(2, 1)).toBe(1);
    expect(multiplicativeOrder(-1, 7)).toBe(2);
  });

  it('ord of 2 mod 1_000_000_007 is 500000003', () => {
    // p - 1 = 2 * 500000003 (500000003 is prime) and 2 is a quadratic residue mod p.
    expect(multiplicativeOrder(2, 1_000_000_007)).toBe(500_000_003);
  });

  it('returns a true order for moduli past 1e10 (independent BigInt check)', () => {
    for (const n of [10_000_000_019, 998_244_353, 600_851_475_143]) {
      for (const a of [3, 5, 7, 10]) {
        let g = a;
        let h = n;
        while (h) [g, h] = [h, g % h];
        if (g !== 1) continue;
        const ord = multiplicativeOrder(a, n);
        const N = BigInt(n);
        expect(bigPow(BigInt(a), BigInt(ord), N)).toBe(1n);
        // minimality: no proper divisor-by-prime works
        for (let q = 2; q * q <= ord; q++) {
          if (ord % q === 0) {
            for (const p of [q, ord / q]) {
              let isPrime = true;
              for (let d = 2; d * d <= p; d++) if (p % d === 0) isPrime = false;
              if (isPrime) expect(bigPow(BigInt(a), BigInt(ord / p), N)).not.toBe(1n);
            }
          }
        }
        if (ord > 1) {
          // prime ord case
          let isPrime = true;
          for (let d = 2; d * d <= ord; d++) if (ord % d === 0) isPrime = false;
          if (isPrime) expect(bigPow(BigInt(a), 1n, N)).not.toBe(1n);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('review follow-ups', () => {
  it('polynomialGCD does not snap a large non-integer coefficient to an integer', () => {
    // 1e13 + 0.5 is exact in binary; the relative convergent test alone would call it an
    // integer and round it away. Both inputs equal, so the GCD is the (monic) input itself.
    const p = [1e13 + 0.5, 1];
    const g = polynomialGCD(p, p);
    expect(g[g.length - 1]).toBe(1);
    expect(g[0]).toBe(1e13 + 0.5);
  });
  it('the public combinations maps over a collection of n or of k', () => {
    expect(combinations([5, 6], 2)).toEqual([10, 15]);
    expect(combinations(6, [1, 2, 3])).toEqual([6, 15, 20]);
  });
});

// polynomialGCD on rational coefficients
// ---------------------------------------------------------------------------

describe('polynomialGCD with rational coefficients is exact', () => {
  it('(x-1/2)(x+1/3) vs (x-1/2)(x-2) -> x - 1/2', () => {
    const a = polymul([-0.5, 1], [1 / 3, 1]);
    const b = polymul([-0.5, 1], [-2, 1]);
    expect(polynomialGCD(a, b)).toEqual([-0.5, 1]);
  });

  it('coprime rational polynomials give [1]', () => {
    expect(polynomialGCD([0.5, 1], [1 / 3, 1])).toEqual([1]);
  });

  it('is exact on a high-degree rational pair', () => {
    const common = polymul(polymul([-0.5, 1], [0.25, 1]), [0.75, 0, 1]);
    const g = polynomialGCD(polymul(common, [1 / 3, 1]), polymul(common, [-1.5, 1, 1]));
    const lead = common[common.length - 1];
    expect(g).toEqual(common.map((c) => c / lead));
  });

  it('irrational input still uses the floating path', () => {
    const r = polynomialGCD([-Math.SQRT2, 1], [-Math.SQRT2, 1]);
    expect(r[0]).toBeCloseTo(-Math.SQRT2, 12);
    expect(r[1]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// qr on SparseMatrix
// ---------------------------------------------------------------------------

describe('qr of a SparseMatrix', () => {
  it('returns dense Q, R with Q*R = A and R upper triangular', () => {
    const rows = [
      [1, 0, 2],
      [0, 3, 0],
      [4, 0, 5],
      [0, 6, 7],
    ];
    const A = matrix(rows, 'sparse');
    const { Q, R } = qr(A) as unknown as {
      Q: { valueOf(): number[][]; storage(): string };
      R: { valueOf(): number[][]; storage(): string };
    };
    expect(Q.storage()).toBe('dense');
    expect(R.storage()).toBe('dense');
    const q = Q.valueOf();
    const r = R.valueOf();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += q[i][k] * r[k][j];
        expect(s).toBeCloseTo(rows[i][j], 10);
      }
    }
    for (let i = 1; i < 4; i++) for (let j = 0; j < Math.min(i, 3); j++) expect(r[i][j]).toBe(0);
    // matches the dense factorisation
    const dense = qr(rows) as { Q: number[][]; R: number[][] };
    expect(r).toEqual(dense.R);
    expect(q).toEqual(dense.Q);
  });
});

// ---------------------------------------------------------------------------
// combinations over collections
// ---------------------------------------------------------------------------

describe('combinations collection support', () => {
  const combinations = createCombinations(
    factoryScope as unknown as { typed: TypedFunction }
  ) as unknown as (n: unknown, k: unknown) => unknown;

  it('maps over a collection of n or of k', () => {
    expect(combinations([4, 5, 6], 2)).toEqual([6, 10, 15]);
    expect(combinations(5, [0, 1, 2, 5])).toEqual([1, 5, 10, 1]);
    expect(combinations([[3], [4]], 2)).toEqual([[3], [6]]);
  });

  it('scalar behaviour is unchanged', () => {
    expect(combinations(6, 3)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// CAS: compile-once evaluation gives the same numbers as per-point evaluate
// ---------------------------------------------------------------------------

describe('cas numeric paths (compiled once)', () => {
  it('integrate (Simpson) matches an evaluate-based oracle', () => {
    const n = 1000;
    const a = 0;
    const b = 2;
    const h = (b - a) / n;
    let sum =
      (evaluate('x^3 + sin(x)', { x: a }) as number) +
      (evaluate('x^3 + sin(x)', { x: b }) as number);
    for (let i = 1; i < n; i++) {
      sum += (i % 2 === 0 ? 2 : 4) * (evaluate('x^3 + sin(x)', { x: a + i * h }) as number);
    }
    expect(integrate('x^3 + sin(x)', 'x', a, b)).toBe((sum * h) / 3);
  });

  it('fourierSeries of x recovers 2(-1)^(k+1)/k sine coefficients', () => {
    const r = fourierSeries('x', 'x', 3);
    expect(Math.abs(r.a0)).toBeLessThan(1e-2); // left-endpoint grid offset, as before
    expect(r.bn[0]).toBeCloseTo(2, 2);
    expect(r.bn[1]).toBeCloseTo(-1, 2);
    expect(r.bn[2]).toBeCloseTo(2 / 3, 2);
    r.an.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-2));
  });

  it('numeric real roots of a degree-5 polynomial (fixed scan)', () => {
    const roots = solve('x^5 - 5*x^3 + 4*x', 'x');
    const nums = roots
      .map((r) => Number(r))
      .filter(Number.isFinite)
      .sort((p, q) => p - q);
    expect(nums.length).toBeGreaterThanOrEqual(5);
    [-2, -1, 0, 1, 2].forEach((r, i) => expect(nums[i]).toBeCloseTo(r, 8));
  });
});

// ---------------------------------------------------------------------------
// Signal outputs (preallocated) keep their shape
// ---------------------------------------------------------------------------

describe('spectrogram / periodogram preallocated outputs', () => {
  it('periodogram has nfft/2+1 bins with matching frequencies', () => {
    const x = Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / 64));
    const r = periodogram(x);
    expect(r.psd.length).toBe(33);
    expect(r.frequencies.length).toBe(33);
    expect(r.frequencies[8]).toBeCloseTo(8 / 64, 12);
    expect(r.psd.indexOf(Math.max(...r.psd))).toBe(8);
  });

  it('spectrogram has one magnitude row and one time per frame', () => {
    const x = Array.from({ length: 256 }, (_, i) => Math.sin(0.3 * i));
    const r = spectrogram(x, { windowSize: 64, hopSize: 32 });
    expect(r.magnitude.length).toBe(r.times.length);
    expect(r.magnitude.length).toBe(7);
    expect(r.magnitude[0].length).toBe(33);
    expect(spectrogram([1, 2], { windowSize: 64, hopSize: 32 }).magnitude).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Precise return types (type-checked by `tsc -p tsconfig.test.json`; no casts)
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;
type IsUnknown<T> = unknown extends T ? ([T] extends [undefined] ? false : true) : false;

describe('solveODE / freqz / zpk2tf are precisely typed', () => {
  it('freqz returns FrequencyResponse', () => {
    const r: FrequencyResponse = freqz([1, 2], [1, 2, 3], 4);
    const notAny: false = null as unknown as IsAny<typeof r>;
    const notUnknown: false = null as unknown as IsUnknown<typeof r>;
    expect([notAny, notUnknown]).toEqual([null, null]);
    expect((r.w as number[]).length).toBe(4);
    expect((r.h as unknown[]).length).toBe(4);
    const h0 = (r.h as { re: number; im: number }[])[0];
    expect(h0.re).toBeCloseTo(0.5, 12); // (1 + 2) / (1 + 2 + 3) at w = 0
    expect(h0.im).toBeCloseTo(0, 12);
    expect(freqz([1], [1]).w).toHaveLength(512);
  });

  it('zpk2tf returns TransferFunction', () => {
    const tf: TransferFunction = zpk2tf([1, 2], [-1, -2], 1);
    const [num, den] = tf;
    expect(num.map((c) => c.re)).toEqual([1, -3, 2]);
    expect(den.map((c) => c.re)).toEqual([1, 3, 2]);
    const noGain: TransferFunction = zpk2tf([1], [2]);
    expect(noGain[0]).toHaveLength(2);
  });

  it('solveODE returns SolveODESolution', () => {
    const sol: SolveODESolution = solveODE(() => [1], [0, 1], [0], { tol: 1e-8 });
    const notAny: false = null as unknown as IsAny<typeof sol>;
    expect(notAny).toBeNull();
    expect(sol.t.length).toBeGreaterThan(1);
    expect(sol.y.length).toBe(sol.t.length);
  });
});
