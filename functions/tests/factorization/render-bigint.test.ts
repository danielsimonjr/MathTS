import { describe, it, expect } from 'vitest';
import { renderFactor } from '../../src/typed/factorization/index.js';

describe('renderFactor — bigint-exact rendering (no Number() fidelity loss)', () => {
  it('renders a degree>=2 factor coefficient exceeding 2^53 exactly', () => {
    // 9007199254740993n = 2^53 + 1: the smallest bigint that Number() cannot
    // represent exactly (it rounds down to 2^53 = 9007199254740992). A
    // renderFactor that routes bigint coefficients through Number() (as the
    // old `.map(Number)` path did) renders the wrong digit string here.
    const poly = [9007199254740993n, 0n, 1n]; // x^2 + 9007199254740993
    expect(renderFactor(poly, 'x')).toBe('(x^2 + 9007199254740993)');
  });

  it('preserves ordinary small-coefficient rendered output (no regression)', () => {
    expect(renderFactor([1n, 0n, 1n], 'x')).toBe('(x^2 + 1)');
    expect(renderFactor([2n, 0n, 1n], 'x')).toBe('(x^2 + 2)');
    expect(renderFactor([-1n, 0n, 2n], 'x')).toBe('(2*x^2 - 1)');
    // degree-1 factors still go through renderLinearFactor unchanged.
    expect(renderFactor([-1n, 1n], 'x')).toBe('(x - 1)');
  });
});
