import { describe, expect, it } from 'vitest';
import { complex, gamma, zeta } from '../src/factories/index.js';

function expectComponents(result: unknown, re: number, im: number): void {
  const actual = result as { re: number; im: number };
  expect(Math.abs(actual.re / re - 1)).toBeLessThan(2e-11);
  expect(Math.abs(actual.im / im - 1)).toBeLessThan(2e-11);
}

describe('complex gamma and zeta range (#1363)', () => {
  // mpmath references computed at 60 decimal digits.
  it.each([
    [-230.5, 1, -3.3704898369214757e261, 8.80372785491299e261],
    [-230.5, -1, -3.3704898369214757e261, -8.80372785491299e261],
    [0.5, 400, 0.04146321761783724, 0.0891065753239292],
    [1, 500, 0.8149671404471603, -0.7804440211173169],
    [-5, 1000, -977960736132.2743, 827372500612.8243],
  ])('matches zeta at %s + %si', (a, b, re, im) => {
    expectComponents(zeta(complex(a, b)), re, im);
  });

  it.each([
    [145, 0.5, -4.3980088830068985e249, 3.3778734029016686e249],
    [151, 1, 1.6914316134477227e262, -5.437429660045517e262],
    [20, 500, 1.6123379111766871e-289, -8.499313819885245e-289],
  ])('matches gamma at %s + %si', (a, b, re, im) => {
    expectComponents(gamma(complex(a, b)), re, im);
  });
});
