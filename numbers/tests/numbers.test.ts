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

/**
 * The facade is an entry point, not a copy: its runtime surface is exactly what it re-exports
 * from core. Adding or dropping an export must be a deliberate change to this list.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'BIGNUMBER_E',
  'BIGNUMBER_LN10',
  'BIGNUMBER_LN2',
  'BIGNUMBER_NEG_ONE',
  'BIGNUMBER_ONE',
  'BIGNUMBER_PI',
  'BIGNUMBER_TEN',
  'BIGNUMBER_ZERO',
  'BigNumber',
  'COMPLEX_NEG_ONE',
  'COMPLEX_ONE',
  'COMPLEX_ZERO',
  'Complex',
  'FRACTION_HALF',
  'FRACTION_NEG_ONE',
  'FRACTION_ONE',
  'FRACTION_QUARTER',
  'FRACTION_THIRD',
  'FRACTION_ZERO',
  'Fraction',
  'I',
  'isBigNumber',
  'isComplex',
  'isFraction',
];

describe('numbers facade export surface', () => {
  it('exports exactly the pinned runtime names', async () => {
    const facade = await import('../src/index.js');
    expect(Object.keys(facade).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS].sort());
  });

  it('re-exports the same bindings as core, not copies', async () => {
    const facade = (await import('../src/index.js')) as Record<string, unknown>;
    const core = (await import('@danielsimonjr/mathts-core')) as Record<string, unknown>;
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect(facade[name], name).toBe(core[name]);
    }
  });
});
