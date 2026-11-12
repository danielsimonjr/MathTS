import { describe, it, expect } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';
import { assertMatmulArgs } from '../src/validate.js';
import { resolveDefaultWorkerScript } from '@danielsimonjr/mathts-workerpool';

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
  });

  describe('#829 worker script resolution', () => {
    it('resolveDefaultWorkerScript returns a worker.js path on Node', async () => {
      const script = await resolveDefaultWorkerScript();
      expect(script).toBeDefined();
      expect(script!).toMatch(/worker\.js$/);
      expect(script!).not.toContain('.vite/deps');
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
