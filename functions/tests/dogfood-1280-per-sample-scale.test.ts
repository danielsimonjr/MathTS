/**
 * #1280-class sites whose scale must come from the sample that underflows, not from the larger
 * variance of the two. glassDelta divides by sd(b), fTest divides by the variance of b, and
 * bartlettTest takes the logarithm of every group variance. A group that is much smaller than the
 * others has a variance outside the safe window while the largest variance is inside it.
 *
 * Oracles are analytic: the plain data A and B has ordinary variances, and the tiny sample is
 * B times 2^e, so its variance is var(B) times 2^(2e) exactly.
 */
import { describe, expect, it } from 'vitest';
import { bartlettTest, fTest, glassDelta } from '../src/index.js';

const A = [1, 2, 3, 4, 5, 6];
const B = [1.1, 2.3, 4.7, 7.9, 11.3];
const sc = (xs: readonly number[], e: number): number[] => xs.map((v) => v * 2 ** e);
const mean = (xs: readonly number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;
const sampleVar = (xs: readonly number[]): number => {
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
};
const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);

describe('glassDelta scales by sd(b), not by the larger variance', () => {
  // mean(b) is below 2^-500, so (mean(a) - mean(b)) is mean(a) in double precision.
  it.each([-520, -540, -560])('a of order 1, b = B * 2^%i', (e) => {
    const want = (mean(A) / Math.sqrt(sampleVar(B))) * 2 ** -e;
    const got = glassDelta(A, sc(B, e));
    expect(Number.isFinite(got), `glassDelta gave ${got}`).toBe(true);
    expect(rel(got, want)).toBeLessThan(8 * Number.EPSILON);
  });

  it('keeps the plain bits for data of order 1', () => {
    const m = mean(A) - mean(B);
    expect(glassDelta(A, B)).toBe(m / Math.sqrt(sampleVar(B)));
  });
});

describe('fTest scales each sample by its own variance', () => {
  it('a variance of b that underflows to 0 does not throw "zero variance"', () => {
    // F = var(A)/var(B) * 2^(-62 + 1080) = 2^1018 * var(A)/var(B), a finite number.
    const want = (sampleVar(A) / sampleVar(B)) * 2 ** 1018;
    const got = fTest(sc(A, -31), sc(B, -540)).statistic;
    expect(rel(got, want)).toBeLessThan(8 * Number.EPSILON);
  });

  it('a subnormal variance of b keeps its digits', () => {
    // var(b) = 17.4 * 2^-1040 is subnormal: 38 bits. F = 2^980 * var(A)/var(B).
    const want = (sampleVar(A) / sampleVar(B)) * 2 ** 980;
    const got = fTest(sc(A, -30), sc(B, -520)).statistic;
    expect(rel(got, want)).toBeLessThan(8 * Number.EPSILON);
  });

  it('a result that leaves the range is Infinity, and a constant b still throws', () => {
    expect(fTest(sc(A, -6), sc(B, -540)).statistic).toBe(Infinity);
    expect(() => fTest(A, [2, 2, 2])).toThrow(/zero variance/);
  });
});

describe('bartlettTest takes the logarithm of the variance of each group exactly', () => {
  it('one group at 2^-540 among groups of order 1', () => {
    // The variances are var(A), var(B) * 2^-1080 and 4 var(A). The middle one is below the
    // smallest subnormal, and its weight in the pooled variance is below 2^-1000.
    const vA = sampleVar(A);
    const vB = sampleVar(B);
    const df = [5, 4, 5];
    const lnV = [Math.log(vA), Math.log(vB) - 1080 * Math.LN2, Math.log(vA) + 2 * Math.LN2];
    const lnSp2 = Math.log((25 * vA) / 14);
    const numerator = df.reduce((s, d, i) => s + d * (lnSp2 - lnV[i]), 0);
    const C = 1 + (df.reduce((s, d) => s + 1 / d, 0) - 1 / 14) / 6;
    const got = bartlettTest([A, sc(B, -540), sc(A, 1)]).statistic;
    expect(Number.isFinite(got), `bartlettTest gave ${got}`).toBe(true);
    expect(rel(got, numerator / C)).toBeLessThan(1e-12);
  });

  it('a group at 2^540 among groups of order 1', () => {
    const vA = sampleVar(A);
    const vB = sampleVar(B);
    const df = [5, 4];
    // var(B * 2^540) = var(B) * 2^1080 is above the largest double.
    const lnV = [Math.log(vA), Math.log(vB) + 1080 * Math.LN2];
    // The weight of group A in the pooled variance is below 2^-1000: ln(sp2) is the other term.
    const lnSp2 = Math.log((4 * vB) / 9) + 1080 * Math.LN2;
    const numerator = df.reduce((s, d, i) => s + d * (lnSp2 - lnV[i]), 0);
    const C = 1 + (df.reduce((s, d) => s + 1 / d, 0) - 1 / 9) / 3;
    const got = bartlettTest([A, sc(B, 540)]).statistic;
    expect(Number.isFinite(got), `bartlettTest gave ${got}`).toBe(true);
    expect(rel(got, numerator / C)).toBeLessThan(1e-12);
  });

  it('150000 groups do not overflow the argument stack of a spread', () => {
    const groups = Array.from({ length: 150_000 }, (_, i) => [
      (i % 7) + 1,
      (i % 5) + 2,
      (i % 3) + 3.5,
    ]);
    expect(Number.isFinite(bartlettTest(groups).statistic)).toBe(true);
  });
});
