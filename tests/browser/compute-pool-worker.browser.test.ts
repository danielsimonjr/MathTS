/**
 * The browser build of `@danielsimonjr/mathts-workerpool` runs a task in a real Web Worker (#893, #912).
 *
 * The browser entry (`dist/browser.js`) and the worker file (`dist/worker.browser.js`) inline the
 * `workerpool` fork and import no Node builtin. The other tests of the bundle only scan its text
 * for builtins; this test boots the worker in Chromium and checks one result.
 *
 * Run with `bun run test:browser` after `bun run build`. The packages are imported by name, so
 * Vite resolves the `browser` export condition of `mathts-workerpool` to the browser build.
 */
import { describe, expect, it } from 'vitest';
import { ComputePool, resolveDefaultWorkerScript } from '@danielsimonjr/mathts-parallel';

describe('ComputePool in a browser (#893 #912)', () => {
  it('resolves the worker of the browser build', async () => {
    expect(typeof window).toBe('object');
    expect(await resolveDefaultWorkerScript()).toMatch(/worker\.browser\.js/);
  });

  it('runs a sin task on a Web Worker and returns Math.sin of every element', async () => {
    const pool = new ComputePool({ maxWorkers: 2 });
    try {
      const n = 65_536;
      const x = new Float64Array(n);
      for (let i = 0; i < n; i++) x[i] = (i % 1000) / 100;
      const { result, parallelized } = await pool.sin(x, { forceParallel: true });
      expect(parallelized).toBe(true);
      expect(result.length).toBe(n);
      for (const i of [0, 1, 999, 40_000, n - 1]) {
        expect(result[i]).toBeCloseTo(Math.sin(x[i] ?? 0), 12);
      }
    } finally {
      await pool.terminate();
    }
  }, 60_000);
});
