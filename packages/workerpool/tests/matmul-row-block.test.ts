import { describe, it, expect } from 'vitest';
import { matmulRowBlock, matmulSequential } from '../src/matmul-sequential.js';

/** The plain triple loop: the order of every sum is k = 0 .. aCols - 1. */
function triple(a: Float64Array, aRows: number, aCols: number, b: Float64Array, bCols: number) {
  const out = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) sum += a[i * aCols + k] * b[k * bCols + j];
      out[i * bCols + j] = sum;
    }
  }
  return out;
}

function fill(n: number, seed: number): Float64Array {
  const x = new Float64Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    x[i] = (s / 4294967296 - 0.5) * 1e3;
  }
  return x;
}

function expectBitEqual(got: Float64Array, want: Float64Array): void {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    if (!Object.is(got[i], want[i])) {
      throw new Error(`element ${i}: got ${got[i]}, want ${want[i]}`);
    }
  }
}

describe('matmulRowBlock', () => {
  const shapes: Array<[number, number, number]> = [
    [1, 1, 1],
    [3, 5, 4],
    [4, 3, 5],
    [7, 7, 7],
    [16, 33, 17],
    [2, 1, 9],
    [9, 1, 2],
  ];

  it.each(shapes)('matches the plain triple loop bit for bit on %i x %i x %i', (m, k, n) => {
    const a = fill(m * k, 11);
    const b = fill(k * n, 23);
    expectBitEqual(matmulSequential(a, m, k, b, n), triple(a, m, k, b, n));
  });

  it('keeps NaN, infinities and signed zero where the plain loop puts them', () => {
    const a = Float64Array.of(1, -0, Infinity, 2, NaN, 3);
    const b = Float64Array.of(0, -0, 1, Infinity, -Infinity, 2);
    expectBitEqual(matmulSequential(a, 2, 3, b, 2), triple(a, 2, 3, b, 2));
  });

  it('an empty inner dimension gives zeros', () => {
    expectBitEqual(
      matmulSequential(new Float64Array(0), 2, 0, new Float64Array(0), 3),
      new Float64Array(6)
    );
  });

  it('reads each input element once, where the plain triple loop reads B once per row of A', () => {
    // A read counter on both inputs. For 16 x 16 x 16 the plain loop reads every element of
    // B sixteen times (4096 reads of B); a packed kernel reads each element of B once (256).
    const n = 16;
    const reads = { a: 0, b: 0 };
    const counted = (data: Float64Array, key: 'a' | 'b'): Float64Array =>
      new Proxy(data, {
        get(target, prop) {
          if (typeof prop === 'string' && /^\d+$/.test(prop)) reads[key]++;
          const value = Reflect.get(target, prop, target) as unknown;
          return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
        },
      });
    const a = fill(n * n, 41);
    const b = fill(n * n, 43);
    const got = matmulSequential(counted(a, 'a'), n, n, counted(b, 'b'), n);
    expectBitEqual(got, triple(a, n, n, b, n));
    expect(reads.b).toBeLessThanOrEqual(n * n);
    expect(reads.a).toBeLessThanOrEqual(n * n);
  });

  it('a row block equals the same rows of the whole product', () => {
    const m = 11;
    const k = 6;
    const n = 5;
    const a = fill(m * k, 3);
    const b = fill(k * n, 5);
    const whole = triple(a, m, k, b, n);
    const block = matmulRowBlock(a, k, b, n, 4, 9);
    expectBitEqual(block, whole.subarray(4 * n, 9 * n));
  });
});
