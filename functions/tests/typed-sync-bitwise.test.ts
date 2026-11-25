/**
 * The typed bitwise Int32Array signatures are synchronous.
 *
 * Each op returns a new Int32Array, never a Promise. A length mismatch throws RangeError.
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
} from '../src/index.js';

type B32 = (a: Int32Array, b: Int32Array) => unknown;

function same(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`index ${i}: got ${actual[i]}, expected ${expected[i]}`);
    }
  }
}

const I32_A = Int32Array.of(0, -1, 5, -8, 0x7fffffff, -0x80000000, 12345, -7);
const I32_B = Int32Array.of(3, 1, 2, 31, 1, 4, 33, 0);

const BITWISE: Array<[string, B32, (x: number, y: number) => number]> = [
  ['bitAnd', bitAnd as B32, (x, y) => x & y],
  ['bitOr', bitOr as B32, (x, y) => x | y],
  ['bitXor', bitXor as B32, (x, y) => x ^ y],
  ['leftShift', leftShift as B32, (x, y) => x << y],
  ['rightArithShift', rightArithShift as B32, (x, y) => x >> y],
  ['rightLogShift', rightLogShift as B32, (x, y) => (x >>> y) | 0],
];

describe.each(BITWISE)('%s(Int32Array, Int32Array) is synchronous', (name, f, js) => {
  it('returns a fresh Int32Array equal to the JS operator', () => {
    const a = I32_A.slice();
    const b = I32_B.slice();
    const out = f(a, b);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBeInstanceOf(Int32Array);
    expect(out).not.toBe(a);
    same(
      out as Int32Array,
      Int32Array.from(I32_A, (x, i) => js(x, I32_B[i]))
    );
    same(a, I32_A);
    same(b, I32_B);
  });

  it('throws RangeError on a length mismatch, both ways', () => {
    expect(() => f(Int32Array.of(1, 2, 3), Int32Array.of(1, 2))).toThrow(
      new RangeError('Dimension mismatch (3 != 2) in element-wise operation')
    );
    expect(() => f(Int32Array.of(1), Int32Array.of(1, 2))).toThrow(RangeError);
    expect(name.length).toBeGreaterThan(0);
  });

  it('returns an empty array for empty inputs', () => {
    const out = f(new Int32Array(0), new Int32Array(0));
    expect((out as Int32Array).length).toBe(0);
  });
});

describe('bitwise: shift direction and bitNot', () => {
  it('leftShift(1, 3) is 8 and rightArithShift(-16, 2) is -4 (a swapped direction fails)', () => {
    same(leftShift(Int32Array.of(1), Int32Array.of(3)) as Int32Array, [8]);
    same(rightArithShift(Int32Array.of(-16), Int32Array.of(2)) as Int32Array, [-4]);
    same(rightLogShift(Int32Array.of(-16), Int32Array.of(28)) as Int32Array, [15]);
  });

  it('bitNot returns a fresh Int32Array of ~x', () => {
    const a = I32_A.slice();
    const out = bitNot(a);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).not.toBe(a);
    same(
      out as Int32Array,
      Int32Array.from(I32_A, (x) => ~x)
    );
    same(a, I32_A);
  });
});
