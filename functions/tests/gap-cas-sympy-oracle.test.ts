import { describe, it, expect } from 'vitest';
import { derivative, simplify, expand, factor, rationalize, evaluate } from '../src/index.js';

/**
 * GC11 — CAS correctness pinned to an EXTERNAL oracle (sympy 1.14.0), not to
 * MathTS's own output. Symbolic results are formatting- and
 * simplification-strength-dependent, so we pin the one thing that must hold
 * regardless of representation: **numeric value**. Each MathTS symbolic result
 * is evaluated at sample points and compared to the value sympy computes —
 * derivatives to `sympy.diff`, and the value-preserving transforms
 * (simplify/expand/factor/rationalize) to `sympy.sympify(expr).subs(...)` of the
 * ORIGINAL expression (they must not change the value). Reference values were
 * generated with sympy and embedded below.
 *
 * This is the implementation-independent discipline from
 * [[feedback-oracle-tests-implementation-independent]]: never assert a CAS
 * result equals its own re-serialization; assert it against a foreign engine.
 */

/** Evaluate a MathTS symbolic result string at x = p. */
const at = (result: unknown, p: number): number =>
  evaluate(String(result), new Map([['x', p]])) as number;

// d/dx f, evaluated at pts — sympy.diff(sympify(f), x).subs(x, p)
const DERIV_REFS = [
  { f: 'x^3 + 2*x', pts: [0.5, 2.0, -1.3], dvals: [2.75, 14.0, 7.07] },
  { f: 'sin(x)*cos(x)', pts: [0.3, 1.1, 2.0], dvals: [0.8253356149, -0.5885011173, -0.6536436209] },
  { f: 'exp(2*x)', pts: [0.0, 0.7, -0.5], dvals: [2.0, 8.1103999337, 0.7357588823] },
  { f: 'log(x^2 + 1)', pts: [0.5, 2.0, 3.3], dvals: [0.8, 0.8, 0.5550883095] },
  { f: 'x/(x^2 + 1)', pts: [0.4, 1.5, -2.0], dvals: [0.6242568371, -0.1183431953, -0.12] },
  { f: 'tan(x)', pts: [0.2, 0.9, -0.6], dvals: [1.0410913585, 2.5879987333, 1.4680431725] },
  { f: 'sqrt(x^2 + 4)', pts: [1.0, 3.0, 0.5], dvals: [0.4472135955, 0.8320502943, 0.242535625] },
];

// d²/dx² f at pts — sympy.diff(f, x, 2)
const DERIV2_REFS = [
  { f: 'x^4', pts: [1.0, 2.0], d2vals: [12.0, 48.0] },
  { f: 'sin(x)', pts: [0.5, 1.2], d2vals: [-0.4794255386, -0.932039086] },
];

// value-preserving transforms — sympy.sympify(expr).subs(x, p) (transform must not change value)
const PRESERVING_REFS = [
  { op: 'simplify', expr: '(x^2 - 1)/(x - 1)', pts: [0.0, 2.0, 3.5], vals: [1.0, 3.0, 4.5] },
  { op: 'simplify', expr: 'sin(x)^2 + cos(x)^2', pts: [0.3, 1.0, 2.2], vals: [1.0, 1.0, 1.0] },
  { op: 'expand', expr: '(x + 1)*(x - 2)', pts: [0.5, 2.0, -1.0], vals: [-2.25, 0.0, 0.0] },
  { op: 'expand', expr: '(x + 3)^2', pts: [0.0, 1.5, 4.0], vals: [9.0, 20.25, 49.0] },
  { op: 'factor', expr: 'x^2 - 5*x + 6', pts: [0.0, 2.0, 5.0], vals: [6.0, 0.0, 6.0] },
  { op: 'factor', expr: 'x^3 - x', pts: [0.5, 2.0, -1.5], vals: [-0.375, 6.0, -1.875] },
  { op: 'rationalize', expr: 'x + x + x', pts: [1.0, 2.0], vals: [3.0, 6.0] },
  { op: 'rationalize', expr: '2/(x+1) + 3/(x+1)', pts: [0.5, 3.0], vals: [3.3333333333, 1.25] },
] as const;

const PRESERVING: Record<string, (e: string) => unknown> = {
  simplify: (e) => simplify(e),
  expand: (e) => expand(e),
  factor: (e) => factor(e),
  rationalize: (e) => rationalize(e),
};

describe('GC11: derivative vs sympy.diff (numeric oracle)', () => {
  for (const { f, pts, dvals } of DERIV_REFS) {
    it(`d/dx ${f} matches sympy at ${pts.length} points`, () => {
      const d = derivative(f, 'x');
      pts.forEach((p, i) => {
        expect(at(d, p)).toBeCloseTo(dvals[i], 8);
      });
    });
  }

  for (const { f, pts, d2vals } of DERIV2_REFS) {
    it(`d²/dx² ${f} matches sympy at ${pts.length} points`, () => {
      const d2 = derivative(derivative(f, 'x'), 'x');
      pts.forEach((p, i) => {
        expect(at(d2, p)).toBeCloseTo(d2vals[i], 8);
      });
    });
  }
});

describe('GC11: value-preserving CAS transforms vs sympy (numeric oracle)', () => {
  for (const { op, expr, pts, vals } of PRESERVING_REFS) {
    it(`${op}(${expr}) preserves value (sympy-anchored)`, () => {
      const result = PRESERVING[op](expr);
      pts.forEach((p, i) => {
        expect(at(result, p)).toBeCloseTo(vals[i], 8);
      });
    });
  }
});
