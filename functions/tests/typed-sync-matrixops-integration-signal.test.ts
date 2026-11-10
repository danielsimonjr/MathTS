/**
 * characteristicPolynomial, matrixPower, matrixLog, polarDecomposition, jordanForm,
 * trapzF64, simpsonF64, fft2d and spectrogram are synchronous.
 *
 * Each function returns its value, never a Promise. The explicit worker paths stay
 * available: computePool.matmul for products and computePool.fftBatch for FFT batches.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { pairwiseSum } from '@danielsimonjr/mathts-core';
import { matMul as denseMatMul } from '@danielsimonjr/mathts-matrix';
import {
  characteristicPolynomial,
  matrixPower,
  matrixLog,
  polarDecomposition,
  jordanForm,
  trapzF64,
  simpsonF64,
  fft2d,
  spectrogram,
  windowFunction,
} from '../src/index.js';
import { fftCoreFloat64 } from '../src/signal/fft-core-f64.js';

function sameNested(actual: number[][], expected: number[][]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[i].length; j++) {
      if (!Object.is(actual[i][j], expected[i][j])) {
        throw new Error(`[${i}][${j}]: got ${actual[i][j]}, expected ${expected[i][j]}`);
      }
    }
  }
}

function close(actual: number[][], expected: number[][], tol = 1e-9): void {
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[i].length; j++) {
      expect(Math.abs(actual[i][j] - expected[i][j])).toBeLessThan(tol);
    }
  }
}

/** Deterministic pseudo-random values in [-1, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

afterAll(async () => {
  await computePool.terminate();
});

describe('matrix-ops are synchronous', () => {
  it('characteristicPolynomial returns the coefficients', () => {
    const out = characteristicPolynomial([[5]]);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toEqual([-5, 1]);
  });

  it('matrixPower of a non-symmetric matrix (a row/column swap fails here)', () => {
    const out = matrixPower(
      [
        [1, 2],
        [3, 4],
      ],
      2
    );
    expect(out).not.toBeInstanceOf(Promise);
    sameNested(out, [
      [7, 10],
      [15, 22],
    ]);
  });

  it('matrixPower above the old 50 000-element worker gate equals the dense kernel', () => {
    const n = 230;
    const next = lcg(7);
    const A = Array.from({ length: n }, () => Array.from({ length: n }, next));
    const out = matrixPower(A, 2);
    expect(out).not.toBeInstanceOf(Promise);
    sameNested(out, denseMatMul(A, A));
  });

  it('matrixLog, polarDecomposition and jordanForm return values, not Promises', () => {
    const log = matrixLog([
      [1, 0],
      [0, 1],
    ]);
    expect(log).not.toBeInstanceOf(Promise);
    close(log, [
      [0, 0],
      [0, 0],
    ]);
    const A = [
      [2, 1],
      [0, 3],
    ];
    const polar = polarDecomposition(A);
    expect(polar).not.toBeInstanceOf(Promise);
    close(denseMatMul(polar.U, polar.P), A);
    const jordan = jordanForm(A);
    expect(jordan).not.toBeInstanceOf(Promise);
    expect(jordan.J.length).toBe(2);
  });
});

describe('trapzF64 and simpsonF64 are synchronous and sum pairwise', () => {
  // Large values in pairs of equal sign (+, +, -, -, ...) plus small noise: the terms
  // alternate in sign, and a naive left-to-right loop loses the noise.
  function cancellationHeavy(n: number): Float64Array {
    const y = new Float64Array(n);
    const next = lcg(11);
    for (let i = 0; i < n; i++) y[i] = ((i >> 1) % 2 === 0 ? 1e16 : -1e16) + 7 * next();
    return y;
  }

  function naiveSum(t: Float64Array): number {
    let s = 0;
    for (let i = 0; i < t.length; i++) s += t[i];
    return s;
  }

  it('trapzF64 equals pairwiseSum of its terms, not the naive loop', () => {
    const y = cancellationHeavy(4097);
    const terms = new Float64Array(y.length - 1);
    for (let i = 1; i < y.length; i++) terms[i - 1] = (y[i - 1] + y[i]) * 0.25;
    const out = trapzF64(y, 0.5);
    expect(out).not.toBeInstanceOf(Promise);
    expect(Object.is(out, pairwiseSum(terms))).toBe(true);
    expect(pairwiseSum(terms)).not.toBe(naiveSum(terms));
  });

  it('simpsonF64 equals pairwiseSum of its weighted terms, not the naive loop', () => {
    const y = cancellationHeavy(4097);
    const terms = new Float64Array(y.length);
    terms[0] = y[0];
    terms[y.length - 1] = y[y.length - 1];
    for (let i = 1; i < y.length - 1; i++) terms[i] = (i % 2 === 0 ? 2 : 4) * y[i];
    const out = simpsonF64(y, 0.5);
    expect(out).not.toBeInstanceOf(Promise);
    expect(Object.is(out, (pairwiseSum(terms) * 0.5) / 3)).toBe(true);
    expect(pairwiseSum(terms)).not.toBe(naiveSum(terms));
  });

  it('pins the last-bit change at 10 points (9 terms, more than the 8 leaf accumulators)', () => {
    // Integer eighths near 1e15, where the spacing of doubles is 1/8: every input is exact.
    const eighths = [
      8000000000005570, 8000000000007056, 8000000000004664, -8000000000002316, 8000000000006030,
      -8000000000000706, 8000000000006681, -8000000000005039, -8000000000002361, 8000000000007215,
    ];
    const y = Float64Array.from(eighths, (m) => m / 8);
    // pairwiseSum gives 1000000000002550.125. The naive loop of the old version gave
    // 1000000000002550.375.
    expect(trapzF64(y, 1)).toBe(8000000000020401 / 8);
    expect(trapzF64(y, 1)).not.toBe(8000000000020403 / 8);
  });

  it('keeps the small-input errors, thrown synchronously', () => {
    expect(() => trapzF64(new Float64Array([1]))).toThrow('at least 2 data points');
    expect(() => simpsonF64(new Float64Array([0, 1, 2, 3]))).toThrow('odd number of points');
  });

  it('gives exact values on small inputs', () => {
    expect(trapzF64(new Float64Array([0, 1, 0]))).toBe(1);
    expect(simpsonF64(new Float64Array([0, 1, 4]), 1)).toBe(8 / 3);
  });
});

describe('fft2d and spectrogram are synchronous', () => {
  it('fft2d of a 2x2 matrix', () => {
    const out = fft2d([
      [1, 2],
      [3, 4],
    ]);
    expect(out).not.toBeInstanceOf(Promise);
    sameNested(out.real, [
      [10, -2],
      [-4, 0],
    ]);
    sameNested(out.imag, [
      [0, 0],
      [0, 0],
    ]);
  });

  it('fft2d of a non-square 3x5 input equals row FFTs then column FFTs', () => {
    const next = lcg(3);
    const x = Array.from({ length: 3 }, () => Array.from({ length: 5 }, next));
    const out = fft2d(x);
    // 3x5 pads to 4x8.
    const rows = Array.from({ length: 4 }, (_, r) => {
      const re = new Float64Array(8);
      if (r < 3) for (let c = 0; c < 5; c++) re[c] = x[r][c];
      return fftCoreFloat64(re, new Float64Array(8), false);
    });
    for (let c = 0; c < 8; c++) {
      const col = fftCoreFloat64(
        Float64Array.from(rows, (r) => r.real[c]),
        Float64Array.from(rows, (r) => r.imag[c]),
        false
      );
      for (let r = 0; r < 4; r++) {
        expect(Object.is(out.real[r][c], col.real[r])).toBe(true);
        expect(Object.is(out.imag[r][c], col.imag[r])).toBe(true);
      }
    }
  });

  it('spectrogram equals fftCoreFloat64 per frame (Object.is)', () => {
    const next = lcg(5);
    const x = Array.from({ length: 1000 }, next);
    const out = spectrogram(x, { windowSize: 100, hopSize: 50 });
    expect(out).not.toBeInstanceOf(Promise);
    const win = windowFunction(100, 'hann');
    expect(out.magnitude.length).toBe(19);
    for (let f = 0; f < out.magnitude.length; f++) {
      const re = new Float64Array(128);
      for (let i = 0; i < 100; i++) re[i] = x[f * 50 + i] * win[i];
      const r = fftCoreFloat64(re, new Float64Array(128), false);
      for (let i = 0; i < 65; i++) {
        expect(Object.is(out.magnitude[f][i], Math.sqrt(r.real[i] ** 2 + r.imag[i] ** 2))).toBe(
          true
        );
      }
    }
  });

  it('spectrogram matches the worker kernel (fftBatchChunk) to 1e-12 relative', async () => {
    await computePool.initialize();
    expect(computePool.isReady()).toBe(true);
    const next = lcg(9);
    const n = 256 * 300; // frames * nfft = 76 800, above the 50 000 worker threshold
    const x = Array.from({ length: n }, next);
    const out = spectrogram(x, { windowSize: 256, hopSize: 256 });
    const win = windowFunction(256, 'hann');
    const re = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[i] * win[i % 256];
    const batch = await computePool.fftBatch(re, new Float64Array(n), 300, 256, false);
    expect(batch.parallelized).toBe(true);
    let maxRel = 0;
    for (let f = 0; f < 300; f++) {
      for (let i = 0; i < 129; i++) {
        const a = batch.result.real[f * 256 + i];
        const b = batch.result.imag[f * 256 + i];
        const w = Math.sqrt(a * a + b * b);
        const s = out.magnitude[f][i];
        maxRel = Math.max(maxRel, Math.abs(w - s) / Math.max(1, Math.abs(s)));
      }
    }
    expect(maxRel).toBeLessThan(1e-12);
  });
});
