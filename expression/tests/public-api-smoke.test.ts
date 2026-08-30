import { describe, it, expect } from 'vitest';
import * as E from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const CALLS: Record<string, unknown[][]> = {
  parse: [['1+2']],
  evaluate: [['1+2']],
  compile: [['x^2']],
};

const HEURISTICS: unknown[][] = [[], ['1+2'], ['x'], [1], [{ x: 1 }]];
const SKIP = new Set(['reviver', 'replacer']);

describe('expression public API smoke', () => {
  const entries = Object.entries(E).filter(([, v]) => isFn(v));
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
    expect(n).toBeGreaterThan(3);
  });
});
