/**
 * Dogfood #1280 - the worker pool `variance` took `std` as `Math.sqrt(variance)`, so the std of
 * data with subnormal squared deviations lost digits (1e-160 gave 9.99994e-161), and the std of
 * data of order 1e200 was Infinity. The pool cannot import core, so it carries one copy of the
 * constant `SQUARES_SAFE_MIN` and of `powerOfTwoBelow`. The parity tests pin the copies equal to
 * the canonical core definitions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SQUARES_SAFE_MIN, powerOfTwoBelow } from '@danielsimonjr/mathts-core';
import { MathWorkerPool } from '../src/index.js';
import { _workerPowerOfTwoBelow, _WORKER_SQUARES_SAFE_MIN } from '../src/worker-numerics.js';

const EPS4 = 4 * Number.EPSILON;
const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

describe('worker copies of the #1280 scale helpers match core', () => {
  it('the constant', () => {
    expect(_WORKER_SQUARES_SAFE_MIN).toBe(SQUARES_SAFE_MIN);
  });
  it.each([
    5e-324,
    2 ** -1074,
    2 ** -1022,
    1 - 2 ** -53,
    1,
    3,
    2 ** -400 - 2 ** -453,
    Number.MAX_VALUE,
  ])('powerOfTwoBelow(%s)', (max) => {
    expect(_workerPowerOfTwoBelow(max)).toBe(powerOfTwoBelow(max));
  });
});

describe('MathWorkerPool.variance: std for subnormal and overflowing squares', () => {
  const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
  const tsdownCli = createRequire(import.meta.url).resolve('tsdown/run');
  const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));
  let pool: MathWorkerPool;

  beforeAll(async () => {
    if (!existsSync(workerScript)) {
      execFileSync(
        process.execPath,
        [tsdownCli, 'src/worker.ts', '--format', 'esm', '--no-clean'],
        { cwd: pkgRoot, stdio: 'ignore' }
      );
    }
    pool = new MathWorkerPool({ maxWorkers: 2, parallelThreshold: 4, chunkSize: 2 });
    await pool.initialize();
  }, 60_000);
  afterAll(async () => {
    await pool?.terminate();
  });

  it('sequential path: [1e-160, 3e-160] has std 1e-160 (9.99994e-161 before)', async () => {
    const r = await pool.variance(new Float64Array([1e-160, 3e-160]), { forceSequential: true });
    expect(r.parallelized).toBe(false);
    expect(rel(r.result.std, 1e-160)).toBeLessThan(EPS4);
  });

  it('worker path: the same data (forceParallel)', async () => {
    const r = await pool.variance(new Float64Array([1e-160, 3e-160, 1e-160, 3e-160]), {
      forceParallel: true,
    });
    expect(r.parallelized).toBe(true);
    expect(rel(r.result.std, 1e-160)).toBeLessThan(EPS4);
  });

  it('overflow: [1e200, 3e200] has std 1e200 (Infinity before), on both paths', async () => {
    const seq = await pool.variance(new Float64Array([1e200, 3e200]), { forceSequential: true });
    expect(rel(seq.result.std, 1e200)).toBeLessThan(EPS4);
    const par = await pool.variance(new Float64Array([1e200, 3e200, 1e200, 3e200]), {
      forceParallel: true,
    });
    expect(rel(par.result.std, 1e200)).toBeLessThan(EPS4);
  });

  it('GUARD: ordinary data keeps its present result', async () => {
    const r = await pool.variance(new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]), {
      forceSequential: true,
    });
    expect(r.result.variance).toBe(4);
    expect(r.result.std).toBe(2);
  });
});
