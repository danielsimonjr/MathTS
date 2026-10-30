import { describe, it, expect } from 'vitest';
import { Unit } from '@danielsimonjr/mathts-core';

describe('Unit.createUnit pollution guard', () => {
  it('rejects __proto__ as a unit name', () => {
    expect(() => Unit.createUnit({ ['__proto__']: '1 m' } as Record<string, string>)).toThrow(
      /unsafe unit name/
    );
  });

  it('still registers a normal custom unit', () => {
    const name = 'mathts_pr4_pollution_test_u';
    try {
      Unit.createUnit({ [name]: '1 m' });
      expect(new Unit(2, name).toNumeric('m')).toBe(2);
    } finally {
      Unit.deleteUnit(name);
    }
  });
});
