/**
 * P6-4 pins for `gradRobust`: exact (`toEqual`) BFGS results for the L1 and Huber losses on
 * multi-parameter, weighted, outlier-laden and fixed-parameter fits, a zero-residual fit, and a fit
 * whose step overflows so that `rowActive` fails and the gradient is +Infinity. The goldens come
 * from the pre-P6-4 `gradL1` / `gradHuber` (see `fixtures/fit-scalar-robust-cases.ts`). BFGS follows
 * the gradient step by step, so a change in the last bit of one gradient entry changes
 * `evaluations`, and usually the parameters.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fitScalarParameters } from '../src/index.js';
import { ROBUST_CASES } from './fixtures/fit-scalar-robust-cases.js';

interface Golden {
  parameters: number[];
  loss: number;
  converged: boolean;
  evaluations: number;
  validRows: number;
  standardErrors: number[] | null;
}

const golden = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures/fit-scalar-robust-loss-extended-golden.json'
    ),
    'utf8'
  )
) as Record<string, Golden>;

describe('fit-scalar L1 / Huber BFGS against the pre-gradRobust bodies', () => {
  for (const loss of ['l1', 'huber'] as const) {
    for (const c of ROBUST_CASES) {
      it(`${loss}: ${c.name}`, () => {
        const want = golden[`${loss}: ${c.name}`];
        const r = fitScalarParameters(
          c.node(),
          c.columns.map((col) => new Float64Array(col)),
          new Float64Array(c.y),
          c.variables,
          { ...c.options, loss, algorithm: 'bfgs', restarts: 0 }
        );
        expect(Array.from(r.parameters)).toEqual(want.parameters);
        expect(r.loss).toBe(want.loss);
        expect(r.converged).toBe(want.converged);
        expect(r.evaluations).toBe(want.evaluations);
        expect(r.validRows).toBe(want.validRows);
        expect(r.standardErrors === null ? null : Array.from(r.standardErrors)).toEqual(
          want.standardErrors
        );
      });
    }
  }

  it('keeps the fixed parameter at its bound in the scattered gradient', () => {
    const c = ROBUST_CASES[2];
    for (const loss of ['l1', 'huber'] as const) {
      const r = fitScalarParameters(
        c.node(),
        c.columns.map((col) => new Float64Array(col)),
        new Float64Array(c.y),
        c.variables,
        { ...c.options, loss, algorithm: 'bfgs', restarts: 0 }
      );
      expect(r.parameters[1]).toBe(0.5);
    }
  });
});
