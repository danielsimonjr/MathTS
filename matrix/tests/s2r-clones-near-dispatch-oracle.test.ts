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
import { gpuOrJs } from '../src/backends/gpu/gpu-or-js.js';
import type { BufferPool, GPUContext, ShaderManager } from '@danielsimonjr/mathts-gpu';
import {
  planRunShaderFromAdd,
  planRunShaderFromMatmul,
  planRunShaderFromTranspose,
  runShader,
  type RunShaderHost,
  type RunShaderPlan,
} from '../src/backends/gpu/run-shader.js';

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

function u32(view: ArrayBufferView): number[] {
  return Array.from(new Uint32Array(view.buffer, view.byteOffset, view.byteLength / 4));
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

  it('applyGivensRight matches hand on all rows (rowEnd = A.length)', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const c = 0.8;
    const s = 0.6;
    const expected = givensColsHand(A, c, s, 0, 1, 0, A.length);
    const viaRight = A.map((row) => row.slice());
    applyGivensRight(viaRight, c, s, 0, 1, 0);
    expect(viaRight).toEqual(expected);
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

  it('sync scale is unchanged (JS path, same values as scaleAsync below threshold)', () => {
    const a = DenseMatrix.fromArray([
      [1, -2],
      [3, 4],
    ]);
    const r = gpu.scale(a, 2);
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

describe('S2R near dispatch — gpuOrJs gating (no device)', () => {
  it('returns js() and never calls gpu or fallback when useGpu is false', async () => {
    const calls: string[] = [];
    const result = await gpuOrJs(
      false,
      () => {
        calls.push('js');
        return 1;
      },
      async () => {
        calls.push('gpu');
        return 2;
      },
      async (gpuOp, fallback) => {
        calls.push('fallback-shell');
        return gpuOp().catch(() => fallback());
      }
    );
    expect(result).toBe(1);
    expect(calls).toEqual(['js']);
  });

  it('routes through executeWithFallback when useGpu is true', async () => {
    const calls: string[] = [];
    const result = await gpuOrJs(
      true,
      () => {
        calls.push('js');
        return 1;
      },
      async () => {
        calls.push('gpu');
        return 2;
      },
      async (gpuOp, fallback) => {
        calls.push('fallback-shell');
        const gpuVal = await gpuOp();
        fallback();
        return gpuVal;
      }
    );
    expect(result).toBe(2);
    expect(calls).toEqual(['fallback-shell', 'gpu', 'js']);
  });
});

describe('S2R near dispatch — GPUBackend runShader plans (oracle)', () => {
  const wg: [number, number, number] = [1, 1, 1];

  it('2×2 add: three equal storage sizes, 4 bind entries, params [rows, cols, 0, 0]', () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([5, 6, 7, 8]);
    const addPlan = planRunShaderFromAdd(a, b, 2, 2, wg);
    expect(addPlan.pipeline).toBe('matrixAdd');
    expect(addPlan.bytes).toEqual([16, 16, 16]);
    expect(addPlan.storageLabels).toEqual(['matrix-a', 'matrix-b', 'matrix-result']);
    expect(addPlan.writes).toEqual([a, b]);
    expect(addPlan.bindEntries).toEqual([
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: 2 },
      { binding: 3, bufferIndex: -1 },
    ]);
    expect(u32(addPlan.params)).toEqual([2, 2, 0, 0]);
    expect(addPlan.resultBufferIndex).toBe(2);
    expect(addPlan.workgroups).toEqual(wg);
  });

  it('2×3 × 3×4 matmul: distinct byte sizes and params [M, N, K, 0]', () => {
    const a = new Float32Array(2 * 3);
    const b = new Float32Array(3 * 4);
    const mm = planRunShaderFromMatmul(a, b, 2, 3, 4, wg);
    expect(mm.pipeline).toBe('matmul');
    expect(mm.bytes).toEqual([2 * 3 * 4, 3 * 4 * 4, 2 * 4 * 4]);
    expect(mm.bytes).toEqual([24, 48, 32]);
    expect(mm.storageLabels).toEqual(['matmul-a', 'matmul-b', 'matmul-result']);
    expect(mm.bindEntries).toEqual([
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: 2 },
      { binding: 3, bufferIndex: -1 },
    ]);
    expect(u32(mm.params)).toEqual([2, 4, 3, 0]);
    expect(mm.resultBufferIndex).toBe(2);
  });

  it('2×3 transpose: two storage buffers, no b, 3 bind entries, params [rows, cols, 0, 0]', () => {
    const a = new Float32Array([1, 2, 3, 4, 5, 6]);
    const tr = planRunShaderFromTranspose(a, 2, 3, wg);
    expect(tr.pipeline).toBe('transpose');
    expect(tr.bytes).toEqual([24, 24]);
    expect(tr.storageLabels).toEqual(['transpose-a', 'transpose-result']);
    expect(tr.writes).toEqual([a]);
    expect(tr.bindEntries).toEqual([
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: -1 },
    ]);
    expect(u32(tr.params)).toEqual([2, 3, 0, 0]);
    expect(tr.resultBufferIndex).toBe(1);
  });
});

