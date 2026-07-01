/**
 * Tests for the shared elementary-function derivative table
 * (`DUAL_UNARY_RULES`) that backs both the scalar `Dual` (core) and the tensor
 * `DualTensor` (autograd). The table is the single source of truth for
 * forward-mode AD chain rules, so consumers don't reinvent them.
 *
 * The centrepiece is a finite-difference cross-check: for every rule, the
 * analytic `deriv(x, f(x))` must match the central-difference of `primal`
 * at a valid interior point. That independently validates each rule (an
 * independent second method), so a copy/paste typo in any derivative fails here.
 */
import { describe, it, expect } from 'vitest';
import { DUAL_UNARY_RULES, type DualUnaryRuleName } from '../src/types/dual-rules.js';

describe('DUAL_UNARY_RULES', () => {
  it('exposes the full canonical set of unary elementary functions', () => {
    const expected = [
      'exp',
      'expm1',
      'log',
      'log2',
      'log10',
      'log1p',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'sinh',
      'cosh',
      'tanh',
      'asinh',
      'acosh',
      'atanh',
      'sqrt',
      'cbrt',
      'square',
      'reciprocal',
      'abs',
      'sign',
    ];
    expect(Object.keys(DUAL_UNARY_RULES).sort()).toEqual([...expected].sort());
  });

  it('computes primal values correctly at reference points', () => {
    expect(DUAL_UNARY_RULES.exp.primal(0)).toBe(1);
    expect(DUAL_UNARY_RULES.log.primal(1)).toBe(0);
    expect(DUAL_UNARY_RULES.sin.primal(0)).toBe(0);
    expect(DUAL_UNARY_RULES.cos.primal(0)).toBe(1);
    expect(DUAL_UNARY_RULES.square.primal(3)).toBe(9);
    expect(DUAL_UNARY_RULES.reciprocal.primal(4)).toBe(0.25);
  });

  it('reuses the computed output y for output-dependent derivatives', () => {
    // exp'(x) = e^x = y; tanh'(x) = 1 - y²; sqrt'(x) = 1/(2y)
    const y1 = DUAL_UNARY_RULES.exp.primal(1.3);
    expect(DUAL_UNARY_RULES.exp.deriv(1.3, y1)).toBe(y1);
    const y2 = DUAL_UNARY_RULES.tanh.primal(0.7);
    expect(DUAL_UNARY_RULES.tanh.deriv(0.7, y2)).toBeCloseTo(1 - y2 * y2, 15);
    const y3 = DUAL_UNARY_RULES.sqrt.primal(2);
    expect(DUAL_UNARY_RULES.sqrt.deriv(2, y3)).toBeCloseTo(1 / (2 * y3), 15);
  });

  // Per-rule interior test point (chosen inside each function's domain).
  const points: Record<DualUnaryRuleName, number> = {
    exp: 0.5,
    expm1: 0.5,
    log: 1.7,
    log2: 1.7,
    log10: 1.7,
    log1p: 0.6,
    sin: 0.6,
    cos: 0.6,
    tan: 0.6,
    asin: 0.4,
    acos: 0.4,
    atan: 0.4,
    sinh: 0.6,
    cosh: 0.6,
    tanh: 0.6,
    asinh: 0.6,
    acosh: 1.7,
    atanh: 0.4,
    sqrt: 2.3,
    cbrt: 2.3,
    square: 1.4,
    reciprocal: 1.4,
    abs: 1.4, // away from the kink at 0
    sign: 1.4, // derivative 0 a.e.; central diff is also 0 away from 0
  };

  it('every rule matches its central-difference derivative (independent check)', () => {
    const h = 1e-6;
    for (const name of Object.keys(DUAL_UNARY_RULES) as DualUnaryRuleName[]) {
      const { primal, deriv } = DUAL_UNARY_RULES[name];
      const x = points[name];
      const analytic = deriv(x, primal(x));
      const numeric = (primal(x + h) - primal(x - h)) / (2 * h);
      expect(Math.abs(analytic - numeric)).toBeLessThan(1e-5);
    }
  });
});
