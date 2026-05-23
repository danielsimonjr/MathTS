/**
 * Tests for @danielsimonjr/mathts-typed-function
 */

import { describe, it, expect } from 'vitest';
import {
  typed,
  create,
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
  NoMatchingSignatureError,
  TypeConversionError,
} from '../src/index.js';

describe('@danielsimonjr/mathts-typed-function', () => {
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

  describe('typed-function re-exports', () => {
    it('should export typed default from typed-function', () => {
      expect(typed).toBeDefined();
      expect(typeof typed).toBe('function');
    });

    it('should export create from typed-function', () => {
      expect(create).toBeDefined();
      expect(typeof create).toBe('function');
    });

    it('should create typed functions using typed default', () => {
      const add = typed('add', {
        'number, number': (a: number, b: number) => a + b,
      });

      expect(add(2, 3)).toBe(5);
      expect(add(10, -5)).toBe(5);
    });

    it('should create a custom typed instance using create', () => {
      const myTyped = create();

      const multiply = myTyped('multiply', {
        'number, number': (a: number, b: number) => a * b,
      });

      expect(multiply(3, 4)).toBe(12);
    });

    it('should support custom types with create', () => {
      interface Point {
        x: number;
        y: number;
        type: 'Point';
      }

      const isPoint = (v: unknown): v is Point =>
        typeof v === 'object' && v !== null && (v as Point).type === 'Point';

      const myTyped = create();
      myTyped.addType({ name: 'Point', test: isPoint });

      const distance = myTyped('distance', {
        'Point, Point': (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
      });

      const p1: Point = { x: 0, y: 0, type: 'Point' };
      const p2: Point = { x: 3, y: 4, type: 'Point' };

      expect(distance(p1, p2)).toBe(5);
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
});
