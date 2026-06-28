/**
 * Tests for Symbol-based type identification, robust type tests,
 * and safe conversion factories.
 *
 * Covers Issues 1, 2, and 5 from the typed-function improvements roadmap.
 */

import { describe, it, expect } from 'vitest';
import {
  TYPED_FUNCTION_TYPE,
  createSymbolTypeTest,
  createRobustTypeTest,
  createRobustSubtypeTest,
  createSafeConversion,
  createSafeConversionDef,
  createSymbolTypeDef,
  createRobustTypeDef,
  create,
} from '../src/index.js';

// =============================================================================
// Test fixtures: classes using different identification strategies
// =============================================================================

/** Class using Symbol-based identification (Issue 1 fix) */
class SymbolMatrix {
  [TYPED_FUNCTION_TYPE] = 'SymbolMatrix' as const;
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }
}

/** Class using instance property identification (Issue 5 fix) */
class InstanceMatrix {
  isMatrix = true as const;
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }
}

/** Class using prototype chain identification (legacy pattern) */
class ProtoMatrix {
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }
}
(ProtoMatrix.prototype as Record<string, unknown>).isMatrix = true;

/** Class using both symbol AND instance property (recommended pattern) */
class RobustMatrix {
  [TYPED_FUNCTION_TYPE] = 'Matrix' as const;
  isMatrix = true as const;
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }
}

/** Subtype: DenseMatrix that is also a Matrix */
class RobustDenseMatrix {
  [TYPED_FUNCTION_TYPE] = 'DenseMatrix' as const;
  isDenseMatrix = true as const;
  isMatrix = true as const;
  data: number[];
  constructor(data: number[]) {
    this.data = data;
  }
}

/** Class that must be constructed with `new` (simulates esbuild-compiled class) */
class StrictComplex {
  re: number;
  im: number;
  [TYPED_FUNCTION_TYPE] = 'Complex' as const;
  constructor(re: number, im: number) {
    this.re = re;
    this.im = im;
  }
}

// =============================================================================
// Issue 1: Symbol-based Type Identification
// =============================================================================

describe('Issue 1: Symbol-based Type Identification', () => {
  describe('TYPED_FUNCTION_TYPE symbol', () => {
    it('should be a global symbol via Symbol.for', () => {
      expect(typeof TYPED_FUNCTION_TYPE).toBe('symbol');
      expect(TYPED_FUNCTION_TYPE).toBe(Symbol.for('typed-function:type'));
    });

    it('should be the same symbol across separate Symbol.for calls', () => {
      const otherRef = Symbol.for('typed-function:type');
      expect(TYPED_FUNCTION_TYPE).toBe(otherRef);
    });

    it('should be settable on class instances', () => {
      const m = new SymbolMatrix([1, 2, 3]);
      expect(m[TYPED_FUNCTION_TYPE]).toBe('SymbolMatrix');
    });
  });

  describe('createSymbolTypeTest', () => {
    const isSymbolMatrix = createSymbolTypeTest('SymbolMatrix');

    it('should identify instances with matching symbol', () => {
      expect(isSymbolMatrix(new SymbolMatrix([1]))).toBe(true);
    });

    it('should reject instances with different symbol', () => {
      const obj = { [TYPED_FUNCTION_TYPE]: 'OtherType' };
      expect(isSymbolMatrix(obj)).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isSymbolMatrix(null)).toBe(false);
      expect(isSymbolMatrix(undefined)).toBe(false);
    });

    it('should reject primitives', () => {
      expect(isSymbolMatrix(42)).toBe(false);
      expect(isSymbolMatrix('SymbolMatrix')).toBe(false);
      expect(isSymbolMatrix(true)).toBe(false);
    });

    it('should reject plain objects without symbol', () => {
      expect(isSymbolMatrix({ data: [1, 2] })).toBe(false);
      expect(isSymbolMatrix({})).toBe(false);
    });

    it('should work with Object.create(null) objects that have the symbol', () => {
      const bare = Object.create(null) as Record<symbol, string>;
      bare[TYPED_FUNCTION_TYPE] = 'SymbolMatrix';
      expect(isSymbolMatrix(bare)).toBe(true);
    });
  });

  describe('createSymbolTypeDef', () => {
    it('should create a TypeDef with symbol-based test', () => {
      const def = createSymbolTypeDef('SymbolMatrix');
      expect(def.name).toBe('SymbolMatrix');
      expect(def.test(new SymbolMatrix([1]))).toBe(true);
      expect(def.test({})).toBe(false);
    });
  });
});

// =============================================================================
// Issue 5: Prototype Chain Breakage - Robust Type Tests
// =============================================================================

