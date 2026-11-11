import { describe, expect, it } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

/**
 * Issue #806 — `new WorkerPool()` must throw synchronously; fire-and-forget `initialize()`
 * used to call `workerScript.startsWith` on undefined and emit an unhandled rejection.
 */
describe('WorkerPool constructor (#806)', () => {
  it('throws synchronously when workerScript is omitted', () => {
    expect(() => new WorkerPool(undefined as unknown as string)).toThrow(TypeError);
    expect(() => new WorkerPool(undefined as unknown as string)).toThrow(/workerScript/);
  });

  it('does not emit unhandledRejection when workerScript is omitted', async () => {
    let unhandled: unknown;
    const onRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onRejection);
    try {
      expect(() => new WorkerPool(undefined as unknown as string)).toThrow(/workerScript/);
      await new Promise((r) => setTimeout(r, 200));
      expect(unhandled).toBeUndefined();
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('throws when workerScript is an empty string', () => {
    expect(() => new WorkerPool('')).toThrow(/workerScript/);
  });

  it('throws synchronously for a zero-arg call and for non-strings', () => {
    const Ctor = WorkerPool as unknown as new (...args: unknown[]) => WorkerPool;
    expect(() => new Ctor()).toThrow(TypeError);
    expect(() => new Ctor()).toThrow(/workerScript/);
    for (const bad of [null, 1, {}, new URL('file:///tmp/worker.js'), new String('/worker.js')]) {
      expect(() => new Ctor(bad)).toThrow(TypeError);
      expect(() => new Ctor(bad)).toThrow(/workerScript/);
    }
  });

  it('does not emit unhandledRejection for an invalid file:// script', async () => {
    const reasons: unknown[] = [];
    const onRejection = (reason: unknown) => {
      reasons.push(reason);
    };
    process.on('unhandledRejection', onRejection);
    const pool = new WorkerPool('file://not a url', 1);
    try {
      await new Promise((r) => setTimeout(r, 200));
      expect(reasons).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
      await pool.terminate();
    }
  });
});
