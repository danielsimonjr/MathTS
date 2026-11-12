import { describe, it, expect } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';
import { assertMatmulArgs } from '../src/validate.js';
import {
  resolveDefaultWorkerScript,
  viteDepsWorkerFallback,
  MIN_WORKER_CHUNK,
} from '@danielsimonjr/mathts-workerpool';

describe('G12 ComputePool regressions', () => {
  describe('#757 lifecycle', () => {
    it('forceParallel without initialize still parallelizes', async () => {
      const pool = new ComputePool({ maxWorkers: 4 });
      expect(pool.isReady()).toBe(false);
      const data = Float64Array.from({ length: 8_192 }, (_, i) => i);
      const r = await pool.sin(data, { forceParallel: true });
      expect(r.parallelized).toBe(true);
      expect(pool.isReady()).toBe(true);
      await pool.terminate(true);
    });

    it('throws after terminate instead of silent sequential', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      await pool.initialize();
      await pool.terminate(true);
      await expect(pool.sin(Float64Array.of(0, 1))).rejects.toThrow(/terminated/i);
    });

    it('throws on every compute family after terminate', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      await pool.initialize();
      await pool.terminate(true);
      const f64 = Float64Array.of(1, 2, 3, 4);
      const i32 = Int32Array.of(1, 3);
      const calls: Array<Promise<unknown>> = [
        pool.minMax(f64),
        pool.histogram(f64, 2),
        pool.transpose(f64, 2, 2),
        pool.matvec(f64, 2, 2, Float64Array.of(1, 1)),
        pool.sign(Float64Array.of(-1, 2)),
        pool.pow(Float64Array.of(2, 3), Float64Array.of(2, 2)),
        pool.bitAnd(i32, Int32Array.of(1, 1)),
        pool.bitNot(i32),
        pool.fftBatch(f64, f64, 1, 4),
        pool.distanceMatrix(f64, 2, 2),
        pool.applyKernel(f64, '(x) => x'),
        pool.integrateFanOut('(x) => x', 0, 1, 1, [0], [1]),
        pool.distributionSampleFanOut('uniform', [], 4, 1, 1),
        pool.tensordot(f64, [2, 2], f64, [2, 2], [1], [0]),
      ];
      const results = await Promise.allSettled(calls);
      expect(results.every((r) => r.status === 'rejected')).toBe(true);
      for (const r of results) {
        if (r.status === 'rejected') {
          expect(String(r.reason)).toMatch(/terminated/i);
        }
      }
    });

    it('initialize after terminate respawns workers', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      await pool.initialize();
      await pool.terminate(true);
      await pool.initialize();
      expect(pool.isReady()).toBe(true);
      const r = await pool.sin(Float64Array.of(0, 1), { forceParallel: true });
      expect(r.parallelized).toBe(true);
      await pool.terminate(true);
    });
  });

  describe('#710 sin threshold', () => {
    it('sin at 1e6 stays sequential by default (thresholdByOp.sin never)', async () => {
      const pool = new ComputePool({ maxWorkers: 4 });
      await pool.initialize();
      const v = new Float64Array(1_000_000);
      for (let i = 0; i < v.length; i++) v[i] = i * 1e-6;
      const r = await pool.sin(v);
      expect(r.parallelized).toBe(false);
      expect(r.chunks).toBe(1);
      await pool.terminate(true);
    });
  });

  describe('#758 chunk count', () => {
    it('forceParallel sin at 1e6 uses at most maxWorkers chunks', async () => {
      const pool = new ComputePool({ maxWorkers: 4 });
      await pool.initialize();
      const n = 1_000_000;
      const a = new Float64Array(n);
      for (let i = 0; i < n; i++) a[i] = Math.sin(i / 10);
      const r = await pool.sin(a, { forceParallel: true });
      expect(r.parallelized).toBe(true);
      expect(r.chunks).toBeLessThanOrEqual(4);
      expect(r.chunks).toBeGreaterThanOrEqual(1);
      await pool.terminate(true);
    });
  });

  describe('edge inputs', () => {
    it('n=0 forceParallel is sequential and empty', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      const r = await pool.sin(new Float64Array(0), { forceParallel: true });
      expect(r.parallelized).toBe(false);
      expect(r.chunks).toBe(1);
      expect(r.result.length).toBe(0);
      await pool.terminate(true);
    });

    it('n=1 and odd lengths match Math.sin and report one truthful chunk', async () => {
      const pool = new ComputePool({ maxWorkers: 4 });
      for (const n of [1, 7, 1001]) {
        const a = new Float64Array(n);
        for (let i = 0; i < n; i++) a[i] = i === 3 ? Number.NaN : i / 3;
        const r = await pool.sin(a, { forceParallel: true });
        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThanOrEqual(1);
        expect(r.chunks).toBeLessThanOrEqual(4);
        expect(r.result.length).toBe(n);
        for (let i = 0; i < n; i++) {
          const got = r.result[i];
          const want = Math.sin(a[i]);
          if (Number.isNaN(want)) expect(Number.isNaN(got)).toBe(true);
          else expect(got).toBe(want);
        }
      }
      await pool.terminate(true);
    });

    it('concurrent forceParallel calls share one lazy init', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      const a = Float64Array.of(0, Math.PI / 2, Math.PI);
      const b = Float64Array.of(1, 2, 3);
      const [ra, rb] = await Promise.all([
        pool.sin(a, { forceParallel: true }),
        pool.sin(b, { forceParallel: true }),
      ]);
      expect(ra.parallelized).toBe(true);
      expect(rb.parallelized).toBe(true);
      expect(ra.result[1]).toBeCloseTo(1, 10);
      expect(rb.result[0]).toBeCloseTo(Math.sin(1), 10);
      await pool.terminate(true);
    });
  });

  describe('#709 matmul arity', () => {
    it('wrong arity yields a short TypeError without stringifying b', () => {
      const n = 256;
      const A = new Float64Array(n * n).fill(1);
      const B = new Float64Array(n * n).fill(2);
      let msg = '';
      try {
        assertMatmulArgs(A, B, n, n, n);
      } catch (e) {
        msg = (e as Error).message;
      }
      expect(msg.length).toBeLessThan(200);
      expect(msg).toMatch(/expected \(a: Float64Array/);
      expect(msg).toMatch(/aRows: Float64Array/);
      expect(msg).not.toMatch(/0\.000/);
    });

    it('pool.matmul rejects the swapped call with a short message and accepts the documented one', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
      const n = 8;
      const A = new Float64Array(n * n).fill(1);
      const B = new Float64Array(n * n).fill(2);
      await expect(
        pool.matmul(A, B as unknown as number, n, n as unknown as Float64Array, n)
      ).rejects.toThrow(/expected \(a: Float64Array/);
      try {
        await pool.matmul(A, B as unknown as number, n, n as unknown as Float64Array, n);
      } catch (e) {
        expect((e as Error).message.length).toBeLessThan(200);
      }
      const ok = await pool.matmul(A, n, n, B, n);
      expect(ok.result.length).toBe(n * n);
      expect(ok.result[0]).toBe(n * 2);
      await pool.terminate(true);
    });
  });

  describe('#829 worker script resolution', () => {
    it('resolveDefaultWorkerScript returns a worker.js path on Node', async () => {
      const script = await resolveDefaultWorkerScript();
      expect(script).toBeDefined();
      expect(script!).toMatch(/worker\.js$/);
      expect(script!).not.toContain('.vite/deps');
    });

    it('rewrites a Vite prebundle worker URL and keeps other URLs sibling-relative', () => {
      const dev = new URL('http://localhost:5178/node_modules/.vite/deps/worker.js');
      expect(viteDepsWorkerFallback(dev)).toBe(
        'http://localhost:5178/node_modules/@danielsimonjr/mathts-workerpool/dist/worker.js'
      );
      const built = new URL('http://localhost:4173/assets/worker-abc123.js');
      expect(viteDepsWorkerFallback(built)).toBe(built.href);
      expect(MIN_WORKER_CHUNK).toBeGreaterThanOrEqual(65_536);
    });
  });
});

describe('G12 #758 bench (informational)', () => {
  it('logs forceParallel vs sequential timing at 1e6 (reported in PR; not gated)', async () => {
    const pool = new ComputePool({ maxWorkers: 4 });
    await pool.initialize();
    const n = 1_000_000;
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = Math.sin(i / 10);

    for (let w = 0; w < 3; w++) {
      await pool.sin(a);
      await pool.sin(a, { forceParallel: true });
    }
    const seqMs = (await pool.sin(a)).duration;
    const par = await pool.sin(a, { forceParallel: true });
    const ratio = par.duration / seqMs;
    // eslint-disable-next-line no-console -- benchmark evidence for PR (not a timing assertion)
    console.log(
      `G12 sin 1e6 pool-seq=${seqMs.toFixed(2)}ms force-par=${par.duration.toFixed(2)}ms ratio=${ratio.toFixed(2)} chunks=${par.chunks}`
    );

    expect(par.parallelized).toBe(true);
    expect(par.chunks).toBeLessThanOrEqual(4);
    expect(par.chunks).toBeGreaterThan(1);
    await pool.terminate(true);
  }, 120_000);
});
