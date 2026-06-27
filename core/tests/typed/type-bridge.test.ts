import { describe, it, expect, beforeAll } from 'vitest';
import { Complex } from '../../src/types/complex.js';
import { Fraction } from '../../src/types/fraction.js';
import { BigNumber } from '../../src/types/bignumber.js';
import { registerNativeTypes } from '../../src/typed/type-bridge.js';

describe('Type Bridge', () => {
  beforeAll(() => {
    registerNativeTypes();
  });

  describe('Complex duck-typing', () => {
    it('should have isComplex marker', () => {
      const z = new Complex(3, 4);
      expect((z as { isComplex?: boolean }).isComplex).toBe(true);
    });
    it('should have type property', () => {
      const z = new Complex(1, 2);
      expect((z as { type?: string }).type).toBe('Complex');
    });
    it('isComplex marker should not be enumerable (set on prototype)', () => {
      const z = new Complex(1, 0);
      expect(Object.keys(z)).not.toContain('isComplex');
    });
    it('type property is already an own instance property', () => {
      const z = new Complex(1, 0);
      // type is set as readonly class field in constructor — it is own and enumerable
      expect(Object.prototype.hasOwnProperty.call(z, 'type')).toBe(true);
      expect((z as { type?: string }).type).toBe('Complex');
    });
  });

  describe('Fraction duck-typing', () => {
    it('should have isFraction marker', () => {
      const f = new Fraction(1, 3);
      expect((f as { isFraction?: boolean }).isFraction).toBe(true);
    });
    it('should have type property', () => {
      const f = new Fraction(2, 7);
      expect((f as { type?: string }).type).toBe('Fraction');
    });
  });

  describe('BigNumber duck-typing', () => {
    it('should have isBigNumber marker', () => {
      const b = BigNumber.fromNumber(42);
      expect((b as { isBigNumber?: boolean }).isBigNumber).toBe(true);
    });
    it('should have type property', () => {
      const b = BigNumber.parse('3.14');
      expect((b as { type?: string }).type).toBe('BigNumber');
    });
  });

  describe('idempotency', () => {
    it('calling registerNativeTypes twice should not throw', () => {
      expect(() => registerNativeTypes()).not.toThrow();
    });
  });
});
