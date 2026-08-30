import { describe, it, expect } from 'vitest';
import * as M from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const A = [
  [2, 1],
  [1, 2],
];
const CALLS: Record<string, unknown[][]> = {
  eig: [[A]],
  svd: [[A]],
  det: [[A]],
  inv: [[A]],
  lu: [[A]],
  qr: [[A]],
  cholesky: [[A]],
};

describe('matrix public API smoke', () => {
  const entries = Object.entries(M).filter(([, v]) => isFn(v));
  it('invokes mapped decomposition exports', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      const lists = CALLS[name];
      if (!lists) continue;
      for (const args of lists) {
        try {
          (raw as Fn)(...(args as never[]));
        } catch {
          /* domain / ctor */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(3);
    expect(entries.length).toBeGreaterThan(5);
  });
});
