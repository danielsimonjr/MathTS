import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';
import { ParallelMatrix } from '../src/ParallelMatrix.js';
import { assertMatmulArgs, assertMatmulShape, assertSameLength } from '../src/validate.js';

const ramp = (n: number, f: (i: number) => number = (i) => i) =>
  Float64Array.from({ length: n }, (_, i) => f(i));

describe('validate helpers', () => {
  it('#709 assertMatmulArgs rejects swapped matrix args with a short message', () => {
    const n = 4;
    const A = new Float64Array(n * n);
    const B = new Float64Array(n * n);
    expect(() => assertMatmulArgs(A, B, n, n, n)).toThrow(/aRows: Float64Array/);
    let msg = '';
    try {
      assertMatmulArgs(A, B, n, n, n);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg.length).toBeLessThan(200);
  });

  it('assertSameLength uses one message shape', () => {
    expect(() => assertSameLength('add', 3, 2)).toThrow('add: lengths must match (3 vs 2)');
    expect(() => assertSameLength('add', 2, 2)).not.toThrow();
  });

  it('assertMatmulShape names the first inconsistency', () => {
    expect(() => assertMatmulShape('multiply', 6, 2, 3, 6, 2, 3)).toThrow(
      'multiply: inner dimensions must match (aCols 3 vs bRows 2)'
    );
    expect(() => assertMatmulShape('multiply', 5, 2, 3, 6, 3, 2)).toThrow(
      'multiply: a has 5 elements, expected 2x3'
    );
    expect(() => assertMatmulShape('multiply', 6, 2, 3, 7, 3, 2)).toThrow(
      'multiply: b has 7 elements, expected 3x2'
    );
    expect(() => assertMatmulShape('multiply', 6, 2, 3, 6, 3, 2)).not.toThrow();
  });
});

describe('ParallelMatrix.multiply validates its shapes at every size', () => {
  it('throws on mismatched inner dimensions below the parallel threshold', async () => {
    ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
    await expect(ParallelMatrix.multiply(ramp(6), 2, 3, ramp(6), 2, 3)).rejects.toThrow(
      /inner dimensions must match/
    );
    await expect(ParallelMatrix.multiply(ramp(5), 2, 3, ramp(6), 3, 2)).rejects.toThrow(
      /a has 5 elements/
    );
  });

  it('throws on the same mistakes above the parallel threshold, before any worker starts', async () => {
    ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
    await expect(ParallelMatrix.multiply(ramp(600), 20, 30, ramp(600), 20, 30)).rejects.toThrow(
      /inner dimensions must match/
    );
    await expect(ParallelMatrix.multiply(ramp(600), 20, 30, ramp(599), 30, 20)).rejects.toThrow(
      /b has 599 elements/
    );
  });
});

describe('ParallelMatrix.toSharedBuffer', () => {
  const toShared = (data: number[] | Float64Array): Float64Array =>
    (
      ParallelMatrix as unknown as {
        toSharedBuffer(d: number[] | Float64Array): Float64Array;
      }
    ).toSharedBuffer(data);

  it('returns an input that is already SharedArrayBuffer-backed as is', () => {
    ParallelMatrix.configure({ useSharedMemory: true });
    const shared = new Float64Array(new SharedArrayBuffer(4 * 8));
    shared.set([1, 2, 3, 4]);
    expect(toShared(shared)).toBe(shared);
  });

  it('copies a plain Float64Array or array into a new shared buffer', () => {
    ParallelMatrix.configure({ useSharedMemory: true });
    const plain = Float64Array.of(1, 2, 3);
    const copy = toShared(plain);
    expect(copy).not.toBe(plain);
    expect(copy.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Array.from(copy)).toEqual([1, 2, 3]);
    expect(toShared([4, 5]).buffer).toBeInstanceOf(SharedArrayBuffer);
  });

  it('leaves a Float64Array alone when shared memory is off', () => {
    ParallelMatrix.configure({ useSharedMemory: false });
    const plain = Float64Array.of(1, 2, 3);
    expect(toShared(plain)).toBe(plain);
  });
});

