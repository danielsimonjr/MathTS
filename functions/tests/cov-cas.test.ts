/**
 * Coverage tests for functions/src/typed/cas.ts.
 *
 * These tests target branches not exercised by the existing cas.test.ts and
 * typed-cas-batch-workers.test.ts suites:
 *   - integrate: c*x^n, c*x, definite-integral and fallback branches
 *   - limit: ±Infinity growth, one-sided, 0/0 forms
 *   - laplace / inverseLaplace lookup-table entries
 *   - multivariateTaylor 2nd-order (Hessian diagonal + cross terms)
 *   - asymptotic at a finite point and the zero-function branch
 *   - minimalPolynomial (rational, quadratic, cubic) and toRadicals
 *     (linear / quadratic / cubic / quartic / numeric-fallback)
 *   - the inverseLaplaceTransform numerical pattern matcher (power, exponential,
 *     scaled-exponential, sin/cos, sum/difference recursion, unmatched throw,
 *     and the parsed-Node input path)
 *   - the batch CAS worker fan-out kernels (casSimplify/Derivative/Expand/Factor
 *     with the compute pool initialized and batches ≥ CAS_BATCH_THRESHOLD)
 *
 * All assertions check the actual, correct symbolic/numeric output of the
 * implementation.  Where the implementation has a documented limitation
 * (e.g. cosh/sinh inverse-Laplace forms are not matched), the test asserts the
 * real behavior and explains it in a comment rather than asserting fictional math.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { parse, evaluate } from '../src/factories/evaluate.js';
import {
  integrate,
  limit,
  laplace,
  inverseLaplace,
  fourierSeries,
  zTransform,
  multivariateTaylor,
  asymptotic,
  minimalPolynomial,
  toRadicals,
  inverseLaplaceTransform,
  solve,
  implicitDiff,
  casSimplify,
  casDerivative,
  casExpand,
  casFactor,
  CAS_BATCH_THRESHOLD,
} from '../src/typed/cas.js';

// =============================================================================
// integrate — symbolic-form branches
// =============================================================================

describe('integrate — coefficient and fallback branches', () => {
  it('c*x^n pattern', () => {
    // 3*x^2 -> (3/3)*x^3 = 1*x^3
    expect(integrate('3*x^2', 'x')).toBe('1*x^3');
  });

  it('c*x pattern', () => {
    // 2*x -> (2/2)*x^2 = 1*x^2
    expect(integrate('2*x', 'x')).toBe('1*x^2');
  });

  it('bare x and x^n', () => {
    expect(integrate('x', 'x')).toBe('x^2/2');
    expect(integrate('x^3', 'x')).toBe('x^4/4');
  });

  it('elementary functions', () => {
    expect(integrate('sin(x)', 'x')).toBe('-cos(x)');
    expect(integrate('cos(x)', 'x')).toBe('sin(x)');
    expect(integrate('exp(x)', 'x')).toBe('exp(x)');
    expect(integrate('1/x', 'x')).toBe('log(x)');
  });

  it('constant integrand', () => {
    expect(integrate('5', 'x')).toBe('5*x');
  });

  it('unrecognised form falls back to integral notation', () => {
    expect(integrate('tan(x)', 'x')).toBe('integral(tan(x), x)');
  });

  it('definite integral via Simpson rule', () => {
    // ∫_0^1 x^2 dx = 1/3
    expect(integrate('x^2', 'x', 0, 1) as number).toBeCloseTo(1 / 3, 6);
    // ∫_0^pi sin(x) dx = 2
    expect(integrate('sin(x)', 'x', 0, Math.PI) as number).toBeCloseTo(2, 6);
  });
});

// =============================================================================
// limit — infinity and one-sided branches
// =============================================================================

describe('limit — infinity and directional branches', () => {
  it('limit at +Infinity that converges', () => {
    // 1/x -> 0 (numerically a tiny positive value)
    expect(limit('1/x', 'x', Infinity)).toBeCloseTo(0, 6);
  });

  it('limit at -Infinity that converges', () => {
    expect(limit('1/x', 'x', -Infinity)).toBeCloseTo(0, 6);
  });

  it('growing function at +Infinity returns large finite sample', () => {
    // x^2 at x=1e8 = 1e16 (below the 1e100 Infinity cutoff)
    expect(limit('x^2', 'x', Infinity)).toBe(1e16);
  });

  it('large positive function at +Infinity returns Infinity', () => {
    // x^20 at 1e8 = 1e160 > 1e100 -> Infinity
    expect(limit('x^20', 'x', Infinity)).toBe(Infinity);
  });

  it('large negative function at -Infinity returns -Infinity', () => {
    // x^21 at -1e8 = -1e168 < -1e100 -> -Infinity
    expect(limit('x^21', 'x', -Infinity)).toBe(-Infinity);
  });

  it('0/0 indeterminate form via numerical approach', () => {
    expect(limit('(x^2 - 1)/(x - 1)', 'x', 1)).toBeCloseTo(2, 6);
    expect(limit('sin(x)/x', 'x', 0)).toBeCloseTo(1, 6);
  });

  it('one-sided limits disagree across a pole', () => {
    expect(limit('1/x', 'x', 0, 'right')).toBeGreaterThan(1e9);
    expect(limit('1/x', 'x', 0, 'left')).toBeLessThan(-1e9);
  });

  it('two-sided limit across a pole returns NaN (disagreeing sides)', () => {
    expect(Number.isNaN(limit('1/x', 'x', 0))).toBe(true);
  });
});

// =============================================================================
// laplace / inverseLaplace — table entries
// =============================================================================

describe('laplace transform table', () => {
  it('polynomial and constant forms', () => {
    expect(laplace('1', 't', 's')).toBe('1/s');
    expect(laplace('t', 't', 's')).toBe('1/s^2');
    expect(laplace('t^3', 't', 's')).toBe('6/s^4');
    expect(laplace('5', 't', 's')).toBe('5/s'); // constant (no t)
  });

  it('exponential and trig forms', () => {
    expect(laplace('exp(-2*t)', 't', 's')).toBe('1/(s - -2)');
    expect(laplace('sin(2*t)', 't', 's')).toBe('2/(s^2 + 4)');
    expect(laplace('cos(2*t)', 't', 's')).toBe('s/(s^2 + 4)');
    expect(laplace('sin(t)', 't', 's')).toBe('1/(s^2 + 1)');
    expect(laplace('cos(t)', 't', 's')).toBe('s/(s^2 + 1)');
    expect(laplace('exp(t)', 't', 's')).toBe('1/(s - 1)');
    expect(laplace('exp(-t)', 't', 's')).toBe('1/(s + 1)');
  });

  it('unrecognised form returns L{} notation', () => {
    expect(laplace('t*sin(t)', 't', 's')).toBe('L{t*sin(t)}(s)');
  });
});

describe('inverseLaplace transform table', () => {
  it('power forms', () => {
    expect(inverseLaplace('1/s', 's', 't')).toBe('1');
    expect(inverseLaplace('1/s^2', 's', 't')).toBe('t');
    expect(inverseLaplace('1/s^3', 's', 't')).toBe('t^2/2');
  });

  it('exponential forms', () => {
    expect(inverseLaplace('1/(s + 2)', 's', 't')).toBe('exp(-2*t)');
    expect(inverseLaplace('1/(s - 2)', 's', 't')).toBe('exp(2*t)');
  });

  it('cos and sin forms', () => {
    expect(inverseLaplace('s/(s^2 + 4)', 's', 't')).toBe('cos(2*t)');
    expect(inverseLaplace('2/(s^2 + 4)', 's', 't')).toBe('sin(2*t)');
    // numerator != w -> scaled sin
    expect(inverseLaplace('3/(s^2 + 4)', 's', 't')).toBe('1.5*sin(2*t)');
  });

  it('unrecognised form returns L^-1{} notation', () => {
    expect(inverseLaplace('1/(s^3+1)', 's', 't')).toBe('L^-1{1/(s^3+1)}(t)');
  });
});

// =============================================================================
// fourierSeries / zTransform
// =============================================================================

describe('fourierSeries', () => {
  it('odd function f(x)=x has zero cosine coefficients', () => {
    const { a0, an, bn } = fourierSeries('x', 'x', 3);
    // Numerical rectangle-rule integration leaves a small residual; a0 and the
    // cosine coefficients of the odd function x are ~0 (within discretisation error).
    expect(Math.abs(a0)).toBeLessThan(0.05);
    for (const a of an) expect(Math.abs(a)).toBeLessThan(0.05);
    // b1 of x on [-pi,pi] is 2
    expect(bn[0]).toBeCloseTo(2, 1);
  });
});

describe('zTransform', () => {
  it('unit, ramp, geometric, fallback', () => {
    expect(zTransform('1', 'n', 'z')).toBe('z/(z - 1)');
    expect(zTransform('n', 'n', 'z')).toBe('z/(z - 1)^2');
    expect(zTransform('2^n', 'n', 'z')).toBe('z/(z - 2)');
    expect(zTransform('n^2', 'n', 'z')).toBe('Z{n^2}(z)');
  });
});

// =============================================================================
// multivariateTaylor — 2nd order
// =============================================================================

describe('multivariateTaylor — second order', () => {
  it('Hessian diagonal terms for x^2 + y^2 at origin', () => {
    // f=x^2+y^2, second-order Maclaurin -> x^2 + y^2 (no first-order, no cross)
    const result = multivariateTaylor('x^2 + y^2', ['x', 'y'], [0, 0], 2);
    expect(result).toContain('x^2');
    expect(result).toContain('y^2');
  });

  it('cross term for x*y at origin', () => {
    const result = multivariateTaylor('x*y', ['x', 'y'], [0, 0], 2);
    expect(result).toContain('x*y');
  });

  it('expansion about a non-zero center', () => {
    const result = multivariateTaylor('x^2', ['x'], [1], 2);
    expect(result).toContain('(x - 1)');
  });

  it('length mismatch throws', () => {
    expect(() => multivariateTaylor('x', ['x', 'y'], [0], 1)).toThrow(/same length/);
  });
});

// =============================================================================
// asymptotic
// =============================================================================

describe('asymptotic', () => {
  it('leading-order growth at infinity', () => {
    const r = asymptotic('(x^2 + 1)/x', 'x', Infinity);
    expect(r.order).toBeCloseTo(1, 6);
    expect(r.leadingTerm).toContain('x');
  });

  it('finite-point limit branch', () => {
    const r = asymptotic('(x^2 - 1)/(x - 1)', 'x', 1);
    expect(r.order).toBe(0);
    expect(r.coefficient).toBeCloseTo(2, 6);
  });

  it('zero function returns -Infinity order', () => {
    const r = asymptotic('0', 'x', Infinity);
    expect(r.order).toBe(-Infinity);
    expect(r.coefficient).toBe(0);
  });
});

// =============================================================================
// minimalPolynomial
// =============================================================================

describe('minimalPolynomial', () => {
  it('integer value -> linear monic polynomial', () => {
    expect(minimalPolynomial('5', 'x')).toBe('x - 5');
  });

  it('rational value -> linear polynomial with denominator', () => {
    expect(minimalPolynomial('1/3', 'x')).toBe('3*x - 1');
  });

  it('sqrt(2) is a root of the returned quadratic', () => {
    const poly = minimalPolynomial('sqrt(2)', 'x');
    expect(poly).not.toBeNull();
    // The integer-relation search returns a scaled multiple of x^2 - 2.
    // Verify sqrt(2) is actually a root by evaluating the polynomial.
    const val = (parse(poly as string) as { evaluate(scope: object): unknown }).evaluate({
      x: Math.SQRT2,
    });
    expect(Math.abs(val as number)).toBeLessThan(1e-6);
  });

  it('golden ratio is a root of the returned quadratic', () => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const poly = minimalPolynomial(String(phi), 'x');
    expect(poly).not.toBeNull();
    const val = (parse(poly as string) as { evaluate(scope: object): unknown }).evaluate({
      x: phi,
    });
    expect(Math.abs(val as number)).toBeLessThan(1e-6);
  });

  it('cube root of 2 yields a cubic with it as a root', () => {
    const a = Math.cbrt(2);
    const poly = minimalPolynomial('2^(1/3)', 'x');
    expect(poly).not.toBeNull();
    const val = (parse(poly as string) as { evaluate(scope: object): unknown }).evaluate({ x: a });
    expect(Math.abs(val as number)).toBeLessThan(1e-5);
  });

  it('non-finite expression returns null', () => {
    expect(minimalPolynomial('1/0', 'x')).toBeNull();
  });
});

// =============================================================================
// toRadicals — linear / quadratic / cubic / quartic / fallback
// =============================================================================

describe('toRadicals', () => {
  it('linear', () => {
    expect(toRadicals('2*x - 6')).toEqual(['3']);
  });

  it('quadratic with integer discriminant', () => {
    // x^2 - 2: a=1, b=0, c=-2, disc=8 -> roots (0 ± sqrt(8))/2 = ±sqrt(2).
    // The formatter emits the literal discriminant form '(0 ± sqrt(8))/2'
    // (sqrt(8) = 2*sqrt(2), so (0 + sqrt(8))/2 = sqrt(2)).
    const roots = toRadicals('x^2 - 2');
    expect(roots).toEqual(['(0 + sqrt(8))/2', '(0 - sqrt(8))/2']);
  });

  it('quadratic with complex roots returns empty', () => {
    expect(toRadicals('x^2 + 1')).toEqual([]);
  });

  it('quadratic double root', () => {
    // x^2 - 2x + 1 = (x-1)^2 -> double root 1
    expect(toRadicals('x^2 - 2*x + 1')).toEqual(['1']);
  });

  it('cubic with rational roots (synthetic-division short-circuit)', () => {
    // (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6
    const roots = toRadicals('x^3 - 6*x^2 + 11*x - 6')
      .map(Number)
      .sort((a, b) => a - b);
    expect(roots).toEqual([1, 2, 3]);
  });

  it('cubic with three distinct real roots (trigonometric/depressed path)', () => {
    // x^3 - 7x + 6 = (x-1)(x-2)(x+3)
    const roots = toRadicals('x^3 - 7*x + 6')
      .map(Number)
      .sort((a, b) => a - b);
    expect(roots).toEqual([-3, 1, 2]);
  });

  it('cubic with one real root (Cardano path)', () => {
    // x^3 - 2 -> single real root 2^(1/3)
    const roots = toRadicals('x^3 - 2');
    expect(roots).toHaveLength(1);
    expect(Number(roots[0])).toBeCloseTo(Math.cbrt(2), 6);
  });

  it('quartic with four real roots', () => {
    // x^4 - 5x^2 + 4 = (x^2-1)(x^2-4) -> {-2,-1,1,2}
    const roots = toRadicals('x^4 - 5*x^2 + 4')
      .map(Number)
      .sort((a, b) => a - b);
    expect(roots).toEqual([-2, -1, 1, 2]);
  });

  it('quintic falls back to numerical roots', () => {
    // x^5 - x = x(x-1)(x+1)(x^2+1) -> real roots {-1,0,1}
    const roots = toRadicals('x^5 - x')
      .map(Number)
      .sort((a, b) => a - b);
    expect(roots).toEqual([-1, 0, 1]);
  });
});

// =============================================================================
// solve — bisection refinement + implicitDiff
// =============================================================================

describe('solve — bisection refinement for irrational roots', () => {
  it('finds ±sqrt(2) via sign-change bisection', () => {
    // x^2 - 2 has no exact roots on the scan grid, so the bisection branch runs.
    const roots = solve('x^2 - 2', 'x');
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-Math.SQRT2, 6);
    expect(roots[1]).toBeCloseTo(Math.SQRT2, 6);
  });

  it('cubic with three irrational roots', () => {
    // x^3 - 3x + 1 has three real roots, all irrational.
    const roots = solve('x^3 - 3*x + 1', 'x');
    expect(roots.length).toBeGreaterThanOrEqual(2);
    for (const r of roots) {
      // f(root) ~ 0
      expect(Math.abs(r * r * r - 3 * r + 1)).toBeLessThan(1e-4);
    }
  });
});

describe('implicitDiff', () => {
  it('dy/dx on a circle', () => {
    // x^2 + y^2 - 25 = 0 at (3,4): dy/dx = -3/4
    expect(implicitDiff('x^2 + y^2 - 25', 'x', 'y', { x: 3, y: 4 })).toBeCloseTo(-0.75, 4);
  });

  it('throws when dF/dy is zero', () => {
    // At (5, 0) on x^2 + y^2 - 25, dF/dy = 2y = 0 -> theorem fails.
    expect(() => implicitDiff('x^2 + y^2 - 25', 'x', 'y', { x: 5, y: 0 })).toThrow(
      /dF\/dy is zero/
    );
  });
});

// =============================================================================
// casDerivative — power-rule n===0 / n===1 edge exponents
// =============================================================================

describe('casDerivative — special power exponents', () => {
  it('x^1 derivative is the constant coefficient', () => {
    // d/dx(x^1) = 1  (n === 1 branch)
    expect(casDerivative('x^1', 'x')).toBe('1');
    // d/dx(3*x^1) = 3
    expect(casDerivative('3*x^1', 'x')).toBe('3');
  });

  it('x^0 derivative is 0', () => {
    // d/dx(x^0) = 0  (n === 0 branch)
    expect(casDerivative('x^0', 'x')).toBe('0');
  });
});

// =============================================================================
// inverseLaplaceTransform — numerical pattern matcher
// =============================================================================

describe('inverseLaplaceTransform — pattern matcher', () => {
  it('unit step and ramp', () => {
    expect(inverseLaplaceTransform('1/s')).toBe('1');
    expect(inverseLaplaceTransform('1/s^2')).toBe('t');
  });

  it('power forms c/s^n', () => {
    expect(inverseLaplaceTransform('2/s^3')).toBe('t^2');
    expect(inverseLaplaceTransform('6/s^4')).toBe('t^3');
    expect(inverseLaplaceTransform('3/s^2')).toBe('3 * t');
    expect(inverseLaplaceTransform('1/s^4')).toBe('1/6 * t^3');
  });

  it('exponential and scaled-exponential forms', () => {
    expect(inverseLaplaceTransform('5/(s - 2)')).toBe('5 * e^(2 * t)');
    expect(inverseLaplaceTransform('7/(s - 2)')).toBe('7 * e^(2 * t)');
    expect(inverseLaplaceTransform('1/(s - 0.5)')).toBe('e^(1/2 * t)');
  });

  it('sin and cos forms', () => {
    expect(inverseLaplaceTransform('s/(s^2 + 4)')).toBe('cos(2 * t)');
    expect(inverseLaplaceTransform('2/(s^2 + 4)')).toBe('sin(2 * t)');
    expect(inverseLaplaceTransform('3/(s^2 + 9)')).toBe('sin(3 * t)');
  });

  it('sum of terms is transformed term-by-term (+ recursion)', () => {
    expect(inverseLaplaceTransform('1/s + 1/s^2')).toBe('1 + t');
  });

  it('difference of terms is transformed term-by-term (- recursion)', () => {
    expect(inverseLaplaceTransform('1/s - 1/s^2')).toBe('1 - t');
  });

  it('accepts a parsed MathNode as input', () => {
    expect(inverseLaplaceTransform(parse('1/s'))).toBe('1');
  });

  it('throws on a form not in the lookup table', () => {
    // The cosh/sinh forms (e.g. s/(s^2 - a^2)) are not matched by the numeric
    // table — the matcher only recognises the listed sin/cos/exp/power pairs.
    expect(() => inverseLaplaceTransform('s/(s^2 - 4)')).toThrow(/could not find/);
  });
});

// =============================================================================
// Batch CAS — single-expression (synchronous) paths
// =============================================================================

describe('CAS batch single-expression paths', () => {
  it('casSimplify single', () => {
    expect(casSimplify('x + x')).toBe('2*x');
    expect(casSimplify('1 * y')).toBe('y');
    expect(casSimplify('2 * 3')).toBe('6');
    expect(casSimplify('0 * x')).toBe('0');
    // MathNode input
    expect(casSimplify(parse('x + x'))).toBe('2*x');
  });

  it('casDerivative single', () => {
    expect(casDerivative('x^3', 'x')).toBe('3*x^2');
    expect(casDerivative('5*x', 'x')).toBe('5');
    expect(casDerivative('5', 'x')).toBe('0');
    expect(casDerivative('sin(x)', 'x')).toBe('cos(x)');
    expect(casDerivative('cos(x)', 'x')).toBe('-sin(x)');
    expect(casDerivative('exp(x)', 'x')).toBe('exp(x)');
    expect(casDerivative('ln(x)', 'x')).toBe('1/x');
    expect(casDerivative('x', 'x')).toBe('1');
    expect(casDerivative('tan(x)', 'x')).toBe('d/dx(tan(x))');
  });

  it('casExpand single (real engine — collects like terms)', () => {
    // (x+1)*(x+2) = x^2 + 3x + 2; (x+1)^2 = x^2 + 2x + 1.
    for (const x of [-2, 0.5, 3]) {
      expect(evaluate(casExpand('(x+1)*(x+2)'), { x }) as number).toBeCloseTo((x + 1) * (x + 2), 8);
      expect(evaluate(casExpand('(x+1)^2'), { x }) as number).toBeCloseTo((x + 1) ** 2, 8);
    }
    expect(casExpand('(x+1)^2')).not.toContain('x*x');
  });

  it('casFactor single (real engine)', () => {
    expect(casFactor('2*x + 4*y')).toBe('2*(x + 2*y)'); // integer-GCD path
    // x^2 - 1 now factors into (x-1)(x+1) via the rational-root engine.
    const f = casFactor('x^2 - 1');
    expect(f).not.toBe('x^2 - 1');
    for (const x of [-2, 0.5, 3]) expect(evaluate(f, { x }) as number).toBeCloseTo(x * x - 1, 8);
    expect(casFactor('x')).toBe('x'); // single term, unchanged
  });
});

// =============================================================================
// Batch CAS — below-threshold (in-process loop, returns Promise)
// =============================================================================

describe('CAS batch below-threshold loop', () => {
  it('casSimplify small batch', async () => {
    const r = await casSimplify(['x + x', 'y * 1', '2 * 3']);
    expect(r).toEqual(['2*x', 'y', '6']);
  });

  it('casDerivative small batch', async () => {
    // casDerivative uses the power rule literally: d/dx(x^2) = 2*x^1.
    const r = await casDerivative(['x^2', 'sin(x)', 'exp(x)'], 'x');
    expect(r).toEqual(['2*x^1', 'cos(x)', 'exp(x)']);
  });

  it('casExpand small batch (real engine)', async () => {
    const r = await casExpand(['(x+1)^2']);
    for (const x of [-2, 0.5, 3])
      expect(evaluate(r[0], { x }) as number).toBeCloseTo((x + 1) ** 2, 8);
  });

  it('casFactor small batch', async () => {
    const r = await casFactor(['3*x + 6*y']);
    expect(r[0]).toBe('3*(x + 2*y)');
  });
});

// =============================================================================
// Batch CAS — worker fan-out (pool initialized, batch >= threshold)
// =============================================================================

describe('CAS batch worker fan-out (pool ready, >= threshold)', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  it('threshold constant is 16', () => {
    expect(CAS_BATCH_THRESHOLD).toBe(16);
  });

  it('casSimplify batch matches single-expression results', async () => {
    const exprs = Array.from({ length: 20 }, (_, i) => `${i + 1}*x + ${i + 1}*x`);
    const results = await casSimplify(exprs);
    expect(results).toHaveLength(20);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casSimplify(exprs[i]));
    }
  });

  it('casSimplify batch handles numeric and identity rules', async () => {
    const exprs = Array.from({ length: 18 }, (_, i) =>
      i % 3 === 0 ? '2 * 3' : i % 3 === 1 ? '1 * y' : `${i}*x + ${i}*x`
    );
    const results = await casSimplify(exprs);
    expect(results[0]).toBe('6');
    expect(results[1]).toBe('y');
  });

  it('casDerivative batch matches single-expression results', async () => {
    const exprs = Array.from({ length: 18 }, (_, i) => `${i + 1}*x^2`);
    const results = await casDerivative(exprs, 'x');
    expect(results).toHaveLength(18);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casDerivative(exprs[i], 'x'));
    }
  });

  it('casDerivative batch covers trig/exp/ln/linear/const/unknown forms', async () => {
    const forms = ['x^2', 'sin(x)', 'cos(x)', 'exp(x)', 'ln(x)', '5*x', '7', 'x', 'tan(x)'];
    const exprs = Array.from({ length: 18 }, (_, i) => forms[i % forms.length]);
    const results = await casDerivative(exprs, 'x');
    expect(results).toHaveLength(18);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casDerivative(exprs[i], 'x'));
    }
  });

  it('casExpand batch matches single-expression results', async () => {
    const exprs = Array.from({ length: 18 }, (_, i) => `(x+${i})*(x+${i + 1})`);
    const results = await casExpand(exprs);
    expect(results).toHaveLength(18);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casExpand(exprs[i]));
    }
  });

  it('casExpand batch handles the (expr)^2 rule', async () => {
    const exprs = Array.from({ length: 18 }, (_, i) => `(x+${i})^2`);
    const results = await casExpand(exprs);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casExpand(exprs[i]));
    }
  });

  it('casFactor batch matches single-expression results', async () => {
    const exprs = Array.from({ length: 18 }, (_, i) => `${2 * (i + 1)}*x + ${4 * (i + 1)}*y`);
    const results = await casFactor(exprs);
    expect(results).toHaveLength(18);
    for (let i = 0; i < exprs.length; i++) {
      expect(results[i]).toBe(casFactor(exprs[i]));
    }
  });

  it('casFactor batch factors univariate polynomials consistently', async () => {
    const exprs = Array.from({ length: 18 }, () => 'x^2 - 1');
    const results = await casFactor(exprs);
    // Real factorization now applies; every result matches the single call.
    for (const r of results) expect(r).toBe(casFactor('x^2 - 1'));
  });
});
