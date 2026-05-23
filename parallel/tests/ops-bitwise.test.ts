/**
 * Direct unit tests for parallel/src/ops/bitwise.ts
 *
 * These tests import the in-process op functions directly so the CDG
 * coverage report counts the source file as tested. No ComputePool or
 * worker-pool primitives are used — these are pure function tests.
 */

import { describe, it, expect } from 'vitest';
import {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
} from '../src/ops/bitwise.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clone an Int32Array so we can detect mutations later. */
function clone(a: Int32Array): Int32Array {
  return new Int32Array(a);
}

/** Build an oracle for a binary op applied element-wise. */
function oracle(a: Int32Array, b: Int32Array, fn: (x: number, y: number) => number): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = fn(a[i], b[i]);
  return out;
}

/** Build an oracle for a binary op with a scalar right-hand side. */
function oracleScalar(a: Int32Array, b: number, fn: (x: number, y: number) => number): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = fn(a[i], b);
  return out;
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const SMALL_A = Int32Array.from([0b1010, 0b1100, 0b1111, 0b0001, -1, 0, 7, -42]);
const SMALL_B = Int32Array.from([0b0110, 0b1010, 0b0101, 0b1110, 2, -1, 3, 17]);

const NEG_A = Int32Array.from([-7, -1, -128, -2147483648]);
const NEG_B = Int32Array.from([3, -1, 7, 1]);

const BOUNDARY_A = Int32Array.from([0, -1, 0x7fffffff, -2147483648]);
const BOUNDARY_B = Int32Array.from([0, -1, 0x7fffffff, -2147483648]);

// SHIFT_AMOUNTS must match SMALL_A.length (8 elements)
const SHIFT_AMOUNTS = Int32Array.from([0, 1, 2, 3, 4, 5, 15, 31]);

// ---------------------------------------------------------------------------
// describe: bitAnd
// ---------------------------------------------------------------------------

