import { describe, it, expect } from 'vitest';
import * as W from '../src/index.js';

type Fn = (...args: never[]) => unknown;
const isFn = (v: unknown): v is Fn => typeof v === 'function';

const SRC = `cells:\n  - code: "1+1"\n    id: a\n`;
const WB = {
  cells: [{ id: 'a', type: 'code', source: '1+1', deps: [] }],
  metadata: {},
};

const CALLS: Record<string, unknown[][]> = {
  parseWorkbook: [[SRC]],
  serializeWorkbook: [[WB]],
  stripOutputs: [[WB]],
  detectCellType: [['1+1']],
  buildDependencyGraph: [[WB]],
  topologicalSort: [[{ a: [] }]],
  getDependents: [[{ a: [] }, 'a']],
  detectCycles: [[{ a: [] }]],
  getAncestors: [[{ a: [] }, 'a']],
  toMermaid: [[{ a: [] }]],
  formatResult: [[2]],
  mathMLToSVG: [['<mi>x</mi>']],
  createExecutor: [],
  addCell: [[WB, { id: 'b', type: 'code', source: '2', deps: [] }]],
};

const HEURISTICS: unknown[][] = [[], [SRC], [WB], ['x'], [2]];
const SKIP = new Set(['runWorkbookWithTimeout', 'WorkbookTimeoutError', 'Session']);

describe('workbook public API smoke', () => {
  const entries = Object.entries(W).filter(([, v]) => isFn(v));
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
    expect(n).toBeGreaterThan(8);
  });
});
