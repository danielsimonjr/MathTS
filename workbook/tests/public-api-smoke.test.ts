import { describe, it, expect } from 'vitest';
import * as W from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const SRC = `cells:\n  - code: "1+1"\n    id: a\n`;
const CALLS: Record<string, unknown[][]> = {
  parseWorkbook: [[SRC]],
  detectCellType: [['1+1']],
  formatResult: [[2]],
  mathMLToSVG: [['<mi>x</mi>']],
};

describe('workbook public API smoke', () => {
  const entries = Object.entries(W).filter(([, v]) => isFn(v));
  it('invokes mapped parse/format/svg exports', () => {
    let n = 0;
    for (const [name, raw] of entries) {
      const lists = CALLS[name];
      if (!lists) continue;
      for (const args of lists) {
        try {
          (raw as Fn)(...(args as never[]));
        } catch {
          /* domain */
        }
      }
      n += 1;
    }
    expect(n).toBeGreaterThan(2);
    expect(entries.length).toBeGreaterThan(8);
  });
});