describe('bitAnd', () => {
  it('returns Int32Array', () => {
    expect(bitAnd(SMALL_A, SMALL_B)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle on small arrays', () => {
    const result = bitAnd(SMALL_A, SMALL_B);
    expect(result).toEqual(oracle(SMALL_A, SMALL_B, (a, b) => a & b));
  });

  it('handles negative numbers (two\'s complement)', () => {
    const result = bitAnd(NEG_A, NEG_B);
    expect(result).toEqual(oracle(NEG_A, NEG_B, (a, b) => a & b));
  });

  it('handles boundary values (0, -1, MAX_INT, MIN_INT)', () => {
    const result = bitAnd(BOUNDARY_A, BOUNDARY_B);
    expect(result).toEqual(oracle(BOUNDARY_A, BOUNDARY_B, (a, b) => a & b));
  });

  it('handles empty array', () => {
    const result = bitAnd(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SMALL_B);
    const origA = clone(a);
    const origB = clone(b);
    bitAnd(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('throws on mismatched lengths', () => {
    expect(() => bitAnd(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// describe: bitOr
// ---------------------------------------------------------------------------

describe('bitOr', () => {
  it('returns Int32Array', () => {
    expect(bitOr(SMALL_A, SMALL_B)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle on small arrays', () => {
    const result = bitOr(SMALL_A, SMALL_B);
    expect(result).toEqual(oracle(SMALL_A, SMALL_B, (a, b) => a | b));
  });

  it('handles negative numbers', () => {
    const result = bitOr(NEG_A, NEG_B);
    expect(result).toEqual(oracle(NEG_A, NEG_B, (a, b) => a | b));
  });

  it('handles boundary values', () => {
    const result = bitOr(BOUNDARY_A, BOUNDARY_B);
    expect(result).toEqual(oracle(BOUNDARY_A, BOUNDARY_B, (a, b) => a | b));
  });

  it('handles empty array', () => {
    const result = bitOr(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SMALL_B);
    const origA = clone(a);
    const origB = clone(b);
    bitOr(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('throws on mismatched lengths', () => {
    expect(() => bitOr(Int32Array.from([1, 2]), Int32Array.from([1]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// describe: bitXor
// ---------------------------------------------------------------------------

describe('bitXor', () => {
  it('returns Int32Array', () => {
    expect(bitXor(SMALL_A, SMALL_B)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle on small arrays', () => {
    const result = bitXor(SMALL_A, SMALL_B);
    expect(result).toEqual(oracle(SMALL_A, SMALL_B, (a, b) => a ^ b));
  });

  it('handles negative numbers', () => {
    const result = bitXor(NEG_A, NEG_B);
    expect(result).toEqual(oracle(NEG_A, NEG_B, (a, b) => a ^ b));
  });

  it('handles boundary values', () => {
    const result = bitXor(BOUNDARY_A, BOUNDARY_B);
    expect(result).toEqual(oracle(BOUNDARY_A, BOUNDARY_B, (a, b) => a ^ b));
  });

  it('handles empty array', () => {
    const result = bitXor(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SMALL_B);
    const origA = clone(a);
    const origB = clone(b);
    bitXor(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('throws on mismatched lengths', () => {
    expect(() => bitXor(Int32Array.from([1, 2, 3, 4]), Int32Array.from([1, 2, 3]))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// describe: bitNot
// ---------------------------------------------------------------------------

describe('bitNot', () => {
  it('returns Int32Array', () => {
    expect(bitNot(SMALL_A)).toBeInstanceOf(Int32Array);
  });

  it('applies ~ to each element', () => {
    const input = Int32Array.from([0, 1, -1, 7, -42, 0x7fffffff, -2147483648]);
    const result = bitNot(input);
    const expected = new Int32Array(input.length);
    for (let i = 0; i < input.length; i++) expected[i] = ~input[i];
    expect(result).toEqual(expected);
  });

  it('handles boundary values', () => {
    const input = Int32Array.from([0, -1, 0x7fffffff, -2147483648]);
    const result = bitNot(input);
    expect(result).toEqual(Int32Array.from([-1, 0, -2147483648, 0x7fffffff]));
  });

  it('handles empty array', () => {
    const result = bitNot(new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate input', () => {
    const a = Int32Array.from([1, 2, 3, 4, 5]);
    const origA = clone(a);
    bitNot(a);
    expect(a).toEqual(origA);
  });

  it('~0 is -1 and ~~0 is 0 (double application)', () => {
    const input = Int32Array.from([0, 0x7fffffff, -1]);
    expect(bitNot(bitNot(input))).toEqual(input);
  });
});

// ---------------------------------------------------------------------------
// describe: leftShift
// ---------------------------------------------------------------------------

describe('leftShift', () => {
  it('returns Int32Array (array shift counts)', () => {
    expect(leftShift(SMALL_A, SHIFT_AMOUNTS)).toBeInstanceOf(Int32Array);
  });

  it('returns Int32Array (scalar shift count)', () => {
    expect(leftShift(SMALL_A, 2)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle with Int32Array shift counts', () => {
    const result = leftShift(SMALL_A, SHIFT_AMOUNTS);
    expect(result).toEqual(oracle(SMALL_A, SHIFT_AMOUNTS, (a, b) => (a << b) | 0));
  });

  it('matches JS oracle with scalar shift count', () => {
    const result = leftShift(SMALL_A, 3);
    expect(result).toEqual(oracleScalar(SMALL_A, 3, (a, b) => (a << b) | 0));
  });

  it('handles negative values', () => {
    const result = leftShift(NEG_A, NEG_B);
    expect(result).toEqual(oracle(NEG_A, NEG_B, (a, b) => (a << b) | 0));
  });

  it('shift count >= 32 is masked to low 5 bits (array)', () => {
    const a = Int32Array.from([1, 1, 1, 1]);
    const b = Int32Array.from([32, 33, 64, 65]);
    const result = leftShift(a, b);
    // JS masks to 5 bits: 32%32=0, 33%32=1, 64%32=0, 65%32=1
    expect(result).toEqual(oracle(a, b, (x, s) => (x << s) | 0));
  });

  it('shift count >= 32 is masked to low 5 bits (scalar)', () => {
    const a = Int32Array.from([1, 2, 3, 4]);
    const result = leftShift(a, 32);
    // 32 & 31 = 0 — equivalent to shift by 0
    expect(result).toEqual(oracleScalar(a, 32, (x, s) => (x << s) | 0));
  });

  it('handles empty array (array path)', () => {
    const result = leftShift(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('handles empty array (scalar path)', () => {
    const result = leftShift(new Int32Array(0), 1);
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs (array path)', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SHIFT_AMOUNTS);
    const origA = clone(a);
    const origB = clone(b);
    leftShift(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('does not mutate input (scalar path)', () => {
    const a = Int32Array.from(SMALL_A);
    const origA = clone(a);
    leftShift(a, 2);
    expect(a).toEqual(origA);
  });

  it('throws on mismatched lengths (array path)', () => {
    expect(() =>
      leftShift(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// describe: rightArithShift
// ---------------------------------------------------------------------------

describe('rightArithShift', () => {
  it('returns Int32Array (array shift counts)', () => {
    expect(rightArithShift(SMALL_A, SHIFT_AMOUNTS)).toBeInstanceOf(Int32Array);
  });

  it('returns Int32Array (scalar shift count)', () => {
    expect(rightArithShift(SMALL_A, 2)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle with Int32Array shift counts', () => {
    const result = rightArithShift(SMALL_A, SHIFT_AMOUNTS);
    expect(result).toEqual(oracle(SMALL_A, SHIFT_AMOUNTS, (a, b) => a >> b));
  });

  it('matches JS oracle with scalar shift count', () => {
    const result = rightArithShift(SMALL_A, 2);
    expect(result).toEqual(oracleScalar(SMALL_A, 2, (a, b) => a >> b));
  });

  it('preserves sign for negative values', () => {
    const a = Int32Array.from([-8, -2147483648, -1]);
    const result = rightArithShift(a, 1);
    expect(result).toEqual(Int32Array.from([-4, -1073741824, -1]));
  });

  it('shift count >= 32 is masked to low 5 bits (array)', () => {
    const a = Int32Array.from([-1, -1, -1, -1]);
    const b = Int32Array.from([32, 33, 64, 65]);
    const result = rightArithShift(a, b);
    expect(result).toEqual(oracle(a, b, (x, s) => x >> s));
  });

  it('shift count >= 32 is masked to low 5 bits (scalar)', () => {
    const a = Int32Array.from([-1, -2, -3, -4]);
    const result = rightArithShift(a, 32);
    expect(result).toEqual(oracleScalar(a, 32, (x, s) => x >> s));
  });

  it('handles empty array (array path)', () => {
    const result = rightArithShift(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('handles empty array (scalar path)', () => {
    const result = rightArithShift(new Int32Array(0), 1);
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs (array path)', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SHIFT_AMOUNTS);
    const origA = clone(a);
    const origB = clone(b);
    rightArithShift(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('does not mutate input (scalar path)', () => {
    const a = Int32Array.from(SMALL_A);
    const origA = clone(a);
    rightArithShift(a, 1);
    expect(a).toEqual(origA);
  });

  it('throws on mismatched lengths', () => {
    expect(() =>
      rightArithShift(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// describe: rightLogShift
// ---------------------------------------------------------------------------

describe('rightLogShift', () => {
  it('returns Int32Array (array shift counts)', () => {
    expect(rightLogShift(SMALL_A, SHIFT_AMOUNTS)).toBeInstanceOf(Int32Array);
  });

  it('returns Int32Array (scalar shift count)', () => {
    expect(rightLogShift(SMALL_A, 2)).toBeInstanceOf(Int32Array);
  });

  it('matches JS oracle with Int32Array shift counts', () => {
    const result = rightLogShift(SMALL_A, SHIFT_AMOUNTS);
    // >>> produces Uint32; Int32Array assignment wraps into signed range
    expect(result).toEqual(oracle(SMALL_A, SHIFT_AMOUNTS, (a, b) => (a >>> b) | 0));
  });

  it('matches JS oracle with scalar shift count', () => {
    const result = rightLogShift(SMALL_A, 1);
    expect(result).toEqual(oracleScalar(SMALL_A, 1, (a, b) => (a >>> b) | 0));
  });

  it('fills with zeros for negative values (unlike >>) (array)', () => {
    const a = Int32Array.from([-1, -2, -2147483648]);
    const b = Int32Array.from([1, 1, 1]);
    const result = rightLogShift(a, b);
    // -1 >>> 1 = 2147483647 as uint, stored as 0x7FFFFFFF = 2147483647 in Int32Array
    // -2 >>> 1 = 2147483647 as uint, stored as 0x7FFFFFFF = 2147483647
    // -2147483648 >>> 1 = 1073741824
    expect(result).toEqual(Int32Array.from([0x7fffffff, 0x7fffffff, 0x40000000]));
  });

  it('fills with zeros for negative values (scalar)', () => {
    const a = Int32Array.from([-1, -2, -2147483648]);
    const result = rightLogShift(a, 1);
    expect(result).toEqual(Int32Array.from([0x7fffffff, 0x7fffffff, 0x40000000]));
  });

  it('shift count >= 32 is masked to low 5 bits (array)', () => {
    const a = Int32Array.from([-1, -1, -1, -1]);
    const b = Int32Array.from([32, 33, 64, 65]);
    const result = rightLogShift(a, b);
    expect(result).toEqual(oracle(a, b, (x, s) => (x >>> s) | 0));
  });

  it('shift count >= 32 is masked to low 5 bits (scalar)', () => {
    const a = Int32Array.from([8, 16, 32, 64]);
    const result = rightLogShift(a, 33);
    expect(result).toEqual(oracleScalar(a, 33, (x, s) => (x >>> s) | 0));
  });

  it('handles empty array (array path)', () => {
    const result = rightLogShift(new Int32Array(0), new Int32Array(0));
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('handles empty array (scalar path)', () => {
    const result = rightLogShift(new Int32Array(0), 2);
    expect(result).toBeInstanceOf(Int32Array);
    expect(result.length).toBe(0);
  });

  it('does not mutate inputs (array path)', () => {
    const a = Int32Array.from(SMALL_A);
    const b = Int32Array.from(SHIFT_AMOUNTS);
    const origA = clone(a);
    const origB = clone(b);
    rightLogShift(a, b);
    expect(a).toEqual(origA);
    expect(b).toEqual(origB);
  });

  it('does not mutate input (scalar path)', () => {
    const a = Int32Array.from(SMALL_A);
    const origA = clone(a);
    rightLogShift(a, 3);
    expect(a).toEqual(origA);
  });

  it('throws on mismatched lengths', () => {
    expect(() =>
      rightLogShift(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2]))
    ).toThrow();
  });
});
