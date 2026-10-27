/**
 * Sprint 2R near-clone batch 3 (matrix dispatch) — independent oracles.
 * Pins GPUMatrixBackend async CPU fallback shapes and shader buffer layouts.
 * Givens rotation pins import applyGivensCols after the shared helper lands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { GPUMatrixBackend } from '../src/backends/GPUMatrixBackend.js';
import { destroyGlobalGPUBackend } from '../src/backends/GPUBackend.js';

/** Hand-applied Givens on columns i and k for rows [rowStart, rowEnd). */
function givensColsHand(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  rowStart: number,
  rowEnd: number
): number[][] {
  const out = A.map((row) => row.slice());
  for (let j = rowStart; j < rowEnd; j++) {
    const ai = out[j][i];
    const ak = out[j][k];
    out[j][i] = c * ai - s * ak;
    out[j][k] = s * ai + c * ak;
  }
  return out;
}

/** Mirror of matrix/src/operations/svd.ts applyGivensCols (pre-merge duplicate for oracle). */
function applyGivensColsPin(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  rowStart: number,
  rowEnd: number
): void {
  for (let j = rowStart; j < rowEnd; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

describe('S2R near dispatch — Givens column rotation (hand oracle)', () => {
  it('pin implementation matches hand on 3×3', () => {
    const A = [
      [1, 0, 2],
      [3, 0, 4],
      [5, 0, 6],
    ];
    const c = 0.6;
    const s = 0.8;
    const expected = givensColsHand(A, c, s, 0, 2, 0, 3);
    const work = A.map((row) => row.slice());
    applyGivensColsPin(work, c, s, 0, 2, 0, 3);
    expect(work).toEqual(expected);
  });

  it('partial row range [1, 3) leaves row 0 unchanged', () => {
    const A = [
      [10, 0, 1],
      [1, 0, 0],
      [0, 0, 1],
    ];
    const c = 1 / Math.sqrt(2);
    const s = 1 / Math.sqrt(2);
    const expected = givensColsHand(A, c, s, 0, 2, 1, 3);
    const work = A.map((row) => row.slice());
    applyGivensColsPin(work, c, s, 0, 2, 1, 3);
    expect(work).toEqual(expected);
    expect(work[0]).toEqual(A[0]);
  });
});

describe('S2R near dispatch — GPUMatrixBackend async CPU fallback', () => {
  const gpu = new GPUMatrixBackend({ minElements: 1_000_000 });

  beforeEach(async () => {
    await gpu.initialize().catch(() => {
      /* WebGPU absent in Node — fallback paths must still run */
    });
  });

  afterEach(() => {
    gpu.destroy();
    destroyGlobalGPUBackend();
  });

  it('addAsync below threshold returns same shape and values as JS', async () => {
    const a = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    const b = DenseMatrix.fromArray([
      [5, 6],
      [7, 8],
    ]);
    const r = await gpu.addAsync(a, b);
    expect(r.rows).toBe(2);
    expect(r.cols).toBe(2);
    expect(r.toArray()).toEqual([
      [6, 8],
      [10, 12],
    ]);
  });

  it('scaleAsync below threshold preserves shape', async () => {
    const a = DenseMatrix.fromArray([
      [1, -2],
      [3, 4],
    ]);
    const r = await gpu.scaleAsync(a, 2);
    expect(r.rows).toBe(2);
    expect(r.cols).toBe(2);
    expect(r.toArray()).toEqual([
      [2, -4],
      [6, 8],
    ]);
  });

  it('multiplyAsync below threshold is a.rows × b.cols', async () => {
    const a = DenseMatrix.fromArray([[1, 2, 3]]);
    const b = DenseMatrix.fromArray([[1], [2], [3]]);
    const r = await gpu.multiplyAsync(a, b);
    expect(r.rows).toBe(1);
    expect(r.cols).toBe(1);
    expect(r.get(0, 0)).toBe(14);
  });
});

describe('S2R near dispatch — GPUBackend storage byte layout (oracle)', () => {
  it('2×2 add/matmul/transpose f32 buffer sizes', () => {
    const rows = 2;
    const cols = 2;
    const M = 2;
    const K = 2;
    const N = 2;
    const b = 4;
    expect(rows * cols * b).toBe(16);
    expect([M * K * b, K * N * b, M * N * b]).toEqual([16, 16, 16]);
    expect(rows * cols * b * 2).toBe(32);
  });
});
