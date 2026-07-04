import { describe, it, expect } from 'vitest';
import {
  sin,
  cos,
  tan,
  csc,
  sec,
  cot,
  asin,
  acos,
  atan,
  acsc,
  asec,
  acot,
  sinh,
  cosh,
  tanh,
  asinh,
  acosh,
  atanh,
  log1p,
  expm1,
  unaryPlus,
} from '@danielsimonjr/mathts-functions';

/**
 * WS-1 P2 — closed-form oracle pins for the elementary trig / inverse-trig /
 * hyperbolic / arithmetic functions the oracle-coverage matrix listed as SELF-REF
 * (they were checked only against the `Math.*` primitive the implementation itself
 * calls, so "we compute sin" was assumed, not proven).
 *
 * Every value here is an exact special-angle or closed-form identity, independent of
 * the implementation: e.g. `sin(π/6) = 1/2`, `atan(1) = π/4`, and the log-2 family
 * `sinh(ln2) = 3/4`, `cosh(ln2) = 5/4`, `tanh(ln2) = 3/5` (with their exact inverses
 * `asinh(3/4) = acosh(5/4) = atanh(3/5) = ln2`). A function that silently returned the
 * wrong branch or the co-function is now caught. See
 * [[feedback-oracle-tests-implementation-independent]].
 */

const P = Math.PI;
const LN2 = Math.log(2);
const E = Math.E;

describe('trigonometry — exact special angles', () => {
  it('sin(π/6)=½, cos(π/3)=½, tan(π/4)=1', () => {
    expect(sin(P / 6)).toBeCloseTo(0.5, 12);
    expect(cos(P / 3)).toBeCloseTo(0.5, 12);
    expect(tan(P / 4)).toBeCloseTo(1, 12);
  });
  it('reciprocals: csc(π/6)=2, sec(π/3)=2, cot(π/4)=1', () => {
    expect(csc(P / 6)).toBeCloseTo(2, 12);
    expect(sec(P / 3)).toBeCloseTo(2, 12);
    expect(cot(P / 4)).toBeCloseTo(1, 12);
  });
});

describe('inverse trigonometry — exact', () => {
  it('asin(½)=π/6, acos(½)=π/3, atan(1)=π/4', () => {
    expect(asin(0.5)).toBeCloseTo(P / 6, 12);
    expect(acos(0.5)).toBeCloseTo(P / 3, 12);
    expect(atan(1)).toBeCloseTo(P / 4, 12);
  });
  it('inverse reciprocals: acsc(2)=π/6, asec(2)=π/3, acot(1)=π/4', () => {
    expect(acsc(2)).toBeCloseTo(P / 6, 12);
    expect(asec(2)).toBeCloseTo(P / 3, 12);
    expect(acot(1)).toBeCloseTo(P / 4, 12);
  });
});

describe('hyperbolic — the ln2 family (exact)', () => {
  it('sinh(ln2)=¾, cosh(ln2)=5/4, tanh(ln2)=⅗', () => {
    expect(sinh(LN2)).toBeCloseTo(0.75, 12);
    expect(cosh(LN2)).toBeCloseTo(1.25, 12);
    expect(tanh(LN2)).toBeCloseTo(0.6, 12);
  });
  it('exact inverses all return ln2: asinh(¾)=acosh(5/4)=atanh(⅗)=ln2', () => {
    expect(asinh(0.75)).toBeCloseTo(LN2, 12);
    expect(acosh(1.25)).toBeCloseTo(LN2, 12);
    expect(atanh(0.6)).toBeCloseTo(LN2, 12);
  });
});

describe('arithmetic — closed-form pins', () => {
  it('log1p(e−1)=1 (ln(e)); expm1(ln2)=1 (e^ln2−1)', () => {
    expect(log1p(E - 1)).toBeCloseTo(1, 12);
    expect(expm1(LN2)).toBeCloseTo(1, 12);
  });
  it('unaryPlus is the identity on numbers', () => {
    expect(unaryPlus(-3)).toBe(-3);
    expect(unaryPlus(0)).toBe(0);
  });
});