describe('ComputePool argument validation (same result at small and large sizes)', () => {
  let eager: ComputePool;
  let lazy: ComputePool;

  beforeAll(async () => {
    eager = new ComputePool({
      maxWorkers: 2,
      chunkSize: 50,
      thresholdByOp: {
        matmul: 'always',
        transpose: 'always',
        matvec: 'always',
        tensordot: 'always',
      },
    });
    await eager.initialize();
    lazy = new ComputePool({ maxWorkers: 2 });
    await lazy.initialize();
  }, 60_000);

  afterAll(async () => {
    await eager.terminate();
    await lazy.terminate();
  });

  describe('matmul', () => {
    for (const [label, getPool] of [
      ['below the threshold', () => lazy],
      ['above the threshold', () => eager],
    ] as const) {
      it(`throws on a b buffer that does not match aCols x bCols (${label})`, async () => {
        await expect(getPool().matmul(ramp(6), 2, 3, ramp(5), 2)).rejects.toThrow(
          /b has 5 elements, expected 3x2/
        );
      });
      it(`throws on an a buffer that does not match aRows x aCols (${label})`, async () => {
        await expect(getPool().matmul(ramp(7), 2, 3, ramp(6), 2)).rejects.toThrow(
          /a has 7 elements, expected 2x3/
        );
      });
    }
  });

  describe('transpose and matvec check lengths above the threshold too', () => {
    it('transpose', async () => {
      await expect(eager.transpose(ramp(10), 3, 4)).rejects.toThrow(
        /data length 10 !== rows\*cols/
      );
      await expect(lazy.transpose(ramp(10), 3, 4)).rejects.toThrow(/data length 10 !== rows\*cols/);
    });
    it('matvec matrix length', async () => {
      await expect(eager.matvec(ramp(10), 3, 4, ramp(4))).rejects.toThrow(/matrix length 10/);
      await expect(lazy.matvec(ramp(10), 3, 4, ramp(4))).rejects.toThrow(/matrix length 10/);
    });
    it('matvec vector length', async () => {
      await expect(eager.matvec(ramp(12), 3, 4, ramp(3))).rejects.toThrow(/vector length 3/);
      await expect(lazy.matvec(ramp(12), 3, 4, ramp(3))).rejects.toThrow(/vector length 3/);
    });
  });

  describe('histogram', () => {
    it.each([0, -3, 1.5, Number.NaN, Infinity])('rejects bins = %s', async (bins) => {
      await expect(lazy.histogram(ramp(10), bins)).rejects.toThrow(
        /bins must be a positive integer/
      );
    });

    it('skips NaN and infinite samples instead of counting them', async () => {
      const data = Float64Array.of(0, 1, 2, 3, NaN, Infinity, -Infinity);
      const r = await lazy.histogram(data, 2);
      // range comes from the finite samples only: [0, 3], width 1.5
      expect(r.result).toEqual([2, 2]);
    });

    it('puts every sample of a constant array in bin 0, with or without explicit bounds', async () => {
      const flat = Float64Array.from({ length: 12 }, () => 5);
      expect((await lazy.histogram(flat, 4)).result).toEqual([12, 0, 0, 0]);
      expect((await lazy.histogram(flat, 4, 5, 5)).result).toEqual([12, 0, 0, 0]);
    });

    it('agrees between the inline and the worker path', async () => {
      const data = ramp(500, (i) => Math.sin(i) * 10);
      const inline = await lazy.histogram(data, 7, undefined, undefined, { forceSequential: true });
      const workers = await lazy.histogram(data, 7, undefined, undefined, { forceParallel: true });
      expect(workers.parallelized).toBe(true);
      expect(workers.result).toEqual(inline.result);
    });
  });

  describe('tensordot reads views with a byteOffset', () => {
    it('matches the sequential result for subarray operands above the threshold', async () => {
      const view = (len: number, f: (i: number) => number) => {
        const whole = new Float64Array(len + 20);
        for (let i = 0; i < len; i++) whole[10 + i] = f(i);
        return whole.subarray(10, 10 + len);
      };
      const a = view(6 * 8, (i) => (i % 9) - 4);
      const b = view(8 * 5, (i) => (i % 4) + 1);
      expect(a.byteOffset).toBe(80);
      const exactA = Float64Array.from(a);
      const exactB = Float64Array.from(b);

      const par = await eager.tensordot(a, [6, 8], b, [8, 5], [1], [0]);
      expect(par.parallelized).toBe(true);
      const ref = await new ComputePool({
        thresholdByOp: { tensordot: 'never' },
      }).tensordot(exactA, [6, 8], exactB, [8, 5], [1], [0]);
      expect(ref.parallelized).toBe(false);
      expect(par.result.shape).toEqual([6, 5]);
      expect(Array.from(par.result.data)).toEqual(Array.from(ref.result.data));
    });
  });
});

describe('ComputePool.exec', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool({ maxWorkers: 2 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool.terminate();
  });

  it('runs a registered worker method and returns its result', async () => {
    const data = Float64Array.of(1, 2, 3, 4);
    const total = await pool.exec<number>('sumChunk', [data.buffer, 0, data.length]);
    expect(total).toBe(10);
  });

  it('passes task options through (a transfer moves the buffer)', async () => {
    const data = Float64Array.of(1, 2, 3, 4, 5);
    const total = await pool.exec<number>('sumChunk', [data.buffer, 0, data.length], {
      transfer: [data.buffer],
    });
    expect(total).toBe(15);
    expect(data.byteLength).toBe(0); // detached by the transfer
  });

  it('rejects for a method the worker does not know', async () => {
    await expect(pool.exec('noSuchKernel', [])).rejects.toThrow(/Unknown method/i);
  });
});