describe('Issue 5: Robust Type Tests (Prototype Chain Breakage)', () => {
  describe('createRobustTypeTest', () => {
    const isMatrix = createRobustTypeTest('Matrix', 'isMatrix');

    it('should detect via symbol (strategy 1)', () => {
      expect(isMatrix(new RobustMatrix([1]))).toBe(true);
    });

    it('should detect via instance property (strategy 2)', () => {
      expect(isMatrix(new InstanceMatrix([1]))).toBe(true);
    });

    it('should detect via prototype chain (strategy 3 - legacy)', () => {
      expect(isMatrix(new ProtoMatrix([1]))).toBe(true);
    });

    it('should reject objects without any identifying marker', () => {
      expect(isMatrix({ data: [1, 2] })).toBe(false);
      expect(isMatrix({})).toBe(false);
    });

    it('should reject null, undefined, and primitives', () => {
      expect(isMatrix(null)).toBe(false);
      expect(isMatrix(undefined)).toBe(false);
      expect(isMatrix(42)).toBe(false);
      expect(isMatrix('matrix')).toBe(false);
    });

    it('should work with Object.create(null) + symbol', () => {
      const bare = Object.create(null) as Record<string | symbol, unknown>;
      bare[TYPED_FUNCTION_TYPE] = 'Matrix';
      expect(isMatrix(bare)).toBe(true);
    });

    it('should work with Object.create(null) + instance property', () => {
      const bare = Object.create(null) as Record<string, unknown>;
      bare.isMatrix = true;
      expect(isMatrix(bare)).toBe(true);
    });

    it('should use custom protoProp when specified', () => {
      const isDense = createRobustTypeTest('DenseMatrix', 'isDenseMatrix', 'isMatrix');

      // Instance property match
      const obj = { isDenseMatrix: true };
      expect(isDense(obj)).toBe(true);

      // Proto match using isMatrix (the protoProp)
      const protoObj = new ProtoMatrix([1]);
      // ProtoMatrix has isMatrix on prototype, but isDenseMatrix check is 'isMatrix' here
      // This should match via prototype since protoProp is 'isMatrix'
      expect(isDense(protoObj)).toBe(true);
    });
  });

  describe('createRobustSubtypeTest', () => {
    const isDenseMatrix = createRobustSubtypeTest('DenseMatrix', 'isDenseMatrix', 'isMatrix');

    it('should detect DenseMatrix with symbol', () => {
      expect(isDenseMatrix(new RobustDenseMatrix([1]))).toBe(true);
    });

    it('should detect DenseMatrix with instance property + parent property', () => {
      const obj = { isDenseMatrix: true, isMatrix: true };
      expect(isDenseMatrix(obj)).toBe(true);
    });

    it('should reject objects that are Matrix but not DenseMatrix', () => {
      expect(isDenseMatrix(new InstanceMatrix([1]))).toBe(false);
    });

    it('should reject plain objects', () => {
      expect(isDenseMatrix({})).toBe(false);
      expect(isDenseMatrix(null)).toBe(false);
    });
  });

  describe('createRobustTypeDef', () => {
    it('should create a TypeDef with robust multi-strategy test', () => {
      const def = createRobustTypeDef('Matrix', 'isMatrix');
      expect(def.name).toBe('Matrix');

      // All strategies should work
      expect(def.test(new RobustMatrix([1]))).toBe(true);
      expect(def.test(new InstanceMatrix([1]))).toBe(true);
      expect(def.test(new ProtoMatrix([1]))).toBe(true);
      expect(def.test({})).toBe(false);
    });
  });
});

// =============================================================================
// Issue 2: Safe Conversions (Explicit `new`)
// =============================================================================

describe('Issue 2: Safe Conversions (Explicit new)', () => {
  describe('createSafeConversion', () => {
    it('should create instances using new', () => {
      const toComplex = createSafeConversion(StrictComplex, (x) => [x as number, 0]);
      const result = toComplex(5);

      expect(result).toBeInstanceOf(StrictComplex);
      expect(result.re).toBe(5);
      expect(result.im).toBe(0);
    });

    it('should pass value directly when no transform is provided', () => {
      class Wrapper {
        value: unknown;
        constructor(value: unknown) {
          this.value = value;
        }
      }

      const toWrapper = createSafeConversion(Wrapper);
      const result = toWrapper(42);

      expect(result).toBeInstanceOf(Wrapper);
      expect(result.value).toBe(42);
    });

    it('should handle multi-arg transforms', () => {
      const toComplex = createSafeConversion(StrictComplex, (x) => {
        const n = x as number;
        return [n, n]; // re = im = n
      });

      const result = toComplex(3);
      expect(result.re).toBe(3);
      expect(result.im).toBe(3);
    });
  });

  describe('createSafeConversionDef', () => {
    it('should create a valid ConversionDef', () => {
      const def = createSafeConversionDef('number', 'Complex', StrictComplex, (x) => [
        x as number,
        0,
      ]);

      expect(def.from).toBe('number');
      expect(def.to).toBe('Complex');
      expect(typeof def.convert).toBe('function');

      const result = def.convert(7) as StrictComplex;
      expect(result).toBeInstanceOf(StrictComplex);
      expect(result.re).toBe(7);
      expect(result.im).toBe(0);
    });
  });
});

