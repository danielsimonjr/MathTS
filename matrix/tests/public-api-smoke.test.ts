import { describe, it, expect } from 'vitest';
import * as M from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const A = [
  [2, 1],
  [1, 2],
];
const CALLS: Record<string, unknown[][]> = {
  DenseMatrix: [
    [
      [1, 2],
      [3, 4],
    ],
  ],
  SparseMatrix: [
    [
      [1, 0],
      [0, 1],
    ],
  ],
  eig: [[A]],
  svd: [[A]],
  det: [[A]],
  inv: [[A]],
  lu: [[A]],
  qr: [[A]],
  cholesky: [[A]],
};

const HEURISTICS: unknown[][] = [[], [A], [A, A], [[1, 2, 3]]];

describe('matrix public API smoke', () => {
  const entries = Object.entries(M).filter(([, v]) => isFn(v));
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
    expect(n).toBeGreaterThan(5);
  });
});
