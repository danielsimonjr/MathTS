/**
 * BigNumber tests
 * @module @danielsimonjr/mathts-core/tests/types/bignumber
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BigNumber,
  isBigNumber,
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_TEN,
  BIGNUMBER_PI,
} from '../../src/types/bignumber';

describe('BigNumber', () => {
  beforeEach(() => {
    BigNumber.resetConfig();
  });

  describe('constructor and factory methods', () => {
    it('should create from number', () => {
      const bn = BigNumber.fromNumber(123.456);
      expect(bn.toString()).toBe('123.456');
    });

    it('should create from integer', () => {
      const bn = BigNumber.fromNumber(42);
      expect(bn.toString()).toBe('42');
    });

    it('strips trailing zeros on integer fromNumber / fromBigInt', () => {
      expect(BigNumber.fromNumber(1000).toString()).toBe('1000');
      expect(BigNumber.fromNumber(-1000).toString()).toBe('-1000');
      expect(BigNumber.fromBigInt(1000n).toString()).toBe('1000');
      expect(BigNumber.fromBigInt(1000n).equals(BigNumber.parse('1000'))).toBe(true);
    });

    it('should create from negative number', () => {
      const bn = BigNumber.fromNumber(-123.456);
      expect(bn.toString()).toBe('-123.456');
    });

    it('should create zero', () => {
      const bn = BigNumber.fromNumber(0);
      expect(bn.toString()).toBe('0');
      expect(bn.isZero()).toBe(true);
    });

    it('should parse string', () => {
      expect(BigNumber.parse('123.456').toString()).toBe('123.456');
      expect(BigNumber.parse('-123.456').toString()).toBe('-123.456');
      expect(BigNumber.parse('0.001').toString()).toBe('0.001');
    });

    it('should parse scientific notation', () => {
      expect(BigNumber.parse('1.23e4').toString()).toBe('12300');
      expect(BigNumber.parse('1.23e-4').toString()).toBe('0.000123');
    });

    it('should parse special values', () => {
      expect(BigNumber.parse('NaN').isNaN()).toBe(true);
      expect(BigNumber.parse('Infinity').isInfinite()).toBe(true);
      expect(BigNumber.parse('-Infinity').isInfinite()).toBe(true);
      expect(BigNumber.parse('-Infinity').isNegative()).toBe(true);
    });

    it('should create from bigint', () => {
      const bn = BigNumber.fromBigInt(12345678901234567890n);
      expect(bn.toString()).toBe('12345678901234567890');
    });

    it('should create from JSON', () => {
      const bn = BigNumber.fromJSON({ value: '123.456' });
      expect(bn.toString()).toBe('123.456');
    });
  });

  describe('type checking', () => {
    it('should identify BigNumber instances', () => {
      expect(isBigNumber(BigNumber.fromNumber(5))).toBe(true);
      expect(isBigNumber(BIGNUMBER_ONE)).toBe(true);
      expect(isBigNumber(5)).toBe(false);
      expect(isBigNumber({})).toBe(false);
    });
  });

  describe('conversion methods', () => {
    it('should convert to string', () => {
      expect(BigNumber.fromNumber(123.456).toString()).toBe('123.456');
      expect(BigNumber.fromNumber(0).toString()).toBe('0');
      expect(BigNumber.parse('NaN').toString()).toBe('NaN');
      expect(BigNumber.parse('Infinity').toString()).toBe('Infinity');
    });

    it('should convert to number', () => {
      expect(BigNumber.fromNumber(123.456).valueOf()).toBeCloseTo(123.456);
      expect(BigNumber.parse('NaN').valueOf()).toBeNaN();
      expect(BigNumber.parse('Infinity').valueOf()).toBe(Infinity);
    });

    it('should convert to JSON', () => {
      const json = BigNumber.fromNumber(123.456).toJSON();
      expect(json.mathjs).toBe('BigNumber');
      expect(json.value).toBe('123.456');
    });

    it('should convert to fixed', () => {
      expect(BigNumber.fromNumber(123.456).toFixed(2)).toBe('123.46');
      expect(BigNumber.fromNumber(123.456).toFixed(0)).toBe('123');
      expect(BigNumber.fromNumber(123).toFixed(2)).toBe('123.00');
    });

    it('should convert to exponential', () => {
      expect(BigNumber.fromNumber(12345).toExponential(2)).toBe('1.23e+4');
      expect(BigNumber.fromNumber(0.00123).toExponential(2)).toBe('1.23e-3');
    });

    it('should convert to precision', () => {
      expect(BigNumber.fromNumber(12345).toPrecision(3)).toBe('1.23e+4');
      expect(BigNumber.fromNumber(123.456).toPrecision(4)).toBe('123.5');
    });

    it('should convert to bigint', () => {
      expect(BigNumber.fromNumber(123.456).toBigInt()).toBe(123n);
      expect(BigNumber.fromNumber(-123.456).toBigInt()).toBe(-123n);
    });

    it('should throw when converting NaN/Infinity to bigint', () => {
      expect(() => BigNumber.parse('NaN').toBigInt()).toThrow();
      expect(() => BigNumber.parse('Infinity').toBigInt()).toThrow();
    });
  });

  describe('arithmetic operations', () => {
    it('should add numbers', () => {
      const a = BigNumber.fromNumber(123.456);
      const b = BigNumber.fromNumber(100.544);
      expect(a.add(b).toString()).toBe('224');
    });

    it('should subtract numbers', () => {
      const a = BigNumber.fromNumber(123.456);
      const b = BigNumber.fromNumber(100.456);
      expect(a.subtract(b).toString()).toBe('23');
    });

    it('should multiply numbers', () => {
      const a = BigNumber.fromNumber(12.5);
      const b = BigNumber.fromNumber(4);
      expect(a.multiply(b).toString()).toBe('50');
    });

    it('should divide numbers', () => {
      BigNumber.config({ precision: 10 });
      const a = BigNumber.fromNumber(100);
      const b = BigNumber.fromNumber(4);
      expect(a.divide(b).toString()).toBe('25');
    });

    it('should handle division with repeating decimals', () => {
      BigNumber.config({ precision: 10 });
      const a = BigNumber.fromNumber(1);
      const b = BigNumber.fromNumber(3);
      const result = a.divide(b);
      expect(result.toFixed(9)).toBe('0.333333333');
    });

    it('should negate numbers', () => {
      expect(BigNumber.fromNumber(123).negate().toString()).toBe('-123');
      expect(BigNumber.fromNumber(-123).negate().toString()).toBe('123');
    });

    it('should compute absolute value', () => {
      expect(BigNumber.fromNumber(-123).abs().toString()).toBe('123');
      expect(BigNumber.fromNumber(123).abs().toString()).toBe('123');
    });

    it('should compute power', () => {
      const base = BigNumber.fromNumber(2);
      expect(base.pow(10).toString()).toBe('1024');
      expect(base.pow(0).toString()).toBe('1');
    });

    it('should expose div/times aliases (mathjs / Decimal.js calling convention)', () => {
      // The relocated Unit calls `.div`/`.times` on BigNumber values, including with
      // string operands (e.g. new BigNumber(String(n)).div(String(d)).times(String(s))).
      BigNumber.config({ precision: 10 });
      const a = BigNumber.fromNumber(100);
      const b = BigNumber.fromNumber(7);
      // aliases are exactly their long forms (implementation-independent)
      expect(a.div(b).toString()).toBe(a.divide(b).toString());
      expect(a.times(b).toString()).toBe(a.multiply(b).toString());
      // exact cases + string operand acceptance
      expect(BigNumber.fromNumber(50).div(BigNumber.fromNumber(5)).toString()).toBe('10');
      expect(BigNumber.fromNumber(6).times('7').toString()).toBe('42');
      expect(BigNumber.fromNumber(10).div('2').toString()).toBe('5');
    });

    it('should compute square root', () => {
      BigNumber.config({ precision: 10 });
      const n = BigNumber.fromNumber(4);
      expect(n.sqrt().toFixed(0)).toBe('2');

      const n2 = BigNumber.fromNumber(2);
      expect(n2.sqrt().toFixed(8)).toBe('1.41421356');
    });
  });

  describe('special value handling', () => {
    it('should handle NaN in arithmetic', () => {
      const nan = BigNumber.parse('NaN');
      const one = BIGNUMBER_ONE;
      expect(nan.add(one).isNaN()).toBe(true);
      expect(nan.subtract(one).isNaN()).toBe(true);
      expect(nan.multiply(one).isNaN()).toBe(true);
      expect(nan.divide(one).isNaN()).toBe(true);
    });

    it('should handle Infinity in arithmetic', () => {
      const inf = BigNumber.parse('Infinity');
      const one = BIGNUMBER_ONE;

      expect(inf.add(one).isInfinite()).toBe(true);
      expect(inf.multiply(one).isInfinite()).toBe(true);
      expect(one.divide(inf).isZero()).toBe(true);
    });

    it('should handle division by zero', () => {
      const one = BIGNUMBER_ONE;
      const zero = BIGNUMBER_ZERO;
      expect(one.divide(zero).isInfinite()).toBe(true);
      expect(zero.divide(zero).isNaN()).toBe(true);
    });

    it('should handle Infinity - Infinity', () => {
      const inf = BigNumber.parse('Infinity');
      expect(inf.subtract(inf).isNaN()).toBe(true);
    });

    it('should handle 0 * Infinity', () => {
      const inf = BigNumber.parse('Infinity');
      const zero = BIGNUMBER_ZERO;
      expect(zero.multiply(inf).isNaN()).toBe(true);
    });
  });

  describe('comparison methods', () => {
    it('should check equality', () => {
      expect(BigNumber.fromNumber(123).equals(BigNumber.fromNumber(123))).toBe(true);
      expect(BigNumber.fromNumber(123).equals(BigNumber.fromNumber(124))).toBe(false);
    });

    it('should check less than', () => {
      expect(BigNumber.fromNumber(100).lessThan(BigNumber.fromNumber(200))).toBe(true);
      expect(BigNumber.fromNumber(200).lessThan(BigNumber.fromNumber(100))).toBe(false);
    });

    it('should check greater than', () => {
      expect(BigNumber.fromNumber(200).greaterThan(BigNumber.fromNumber(100))).toBe(true);
      expect(BigNumber.fromNumber(100).greaterThan(BigNumber.fromNumber(200))).toBe(false);
    });

    it('should compare', () => {
      expect(BigNumber.compare(BigNumber.fromNumber(100), BigNumber.fromNumber(200))).toBe(-1);
      expect(BigNumber.compare(BigNumber.fromNumber(200), BigNumber.fromNumber(100))).toBe(1);
      expect(BigNumber.compare(BigNumber.fromNumber(100), BigNumber.fromNumber(100))).toBe(0);
    });

    it('should compare negative numbers', () => {
      expect(BigNumber.fromNumber(-100).lessThan(BigNumber.fromNumber(100))).toBe(true);
      expect(BigNumber.fromNumber(-100).lessThan(BigNumber.fromNumber(-50))).toBe(true);
    });
  });

  describe('rounding methods', () => {
    it('should round to decimal places', () => {
      expect(BigNumber.fromNumber(123.456).round(2).toString()).toBe('123.46');
      expect(BigNumber.fromNumber(123.454).round(2).toString()).toBe('123.45');
    });

    it('should round with different modes', () => {
      const n = BigNumber.fromNumber(2.5);
      expect(n.round(0, 'up').toString()).toBe('3');
      expect(n.round(0, 'down').toString()).toBe('2');
      expect(n.round(0, 'ceil').toString()).toBe('3');
      expect(n.round(0, 'floor').toString()).toBe('2');
      expect(n.round(0, 'halfUp').toString()).toBe('3');
      expect(n.round(0, 'halfDown').toString()).toBe('2');
      expect(n.round(0, 'halfEven').toString()).toBe('2'); // Banker's rounding: 2.5 -> 2
    });

    it('should floor', () => {
      expect(BigNumber.fromNumber(2.7).floor().toString()).toBe('2');
      expect(BigNumber.fromNumber(-2.7).floor().toString()).toBe('-3');
    });

    it('should ceil', () => {
      expect(BigNumber.fromNumber(2.3).ceil().toString()).toBe('3');
      expect(BigNumber.fromNumber(-2.3).ceil().toString()).toBe('-2');
    });

    it('should truncate', () => {
      expect(BigNumber.fromNumber(2.7).trunc().toString()).toBe('2');
      expect(BigNumber.fromNumber(-2.7).trunc().toString()).toBe('-2');
    });
  });

  describe('utility methods', () => {
    it('should check isNaN', () => {
      expect(BigNumber.parse('NaN').isNaN()).toBe(true);
      expect(BigNumber.fromNumber(123).isNaN()).toBe(false);
    });

    it('should check isFinite', () => {
      expect(BigNumber.fromNumber(123).isFinite()).toBe(true);
      expect(BigNumber.parse('Infinity').isFinite()).toBe(false);
      expect(BigNumber.parse('NaN').isFinite()).toBe(false);
    });

    it('should check isInfinite', () => {
      expect(BigNumber.parse('Infinity').isInfinite()).toBe(true);
      expect(BigNumber.parse('-Infinity').isInfinite()).toBe(true);
      expect(BigNumber.fromNumber(123).isInfinite()).toBe(false);
    });

    it('should check isZero', () => {
      expect(BIGNUMBER_ZERO.isZero()).toBe(true);
      expect(BigNumber.fromNumber(0.001).isZero()).toBe(false);
    });

    it('should check isPositive', () => {
      expect(BigNumber.fromNumber(123).isPositive()).toBe(true);
      expect(BigNumber.fromNumber(-123).isPositive()).toBe(false);
      expect(BIGNUMBER_ZERO.isPositive()).toBe(false);
    });

    it('should check isNegative', () => {
      expect(BigNumber.fromNumber(-123).isNegative()).toBe(true);
      expect(BigNumber.fromNumber(123).isNegative()).toBe(false);
    });

    it('should check isInteger', () => {
      expect(BigNumber.fromNumber(123).isInteger()).toBe(true);
      expect(BigNumber.fromNumber(123.456).isInteger()).toBe(false);
    });

    it('should get sign', () => {
      expect(BigNumber.fromNumber(123).sign()).toBe(1);
      expect(BigNumber.fromNumber(-123).sign()).toBe(-1);
      expect(BIGNUMBER_ZERO.sign()).toBe(0);
    });

    it('should clone', () => {
      const bn = BigNumber.fromNumber(123.456);
      const clone = bn.clone();
      expect(clone.toString()).toBe('123.456');
      expect(clone).not.toBe(bn);
    });
  });

  describe('configuration', () => {
    it('should get and set config', () => {
      const config = BigNumber.config({ precision: 100 });
      expect(config.precision).toBe(100);
    });

    it('should reset config', () => {
      BigNumber.config({ precision: 100 });
      BigNumber.resetConfig();
      const config = BigNumber.config();
      expect(config.precision).toBe(64);
    });
  });

  describe('constants', () => {
    it('should have correct zero', () => {
      expect(BIGNUMBER_ZERO.isZero()).toBe(true);
    });

    it('should have correct one', () => {
      expect(BIGNUMBER_ONE.toString()).toBe('1');
    });

    it('should have correct ten', () => {
      expect(BIGNUMBER_TEN.toString()).toBe('10');
    });

    it('should have pi with high precision', () => {
      expect(BIGNUMBER_PI.toString().startsWith('3.14159265358979')).toBe(true);
    });
  });
});
