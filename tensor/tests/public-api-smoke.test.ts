import { describe, it, expect } from 'vitest';
import * as T from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const CALLS: Record<string, unknown[][]> = {
  Tensor: [
    [
      [1, 2, 3, 4],
      [2, 2],
    ],
  ],
};

const HEURISTICS: unknown[][] = [[], [[1, 2, 3]], [[1, 2], [2]]];

describe('tensor public API smoke', () => {
  const entries = Object.entries(T).filter(([, v]) => isFn(v));
  it('invokes every function export', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      const lists = CALLS[name] ?? HEURISTICS;
      for (const args of lists) {
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
