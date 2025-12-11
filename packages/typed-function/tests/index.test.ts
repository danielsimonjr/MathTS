/**
 * Tests for @mathts/typed-function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTyped,
  createTypedFunction,
  TypeRegistry,
  parseSignature,
  buildSignature,
  isNumber,
  isBigInt,
  isArray,
  isString,
  isBoolean,
  isFiniteNumber,
  isInteger,
  isFloat64Array,
  baseTyped,
  NoMatchingSignatureError,
  TypeConversionError,
} from '../src/index.js';

describe('@mathts/typed-function', () => {
  describe('Type tests', () => {
    it('should correctly identify number', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(NaN)).toBe(true);
      expect(isNumber(Infinity)).toBe(true);
      expect(isNumber('42')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });

    it('should correctly identify bigint', () => {
      expect(isBigInt(42n)).toBe(true);
      expect(isBigInt(BigInt(42))).toBe(true);
      expect(isBigInt(42)).toBe(false);
      expect(isBigInt('42')).toBe(false);
    });

    it('should correctly identify array', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray({ length: 0 })).toBe(false);
      expect(isArray('array')).toBe(false);
    });

    it('should correctly identify string', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
      expect(isString(42)).toBe(false);
    });

    it('should correctly identify boolean', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean('true')).toBe(false);
    });

    it('should correctly identify finite number', () => {
      expect(isFiniteNumber(42)).toBe(true);
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
      expect(isFiniteNumber(NaN)).toBe(false);
    });

    it('should correctly identify integer', () => {
      expect(isInteger(42)).toBe(true);
      expect(isInteger(-5)).toBe(true);
      expect(isInteger(3.14)).toBe(false);
      expect(isInteger(42.0)).toBe(true);
    });

    it('should correctly identify Float64Array', () => {
      expect(isFloat64Array(new Float64Array(10))).toBe(true);
      expect(isFloat64Array(new Float32Array(10))).toBe(false);
      expect(isFloat64Array([1, 2, 3])).toBe(false);
    });
  });

  describe('createTyped', () => {
    it('should create a basic typed instance', () => {
      const myTyped = createTyped();

      const add = myTyped('add', {
        'number, number': (a: number, b: number) => a + b,
      });

      expect(add(2, 3)).toBe(5);
      expect(add(10, -5)).toBe(5);
    });

    it('should handle type conversions', () => {
      const myTyped = createTyped();

      const multiply = myTyped('multiply', {
        'number, number': (a: number, b: number) => a * b,
      });

      // string to number conversion
      expect(multiply('2' as unknown as number, 3)).toBe(6);

      // boolean to number conversion
      expect(multiply(true as unknown as number, 5)).toBe(5);
    });

    it('should support custom types', () => {
      interface Point {
        x: number;
        y: number;
        type: 'Point';
      }

      const isPoint = (v: unknown): v is Point =>
        typeof v === 'object' &&
        v !== null &&
        (v as Point).type === 'Point';

      const myTyped = createTyped({
        types: [{ name: 'Point', test: isPoint }],
      });

      const distance = myTyped('distance', {
        'Point, Point': (a: Point, b: Point) =>
          Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
      });

      const p1: Point = { x: 0, y: 0, type: 'Point' };
      const p2: Point = { x: 3, y: 4, type: 'Point' };

      expect(distance(p1, p2)).toBe(5);
    });

    it('should support custom conversions', () => {
      const myTyped = createTyped({
        conversions: [
          {
            from: 'Array',
            to: 'number',
            convert: (arr: unknown) => (arr as number[]).reduce((a, b) => a + b, 0),
          },
        ],
      });

      const double = myTyped('double', {
        'number': (n: number) => n * 2,
      });

      // Array should be converted to number (sum)
      expect(double([1, 2, 3, 4] as unknown as number)).toBe(20); // sum=10, doubled=20
    });
  });

  describe('createTypedFunction', () => {
    it('should create a simple typed function', () => {
      const square = createTypedFunction('square', {
        'number': (n: number) => n * n,
      });

      expect(square(4)).toBe(16);
      expect(square(-3)).toBe(9);
    });

    it('should support multiple signatures', () => {
      const abs = createTypedFunction('abs', {
        'number': (n: number) => Math.abs(n),
        'Array': (arr: number[]) => arr.map(Math.abs),
      });

      expect(abs(-5)).toBe(5);
      expect(abs([-1, 2, -3])).toEqual([1, 2, 3]);
    });

    it('should support variadic signatures', () => {
      const sum = createTypedFunction('sum', {
        'number, number': (a: number, b: number) => a + b,
        'number, number, number': (a: number, b: number, c: number) => a + b + c,
      });

      expect(sum(1, 2)).toBe(3);
      expect(sum(1, 2, 3)).toBe(6);
    });
  });

  describe('TypeRegistry', () => {
    let registry: TypeRegistry;

    beforeEach(() => {
      registry = new TypeRegistry();
    });

    it('should register types', () => {
      interface Vector { values: number[]; type: 'Vector' }
      const isVector = (v: unknown): v is Vector =>
        typeof v === 'object' && v !== null && (v as Vector).type === 'Vector';

      registry.registerType('Vector', isVector);

      expect(registry.hasType('Vector')).toBe(true);
      expect(registry.hasType('Matrix')).toBe(false);
      expect(registry.getTypeNames()).toContain('Vector');
    });

    it('should register conversions', () => {
      registry.registerConversion<number, string>('number', 'string', (n) => String(n));

      expect(registry.hasConversion('number', 'string')).toBe(true);
      expect(registry.hasConversion('string', 'number')).toBe(false);
    });

    it('should build a typed instance from registry', () => {
      interface Currency { value: number; type: 'Currency' }
      const isCurrency = (v: unknown): v is Currency =>
        typeof v === 'object' && v !== null && (v as Currency).type === 'Currency';

      registry.registerType('Currency', isCurrency);
      registry.registerConversion<number, Currency>('number', 'Currency', (n) => ({
        value: n,
        type: 'Currency',
      }));

      const typedInstance = registry.build();

      const formatCurrency = typedInstance('formatCurrency', {
        'Currency': (c: Currency) => `$${c.value.toFixed(2)}`,
      });

      // Direct currency
      expect(formatCurrency({ value: 42.5, type: 'Currency' })).toBe('$42.50');
    });

    it('should clear registry', () => {
      interface Dummy { type: 'Dummy' }
      const isDummy = (v: unknown): v is Dummy =>
        typeof v === 'object' && v !== null && (v as Dummy).type === 'Dummy';

      registry.registerType('Dummy', isDummy);
      expect(registry.hasType('Dummy')).toBe(true);

      registry.clear();
      expect(registry.hasType('Dummy')).toBe(false);
    });
  });

  describe('Signature utilities', () => {
    it('should parse signature strings', () => {
      expect(parseSignature('number, number')).toEqual(['number', 'number']);
      expect(parseSignature('number')).toEqual(['number']);
      expect(parseSignature('Complex, Complex, Complex')).toEqual([
        'Complex',
        'Complex',
        'Complex',
      ]);
      expect(parseSignature('')).toEqual([]);
      expect(parseSignature('  number  ,  string  ')).toEqual(['number', 'string']);
    });

    it('should build signature strings', () => {
      expect(buildSignature('number', 'number')).toBe('number, number');
      expect(buildSignature('Complex')).toBe('Complex');
      expect(buildSignature()).toBe('');
    });
  });

  describe('Error classes', () => {
    it('should create NoMatchingSignatureError', () => {
      const error = new NoMatchingSignatureError(
        'add',
        ['object', 'object'],
        ['number, number', 'string, string']
      );

      expect(error.name).toBe('NoMatchingSignatureError');
      expect(error.functionName).toBe('add');
      expect(error.actualTypes).toEqual(['object', 'object']);
      expect(error.availableSignatures).toEqual(['number, number', 'string, string']);
      expect(error.message).toContain('add');
      expect(error.message).toContain('object');
    });

    it('should create TypeConversionError', () => {
      const error = new TypeConversionError('Complex', 'bigint');

      expect(error.name).toBe('TypeConversionError');
      expect(error.fromType).toBe('Complex');
      expect(error.toType).toBe('bigint');
      expect(error.message).toContain('Complex');
      expect(error.message).toContain('bigint');
    });

    it('should create TypeConversionError with original error', () => {
      const originalError = new Error('Precision loss');
      const error = new TypeConversionError('BigNumber', 'number', originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('Precision loss');
    });
  });

  describe('baseTyped', () => {
    it('should be a pre-configured instance', () => {
      const concat = baseTyped('concat', {
        'string, string': (a: string, b: string) => a + b,
      });

      expect(concat('hello', ' world')).toBe('hello world');
    });

    it('should support bigint type', () => {
      const addBigInt = baseTyped('addBigInt', {
        'bigint, bigint': (a: bigint, b: bigint) => a + b,
      });

      expect(addBigInt(10n, 20n)).toBe(30n);
    });

    it('should support Float64Array type', () => {
      const sumArray = baseTyped('sumArray', {
        'Float64Array': (arr: Float64Array) =>
          arr.reduce((a, b) => a + b, 0),
      });

      const data = new Float64Array([1, 2, 3, 4, 5]);
      expect(sumArray(data)).toBe(15);
    });
  });
});
