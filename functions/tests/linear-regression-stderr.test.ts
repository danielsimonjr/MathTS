/**
 * The slope standard error of `linearRegression` and `linregress` is the residual form
 * √(Σ(y − ŷ)² / ((n − 2)·Σ(x − x̄)²)). Found by the Universal-Physics-Tensor deep dive of
 * 2026-10-15: the old `syy − slope·sxy` (that is, `syy·(1 − r²)`) cancels on a near-exact fit,
 * and goes negative when r rounds above 1, so `stdErr` was NaN (`null` once serialised).
 */
import { describe, expect, it } from 'vitest';
import { linearRegression, linregress, ols } from '../src/index.js';

/** A finite double as an exact integer over 2^1100. */
function exact(v: number): bigint {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, v);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const e = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const mant = e === 0 ? frac : frac | (1n << 52n);
  const shift = BigInt((e === 0 ? 1 : e) - 1075 + 1100);
  return sign * (mant << shift);
}

/**
 * The exact least-squares slope standard error of the given doubles, in rational arithmetic,
 * rounded once at the end: stdErr² = (Syy·Sxx − Sxy²) / ((n − 2)·Sxx²) with S·· the n-scaled
 * centred sums n·Σab − Σa·Σb. Independent of the code under test.
 */
function exactStdErr(x: number[], y: number[]): number {
  const n = BigInt(x.length);
  const X = x.map(exact);
  const Y = y.map(exact);
  const sum = (a: bigint[]): bigint => a.reduce((s, v) => s + v, 0n);
  const dot = (a: bigint[], b: bigint[]): bigint => a.reduce((s, v, i) => s + v * b[i], 0n);
  const Sx = sum(X);
  const Sy = sum(Y);
  const Sxx = n * dot(X, X) - Sx * Sx;
  const Sxy = n * dot(X, Y) - Sx * Sy;
  const Syy = n * dot(Y, Y) - Sy * Sy;
  const num = Syy * Sxx - Sxy * Sxy;
  const den = (n - 2n) * Sxx * Sxx;
  const scaled = (num << 200n) / den;
  return Math.sqrt(Number(scaled) / 2 ** 200);
}

const x10 = Array.from({ length: 10 }, (_, i) => i + 1);

describe('slope standard error from the residuals', () => {
  it('an exact line y = 2x + 1 has stdErr 0', () => {
    const y = x10.map((v) => 2 * v + 1);
    for (const r of [linearRegression(x10, y), linregress(x10, y)]) {
      expect(r.stdErr).toBe(0);
    }
  });

  it('a fit exact up to rounding has a finite, rounding-sized stdErr', () => {
    // A power law y = 1.5·x + c in log space, written through rounded logarithms: the
    // residuals are rounding, so r can round above 1 and syy·(1 − r²) below 0.
    let checked = 0;
    for (let k = 1; k < 200; k++) {
      const x = Array.from({ length: 12 }, (_, i) => Math.log(1 + i * 0.37 * k));
      const y = x.map((v) => v * 1.5 + 0.1 * k);
      for (const r of [linearRegression(x, y), linregress(x, y)]) {
        expect(Number.isFinite(r.stdErr)).toBe(true);
        expect(r.stdErr).toBeGreaterThanOrEqual(0);
        expect(r.stdErr).toBeLessThan(1e-14);
        checked++;
      }
    }
    expect(checked).toBe(398);
  });

  it('a near-exact fit (noise 1e-9) matches the exact stdErr', () => {
    const y = x10.map((v, i) => 2 * v + 1 + 1e-9 * Math.sin(3 * i + 1));
    const want = exactStdErr(x10, y);
    expect(want).toBeGreaterThan(1e-11);
    // Each residual carries about ulp(21) = 3.6e-15 against a size of 1e-9.
    for (const r of [linearRegression(x10, y), linregress(x10, y)]) {
      expect(Math.abs(r.stdErr / want - 1)).toBeLessThan(1e-5);
    }
  });

  it('the exact reference is right on a hand case', () => {
    // x = 0, 1, 2; y = 0, 1, 0: slope 0, residuals −1/3, 2/3, −1/3, so stdErr = √((2/3)/(1·2)).
    expect(exactStdErr([0, 1, 2], [0, 1, 0])).toBe(Math.sqrt(1 / 3));
  });

  it('a noisy fit matches the exact stdErr to 1e-12 relative', () => {
    const x = Array.from({ length: 25 }, (_, i) => 0.4 * i - 3);
    const y = x.map((v, i) => 3 * v - 2 + 0.5 * Math.sin(7 * i + 0.3));
    const want = exactStdErr(x, y);
    for (const r of [linearRegression(x, y), linregress(x, y)]) {
      expect(Math.abs(r.stdErr / want - 1)).toBeLessThan(1e-12);
    }
    // ols already uses its residuals; its slope standard error agrees.
    const o = ols(
      x.map((v) => [v]),
      y
    );
    expect(Math.abs(o.stderr[1] / want - 1)).toBeLessThan(1e-12);
  });

  it('fewer than 3 points still throws', () => {
    expect(() => linearRegression([1, 2], [3, 4])).toThrow(/at least 3/);
    expect(() => linregress([1, 2], [3, 4])).toThrow(/at least 3/);
  });
});
