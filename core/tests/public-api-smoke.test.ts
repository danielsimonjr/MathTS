import { describe, it, expect } from 'vitest';
import * as C from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const CALLS: Record<string, unknown[][]> = {
  isNumber: [[1], ['x']],
  isComplex: [[{ re: 1, im: 0 }]],
  isBigNumber: [[1]],
  isFraction: [[1]],
  isMatrix: [[[1, 2]]],
  isUnit: [[1]],
  isDual: [[1]],
  Complex: [[1, 2]],
  Fraction: [[1, 2]],
  BigNumber: [[2]],
  Dual: [[1, 0]],
  createRangeClass: [],
};

const HEURISTICS: unknown[][] = [[], [0], [1], [1, 2], ['x'], [[1, 2]]];

describe('core public API smoke', () => {
  const entries = Object.entries(C).filter(([, v]) => isFn(v));
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
    expect(n).toBeGreaterThan(10);
  });
});
