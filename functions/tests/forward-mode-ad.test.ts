import { describe, it, expect } from 'vitest';
import {
  derivativeAt,
  valueAndDerivativeAt,
  gradientAt,
  add,
  subtract,
  multiply,
  divide,
  pow,
  sin,
  cos,
  tan,
  exp,
  log,
  sqrt,
  square,
  cbrt,
  abs,
} from '@danielsimonjr/mathts-functions';
import { Dual } from '@danielsimonjr/mathts-core';

/**
 * Forward-mode AD over the plain functions surface (Dual-number overloading).
 * `grad` now flows through the ordinary functions API (sin/multiply/...) — not
 * just autograd TapedTensor methods. Verified vs closed forms + central
 * finite differences.
 */
const fd = (f: (x: number) => number, x: number, e = 1e-6) => (f(x + e) - f(x - e)) / (2 * e);

describe('forward-mode AD: elementary functions are differentiable', () => {
  const cases: Array<[string, (x: Dual) => Dual, (x: number) => number]> = [
    ['sin', (x) => sin(x) as Dual, Math.sin],
    ['cos', (x) => cos(x) as Dual, Math.cos],
    ['tan', (x) => tan(x) as Dual, Math.tan],
    ['exp', (x) => exp(x) as Dual, Math.exp],
    ['log', (x) => log(x) as Dual, Math.log],
    ['sqrt', (x) => sqrt(x) as Dual, Math.sqrt],
    ['square', (x) => square(x) as Dual, (v) => v * v],
    ['cbrt', (x) => cbrt(x) as Dual, Math.cbrt],
    ['abs', (x) => abs(x) as Dual, Math.abs],
  ];

  for (const [name, f, ref] of cases) {
    it(`d/dx ${name}(x) matches finite difference`, () => {
      for (const x of [0.7, 1.3, 2.5]) {
        expect(derivativeAt(f, x)).toBeCloseTo(fd(ref, x), 5);
      }
    });
  }
});

describe('forward-mode AD: composed expressions', () => {
  it('d/dx [sin(x)·x] = sin(x) + x·cos(x)', () => {
    for (const x of [0.5, 2, -1]) {
      const g = derivativeAt((t) => multiply(sin(t), t) as Dual, x);
      expect(g).toBeCloseTo(Math.sin(x) + x * Math.cos(x), 8);
    }
  });

  it('d/dx [exp(x) / (x² + 1)] matches finite difference', () => {
    const f = (t: Dual) => divide(exp(t), add(square(t), 1)) as Dual;
    const ref = (v: number) => Math.exp(v) / (v * v + 1);
    for (const x of [0.3, 1.5, 3]) expect(derivativeAt(f, x)).toBeCloseTo(fd(ref, x), 5);
  });

  it('d/dx [pow(x, 3) − 2x] = 3x² − 2', () => {
    for (const x of [1, 2, -1.5]) {
      const g = derivativeAt((t) => subtract(pow(t, 3), multiply(2, t)) as Dual, x);
      expect(g).toBeCloseTo(3 * x * x - 2, 8);
    }
  });

  it('d/dx [log(cos(x))] = −tan(x)', () => {
    for (const x of [0.3, 0.9, 1.2]) {
      const g = derivativeAt((t) => log(cos(t)) as Dual, x);
      expect(g).toBeCloseTo(-Math.tan(x), 8);
    }
  });

  it('valueAndDerivativeAt returns both', () => {
    const { value, deriv } = valueAndDerivativeAt((t) => exp(t) as Dual, 1);
    expect(value).toBeCloseTo(Math.E, 10);
    expect(deriv).toBeCloseTo(Math.E, 10);
  });
});

describe('forward-mode AD: gradients (ℝⁿ → ℝ)', () => {
  it('∇[x·sin(y)] = [sin(y), x·cos(y)]', () => {
    const g = gradientAt((v) => multiply(v[0], sin(v[1])) as Dual, [3, Math.PI / 4]);
    expect(g[0]).toBeCloseTo(Math.sin(Math.PI / 4), 8);
    expect(g[1]).toBeCloseTo(3 * Math.cos(Math.PI / 4), 8);
  });

  it('∇[x² + x·y + y²] = [2x + y, x + 2y]', () => {
    const f = (v: Dual[]) => add(add(square(v[0]), multiply(v[0], v[1])), square(v[1])) as Dual;
    const g = gradientAt(f, [2, 3]);
    expect(g[0]).toBeCloseTo(2 * 2 + 3, 8);
    expect(g[1]).toBeCloseTo(2 + 2 * 3, 8);
  });
});
