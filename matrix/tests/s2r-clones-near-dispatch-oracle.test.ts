/**
 * Sprint 2R near-clone batch 3 (matrix dispatch) — independent oracles.
 * Pins GPUMatrixBackend async CPU fallback shapes and shader buffer layouts.
 * Givens rotation pins import applyGivensCols after the shared helper lands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { GPUMatrixBackend } from '../src/backends/GPUMatrixBackend.js';
import { destroyGlobalGPUBackend } from '../src/backends/GPUBackend.js';
import { applyGivensCols, applyGivensRight } from '../src/operations/givens.js';

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

describe('S2R near dispatch — Givens column rotation (hand oracle)', () => {
  it('applyGivensCols matches hand on 3×3', () => {
    const A = [
      [1, 0, 2],
      [3, 0, 4],
      [5, 0, 6],
    ];
    const c = 0.6;
    const s = 0.8;
    const expected = givensColsHand(A, c, s, 0, 2, 0, 3);
    const work = A.map((row) => row.slice());
    applyGivensCols(work, c, s, 0, 2, 0, 3);
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
    applyGivensCols(work, c, s, 0, 2, 1, 3);
    expect(work).toEqual(expected);
    expect(work[0]).toEqual(A[0]);
  });

  it('applyGivensRight matches applyGivensCols with rowEnd = A.length', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const c = 0.8;
    const s = 0.6;
    const viaCols = A.map((row) => row.slice());
    applyGivensCols(viaCols, c, s, 0, 1, 0, viaCols.length);
    const viaRight = A.map((row) => row.slice());
    applyGivensRight(viaRight, c, s, 0, 1, 0);
    expect(viaRight).toEqual(viaCols);
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

describe('S2R near dispatch — GPUBackend runShader plans (oracle)', () => {
  it('2×2 add/matmul/transpose bind layouts and byte sizes', async () => {
    const { planRunShaderFromAdd, planRunShaderFromMatmul, planRunShaderFromTranspose } =
      await import('../src/backends/gpu/run-shader.js');
    const wg: [number, number, number] = [1, 1, 1];
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([5, 6, 7, 8]);
    const addPlan = planRunShaderFromAdd(a, b, 2, 2, wg);
    expect(addPlan.pipeline).toBe('matrixAdd');
    expect(addPlan.bytes).toEqual([16, 16, 16]);
    expect(addPlan.bindEntries.length).toBe(4);

    const mm = planRunShaderFromMatmul(a, b, 2, 2, 2, wg);
    expect(mm.pipeline).toBe('matmul');
    expect(mm.bytes).toEqual([16, 16, 16]);
    expect(new Uint32Array(mm.params.buffer)[0]).toBe(2);

    const tr = planRunShaderFromTranspose(a, 2, 2, wg);
    expect(tr.pipeline).toBe('transpose');
    expect(tr.bytes).toEqual([16, 16]);
    expect(tr.bindEntries.length).toBe(3);
    expect(tr.bindEntries.some((e) => e.binding === 1 && e.bufferIndex === 1)).toBe(true);
  });
});
