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
});
