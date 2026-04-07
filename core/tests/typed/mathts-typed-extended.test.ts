import { describe, it, expect } from 'vitest';
import {
  isNumber, isBoolean, isString, isBigInt, isArray, isFunction, isObject,
  isNull, isUndefined,
  isFloat64Array, isFloat32Array, isInt32Array, isUint32Array, isUint8Array,
  isComplex, isFraction, isBigNumber, isMatrix, isDenseMatrix, isSparseMatrix,
  TypeRegistry,
  createMathTSTyped,
  createTypedFunction,
  mathTyped,
  MATHTS_TYPES,
  MATHTS_CONVERSIONS,
} from '../../src/typed/mathts-typed.js';
import { Complex } from '../../src/types/complex.js';
import { Fraction } from '../../src/types/fraction.js';
import { BigNumber } from '../../src/types/bignumber.js';

describe('type guard functions', () => {
  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-1.5)).toBe(true);
    });
    it('should return false for non-numbers', () => {
      expect(isNumber('42')).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('should detect booleans', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(0)).toBe(false);
    });
  });

  describe('isString', () => {
    it('should detect strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString(42)).toBe(false);
    });
  });

  describe('isBigInt', () => {
    it('should detect BigInt', () => {
      expect(isBigInt(BigInt(42))).toBe(true);
      expect(isBigInt(42)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should detect arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2])).toBe(true);
      expect(isArray('not array')).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('should detect functions', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(42)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should detect plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
    });
  });

  describe('isNull and isUndefined', () => {
    it('should detect null', () => {
      expect(isNull(null)).toBe(true);
      expect(isNull(undefined)).toBe(false);
    });
    it('should detect undefined', () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(null)).toBe(false);
    });
  });

  describe('typed array guards', () => {
    it('should detect Float64Array', () => {
      expect(isFloat64Array(new Float64Array(2))).toBe(true);
      expect(isFloat64Array(new Float32Array(2))).toBe(false);
    });
    it('should detect Float32Array', () => {
      expect(isFloat32Array(new Float32Array(2))).toBe(true);
    });
    it('should detect Int32Array', () => {
      expect(isInt32Array(new Int32Array(2))).toBe(true);
    });
    it('should detect Uint32Array', () => {
      expect(isUint32Array(new Uint32Array(2))).toBe(true);
    });
    it('should detect Uint8Array', () => {
      expect(isUint8Array(new Uint8Array(2))).toBe(true);
    });
  });

  describe('mathts type guards', () => {
    it('should detect Complex', () => {
      expect(isComplex(new Complex(1, 2))).toBe(true);
      expect(isComplex(42)).toBe(false);
    });
    it('should detect Fraction', () => {
      expect(isFraction(new Fraction(1, 2))).toBe(true);
      expect(isFraction(0.5)).toBe(false);
    });
    it('should detect BigNumber', () => {
      expect(isBigNumber(BigNumber.fromNumber(42))).toBe(true);
      expect(isBigNumber(42)).toBe(false);
    });
    it('should return false for isMatrix on primitives', () => {
      expect(isMatrix(42)).toBe(false);
    });
    it('should return false for isDenseMatrix on primitives', () => {
      expect(isDenseMatrix(42)).toBe(false);
    });
    it('should return false for isSparseMatrix on primitives', () => {
      expect(isSparseMatrix(42)).toBe(false);
    });
  });
});

describe('TypeRegistry', () => {
  it('should register and check types', () => {
    const registry = new TypeRegistry();
    registry.registerType('TestType', (x: any) => typeof x === 'symbol');
    expect(registry.hasType('TestType')).toBe(true);
    expect(registry.hasType('NonExistent')).toBe(false);
  });

  it('should get all type names', () => {
    const registry = new TypeRegistry();
    registry.registerType('TypeA', () => false);
    registry.registerType('TypeB', () => false);
    const names = registry.getTypeNames();
    expect(names).toContain('TypeA');
    expect(names).toContain('TypeB');
  });

  it('should register and check conversions', () => {
    const registry = new TypeRegistry();
    registry.registerConversion('string', 'number', (s: string) => parseFloat(s));
    expect(registry.hasConversion('string', 'number')).toBe(true);
    expect(registry.hasConversion('number', 'string')).toBe(false);
  });

  it('should clear all registrations', () => {
    const registry = new TypeRegistry();
    registry.registerType('X', () => false);
    registry.registerConversion('a', 'b', () => {});
    registry.clear();
    expect(registry.hasType('X')).toBe(false);
    expect(registry.hasConversion('a', 'b')).toBe(false);
  });
});

describe('createMathTSTyped', () => {
  it('should create a typed instance', () => {
    const typed = createMathTSTyped();
    expect(typed).toBeDefined();
    expect(typeof typed).toBe('function');
  });
});

describe('createTypedFunction', () => {
  it('should create a working typed function', () => {
    const add = createTypedFunction('testAdd', {
      'number, number': (a: number, b: number) => a + b,
    });
    expect(add(1, 2)).toBe(3);
  });
});

describe('mathTyped', () => {
  it('should be a function', () => {
    expect(typeof mathTyped).toBe('function');
  });
});

describe('MATHTS_TYPES', () => {
  it('should be an array of type definitions', () => {
    expect(Array.isArray(MATHTS_TYPES)).toBe(true);
    expect(MATHTS_TYPES.length).toBeGreaterThan(0);
  });
});

describe('MATHTS_CONVERSIONS', () => {
  it('should be an array of conversion definitions', () => {
    expect(Array.isArray(MATHTS_CONVERSIONS)).toBe(true);
    expect(MATHTS_CONVERSIONS.length).toBeGreaterThan(0);
  });

  it('should convert boolean to number', () => {
    const conv = MATHTS_CONVERSIONS.find((c: any) => c.from === 'boolean' && c.to === 'number');
    expect(conv).toBeDefined();
    expect(conv!.convert(true)).toBe(1);
    expect(conv!.convert(false)).toBe(0);
  });
});
