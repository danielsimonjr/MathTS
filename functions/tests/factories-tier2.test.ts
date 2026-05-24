import { describe, it, expect } from 'vitest';

// bin/hex/oct moved from factories/ to typed/ — import them from the typed layer
import { bin, hex, oct } from '../src/typed/string.js';

// randomInt moved from factories/ to typed/ — import from the typed layer
import { randomInt } from '../src/typed/probability.js';

import {
  divideScalar,
  parseNumberWithConfig,
  mode,
  prod,
  hasNumericValue,
  isFinite,
  isZero,
  factory_unaryPlus,
  factory_dot,
} from '../src/factories/index.js';

describe('Tier 2 factories', () => {
  describe('divideScalar', () => {
    it('divides two numbers', () => {
      expect(divideScalar(6, 3)).toBe(2);
    });

    it('handles non-integer division', () => {
      expect(divideScalar(1, 4)).toBeCloseTo(0.25);
    });
  });

  describe('parseNumberWithConfig', () => {
    it('parses a plain integer string to number', () => {
      expect(parseNumberWithConfig('42')).toBe(42);
    });

    it('parses a float string to number', () => {
      expect(parseNumberWithConfig('3.14')).toBeCloseTo(3.14);
    });
  });

  describe('randomInt', () => {
    it('returns an integer', () => {
      const r = randomInt(10);
      expect(Number.isInteger(r)).toBe(true);
    });

    it('returns value within [min, max)', () => {
      for (let i = 0; i < 20; i++) {
        const r = randomInt(5, 10);
        expect(r).toBeGreaterThanOrEqual(5);
        expect(r).toBeLessThan(10);
      }
    });
  });

  describe('mode', () => {
    it('finds mode of a simple array', () => {
      expect(mode([1, 2, 2, 3])).toEqual([2]);
    });

    it('returns all values when all are equal frequency', () => {
      const result = mode([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('prod', () => {
    it('multiplies all elements of an array', () => {
      expect(prod([1, 2, 3, 4])).toBe(24);
    });

    it('returns identity for single element', () => {
      expect(prod([7])).toBe(7);
    });
  });

  describe('bin', () => {
    it('converts 10 to binary string', () => {
      expect(bin(10)).toBe('0b1010');
    });

    it('converts 0 to binary string', () => {
      expect(bin(0)).toBe('0b0');
    });
  });

  describe('hex', () => {
    it('converts 255 to hex string', () => {
      expect(hex(255)).toBe('0xff');
    });

    it('converts 16 to hex string', () => {
      expect(hex(16)).toBe('0x10');
    });
  });

  describe('oct', () => {
    it('converts 8 to octal string', () => {
      expect(oct(8)).toBe('0o10');
    });

    it('converts 0 to octal string', () => {
      expect(oct(0)).toBe('0o0');
    });
  });

  describe('hasNumericValue', () => {
    it('returns true for numbers', () => {
      expect(hasNumericValue(42)).toBe(true);
    });

    it('returns false for strings', () => {
      expect(hasNumericValue('hello')).toBe(false);
    });

    it('returns true for booleans (booleans are numeric in mathjs)', () => {
      expect(hasNumericValue(true)).toBe(true);
    });
  });

  describe('isFinite', () => {
    it('returns true for finite number', () => {
      expect(isFinite(42)).toBe(true);
    });

    it('returns false for Infinity', () => {
      expect(isFinite(Infinity)).toBe(false);
    });

    it('returns false for -Infinity', () => {
      expect(isFinite(-Infinity)).toBe(false);
    });
  });

  describe('isZero', () => {
    it('returns true for zero', () => {
      expect(isZero(0)).toBe(true);
    });

    it('returns false for non-zero', () => {
      expect(isZero(1)).toBe(false);
    });
  });

  describe('factory_unaryPlus (factory_ prefix due to typed/ conflict)', () => {
    it('returns the same number', () => {
      expect(factory_unaryPlus(5)).toBe(5);
    });

    it('returns zero for zero', () => {
      expect(factory_unaryPlus(0)).toBe(0);
    });
  });

  describe('factory_dot (factory_ prefix due to typed/ conflict)', () => {
    it('computes dot product', () => {
      expect(factory_dot([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    it('computes dot product of unit vectors', () => {
      expect(factory_dot([1, 0, 0], [1, 0, 0])).toBe(1);
    });
  });
});
