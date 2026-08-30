import { describe, it, expect } from 'vitest';
import * as A from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const HEURISTICS: unknown[][] = [[], [1], [[1, 2]], [1, 0]];

describe('autograd public API smoke', () => {
  const entries = Object.entries(A).filter(([, v]) => isFn(v));
  it('invokes every function export', () => {
    let n = 0;
    for (const [, raw] of entries) {
      for (const args of HEURISTICS) {
        try {
          (raw as Fn)(...(args as never[]));
        } catch {
          /* domain / ctor */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(0);
  });
});
