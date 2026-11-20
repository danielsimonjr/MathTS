/**
 * Dogfood #1294 - owensT(h, a) for a large h.
 *
 * The integrand of T(h, a) carries the factor exp(-h^2 / 2), so at h = 30 its values are near
 * 1e-196. The quadrature accepted each panel against its absolute floor of 1e-14 and lost up
 * to 3 digits. owensT now takes exp(-h^2 / 2) out of the integral, so the relative tolerance
 * of the quadrature applies.
 * Expected values: the closed form T(h, 1) = Phi(h) Phi(-h) / 2 and a composite quadrature,
 * both with mpmath at 40 digits; SciPy 1.16.3 `owens_t` agrees to 3e-13
 * (script `owens_oracle2.py` of the batch scratch folder).
 */
import { describe, it, expect } from 'vitest';
import { owensT } from '../src/index.js';

const relErr = (got: number, want: number): number => Math.abs(got / want - 1);

// [h, Phi(h) Phi(-h) / 2], mpmath 40 digits.
const CLOSED_FORM: ReadonlyArray<readonly [number, number]> = [
  [5, 1.4332574485503513e-7],
  [8, 3.11048028713589e-16],
  [10, 3.809926512080263e-24],
  [15, 1.8354830996563754e-51],
  [20, 1.3768120593031169e-89],
  [25, 1.5283483531912805e-138],
  [30, 2.4533569635740936e-198],
  [33, 2.0305928104579274e-239],
  [35, 5.624553532362031e-269],
  [37, 2.8627856112622886e-300],
];

// [h, a, T(h, a)], mpmath 40 digits; SciPy owens_t agrees to 3e-13.
const OTHER_A: ReadonlyArray<readonly [number, number, number]> = [
  [30, 0.1, 2.4468050114166746e-198],
  [30, 0.5, 2.4533569635740936e-198],
  [20, 0.9, 1.3768120593031169e-89],
  [30, 1.01, 2.4533569635740936e-198],
  [25, 2, 1.5283483531912805e-138],
  [10, 0.3, 3.800553629215616e-24],
  [15, 5, 1.8354830996563754e-51],
  [37, 0.05, 2.6792250933627118e-300],
  [8, 3, 3.110480287135892e-16],
];

describe('#1294 owensT of a large h', () => {
  it.each(CLOSED_FORM)('T(%d, 1) matches the closed form', (h, want) => {
    expect(relErr(owensT(h, 1), want)).toBeLessThanOrEqual(1e-10);
    expect(relErr(owensT(-h, 1), want)).toBeLessThanOrEqual(1e-10);
  });

  it.each(OTHER_A)('T(%s, %s) matches the reference', (h, a, want) => {
    expect(relErr(owensT(h, a), want)).toBeLessThanOrEqual(1e-10);
    expect(relErr(owensT(h, -a), -want)).toBeLessThanOrEqual(1e-10);
  });

  it('is 0 where exp(-h^2 / 2) underflows', () => {
    expect(owensT(1e3, 1)).toBe(0);
  });
});
