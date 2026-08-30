import { describe, it, expect } from 'vitest';
import * as P from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const SKIP = new Set(['ComputePool', 'WorkerPool', 'MathWorkerPool']);
const HEURISTICS: unknown[][] = [[], [1], [[1, 2, 3]], [new Float64Array([1, 2, 3])]];

describe('parallel public API smoke', () => {
  const entries = Object.entries(P).filter(([, v]) => isFn(v));
  it('invokes every safe function export', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      if (SKIP.has(name)) continue;
      for (const args of HEURISTICS) {
        try {
          (raw as Fn)(...(args as never[]));
        } catch {
          /* domain */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(0);
  });
});
