/**
 * Tests for parallel-first typed bitwise functions.
 *
 * Covers four shapes for each binary op:
 *   - scalar `number, number`
 *   - scalar `bigint, bigint`
 *   - `Int32Array, Int32Array` (must `await` — dispatches through
 *     `ComputePool` and exercises the new ops added to `parallel`)
 *   - variadic `number, number, ...number`
 *
 * Plus the unary `bitNot` over each scalar type and `Int32Array`,
 * and the `BigNumber, BigNumber` path for every op.
 *
 * Edge cases: zero, negative two's-complement, shift counts ≥ 32 (JS
 * coerces mod 32 for `number` shifts on 32-bit integers).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
  typedBitwise,
} from '../src/typed/bitwise.js';

// -----------------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------------

/** Build an Int32Array of length 16 with both signs and a couple of edge values. */
function buildIntPair(): { a: Int32Array; b: Int32Array } {
  const a = Int32Array.from([
    0,  1,  2,  3,  4,  5,  6,  7,
    -1, -2, -3, -4,  0xffff,  0x7fffffff,  -0x80000000,  0b10101010,
  ]);
  const b = Int32Array.from([
    0,  1, -1,  2, -2,  3, -3,  4,
    -4,  5, -5,  6,  0xff00,  0x00000001,   1,            0b01010101,
  ]);
  return { a, b };
}

/** Apply a scalar op element-wise to two Int32Arrays — the test oracle. */
function elementwise(
  a: Int32Array,
  b: Int32Array,
  op: (x: number, y: number) => number
): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = op(a[i], b[i]);
  return out;
}

