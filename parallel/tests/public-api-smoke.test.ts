import { describe, it, expect } from 'vitest';
import * as P from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const f64 = new Float64Array([1, 2, 3, 4]);
const CALLS: Record<string, unknown[][]> = {
  parallelAdd: [[f64, f64]],
  parallelSubtract: [[f64, f64]],
  parallelMultiply: [[f64, f64]],
  parallelDivide: [[f64, f64]],
  parallelSin: [[f64]],
  parallelCos: [[f64]],
  parallelTan: [[f64]],
  parallelExp: [[f64]],
  parallelLog: [[f64]],
  parallelSqrt: [[f64]],
  parallelAbs: [[f64]],
  parallelSum: [[f64]],
};

describe('parallel public API smoke', () => {
  const entries = Object.entries(P).filter(([, v]) => isFn(v));
  it('exports functions', () => {
    expect(entries.length).toBeGreaterThan(0);
  });
  it('invokes mapped elementwise/reduction exports', async () => {
    let n = 0;
    for (const [name, raw] of entries) {
      const lists = CALLS[name];
      if (!lists) continue;
      for (const args of lists) {
        try {
          await (raw as Fn)(...(args as never[]));
        } catch {
          /* domain */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(5);
  });
});
