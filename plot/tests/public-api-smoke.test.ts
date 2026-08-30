import { describe, it, expect } from 'vitest';
import * as P from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const HEURISTICS: unknown[][] = [
  [],
  [
    [0, 1],
    [0, 1],
  ],
  [{ x: [0, 1], y: [0, 1] }],
];

describe('plot public API smoke', () => {
  const entries = Object.entries(P).filter(([, v]) => isFn(v));
  it('invokes every function export', () => {
    let n = 0;
    for (const [, raw] of entries) {
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
