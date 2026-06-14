import { describe, it, expect } from 'vitest';
import {
  Complex,
  Fraction,
  BigNumber,
  isComplex,
  isFraction,
  isBigNumber,
  I,
  COMPLEX_ZERO,
  COMPLEX_ONE,
  FRACTION_ONE,
  BIGNUMBER_ONE,
} from '../src/index.js';

/**
 * Re-export of the numeric types from `@danielsimonjr/mathts-core`. The exported
 * constants are genuine instances, so the guards verify classes + constants +
 * guards line up. Full numeric behaviour is covered by core's own tests.
 */
describe('@danielsimonjr/mathts-numbers re-export surface', () => {
  it('exposes Complex with guard + constants', () => {
    expect(typeof Complex).toBe('function');
    expect(isComplex(COMPLEX_ONE)).toBe(true);
    expect(isComplex(COMPLEX_ZERO)).toBe(true);
    expect(isComplex(I)).toBe(true);
  });

  it('exposes Fraction with guard + constants', () => {
    expect(typeof Fraction).toBe('function');
    expect(isFraction(FRACTION_ONE)).toBe(true);
  });

  it('exposes BigNumber with guard + constants', () => {
    expect(typeof BigNumber).toBe('function');
    expect(isBigNumber(BIGNUMBER_ONE)).toBe(true);
  });
});
