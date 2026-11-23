/**
 * Dogfood #1280 - a statistic that squares deviations loses digits when the squares are
 * subnormal, and gives NaN, 0 or Infinity when a variance (or a power of it) leaves the range.
 * The #1257 rescue ran only for a result that was 0, NaN or infinite. A result that is finite and
 * not zero but built from subnormal squares kept its lost digits.
 *
 * Each function now computes again on data divided by an exact power of 2 when its sum of squares
 * (or its variance) is outside the range in which every digit is kept. The scale is exact, so the
 * data of order 1 gives the digits of the plain path.
 *
 * Data: `B` and `D` are not exact on the subnormal grid. Integer data such as `[1, 3]` has exact
 * subnormal squares, so a test with it cannot fail.
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const std = fn('std') as (x: unknown, ...r: unknown[]) => number;
const EPS4 = 4 * Number.EPSILON;
const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
const T = 2 ** -535;
const B = [1.1, 2.3, 4.7, 7.9, 11.3];
const B2 = [2.2, 3.1, 5.9, 8.1, 12.7];
const B3 = [0.9, 1.7, 3.1, 4.4, 6.2];
const D = [0.25, 0.5, 1, 1.75];
const C = [3.3, 1.2, 8.8, 2.1, 5.5, 7.7, 0.4, 6.1];
const sc = (a: readonly number[], e: number): number[] => a.map((v) => v * 2 ** e);
/** Every numeric field of `got` equals the field of `base` (times 2^e for a scaled field) within EPS4. */
function expectFields(
  got: Record<string, unknown>,
  base: Record<string, unknown>,
  e = 0,
  scaled: readonly string[] = []
): void {
  for (const k of Object.keys(base)) {
    if (typeof base[k] !== 'number') continue;
    const want = scaled.includes(k) ? (base[k] as number) * 2 ** e : (base[k] as number);
    expect(rel(got[k] as number, want), `${k}: got ${got[k]}, want ${want}`).toBeLessThan(EPS4);
  }
}
const EXPS = [-535, -300, 300];

