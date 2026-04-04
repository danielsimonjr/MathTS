/**
 * Tests for Tier 4 activated factory functions.
 */
import { describe, it, expect } from 'vitest';
import {
  factory_equal,
  factory_cbrt,
  factory_round,
  factory_xgcd,
  factory_log,
  factory_sum,
  factory_cumsum,
  nthRoots,
  catalan,
  concat,
  inv,
  mapSlices,
  resize,
  subset,
  bernoulli,
  zpk2tf,
  csCounts,
  csSymperm,
  csAmd,
  csSqr,
  lsolve,
  lsolveAll,
  usolve,
  usolveAll,
} from '../src/factories/index.js';

// ---------------------------------------------------------------------------
// Relational
// ---------------------------------------------------------------------------
describe('factory_equal', () => {
  it('equal(2, 2) = true', () => {
    expect(factory_equal(2, 2)).toBe(true);
  });
  it('equal(2, 3) = false', () => {
    expect(factory_equal(2, 3)).toBe(false);
  });
  it('equal(1e-15, 0) = true (within epsilon)', () => {
    expect(factory_equal(1e-15, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------
describe('factory_cbrt', () => {
  it('cbrt(27) = 3', () => {
    expect(factory_cbrt(27)).toBeCloseTo(3);
  });
  it('cbrt(0) = 0', () => {
    expect(factory_cbrt(0)).toBe(0);
  });
  it('cbrt(-8) = -2', () => {
    expect(factory_cbrt(-8)).toBeCloseTo(-2);
  });
});

describe('factory_round', () => {
  it('round(3.7) = 4', () => {
    expect(factory_round(3.7)).toBe(4);
  });
  it('round(3.2) = 3', () => {
    expect(factory_round(3.2)).toBe(3);
  });
  it('round(-0.5) = -1 (rounds half to even/away)', () => {
    expect(factory_round(-0.5)).toBe(-1);
  });
  it('round(3.14159, 2) = 3.14', () => {
    expect(factory_round(3.14159, 2)).toBeCloseTo(3.14);
  });
});

describe('factory_xgcd', () => {
  it('xgcd(36, 24) returns gcd=12 with Bezout coefficients', () => {
    const result = factory_xgcd(36, 24);
    // Result is [gcd, x, y] where gcd = 36*x + 24*y
    expect(result.valueOf()).toEqual([12, 1, -1]);
  });
});

describe('factory_log', () => {
  it('log(1) = 0', () => {
    expect(factory_log(1)).toBeCloseTo(0);
  });
  it('log(e) = 1', () => {
    expect(factory_log(Math.E)).toBeCloseTo(1);
  });
  it('log(100, 10) = 2', () => {
    expect(factory_log(100, 10)).toBeCloseTo(2);
  });
});

describe('nthRoots', () => {
  it('nthRoots(1) returns complex roots', () => {
    const result = nthRoots(1);
    // nthRoots(1) with default root=2 returns sqrt roots
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
describe('factory_sum', () => {
  it('sum(1, 2, 3) = 6', () => {
    expect(factory_sum(1, 2, 3)).toBe(6);
  });
  it('sum([1, 2, 3]) = 6', () => {
    expect(factory_sum([1, 2, 3])).toBe(6);
  });
});

describe('factory_cumsum', () => {
  it('cumsum([1, 2, 3]) = [1, 3, 6]', () => {
    expect(factory_cumsum([1, 2, 3])).toEqual([1, 3, 6]);
  });
  it('cumsum(1, 2, 3) = [1, 3, 6]', () => {
    expect(factory_cumsum(1, 2, 3)).toEqual([1, 3, 6]);
  });
});

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------
describe('concat', () => {
  it('concat([[1], [2]], [[3], [4]]) works', () => {
    const result = concat([[1], [2]], [[3], [4]]);
    expect(result).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
  it('concat([1, 2], [3, 4]) = [1, 2, 3, 4]', () => {
    const result = concat([1, 2], [3, 4]);
    expect(result).toEqual([1, 2, 3, 4]);
  });
});

describe('inv', () => {
  it('inv([[1, 0], [0, 1]]) = identity', () => {
    const result = inv([
      [1, 0],
      [0, 1],
    ]);
    // Result should be identity matrix
    expect(result[0][0]).toBeCloseTo(1);
    expect(result[0][1]).toBeCloseTo(0);
    expect(result[1][0]).toBeCloseTo(0);
    expect(result[1][1]).toBeCloseTo(1);
  });
  it('inv([[2, 0], [0, 2]]) = [[0.5, 0], [0, 0.5]]', () => {
    const result = inv([
      [2, 0],
      [0, 2],
    ]);
    expect(result[0][0]).toBeCloseTo(0.5);
    expect(result[1][1]).toBeCloseTo(0.5);
  });
});

describe('mapSlices', () => {
  it('is a function', () => {
    expect(typeof mapSlices).toBe('function');
  });
});

describe('resize', () => {
  it('resize([1, 2, 3], [5]) pads with zeros', () => {
    const result = resize([1, 2, 3], [5]);
    expect(result).toEqual([1, 2, 3, 0, 0]);
  });
  it('resize([1, 2, 3], [2]) truncates', () => {
    const result = resize([1, 2, 3], [2]);
    expect(result).toEqual([1, 2]);
  });
});

describe('subset', () => {
  it('is a function', () => {
    expect(typeof subset).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Combinatorics
// ---------------------------------------------------------------------------
describe('catalan', () => {
  it('catalan(0) = 1', () => {
    expect(catalan(0)).toBe(1);
  });
  it('catalan(1) = 1', () => {
    expect(catalan(1)).toBe(1);
  });
  it('catalan(4) = 14', () => {
    expect(catalan(4)).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Probability
// ---------------------------------------------------------------------------
describe('bernoulli', () => {
  it('bernoulli(0) = 1', () => {
    expect(bernoulli(0)).toBe(1);
  });
  it('bernoulli(1) = -0.5', () => {
    expect(bernoulli(1)).toBeCloseTo(-0.5);
  });
  it('bernoulli(2) ~= 1/6', () => {
    expect(bernoulli(2)).toBeCloseTo(1 / 6);
  });
});

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------
describe('zpk2tf', () => {
  it('is a function', () => {
    expect(typeof zpk2tf).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Algebra/sparse (existence checks — these are internal building blocks)
// ---------------------------------------------------------------------------
describe('algebra sparse helpers', () => {
  it('csCounts is a function', () => {
    expect(typeof csCounts).toBe('function');
  });
  it('csSymperm is a function', () => {
    expect(typeof csSymperm).toBe('function');
  });
  it('csAmd is a function', () => {
    expect(typeof csAmd).toBe('function');
  });
  it('csSqr is a function', () => {
    expect(typeof csSqr).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Algebra/solver (existence checks)
// ---------------------------------------------------------------------------
describe('algebra solvers', () => {
  it('lsolve is a function', () => {
    expect(typeof lsolve).toBe('function');
  });
  it('lsolveAll is a function', () => {
    expect(typeof lsolveAll).toBe('function');
  });
  it('usolve is a function', () => {
    expect(typeof usolve).toBe('function');
  });
  it('usolveAll is a function', () => {
    expect(typeof usolveAll).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Tier 5+ factory tests
// ---------------------------------------------------------------------------
import {
  factory_compare,
  factory_larger,
  factory_smaller,
  factory_gcd,
  factory_lcm,
  factory_mod,
  factory_pow,
  factory_ceil,
  factory_floor,
  factory_nthRoot,
  dotDivide,
  dotMultiply,
  bitAnd,
  bitOr,
  bitXor,
  leftShift,
  deepEqual,
  unequal,
  compareNatural,
  factory_fix,
  factory_max,
  factory_min,
  factory_hypot,
  gamma,
  factorial,
  qr,
  range,
  partitionSelect,
  bellNumbers,
  stirlingS2,
  permutations,
  composition,
  sort,
} from '../src/factories/index.js';

describe('Tier 5 - relational', () => {
  it('compare(1, 2) = -1', () => expect(factory_compare(1, 2)).toBe(-1));
  it('larger(3, 2) = true', () => expect(factory_larger(3, 2)).toBe(true));
  it('smaller(1, 2) = true', () => expect(factory_smaller(1, 2)).toBe(true));
  it('deepEqual([1,2], [1,2]) = true', () => expect(deepEqual([1, 2], [1, 2])).toBe(true));
  it('unequal(1, 2) = true', () => expect(unequal(1, 2)).toBe(true));
});

describe('Tier 5 - arithmetic', () => {
  it('gcd(12, 8) = 4', () => expect(factory_gcd(12, 8)).toBe(4));
  it('lcm(4, 6) = 12', () => expect(factory_lcm(4, 6)).toBe(12));
  it('mod(7, 3) = 1', () => expect(factory_mod(7, 3)).toBe(1));
  it('pow(2, 10) = 1024', () => expect(factory_pow(2, 10)).toBe(1024));
  it('ceil(4.1) = 5', () => expect(factory_ceil(4.1)).toBe(5));
  it('floor(4.9) = 4', () => expect(factory_floor(4.9)).toBe(4));
  it('nthRoot(27, 3) = 3', () => expect(factory_nthRoot(27, 3)).toBe(3));
  it('dotDivide([6, 9], [2, 3]) = [3, 3]', () =>
    expect(dotDivide([6, 9], [2, 3])).toEqual([3, 3]));
  it('dotMultiply([2, 3], [4, 5]) = [8, 15]', () =>
    expect(dotMultiply([2, 3], [4, 5])).toEqual([8, 15]));
});

describe('Tier 5 - bitwise', () => {
  it('bitAnd(5, 3) = 1', () => expect(bitAnd(5, 3)).toBe(1));
  it('bitOr(5, 3) = 7', () => expect(bitOr(5, 3)).toBe(7));
  it('bitXor(5, 3) = 6', () => expect(bitXor(5, 3)).toBe(6));
  it('leftShift(1, 3) = 8', () => expect(leftShift(1, 3)).toBe(8));
});

describe('Tier 6 - statistics & probability', () => {
  it('max(1, 2, 3) = 3', () => expect(factory_max(1, 2, 3)).toBe(3));
  it('min(1, 2, 3) = 1', () => expect(factory_min(1, 2, 3)).toBe(1));
  it('gamma(5) = 24', () => expect(gamma(5)).toBe(24));
  it('hypot(3, 4) = 5', () => expect(factory_hypot(3, 4)).toBeCloseTo(5));
  it('fix(4.7) = 4', () => expect(factory_fix(4.7)).toBe(4));
  it('fix(-4.7) = -4', () => expect(factory_fix(-4.7)).toBe(-4));
  it('compareNatural is a function', () => expect(typeof compareNatural).toBe('function'));
});

describe('Tier 6 - matrix', () => {
  it('range(1, 5) returns [1,2,3,4]', () => {
    const r = range(1, 5);
    // range returns a matrix; convert to array
    const arr = r.valueOf ? r.valueOf() : r;
    expect(arr).toEqual([1, 2, 3, 4]);
  });
  it('partitionSelect is a function', () => expect(typeof partitionSelect).toBe('function'));
  it('qr is a function', () => expect(typeof qr).toBe('function'));
});

describe('Tier 7-9 - combinatorics & probability', () => {
  it('factorial(5) = 120', () => expect(factorial(5)).toBe(120));
  it('factorial(0) = 1', () => expect(factorial(0)).toBe(1));
  it('permutations(5, 2) = 20', () => expect(permutations(5, 2)).toBe(20));
  it('stirlingS2(5, 2) = 15', () => expect(stirlingS2(5, 2)).toBe(15));
  it('bellNumbers(4) = 15', () => expect(bellNumbers(4)).toBe(15));
  it('composition(5, 3) = 6', () => expect(composition(5, 3)).toBe(6));
  it('sort([3, 1, 2]) = [1, 2, 3]', () => expect(sort([3, 1, 2])).toEqual([1, 2, 3]));
});

// ---------------------------------------------------------------------------
// Total count validation
// ---------------------------------------------------------------------------
describe('factory activation count', () => {
  it('has activated at least 170 factories', async () => {
    const mod = await import('../src/factories/index.js');
    const exportCount = Object.keys(mod).length;
    // 99 original + 24 tier4 + 29 tier5 + 17 tier6 + 3 tier7 + 2 tier8 + 1 tier9 = 175
    expect(exportCount).toBeGreaterThanOrEqual(170);
  });
});
