import { describe, it, expect } from 'vitest';
import {
  asin,
  acos,
  atan,
  atan2,
  add,
  subtract,
  multiply,
  divide,
  pow,
  sqrt,
  abs,
  exp,
  log,
  sin,
  cos,
  tan,
  sum,
  mean,
  min,
  max,
  gcd,
  lcm,
  round,
  floor,
  ceil,
  det,
  conj,
  re,
  im,
  arg,
  shims,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  SQRT2,
  SQRT1_2,
  Infinity_,
  NaN_,
} from '../src/shims.js';
import { Complex, DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-core';

describe('Inverse trig functions', () => {
  it('asin should wrap Math.asin', () => {
    expect(asin(0)).toBe(0);
    expect(asin(1)).toBeCloseTo(Math.PI / 2);
  });

  it('acos should wrap Math.acos', () => {
    expect(acos(1)).toBe(0);
    expect(acos(0)).toBeCloseTo(Math.PI / 2);
  });

  it('atan should wrap Math.atan', () => {
    expect(atan(0)).toBe(0);
    expect(atan(1)).toBeCloseTo(Math.PI / 4);
  });

  it('atan2 should wrap Math.atan2', () => {
    expect(atan2(1, 1)).toBeCloseTo(Math.PI / 4);
    expect(atan2(0, 1)).toBe(0);
  });
});

describe('Arithmetic re-exports', () => {
  it('add should work', () => {
    expect(add(2, 3)).toBe(5);
  });
  it('subtract should work', () => {
    expect(subtract(5, 3)).toBe(2);
  });
  it('multiply should work', () => {
    expect(multiply(3, 4)).toBe(12);
  });
  it('divide should work', () => {
    expect(divide(10, 2)).toBe(5);
  });
  it('pow should work', () => {
    expect(pow(2, 3)).toBe(8);
  });
  it('sqrt should work', () => {
    expect(sqrt(9)).toBe(3);
  });
  it('abs should work', () => {
    expect(abs(-5)).toBe(5);
  });
  it('exp should work', () => {
    expect(exp(0)).toBe(1);
  });
  it('log should work', () => {
    expect(log(1)).toBe(0);
  });
});

describe('Trig re-exports', () => {
  it('sin should work', () => {
    expect(sin(0)).toBe(0);
  });
  it('cos should work', () => {
    expect(cos(0)).toBe(1);
  });
  it('tan should work', () => {
    expect(tan(0)).toBe(0);
  });
});

describe('Statistics re-exports', () => {
  it('sum should work', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
  it('mean should work', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
  it('min should work', () => {
    expect(min(3, 1, 2)).toBe(1);
  });
  it('max should work', () => {
    expect(max(3, 1, 2)).toBe(3);
  });
});

describe('Number theory re-exports', () => {
  it('gcd should work', () => {
    expect(gcd(12, 8)).toBe(4);
  });
  it('lcm should work', () => {
    expect(lcm(4, 6)).toBe(12);
  });
});

describe('Rounding re-exports', () => {
  it('round should work', () => {
    expect(round(2.7)).toBe(3);
  });
  it('floor should work', () => {
    expect(floor(2.7)).toBe(2);
  });
  it('ceil should work', () => {
    expect(ceil(2.1)).toBe(3);
  });
});

describe('det() edge cases', () => {
  it('should handle 1x1 matrix', () => {
    expect(det([[5]])).toBe(5);
  });

  it('should handle 4x4 matrix (LU decomposition)', () => {
    const d = det([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [2, 6, 4, 8],
      [3, 1, 1, 2],
    ]);
    expect(typeof d).toBe('number');
    expect(isFinite(d)).toBe(true);
  });

  it('should return 0 for singular matrix', () => {
    const d = det([
      [1, 2],
      [2, 4],
    ]);
    expect(Math.abs(d)).toBeLessThan(1e-10);
  });

  it('should throw for non-square matrix', () => {
    expect(() =>
      det([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toThrow('square');
  });
});

describe('Complex error cases', () => {
  it('conj should throw for non-Complex', () => {
    expect(() => conj(5 as any)).toThrow('Expected Complex number');
  });

  it('re should throw for non-number/non-Complex', () => {
    expect(() => re('bad' as any)).toThrow('Expected Complex or number');
  });

  it('im should throw for non-number/non-Complex', () => {
    expect(() => im('bad' as any)).toThrow('Expected Complex or number');
  });

  it('arg should throw for non-Complex', () => {
    expect(() => arg(5 as any)).toThrow('Expected Complex number');
  });
});

describe('Additional constants', () => {
  it('LN2', () => {
    expect(LN2).toBe(Math.LN2);
  });
  it('LN10', () => {
    expect(LN10).toBe(Math.LN10);
  });
  it('LOG2E', () => {
    expect(LOG2E).toBe(Math.LOG2E);
  });
  it('LOG10E', () => {
    expect(LOG10E).toBe(Math.LOG10E);
  });
  it('SQRT2', () => {
    expect(SQRT2).toBe(Math.SQRT2);
  });
  it('SQRT1_2', () => {
    expect(SQRT1_2).toBe(Math.SQRT1_2);
  });
  it('Infinity_', () => {
    expect(Infinity_).toBe(Infinity);
  });
  it('NaN_', () => {
    expect(NaN_).toBeNaN();
  });
});

describe('shims object', () => {
  it('should contain all expected function keys', () => {
    const expectedKeys = [
      'complex',
      'fraction',
      'bignumber',
      'matrix',
      'sparse',
      'add',
      'subtract',
      'multiply',
      'divide',
      'pow',
      'sqrt',
      'abs',
      'exp',
      'log',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'atan2',
      'sum',
      'mean',
      'min',
      'max',
      'gcd',
      'lcm',
      'round',
      'floor',
      'ceil',
      'conj',
      're',
      'im',
      'arg',
      'transpose',
      'det',
      'identity',
      'zeros',
      'ones',
      'size',
      'isComplex',
      'isFraction',
      'isBigNumber',
      'isNumber',
      'isMatrix',
      'i',
      'pi',
      'e',
      'phi',
      'tau',
    ];
    for (const key of expectedKeys) {
      expect(shims).toHaveProperty(key);
    }
  });
});

describe('variadic arithmetic (regression: silent arg-dropping)', () => {
  // Before the fix, add/subtract/multiply were 2-arg-only and silently
  // dropped the 3rd+ operand (add(1,2,3) === 3). mathjs folds over all args.
  it('add folds over all scalar arguments', () => {
    expect(add(1, 2, 3)).toBe(6);
    expect(add(1, 2, 3, 4)).toBe(10);
  });

  it('multiply folds over all scalar arguments', () => {
    expect(multiply(2, 3, 4)).toBe(24);
    expect(multiply(2, 3, 4, 5)).toBe(120);
  });

  it('subtract folds left-to-right over all arguments', () => {
    expect(subtract(10, 2, 3)).toBe(5);
  });

  it('single argument returns itself', () => {
    expect(add(7)).toBe(7);
    expect(multiply(7)).toBe(7);
  });

  it('two-argument behaviour is unchanged', () => {
    expect(add(1, 2)).toBe(3);
    expect(multiply(3, 4)).toBe(12);
    expect(subtract(10, 4)).toBe(6);
  });

  it('matrix operands still work with the variadic wrapper', () => {
    expect(add([[1, 2], [3, 4]], [[5, 6], [7, 8]])).toEqual([[6, 8], [10, 12]]);
  });
});