describe('#1280 std of numbers whose squared deviations are subnormal', () => {
  it('std([1e-160, 3e-160]) is correct (relative error 5.6e-6 before)', () => {
    expect(rel(std([1e-160, 3e-160]), Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
  });
  it('typed array and matrix input', () => {
    const m = (f as unknown as { matrix: AnyFn }).matrix([1e-160, 3e-160]);
    expect(rel(std(new Float64Array([1e-160, 3e-160])), Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
    expect(rel(std(m), Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
  });
  it("normalization 'uncorrected'", () => {
    expect(rel(std([1e-160, 3e-160], 'uncorrected'), 1e-160)).toBeLessThan(EPS4);
  });
  it('dimension form', () => {
    const r = std(
      [
        [1e-160, 3e-160],
        [1e-160, 3e-160],
      ],
      1
    ) as unknown as number[];
    expect(rel(r[0], Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
    expect(rel(r[1], Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
  });
  it('is homogeneous: std(x * 2^-535) is bit-equal to std(x) * 2^-535', () => {
    expect(std(sc(B, -535))).toBe(std(B) * T);
    let s = 1;
    const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
    const base = Array.from({ length: 1000 }, () => r() + 0.5);
    expect(std(sc(base, -535))).toBe(std(base) * T);
  });
  it('factory_std and evaluate', () => {
    expect(rel(fn('factory_std')([1e-160, 3e-160]) as number, Math.SQRT2 * 1e-160)).toBeLessThan(
      EPS4
    );
    expect(rel(evaluate('std([1e-160, 3e-160])') as number, Math.SQRT2 * 1e-160)).toBeLessThan(
      EPS4
    );
  });
  it('sem, zscore, variation and describe follow std', () => {
    const sem = fn('sem') as (x: number[]) => number;
    expect(sem(sc(B, -535))).toBe(sem(B) * T);
    const z = fn('zscore')(sc(B, -535)) as number[];
    const z0 = fn('zscore')(B) as number[];
    z.forEach((v, i) => expect(rel(v, z0[i])).toBeLessThan(EPS4));
    const variation = fn('variation') as (x: number[]) => number;
    expect(rel(variation(sc(B, -535)), variation(B))).toBeLessThan(EPS4);
    const d = fn('describe') as (x: number[]) => { std: number };
    expect(rel(d(sc(B, -535)).std, d(B).std * T)).toBeLessThan(EPS4);
  });
  it('the overflow side: std([1e200, 3e200])', () => {
    expect(rel(std([1e200, 3e200]), Math.SQRT2 * 1e200)).toBeLessThan(EPS4);
  });
  it('guards that stay', () => {
    expect(std(new Array(7).fill(1e-200))).toBe(0);
    expect(std([2, 4, 6])).toBe(2);
  });
});

describe('#1280 corr and the factory 2-norm', () => {
  const corr = fn('corr') as (a: number[], b: number[]) => number;
  it('corr with a subnormal sxx and a large syy (4.5e-3 before)', () => {
    const r = corr(sc([1, 2, 4], -535), sc([1, 2, 3.5], 465));
    expect(rel(r, 69 / Math.sqrt(4788))).toBeLessThan(EPS4);
  });
  it('GUARD: both sums above 2^-800 and the product below the normal range', () => {
    const r = corr(sc([1, 2, 4], -390), sc([1, 2, 3.5], -390));
    expect(rel(r, 69 / Math.sqrt(4788))).toBeLessThan(EPS4);
  });
  it('factory_norm(A, 2) (4.5e-4 before)', () => {
    const A = (f as unknown as { matrix: AnyFn }).matrix(
      [
        [1, 2],
        [0, 3],
      ].map((row) => row.map((v) => v * T))
    );
    expect(rel(fn('factory_norm')(A, 2) as number, (Math.SQRT2 + Math.sqrt(5)) * T)).toBeLessThan(
      EPS4
    );
  });
});

describe('#1280 skewness, kurtosis and describe', () => {
  const skewness = fn('skewness') as (x: number[]) => number;
  const kurtosis = fn('kurtosis') as (x: number[]) => number;
  const describe_ = fn('describe') as (x: number[]) => {
    std: number;
    skewness: number;
    kurtosis: number;
  };
  it('skewness and kurtosis of data with subnormal squares (NaN before)', () => {
    expect(skewness(sc(D, -535))).toBe(skewness(D));
    expect(kurtosis(sc(D, -535))).toBe(kurtosis(D));
  });
  it('at 2^-570 (threw "variance is zero" before)', () => {
    expect(skewness(sc(D, -570))).toBe(skewness(D));
    expect(kurtosis(sc(D, -570))).toBe(kurtosis(D));
  });
  it('kurtosis at 2^-270 and 2^300 (NaN before)', () => {
    expect(kurtosis(sc(D, -270))).toBe(kurtosis(D));
    expect(kurtosis(sc(D, 300))).toBe(kurtosis(D));
  });
  it('skewness at 2^340 (NaN before)', () => {
    expect(rel(skewness(sc(B, 340)), skewness(B))).toBeLessThan(EPS4);
  });
  it('describe: std, skewness, kurtosis', () => {
    expect(describe_(sc(D, -270)).kurtosis).toBe(describe_(D).kurtosis);
    expect(describe_(sc(D, 300)).kurtosis).toBe(describe_(D).kurtosis);
    expect(describe_(sc(D, -535)).skewness).toBe(describe_(D).skewness);
    expect(rel(describe_(sc(B, -535)).std, describe_(B).std * T)).toBeLessThan(EPS4);
  });
  it('guards that stay', () => {
    expect(() => skewness([T, T, T])).toThrow(/variance is zero/);
    const d = describe_([2, 2, 2]);
    expect(d.skewness).toBeNaN();
    expect(d.kurtosis).toBeNaN();
    expect(d.std).toBe(0);
    expect(skewness(D)).toBe(0.4987837491108397);
    expect(kurtosis(D)).toBe(-1.2380952380952381);
  });
});

describe('#1280 the sites of the class with the same mechanism (ruling R1)', () => {
  it.each(EXPS)('linregress and linearRegression, x and y at 2^%i', (e) => {
    const lr = fn('linregress') as (a: number[], b: number[]) => Record<string, number>;
    const lin = fn('linearRegression') as (a: number[], b: number[]) => Record<string, number>;
    expectFields(lr(sc(B, e), sc(B2, e)), lr(B, B2), e, ['intercept', 'interceptStdErr']);
    expectFields(lin(sc(B, e), sc(B2, e)), lin(B, B2), e, ['intercept']);
  });
  it('linregress with x and y in different units (x at 2^-535, y at 2^465)', () => {
    const lr = fn('linregress') as (a: number[], b: number[]) => Record<string, number>;
    const got = lr(sc(B, -535), sc(B2, 465));
    const base = lr(B, B2);
    expect(rel(got.slope, base.slope * 2 ** 1000)).toBeLessThan(EPS4);
    expect(rel(got.intercept, base.intercept * 2 ** 465)).toBeLessThan(EPS4);
    expect(rel(got.stdErr, base.stdErr * 2 ** 1000)).toBeLessThan(EPS4);
    expect(rel(got.interceptStdErr, base.interceptStdErr * 2 ** 465)).toBeLessThan(EPS4);
    expect(rel(got.rValue, base.rValue)).toBeLessThan(EPS4);
    expect(rel(got.pValue, base.pValue)).toBeLessThan(EPS4);
  });
  it('GUARD: linregress of ordinary data keeps its bits', () => {
    const lr = fn('linregress') as (a: number[], b: number[]) => Record<string, number>;
    const r = lr([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
    expect(r.slope).toBe(1.9899999999999998);
    expect(r.intercept).toBe(0.0500000000000016);
    expect(r.stdErr).toBe(0.059721576223896594);
    expect(r.interceptStdErr).toBe(0.1980740602232751);
  });
  it.each([-535, -300])('partialCorrelation at 2^%i (NaN before)', (e) => {
    const pc = fn('partialCorrelation') as (a: number[], b: number[], c: number[]) => number;
    expect(rel(pc(sc(B, e), sc(B2, e), sc(B3, e)), pc(B, B2, B3))).toBeLessThan(EPS4);
  });
  it('partialCorrelation at 2^300 (1 before) and in different units', () => {
    const pc = fn('partialCorrelation') as (a: number[], b: number[], c: number[]) => number;
    expect(rel(pc(sc(B, 300), sc(B2, 300), sc(B3, 300)), pc(B, B2, B3))).toBeLessThan(EPS4);
    expect(rel(pc(sc(B, -535), sc(B2, 465), sc(B3, 0)), pc(B, B2, B3))).toBeLessThan(EPS4);
  });
  it.each(['cohensD', 'hedgesG', 'glassDelta'])(
    '%s at 2^-535 (error 2.8e-5 to 7.7e-4 before)',
    (name) => {
      const g = fn(name) as (a: number[], b: number[]) => number;
      expect(rel(g(sc(B, -535), sc(B2, -535)), g(B, B2))).toBeLessThan(EPS4);
    }
  );
  it('etaSquared at 2^-535', () => {
    const g = fn('etaSquared') as (a: number[][]) => number;
    expect(rel(g([sc(B, -535), sc(B2, -535), sc(B3, -535)]), g([B, B2, B3]))).toBeLessThan(EPS4);
  });
  it.each(EXPS)('studentTTest, two samples at 2^%i (p-value NaN before)', (e) => {
    const t = fn('studentTTest') as (a: number[], b?: number[] | number) => Record<string, number>;
    expectFields(t(sc(B, e), sc(B2, e)), t(B, B2));
  });
  it.each(EXPS)('studentTTest, one sample with popmean at 2^%i', (e) => {
    const t = fn('studentTTest') as (a: number[], b?: number[] | number) => Record<string, number>;
    expectFields(t(sc(B, e), 4 * 2 ** e), t(B, 4));
  });
  it('studentTTestPaired at 2^-535 (error 7.8e-2 before)', () => {
    const t = fn('studentTTestPaired') as (a: number[], b: number[]) => Record<string, number>;
    expectFields(t(sc(B, -535), sc(B2, -535)), t(B, B2));
  });
  it('fTest at 2^-535 (error 3.5e-4 before)', () => {
    const t = fn('fTest') as (a: number[], b: number[]) => Record<string, number>;
    expectFields(t(sc(B, -535), sc(B2, -535)), t(B, B2));
  });
  it.each(EXPS)(
    'bartlettTest at 2^%i is bit-equal to bartlettTest of the data (24x error at 2^-535 before)',
    (e) => {
      const t = fn('bartlettTest') as (g: number[][]) => Record<string, number>;
      expect(t([sc(B, e), sc(B2, e)])).toEqual(t([B, B2]));
    }
  );
  it.each(EXPS)('jarqueBera at 2^%i (NaN before)', (e) => {
    const t = fn('jarqueBera') as (a: number[]) => Record<string, number>;
    expectFields(t(sc(B, e)), t(B));
  });
  it.each(EXPS)('dagostinoTest at 2^%i (NaN before)', (e) => {
    const t = fn('dagostinoTest') as (a: number[]) => Record<string, number>;
    expectFields(t(sc(B.concat(C), e)), t(B.concat(C)));
  });
  it('acf, pacf and ljungBox at 2^-535 (error 2.1e-3 to 5.9e-2 before)', () => {
    const acf = fn('acf') as (a: number[], n: number) => number[];
    const pacf = fn('pacf') as (a: number[], n: number) => number[];
    const lb = fn('ljungBox') as (a: number[], n: number) => Record<string, number>;
    acf(sc(C, -535), 2).forEach((v, i) => expect(rel(v, acf(C, 2)[i])).toBeLessThan(EPS4));
    pacf(sc(C, -535), 2).forEach((v, i) => expect(rel(v, pacf(C, 2)[i])).toBeLessThan(EPS4));
    expectFields(lb(sc(C, -535), 2), lb(C, 2));
  });
  it('distance2D, distance3D and distanceND at 2^-535 (error 4.8e-5 before)', () => {
    const a = [1.1, 2.3, 4.7];
    const b = [7.9, 11.3, 3.3];
    const d2 = fn('distance2D') as (a: number[], b: number[]) => number;
    const d3 = fn('distance3D') as (a: number[], b: number[]) => number;
    const dn = fn('distanceND') as (a: number[], b: number[]) => number;
    expect(rel(d2(sc(a, -535), sc(b, -535)), d2(a, b) * T)).toBeLessThan(EPS4);
    expect(rel(d3(sc(a, -535), sc(b, -535)), d3(a, b) * T)).toBeLessThan(EPS4);
    expect(rel(dn(sc(a, -535), sc(b, -535)), dn(a, b) * T)).toBeLessThan(EPS4);
  });
  it('gaussianKDE bandwidth at 2^-535 (the sample std lost digits)', () => {
    const h0 = f.gaussianKDE(B).bandwidth;
    expect(rel(f.gaussianKDE(sc(B, -535)).bandwidth, h0 * T)).toBeLessThan(EPS4);
  });
  it('parallelStatNorm(x, 2) at 2^-535 (error 5.7e-6 before)', () => {
    const nrm = fn('parallelStatNorm') as (a: Float64Array, p: number) => number;
    const x = new Float64Array(B);
    expect(rel(nrm(new Float64Array(sc(B, -535)), 2), nrm(x, 2) * T)).toBeLessThan(EPS4);
  });
});

describe('#1280 parallelStatStd', () => {
  const pstd = fn('parallelStatStd') as (x: Float64Array, n?: string) => Promise<number>;
  it('1e-160 data: the default and the normalization signature', async () => {
    const x = new Float64Array([1e-160, 3e-160]);
    expect(rel(await pstd(x), Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
    expect(rel(await pstd(x, 'uncorrected'), 1e-160)).toBeLessThan(EPS4);
  });
  it('1e200 data (Infinity before)', async () => {
    const x = new Float64Array([1e200, 3e200]);
    expect(rel(await pstd(x), Math.SQRT2 * 1e200)).toBeLessThan(EPS4);
  });
});
