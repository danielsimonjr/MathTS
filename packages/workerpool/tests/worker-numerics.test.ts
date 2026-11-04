import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  rowMajorStrides,
  pairwiseSum,
  pairwiseDot,
  norm2,
  scaledDistance,
} from '@danielsimonjr/mathts-core';
import {
  _workerMulberry32,
  _tdRowMajorStrides,
  _workerPairwiseSum,
  _workerPairwiseDot,
  _workerScaledSsq,
  _workerScaledSsqDiff,
  _workerCombineScaledSsq,
} from '../src/worker-numerics.js';

/** Independent oracle: first 8 outputs of origin/main `makeMulberry32(42)`. */
const MULBERRY32_42_FIRST_8 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
];

describe('worker-numerics parity with core', () => {
  it('mulberry32 copy matches core for the first 8 outputs at seed 42', () => {
    const coreRng = mulberry32(42);
    const workerRng = _workerMulberry32(42);
    const fromCore: number[] = [];
    const fromWorker: number[] = [];
    for (let i = 0; i < 8; i++) {
      fromCore.push(coreRng());
      fromWorker.push(workerRng());
    }
    expect(fromWorker).toEqual(fromCore);
    expect(fromWorker).toEqual(MULBERRY32_42_FIRST_8);
  });

  it('rowMajorStrides copy matches core', () => {
    expect(_tdRowMajorStrides([2, 3, 4])).toEqual(rowMajorStrides([2, 3, 4]));
    expect(_tdRowMajorStrides([])).toEqual(rowMajorStrides([]));
    expect(_tdRowMajorStrides([0, 5])).toEqual(rowMajorStrides([0, 5]));
  });

  /** Deterministic ill-conditioned data: large mean, tiny spread, mixed magnitudes. */
  function sample(n: number, seed: number): Float64Array {
    const rng = mulberry32(seed);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = 1e6 + (rng() - 0.5) * 1e-2 * (1 + (i % 7));
    return out;
  }

  it('pairwiseSum copy is bit-identical to core on whole arrays and on sub-ranges', () => {
    for (const n of [0, 1, 7, 8, 127, 128, 129, 1000, 4097, 100_003]) {
      const x = sample(n, n + 1);
      expect(_workerPairwiseSum(x)).toBe(pairwiseSum(x));
      if (n > 20) expect(_workerPairwiseSum(x, 3, n - 5)).toBe(pairwiseSum(x, 3, n - 5));
    }
  });

  it('pairwiseDot copy is bit-identical to core', () => {
    for (const n of [0, 1, 9, 128, 129, 5000, 100_003]) {
      const a = sample(n, 2 * n + 1);
      const b = sample(n, 2 * n + 2);
      expect(_workerPairwiseDot(a, b)).toBe(pairwiseDot(a, b));
      if (n > 20) expect(_workerPairwiseDot(a, b, 4, n - 2)).toBe(pairwiseDot(a, b, 4, n - 2));
    }
  });

  it('a single scaled partial reproduces core norm2 / scaledDistance exactly', () => {
    for (const scale of [1, 1e200, 1e-200]) {
      const a = sample(3000, 7).map((v) => v * scale);
      const b = sample(3000, 8).map((v) => v * scale);
      expect(_workerCombineScaledSsq([_workerScaledSsq(a)])).toBe(norm2(a));
      expect(_workerCombineScaledSsq([_workerScaledSsqDiff(a, b)])).toBe(scaledDistance(a, b));
    }
  });

  it('chunked scaled partials combine to core norm2 within rounding, even at 1e200', () => {
    for (const scale of [1, 1e200, 1e-200]) {
      const x = sample(10_000, 11).map((v) => v * scale);
      const parts: [number, number][] = [];
      for (let i = 0; i < x.length; i += 1500) {
        parts.push(_workerScaledSsq(x, i, Math.min(i + 1500, x.length)));
      }
      const combined = _workerCombineScaledSsq(parts);
      expect(Number.isFinite(combined)).toBe(true);
      expect(Math.abs(combined - norm2(x)) / norm2(x)).toBeLessThan(1e-14);
    }
  });

  it('combine handles empty, zero, NaN and Infinity partials like norm2', () => {
    expect(_workerCombineScaledSsq([])).toBe(0);
    expect(_workerCombineScaledSsq([_workerScaledSsq(new Float64Array(4))])).toBe(0);
    expect(_workerCombineScaledSsq([_workerScaledSsq(Float64Array.of(1, NaN))])).toBeNaN();
    const withInf = [
      _workerScaledSsq(Float64Array.of(1, 2)),
      _workerScaledSsq(Float64Array.of(Infinity)),
    ];
    expect(_workerCombineScaledSsq(withInf)).toBe(Infinity);
    expect(norm2(Float64Array.of(1, Infinity))).toBe(Infinity);
  });
});
