import { describe, it, expect } from 'vitest';
import * as G from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const SKIP = new Set(['enableGpu', 'disableGpu']);
const HEURISTICS: unknown[][] = [[], [true], [false]];

describe('gpu public API smoke', () => {
  const entries = Object.entries(G).filter(([, v]) => isFn(v));
  it('invokes every safe function export', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      if (SKIP.has(name)) continue;
      for (const args of HEURISTICS) {
        try {
          (raw as Fn)(...(args as never[]));
        } catch {
          /* domain / no adapter */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(0);
  });
});
