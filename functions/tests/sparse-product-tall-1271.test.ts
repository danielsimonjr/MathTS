/**
 * #1271 - the workspace of a sparse product follows the stored entries, not the row count.
 *
 * A tall matrix (here 5e7 rows, 3 stored entries) multiplied by a small one needs no
 * workspace of one slot per row: the kernel works in the compact space of the stored rows.
 * The proxy is deterministic: it records the length of every `Int32Array` and `Float64Array`
 * that the call allocates, so no wall-clock or memory reading decides the result.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Csc = { _values: unknown[] | null; _index: number[]; _ptr: number[]; _size: number[] };
const multiply = math.multiply as unknown as Fn;
const sparse = math.sparse as unknown as (data: unknown) => Csc;
const mjMultiply = mathjs.multiply as unknown as Fn;
const MjSparse = (mathjs as unknown as { SparseMatrix: new (d: unknown) => Csc }).SparseMatrix;

/** The largest typed-array length that `body` allocates. */
function largestTypedAllocation(body: () => void): number {
  let largest = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  const originals = { Int32Array: g.Int32Array, Float64Array: g.Float64Array };
  for (const name of ['Int32Array', 'Float64Array'] as const) {
    const Original = originals[name] as new (...a: unknown[]) => object;
    g[name] = class extends (Original as new (...a: unknown[]) => object) {
      constructor(...args: unknown[]) {
        super(...args);
        if (typeof args[0] === 'number' && args[0] > largest) largest = args[0];
      }
    };
  }
  try {
    body();
  } finally {
    g.Int32Array = originals.Int32Array;
    g.Float64Array = originals.Float64Array;
  }
  return largest;
}

const ROWS = 5e7;
/** `ROWS x 2`, three stored entries: rows 0, 7 and ROWS - 1. */
const tall = (): Record<string, unknown> => ({
  values: [1, 2, 3],
  index: [0, ROWS - 1, 7],
  ptr: [0, 2, 3],
  size: [ROWS, 2],
});
/** `2 x 2`: [[3, 0], [0, 5]] in CSC form. */
const small = (): Record<string, unknown> => ({
  values: [3, 5],
  index: [0, 1],
  ptr: [0, 1, 2],
  size: [2, 2],
});

describe('#1271 a tall sparse operand', () => {
  it('allocates no workspace of one slot per row', () => {
    let product: Csc | undefined;
    const largest = largestTypedAllocation(() => {
      product = multiply(sparse(tall()), sparse(small())) as Csc;
    });
    expect(largest).toBeLessThan(1000);
    expect(product!._size).toEqual([ROWS, 2]);
  });

  it('gives the structure and the values of mathjs', () => {
    const got = multiply(sparse(tall()), sparse(small())) as Csc;
    const want = mjMultiply(new MjSparse(tall()), new MjSparse(small())) as Csc;
    // mathjs writes the rows of a column in discovery order; compare each column sorted.
    const column = (m: Csc, j: number): Array<[number, unknown]> => {
      const out: Array<[number, unknown]> = [];
      for (let p = m._ptr[j]; p < m._ptr[j + 1]; p++) out.push([m._index[p], m._values![p]]);
      return out.sort((x, y) => x[0] - y[0]);
    };
    expect(got._ptr).toEqual(want._ptr);
    expect(column(got, 0)).toEqual(column(want, 0));
    expect(column(got, 1)).toEqual(column(want, 1));
  });

  it('sorts the rows of a Complex product', () => {
    const c = (re: number, im: number) => math.complex(re, im);
    const bigTall = {
      values: [c(1, 1), c(2, 0), c(-1, -1)],
      index: [ROWS - 1, 3, ROWS - 1],
      ptr: [0, 2, 3],
      size: [ROWS, 2],
    };
    const right = { values: [c(1, 0), c(1, 0)], index: [0, 1], ptr: [0, 1, 2], size: [2, 2] };
    const got = multiply(sparse(bigTall), sparse(right)) as Csc;
    expect(got._index.slice(0, got._ptr[2])).toEqual([3, ROWS - 1, ROWS - 1]);
  });
});
