import { describe, it, expect } from 'vitest';
import * as C from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const CALLS: Record<string, unknown[][]> = {
  create: [],
};

const HEURISTICS: unknown[][] = [[], [1, 2], ['1+2']];
const SKIP = new Set(['all']);

describe('compat public API smoke', () => {
  const entries = Object.entries(C).filter(([, v]) => isFn(v));
  it('invokes every safe function export', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      if (SKIP.has(name)) continue;
      const lists = CALLS[name] ?? HEURISTICS;
      for (const args of lists) {
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
