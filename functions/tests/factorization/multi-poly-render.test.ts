import { describe, it, expect } from 'vitest';
import { fromTerms, toAlgebraString } from '../../src/typed/factorization/multi-poly.js';

describe('toAlgebraString — bigint-exact rendering (no Number() fidelity loss)', () => {
  it('renders a coefficient exceeding 2^53 exactly (no rounding)', () => {
    // 9007199254740993n = 2^53 + 1: the smallest bigint that Number() cannot
    // represent exactly (it rounds DOWN to 2^53 = 9007199254740992). A
    // toAlgebraString that routes bigint coefficients through Number() (as the
    // old `.map(([k, v]) => ({ coeff: Number(v), ... }))` path did) renders the
    // wrong digit string here.
    const p = fromTerms(
      ['x'],
      [
        [[2], 1n],
        [[0], 9007199254740993n],
      ]
    );
    const s = toAlgebraString(p);
    expect(s).toContain('9007199254740993');
    expect(s).not.toContain('9007199254740992');
  });

  it('preserves ordinary small-coefficient rendered output (no regression)', () => {
    const p = fromTerms(
      ['x', 'y'],
      [
        [[0, 1], 1n],
        [[1, 0], 1n],
      ]
    );
    // Pinned to the CURRENT (pre-fix) toAlgebraString byte output — same term
    // order, same "1*x" unit-coefficient style, same "*"/"+" spacing that
    // polyToString has always produced for this input.
    expect(toAlgebraString(p)).toBe('1*x + 1*y');
  });
});
