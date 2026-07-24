// `factor`/`expand`/`apart`/`together` were flipped to real univariate
// polynomial/rational transforms by Phase 8 Task 6; `casFactor`/`casExpand`
// were wired to those same real engines afterward (they were crude
// string-manipulation stubs). All assertions below pin the behavior by NUMERIC
// evaluation (implementation-independent — see
// [[feedback-oracle-tests-implementation-independent]]), not string equality,
// since the exact factored/expanded string form is not contractual.
import { describe, it, expect } from 'vitest';
import { factor, expand, casFactor, casExpand, apart, together, evaluate } from '../src/index.js';

const at = (e: string, x: number) => evaluate(e, { x }) as number;

describe('CAS transforms: implemented (Phase 8 Task 6) + casExpand/casFactor wired', () => {
  it('factor(x^2-1) is now a real univariate factorization', () => {
    const f = factor('x^2-1');
    expect(f).not.toBe('x^2-1');
    for (const x of [-2, 0.5, 3]) expect(at(f, x)).toBeCloseTo(x * x - 1, 8);
  });

  it('expand((x+1)^3) is now a real univariate expansion', () => {
    const e = expand('(x+1)^3');
    expect(e).not.toBe('(x+1)^3');
    for (const x of [-2, 0.5, 3]) expect(at(e, x)).toBeCloseTo((x + 1) ** 3, 8);
  });

  it('casFactor is now wired to the real factor engine', () => {
    const f = casFactor('x^2-1');
    expect(f).not.toBe('x^2-1');
    for (const x of [-2, 0.5, 3]) expect(at(f, x)).toBeCloseTo(x * x - 1, 8);
  });

  it('casExpand is now wired to the real expand engine', () => {
    const e = casExpand('(x+1)^3');
    expect(e).not.toBe('(x+1)^3');
    for (const x of [-2, 0.5, 3]) expect(at(e, x)).toBeCloseTo((x + 1) ** 3, 8);
  });

  it('apart(1/(x^2-1)) is now a real partial-fraction decomposition', () => {
    const a = apart('1/(x^2-1)');
    expect(a).not.toBe('1/(x^2-1)');
    for (const x of [2, 0.5, 3]) expect(at(a, x)).toBeCloseTo(1 / (x * x - 1), 8);
  });

  it('together(1/x+1/(x+1)) is now a real common-denominator combination', () => {
    const t = together('1/x+1/(x+1)');
    expect(t).not.toBe('1/x+1/(x+1)');
    for (const x of [2, 0.5, 3]) expect(at(t, x)).toBeCloseTo(1 / x + 1 / (x + 1), 8);
  });
});