// =============================================================================
// Integration: Using new utilities with typed-function
// =============================================================================

describe('Integration with typed-function', () => {
  it('should register symbol-based types with typed-function', () => {
    const myTyped = create();
    myTyped.addType(createSymbolTypeDef('SymbolMatrix'));

    const getLength = myTyped('getLength', {
      SymbolMatrix: (m: SymbolMatrix) => m.data.length,
    });

    expect(getLength(new SymbolMatrix([1, 2, 3]))).toBe(3);
  });

  it('should register robust types with typed-function', () => {
    const myTyped = create();
    myTyped.addType(createRobustTypeDef('Matrix', 'isMatrix'));

    const getLength = myTyped('getLength', {
      Matrix: (m: RobustMatrix | InstanceMatrix | ProtoMatrix) => m.data.length,
    });

    // All identification strategies should work
    expect(getLength(new RobustMatrix([1, 2]))).toBe(2);
    expect(getLength(new InstanceMatrix([1, 2, 3]))).toBe(3);
    expect(getLength(new ProtoMatrix([1]))).toBe(1);
  });

  it('should use safe conversions with typed-function', () => {
    const myTyped = create();

    // Register Complex type with symbol-based identification
    myTyped.addType({
      name: 'Complex',
      test: createSymbolTypeTest('Complex'),
    });

    // Add safe conversion from number to Complex
    myTyped.addConversion(
      createSafeConversionDef('number', 'Complex', StrictComplex, (x) => [x as number, 0])
    );

    // Create a function that accepts Complex
    const magnitude = myTyped('magnitude', {
      Complex: (c: StrictComplex) => Math.sqrt(c.re * c.re + c.im * c.im),
    });

    // Direct Complex argument
    expect(magnitude(new StrictComplex(3, 4))).toBe(5);

    // Number auto-converted to Complex via safe conversion
    expect(magnitude(7)).toBe(7);
  });

  it('should handle type resolution correctly with robust tests', () => {
    const myTyped = create();

    myTyped.addType(createRobustTypeDef('Matrix', 'isMatrix'));

    const add = myTyped('add', {
      'number, number': (a: number, b: number) => a + b,
      'Matrix, Matrix': (a: RobustMatrix, b: RobustMatrix) =>
        new RobustMatrix(a.data.map((v, i) => v + b.data[i])),
    });

    // Number addition
    expect(add(2, 3)).toBe(5);

    // Matrix addition (using symbol)
    const result = add(new RobustMatrix([1, 2]), new RobustMatrix([3, 4])) as RobustMatrix;
    expect(result.data).toEqual([4, 6]);

    // Matrix addition (using instance property only)
    const result2 = add(new InstanceMatrix([10, 20]), new InstanceMatrix([5, 5])) as InstanceMatrix;
    expect(result2.data).toEqual([15, 25]);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('Edge cases', () => {
  it('should handle frozen objects with symbol', () => {
    const obj = Object.freeze({ [TYPED_FUNCTION_TYPE]: 'Frozen', data: [1] });
    const test = createSymbolTypeTest('Frozen');
    expect(test(obj)).toBe(true);
  });

  it('should handle sealed objects', () => {
    const obj = Object.seal({ isMatrix: true, data: [1] });
    const test = createRobustTypeTest('Matrix', 'isMatrix');
    expect(test(obj)).toBe(true);
  });

  it('should handle arrays (should not false-positive)', () => {
    const test = createRobustTypeTest('Matrix', 'isMatrix');
    expect(test([1, 2, 3])).toBe(false);
  });

  it('should handle functions (should not false-positive)', () => {
    const test = createRobustTypeTest('Matrix', 'isMatrix');
    expect(test(() => {})).toBe(false);
  });

  it('should handle objects with isMatrix=false', () => {
    const test = createRobustTypeTest('Matrix', 'isMatrix');
    expect(test({ isMatrix: false })).toBe(false);
  });

  it('should handle objects with isMatrix as non-boolean', () => {
    const test = createRobustTypeTest('Matrix', 'isMatrix');
    expect(test({ isMatrix: 'yes' })).toBe(false);
    expect(test({ isMatrix: 1 })).toBe(false);
  });
});
