import { describe, expect, it } from 'vitest';
import { WorkerPool } from '../src/WorkerPool.js';

/**
 * Issue #806 — `new WorkerPool()` must throw synchronously; async `initialize()`
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
});
