/**
 * Dogfood relay G01 — compat create(all) complex promotion (#728, #729).
 */
import { describe, it, expect } from 'vitest';
import { create, all, type MathInstance } from '../src/index.js';
import { asin as Fasin } from '@danielsimonjr/mathts-functions';
import { create as mjCreate, all as mjAll } from 'mathjs';
import { Complex } from '@danielsimonjr/mathts-core';

type Scalars = {
  log: (x: number) => unknown;
  pow: (x: number, y: number) => unknown;
  nthRoot: (x: number, n: number) => unknown;
  acosh: (x: number) => unknown;
  evaluate: (expr: string) => unknown;
};

const mj = mjCreate(mjAll) as unknown as MathInstance & Scalars;

describe('G01 #728 compat asin delegates to functions', () => {
  it('matches mathjs default and functions asin(2)', () => {
    const mt = create(all);
    const expected = String(mj.asin(2));
    expect(String(mt.asin(2))).toBe(expected);
    expect(String(Fasin(2))).toBe(expected);
    const z = mt.asin(2) as Complex;
    const f = Fasin(2) as Complex;
    expect(z.re).toBeCloseTo(f.re, 12);
    expect(z.im).toBeCloseTo(f.im, 12);
  });

  it('predictable:true yields NaN like mathjs', () => {
    const mt = create(all, { predictable: true });
    const mjPred = mjCreate(mjAll, { predictable: true });
    expect(mt.asin(2)).toBeNaN();
    expect(String(mjPred.asin(2))).toBe(String(mt.asin(2)));
  });
});

describe('G01 #729 compat principal values', () => {
  it('matches mathjs 13 for listed edge cases', () => {
    const mt = create(all) as MathInstance & Scalars;
    const cases: Array<{ run: (m: MathInstance & Scalars) => unknown; label: string }> = [
      { run: (m) => m.log(-1), label: 'log(-1)' },
      { run: (m) => m.pow(-8, 1 / 3), label: 'pow(-8,1/3)' },
      { run: (m) => m.nthRoot(-8, 3), label: 'nthRoot(-8,3)' },
      { run: (m) => m.acosh(0), label: 'acosh(0)' },
      { run: (m) => m.evaluate('log(-1)'), label: 'evaluate log(-1)' },
    ];
    for (const { run, label } of cases) {
      const mjVal = run(mj as typeof mt);
      const mtVal = run(mt);
      if (typeof mjVal === 'number' && typeof mtVal === 'number') {
        expect(mtVal, label).toBe(mjVal);
        continue;
      }
      const mjC = mjVal as { re?: number; im?: number };
      const mtC = mtVal as { re?: number; im?: number };
      if (typeof mjC.re === 'number' && typeof mjC.im === 'number') {
        expect(mtC.re ?? NaN, label).toBeCloseTo(mjC.re, 12);
        expect(mtC.im ?? NaN, label).toBeCloseTo(mjC.im, 12);
      } else {
        expect(String(mtVal), label).toBe(String(mjVal));
      }
    }
  });
});