describe('Typed Bitwise Functions', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });

  afterAll(async () => {
    await computePool.terminate();
  });

  // ---------------------------------------------------------------------------
  // Scalar number tests (truth-table values)
  // ---------------------------------------------------------------------------

  describe('Scalar number truth tables', () => {
    it('bitAnd matches known values', () => {
      expect(bitAnd(0b1010, 0b1100)).toBe(0b1000);
      expect(bitAnd(53, 131)).toBe(1);
      expect(bitAnd(0, 0xff)).toBe(0);
      expect(bitAnd(-1, 5)).toBe(5); // -1 is all ones
    });

    it('bitOr matches known values', () => {
      expect(bitOr(0b1010, 0b0101)).toBe(0b1111);
      expect(bitOr(0, 0xff)).toBe(0xff);
      expect(bitOr(0xf0, 0x0f)).toBe(0xff);
      expect(bitOr(-1, 5)).toBe(-1);
    });

    it('bitXor matches known values', () => {
      expect(bitXor(0b1010, 0b1100)).toBe(0b0110);
      expect(bitXor(0xff, 0xff)).toBe(0);
      expect(bitXor(0xff, 0)).toBe(0xff);
      // negative XOR negative -> positive: -1 ^ -1 === 0
      expect(bitXor(-1, -1)).toBe(0);
    });

    it('bitNot matches known values', () => {
      expect(bitNot(0)).toBe(-1);
      expect(bitNot(-1)).toBe(0);
      expect(bitNot(1)).toBe(-2);
      expect(bitNot(0x7fffffff)).toBe(-0x80000000);
    });

    it('leftShift matches known values', () => {
      expect(leftShift(1, 4)).toBe(16);
      expect(leftShift(3, 2)).toBe(12);
      expect(leftShift(0, 5)).toBe(0);
      expect(leftShift(-1, 1)).toBe(-2);
    });

    it('rightArithShift matches known values', () => {
      expect(rightArithShift(16, 2)).toBe(4);
      // sign-preserving: -8 >> 1 === -4
      expect(rightArithShift(-8, 1)).toBe(-4);
      expect(rightArithShift(-1, 5)).toBe(-1); // stays all-ones
    });

    it('rightLogShift matches known values', () => {
      expect(rightLogShift(16, 2)).toBe(4);
      // zero-filling: -1 >>> 1 === 0x7fffffff
      expect(rightLogShift(-1, 1)).toBe(0x7fffffff);
      expect(rightLogShift(-2, 1)).toBe(0x7fffffff);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases on number scalar inputs
  // ---------------------------------------------------------------------------

  describe('Number edge cases', () => {
    it('rejects non-integer inputs for bitAnd', () => {
      expect(() => bitAnd(1.5, 2)).toThrow(/Integers expected/);
    });

    it('rejects non-integer inputs for bitNot', () => {
      expect(() => bitNot(1.5)).toThrow(/Integer expected/);
    });

    it('shift counts >= 32 fold mod 32 (JS semantics)', () => {
      // JS coerces shift counts to bits[0..4] -> 32 % 32 === 0, so this is a
      // no-op shift; the result is the value itself.
      expect(leftShift(1, 32)).toBe(1);
      expect(leftShift(1, 33)).toBe(2);
      // rightArithShift uses the same mask.
      expect(rightArithShift(-4, 32)).toBe(-4);
      expect(rightLogShift(0xff, 32)).toBe(0xff);
    });

    it('handles two\'s-complement boundaries', () => {
      expect(bitNot(0x7fffffff)).toBe(-0x80000000);
      expect(bitAnd(-0x80000000, -1)).toBe(-0x80000000);
      expect(bitOr(-0x80000000, 0x7fffffff)).toBe(-1);
    });
  });

  // ---------------------------------------------------------------------------
  // Variadic number forms
  // ---------------------------------------------------------------------------

  describe('Variadic number forms', () => {
    it('bitAnd reduces from the left', () => {
      // 0b1111 & 0b1100 & 0b1010 === 0b1000
      expect(bitAnd(0b1111, 0b1100, 0b1010)).toBe(0b1000);
      expect(bitAnd(0xff, 0x0f, 0x07, 0x03)).toBe(0x03);
    });

    it('bitOr reduces from the left', () => {
      expect(bitOr(1, 2, 4, 8)).toBe(15);
      expect(bitOr(0, 0, 0, 0)).toBe(0);
    });

    it('bitXor reduces from the left', () => {
      // 0b1010 ^ 0b0101 ^ 0b1111 === 0b0000
      expect(bitXor(0b1010, 0b0101, 0b1111)).toBe(0);
      // 1 ^ 1 ^ 1 === 1 (odd count of 1s)
      expect(bitXor(1, 1, 1)).toBe(1);
    });

    it('leftShift chains shifts', () => {
      // ((1 << 2) << 3) === 32
      expect(leftShift(1, 2, 3)).toBe(32);
    });

    it('rightArithShift chains shifts', () => {
      // ((32 >> 1) >> 2) === 4
      expect(rightArithShift(32, 1, 2)).toBe(4);
    });

    it('rightLogShift chains shifts', () => {
      expect(rightLogShift(0xff, 1, 1)).toBe(0xff >>> 1 >>> 1);
    });
  });

  // ---------------------------------------------------------------------------
  // bigint tests
  // ---------------------------------------------------------------------------

  describe('bigint scalar', () => {
    it('bitAnd', () => {
      expect(bitAnd(0b1010n, 0b1100n)).toBe(0b1000n);
      expect(bitAnd(53n, 131n)).toBe(1n);
      // bigint -1n is conceptually all-ones
      expect(bitAnd(-1n, 42n)).toBe(42n);
    });

    it('bitOr', () => {
      expect(bitOr(0b1010n, 0b0101n)).toBe(0b1111n);
      expect(bitOr(0n, 0xffn)).toBe(0xffn);
    });

    it('bitXor', () => {
      expect(bitXor(0b1010n, 0b1100n)).toBe(0b0110n);
      expect(bitXor(0xffn, 0xffn)).toBe(0n);
    });

    it('bitNot', () => {
      expect(bitNot(0n)).toBe(-1n);
      expect(bitNot(-1n)).toBe(0n);
      expect(bitNot(1n)).toBe(-2n);
    });

    it('leftShift', () => {
      expect(leftShift(1n, 4n)).toBe(16n);
      // bigint shifts do NOT wrap mod 32 — wide shifts produce wide integers
      expect(leftShift(1n, 40n)).toBe(1n << 40n);
    });

    it('rightArithShift', () => {
      expect(rightArithShift(16n, 2n)).toBe(4n);
      expect(rightArithShift(-8n, 1n)).toBe(-4n);
    });

    it('rightLogShift on bigint masks to 32 bits before shifting', () => {
      // -1n is all-ones — masking to 32 bits yields 0xffffffffn,
      // then >> 1 yields 0x7fffffffn (positive).
      expect(rightLogShift(-1n, 1n)).toBe(0x7fffffffn);
      expect(rightLogShift(0xffn, 4n)).toBe(0x0fn);
    });

    it('rightLogShift rejects negative shift counts', () => {
      expect(() => rightLogShift(1n, -1n)).toThrow(/Negative shift/);
    });
  });

  // ---------------------------------------------------------------------------
  // BigNumber tests (the dispatch path our reimplemented BigNumber helper
  // is responsible for)
  // ---------------------------------------------------------------------------

  describe('BigNumber scalar', () => {
    const bn = (n: number | string): BigNumber =>
      typeof n === 'number' ? BigNumber.fromNumber(n) : BigNumber.parse(n);

    it('bitAnd of two integer BigNumbers', () => {
      const result = bitAnd(bn(0b1010), bn(0b1100)) as BigNumber;
      expect(result.valueOf()).toBe(0b1000);
    });

    it('bitOr of two integer BigNumbers', () => {
      const result = bitOr(bn(0b1010), bn(0b0101)) as BigNumber;
      expect(result.valueOf()).toBe(0b1111);
    });

    it('bitXor of two integer BigNumbers', () => {
      const result = bitXor(bn(0b1010), bn(0b1100)) as BigNumber;
      expect(result.valueOf()).toBe(0b0110);
    });

    it('bitNot of a BigNumber', () => {
      const result = bitNot(bn(0)) as BigNumber;
      expect(result.valueOf()).toBe(-1);
    });

    it('leftShift of a BigNumber', () => {
      const result = leftShift(bn(1), bn(4)) as BigNumber;
      expect(result.valueOf()).toBe(16);
    });

    it('rightArithShift of a BigNumber', () => {
      const result = rightArithShift(bn(16), bn(2)) as BigNumber;
      expect(result.valueOf()).toBe(4);
    });

    it('rightLogShift of a BigNumber', () => {
      // -1 masked to 32 bits then >> 1 === 0x7fffffff
      const result = rightLogShift(bn(-1), bn(1)) as BigNumber;
      expect(result.valueOf()).toBe(0x7fffffff);
    });

    it('rejects non-integer BigNumbers', () => {
      expect(() => bitAnd(bn('1.5'), bn(2))).toThrow(/Integers expected/);
    });
  });

  // ---------------------------------------------------------------------------
  // Int32Array tests (dispatch through ComputePool)
  // ---------------------------------------------------------------------------

  describe('Int32Array (parallel dispatch)', () => {
    it('bitAnd produces element-wise AND', async () => {
      const { a, b } = buildIntPair();
      const result = await (bitAnd(a, b) as Promise<Int32Array>);
      const expected = elementwise(a, b, (x, y) => x & y);
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('bitOr produces element-wise OR', async () => {
      const { a, b } = buildIntPair();
      const result = await (bitOr(a, b) as Promise<Int32Array>);
      const expected = elementwise(a, b, (x, y) => x | y);
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('bitXor produces element-wise XOR', async () => {
      const { a, b } = buildIntPair();
      const result = await (bitXor(a, b) as Promise<Int32Array>);
      const expected = elementwise(a, b, (x, y) => x ^ y);
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('bitNot produces element-wise NOT', async () => {
      const { a } = buildIntPair();
      const result = await (bitNot(a) as Promise<Int32Array>);
      const expected = new Int32Array(a.length);
      for (let i = 0; i < a.length; i++) expected[i] = ~a[i];
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('leftShift produces element-wise <<', async () => {
      const { a, b } = buildIntPair();
      const result = await (leftShift(a, b) as Promise<Int32Array>);
      const expected = elementwise(a, b, (x, y) => x << y);
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('rightArithShift produces element-wise >>', async () => {
      const { a, b } = buildIntPair();
      const result = await (rightArithShift(a, b) as Promise<Int32Array>);
      const expected = elementwise(a, b, (x, y) => x >> y);
      expect(Array.from(result)).toEqual(Array.from(expected));
    });

    it('rightLogShift produces element-wise >>>', async () => {
      const { a, b } = buildIntPair();
      const result = await (rightLogShift(a, b) as Promise<Int32Array>);
      // Note: oracle uses `x >>> y` then Int32Array assignment, which is
      // what the implementation does.
      const expected = new Int32Array(a.length);
      for (let i = 0; i < a.length; i++) expected[i] = a[i] >>> b[i];
      expect(Array.from(result)).toEqual(Array.from(expected));
    });
  });

  // ---------------------------------------------------------------------------
  // Barrel
  // ---------------------------------------------------------------------------

  describe('Barrel export', () => {
    it('typedBitwise contains every op', () => {
      expect(typedBitwise.bitAnd).toBe(bitAnd);
      expect(typedBitwise.bitOr).toBe(bitOr);
      expect(typedBitwise.bitXor).toBe(bitXor);
      expect(typedBitwise.bitNot).toBe(bitNot);
      expect(typedBitwise.leftShift).toBe(leftShift);
      expect(typedBitwise.rightArithShift).toBe(rightArithShift);
      expect(typedBitwise.rightLogShift).toBe(rightLogShift);
    });
  });
});
