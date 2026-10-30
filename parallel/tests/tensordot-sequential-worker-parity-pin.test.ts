import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';

describe('tensordot sequential vs worker parity (P6-8 pin)', () => {
  let parallelPool: ComputePool;
  let sequentialPool: ComputePool;

  beforeAll(async () => {
    parallelPool = new ComputePool({
      maxWorkers: 2,
      chunkSize: 4,
      thresholdByOp: { tensordot: 1 },
    });
    sequentialPool = new ComputePool({
      maxWorkers: 2,
      thresholdByOp: { tensordot: 'never' },
    });
    await parallelPool.initialize();
    await sequentialPool.initialize();
  });

  afterAll(async () => {
    await parallelPool.terminate();
    await sequentialPool.terminate();
  });

  it('worker and sequential paths produce identical Float64 bytes', async () => {
    const aShape = [2, 3, 4] as const;
    const bShape = [4, 2] as const;
    const a = new Float64Array(24);
    const b = new Float64Array(8);
    for (let i = 0; i < a.length; i++) a[i] = (i % 7) - 2;
    for (let i = 0; i < b.length; i++) b[i] = i * 0.25;

    const par = await parallelPool.tensordot(a, aShape, b, bShape, [2], [0]);
    const seq = await sequentialPool.tensordot(a, aShape, b, bShape, [2], [0]);

    expect(par.parallelized).toBe(true);
    expect(seq.parallelized).toBe(false);
    expect(par.result.shape).toEqual(seq.result.shape);
    expect(Array.from(par.result.data)).toEqual(Array.from(seq.result.data));
  });

  it('two contracted axes in permuted order match an independent loop on both paths', async () => {
    const aShape = [3, 4, 5] as const;
    const bShape = [5, 2, 3] as const;
    const a = new Float64Array(60);
    const b = new Float64Array(30);
    for (let i = 0; i < a.length; i++) a[i] = Math.imul(i + 1, 2654435761) / 2 ** 31;
    for (let i = 0; i < b.length; i++) b[i] = Math.imul(i + 7, 40503) / 2 ** 15;

    // result[j][l] = sum over k (a axis 2 / b axis 0), then i (a axis 0 / b axis 2), k outermost.
    const expected = new Float64Array(8);
    for (let j = 0; j < 4; j++) {
      for (let l = 0; l < 2; l++) {
        let acc = 0;
        for (let k = 0; k < 5; k++) {
          for (let i = 0; i < 3; i++) {
            acc += a[i * 20 + j * 5 + k] * b[k * 6 + l * 3 + i];
          }
        }
        expected[j * 2 + l] = acc;
      }
    }

    const par = await parallelPool.tensordot(a, aShape, b, bShape, [2, 0], [0, 2]);
    const seq = await sequentialPool.tensordot(a, aShape, b, bShape, [2, 0], [0, 2]);

    expect(par.parallelized).toBe(true);
    expect(par.chunks).toBe(2);
    expect(seq.parallelized).toBe(false);
    expect(seq.chunks).toBe(1);
    expect(par.result.shape).toEqual([4, 2]);
    expect(seq.result.shape).toEqual([4, 2]);
    for (let i = 0; i < expected.length; i++) {
      expect(Object.is(par.result.data[i], expected[i])).toBe(true);
      expect(Object.is(seq.result.data[i], expected[i])).toBe(true);
    }
  });

  it('a zero-size output is empty on both paths', async () => {
    const a = new Float64Array(0);
    const b = new Float64Array(6);
    const par = await parallelPool.tensordot(a, [0, 3], b, [3, 2], [1], [0]);
    const seq = await sequentialPool.tensordot(a, [0, 3], b, [3, 2], [1], [0]);
    expect(par.result.shape).toEqual([0, 2]);
    expect(seq.result.shape).toEqual([0, 2]);
    expect(par.result.data.length).toBe(0);
    expect(seq.result.data.length).toBe(0);
  });
});