describe('S2R near dispatch — runShader acquire/release (mock host)', () => {
  function makeHost(opts: { throwOnWrite?: boolean } = {}): {
    host: RunShaderHost;
    acquired: string[];
    released: string[];
    writable: boolean[];
  } {
    const acquired: string[] = [];
    const released: string[] = [];
    const writable: boolean[] = [];
    let seq = 0;
    const host: RunShaderHost = {
      getContext: () =>
        ({
          writeBuffer: () => {
            if (opts.throwOnWrite) {
              throw new Error('write-fail');
            }
          },
          createBindGroup: () => ({}),
          dispatchCompute: () => undefined,
          readBuffer: async () => new Float32Array([9, 8, 7, 6]).buffer,
        }) as unknown as GPUContext,
      getBufferPool: () =>
        ({
          acquireStorageBuffer: (
            size: number,
            label: string,
            _readable: boolean,
            isWritable: boolean
          ) => {
            const id = `${label}:${size}:${seq++}`;
            acquired.push(id);
            writable.push(isWritable);
            return { label: id } as unknown as GPUBuffer;
          },
          acquireUniformBuffer: (size: number, label: string) => {
            const id = `${label}:${size}:${seq++}`;
            acquired.push(id);
            return { label: id } as unknown as GPUBuffer;
          },
          release: (buffer: GPUBuffer) => {
            released.push((buffer as unknown as { label: string }).label);
          },
        }) as unknown as BufferPool,
      getShaderManager: () =>
        ({
          getRegisteredPipeline: () => ({
            getBindGroupLayout: () => ({}),
          }),
        }) as unknown as ShaderManager,
    };
    return { host, acquired, released, writable };
  }

  const addPlan: RunShaderPlan = planRunShaderFromAdd(
    new Float32Array([1, 2, 3, 4]),
    new Float32Array([5, 6, 7, 8]),
    2,
    2,
    [1, 1, 1]
  );

  it('acquires A, B, result, params then releases all four in that order', async () => {
    const { host, acquired, released, writable } = makeHost();
    const out = await runShader(host, addPlan);
    expect(Array.from(out)).toEqual([9, 8, 7, 6]);
    expect(acquired.map((id) => id.split(':')[0])).toEqual([
      'matrix-a',
      'matrix-b',
      'matrix-result',
      'params',
    ]);
    expect(writable).toEqual([true, true, false]);
    expect(released.map((id) => id.split(':')[0])).toEqual([
      'matrix-a',
      'matrix-b',
      'matrix-result',
      'params',
    ]);
  });

  it('releases acquired buffers when writeBuffer throws', async () => {
    const { host, acquired, released } = makeHost({ throwOnWrite: true });
    await expect(runShader(host, addPlan)).rejects.toThrow('write-fail');
    expect(acquired.length).toBeGreaterThan(0);
    expect(released).toEqual(acquired);
  });

  it('transpose acquires two storage buffers plus params (no b)', async () => {
    const { host, acquired, writable } = makeHost();
    const tr = planRunShaderFromTranspose(new Float32Array([1, 2, 3, 4]), 2, 2, [1, 1, 1]);
    await runShader(host, tr);
    expect(acquired.map((id) => id.split(':')[0])).toEqual([
      'transpose-a',
      'transpose-result',
      'params',
    ]);
    expect(writable).toEqual([true, false]);
  });
});
