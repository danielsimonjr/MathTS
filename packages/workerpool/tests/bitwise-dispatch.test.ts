/**
 * Regression tests for the Int32Array bitwise kernels that were added so
 * `ComputePool.bitAnd / bitOr / ...` could move off-thread.
 *
 * These force the parallel path (`forceParallel: true`) and check the
 * worker output against an in-test oracle that applies the same JS
 * operator element-wise. If a regression silently routes Int32 data
 * through a Float64 kernel (or vice versa), the upper bits would be
 * corrupted and the comparison would fail.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MathWorkerPool } from '../src/index.js';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

/** Build a fixed Int32Array fixture of `length` with both signs + edge values. */
function buildInt32Fixture(length: number, seed = 1): Int32Array {
  const data = new Int32Array(length);
  // A few load-bearing edge values up front; pseudo-random fill afterward.
  const edges = [0, 1, -1, 0x7fffffff, -0x80000000, 0xff, -2, 0b10101010];
  let s = seed;
  for (let i = 0; i < length; i++) {
    if (i < edges.length) {
      data[i] = edges[i];
    } else {
      // Xorshift32, then mask to 32 bits via Int32Array assignment.
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      data[i] = s | 0;
    }
  }
  return data;
}

describe('Int32Array bitwise worker dispatch', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    if (!existsSync(workerScript)) {
      execSync('npx tsup src/worker.ts --format esm', { cwd: pkgRoot, stdio: 'ignore' });
    }
    pool = new MathWorkerPool({ maxWorkers: 3, parallelThreshold: 10, chunkSize: 7 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate();
  });

  describe('bitwiseBinary (Int32 × Int32 → Int32)', () => {
    const ops = ['bitAnd', 'bitOr', 'bitXor', 'leftShift', 'rightArithShift', 'rightLogShift'] as const;

    for (const op of ops) {
      it(`dispatches ${op} to a real worker and matches the JS oracle`, async () => {
        const a = buildInt32Fixture(100, 1);
        const b = buildInt32Fixture(100, 2);
        const r = await pool.bitwiseBinary(a, b, op, { forceParallel: true });

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(r.result).toBeInstanceOf(Int32Array);
        expect(r.result.length).toBe(100);

        // Apply the JS operator element-wise as ground truth.
        const expected = new Int32Array(100);
        for (let i = 0; i < 100; i++) {
          switch (op) {
            case 'bitAnd': expected[i] = a[i] & b[i]; break;
            case 'bitOr': expected[i] = a[i] | b[i]; break;
            case 'bitXor': expected[i] = a[i] ^ b[i]; break;
            case 'leftShift': expected[i] = a[i] << b[i]; break;
            case 'rightArithShift': expected[i] = a[i] >> b[i]; break;
            case 'rightLogShift': expected[i] = a[i] >>> b[i]; break;
          }
        }
        expect(Array.from(r.result)).toEqual(Array.from(expected));
      });
    }
  });

  describe('bitwiseScalar (Int32 × scalar → Int32)', () => {
    const shiftOps = ['leftShift', 'rightArithShift', 'rightLogShift'] as const;

    for (const op of shiftOps) {
      it(`dispatches ${op} with a scalar shift count`, async () => {
        const a = buildInt32Fixture(100, 3);
        const scalar = 5;
        const r = await pool.bitwiseScalar(a, scalar, op, { forceParallel: true });

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);

        const expected = new Int32Array(100);
        for (let i = 0; i < 100; i++) {
          switch (op) {
            case 'leftShift': expected[i] = a[i] << scalar; break;
            case 'rightArithShift': expected[i] = a[i] >> scalar; break;
            case 'rightLogShift': expected[i] = a[i] >>> scalar; break;
          }
        }
        expect(Array.from(r.result)).toEqual(Array.from(expected));
      });
    }
  });

  describe('bitwiseNot (Int32 → Int32)', () => {
    it('dispatches bitNot to a real worker and matches the JS oracle', async () => {
      const a = buildInt32Fixture(100, 4);
      const r = await pool.bitwiseNot(a, { forceParallel: true });

      expect(r.parallelized).toBe(true);
      expect(r.chunks).toBeGreaterThan(1);

      const expected = new Int32Array(100);
      for (let i = 0; i < 100; i++) expected[i] = ~a[i];
      expect(Array.from(r.result)).toEqual(Array.from(expected));
    });
  });

  describe('sequential fallback', () => {
    it('runs in-process below threshold', async () => {
      const small = Int32Array.from([1, 2, 3, 4, 5]);
      const r = await pool.bitwiseBinary(small, small, 'bitAnd', { forceSequential: true });
      expect(r.parallelized).toBe(false);
      expect(Array.from(r.result)).toEqual([1, 2, 3, 4, 5]);
    });

    it('throws on length mismatch', async () => {
      const a = Int32Array.from([1, 2, 3]);
      const b = Int32Array.from([1, 2]);
      await expect(pool.bitwiseBinary(a, b, 'bitAnd')).rejects.toThrow('lengths must match');
    });
  });
});
