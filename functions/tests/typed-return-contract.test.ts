/**
 * Typed return contract (#898, #918): the public overloads of `median`, `mode`, `mad` and
 * `parallelFFT` declare the type that the call returns at run time.
 *
 * `expectTypeOf` is a compile-time check. `bun run typecheck` runs it through
 * `tsconfig.test.json`. The packed `.d.ts` is checked by `tools/test/consumer-typecheck.mjs`.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { median, mode, mad, matrix, bignumber, parallelFFT } from '../src/index.js';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

const XS: number[] = [4, 1, 3, 2, 5];
const GRID: number[][] = [
  [1, 2],
  [3, 4],
];

describe('median, mode and mad of the inputs that the public overloads name', () => {
  it('a vector: median and mad give a number, mode gives a list', () => {
    expect(median(XS)).toBe(3);
    expectTypeOf(median(XS)).toEqualTypeOf<number>();
    expect(mad(XS)).toBe(1);
    expectTypeOf(mad(XS)).toEqualTypeOf<number>();
    expect(mode([1, 2, 2, 3])).toEqual([2]);
    expectTypeOf(mode(XS)).toEqualTypeOf<number[] | number>();
  });

  it('a Float64Array gives the same types as a vector', () => {
    const data = new Float64Array(XS);
    expect(median(data)).toBe(3);
    expectTypeOf(median(data)).toEqualTypeOf<number>();
    expect(mad(data)).toBe(1);
    expectTypeOf(mad(data)).toEqualTypeOf<number>();
    expect(mode(new Float64Array([1, 2, 2]))).toEqual([2]);
    expectTypeOf(mode(data)).toEqualTypeOf<number[] | number>();
  });

  it('a 2-D array is flattened, so the types are the types of a vector', () => {
    expect(median(GRID)).toBe(2.5);
    expectTypeOf(median(GRID)).toEqualTypeOf<number>();
    expect(mad(GRID)).toBe(1);
    expectTypeOf(mad(GRID)).toEqualTypeOf<number>();
    expect(mode(GRID)).toEqual([1, 2, 3, 4]);
    expectTypeOf(mode(GRID)).toEqualTypeOf<number[] | number>();
  });

  it('a dimension gives a number for a vector and one number per slice for a 2-D array', () => {
    expect(median(XS, 0)).toBe(3);
    expect(median(GRID, 0)).toEqual([2, 3]);
    expect(median(GRID, 1)).toEqual([1.5, 3.5]);
    expectTypeOf(median(GRID, 0)).toEqualTypeOf<number | number[]>();
  });

  it('options keep the type', () => {
    expect(median([1, NaN, 3], { skipNaN: true })).toBe(2);
    expectTypeOf(median(XS, { skipNaN: true })).toEqualTypeOf<number>();
  });

  it('scalar arguments give a number', () => {
    expect(median(5, 2, 7)).toBe(5);
    expectTypeOf(median(5, 2, 7)).toEqualTypeOf<number>();
    expect(mode(1, 2, 2)).toEqual([2]);
    expectTypeOf(mode(1, 2, 2)).toEqualTypeOf<number[]>();
  });

  it('an empty input gives NaN, and mode declares that', () => {
    expect(median([])).toBeNaN();
    expect(mad([])).toBeNaN();
    expect(mode([])).toBeNaN();
  });

  it('an input that no overload names gives unknown, and the call still compiles', () => {
    const wide: unknown[] = XS;
    expect(median(wide)).toBe(3);
    expectTypeOf(median(wide)).toEqualTypeOf<unknown>();
    expectTypeOf(mad(wide)).toEqualTypeOf<unknown>();
    expectTypeOf(mode(wide)).toEqualTypeOf<unknown>();
  });
});

describe('the Matrix arm returns numbers because the public Matrix stores numbers only', () => {
  it('median, mad and mode of a DenseMatrix and a SparseMatrix', () => {
    const dense = new DenseMatrix(GRID);
    expect(median(dense)).toBe(2.5);
    expectTypeOf(median(dense)).toEqualTypeOf<number>();
    expect(mad(dense)).toBe(1);
    expectTypeOf(mad(dense)).toEqualTypeOf<number>();
    expect(mode(dense)).toEqual([1, 2, 3, 4]);
    expectTypeOf(mode(dense)).toEqualTypeOf<number[] | number>();
    const sparse = SparseMatrix.fromDense(dense);
    expect(median(sparse)).toBe(2.5);
    expectTypeOf(median(sparse)).toEqualTypeOf<number>();
  });

  it('a DenseMatrix refuses a BigNumber, and a SparseMatrix stores it as a double', () => {
    const big = bignumber(5) as number;
    expect(() => new DenseMatrix([[big]])).toThrow(/must contain numbers/);
    const sparse = new SparseMatrix(1, 1, [big], [0], [0, 1]);
    expect(typeof median(sparse)).toBe('number');
    expect(typeof mad(sparse)).toBe('number');
    expect(typeof (mode(sparse) as number[])[0]).toBe('number');
  });

  it('a compat matrix of BigNumber returns a BigNumber, and its type is unknown', () => {
    // `matrix()` and `bignumber()` return `unknown`, so no overload names this input.
    const compat = matrix([bignumber(1), bignumber(5), bignumber(3)]);
    const result = median(compat);
    expectTypeOf(result).toEqualTypeOf<unknown>();
    expect((result as { toNumber(): number }).toNumber()).toBe(3);
  });
});

describe('parallelFFT takes a vector', () => {
  it('a number[] gives the result at once, a Float64Array gives a Promise', async () => {
    const sync = parallelFFT([0, 1, 0, -1]);
    expectTypeOf(sync).toEqualTypeOf<{
      real: Float64Array;
      imag: Float64Array;
      originalLength: number;
    }>();
    expect(sync.originalLength).toBe(4);
    const readOnly: readonly number[] = Object.freeze([0, 1, 0, -1]);
    expectTypeOf(parallelFFT(readOnly)).toEqualTypeOf<{
      real: Float64Array;
      imag: Float64Array;
      originalLength: number;
    }>();
    expect(parallelFFT(readOnly).originalLength).toBe(4);
    const pending = parallelFFT(new Float64Array([0, 1, 0, -1]));
    expectTypeOf(pending).toEqualTypeOf<
      Promise<{ real: Float64Array; imag: Float64Array; originalLength: number }>
    >();
    const { real, imag } = await pending;
    expect(real.length).toBe(4);
    expect(imag.length).toBe(4);
  });

  it('refuses a 2-D array at compile time', () => {
    // @ts-expect-error a 2-D array is not a vector, and its run-time result is NaN
    const bins = parallelFFT(GRID);
    expect(bins).toBeDefined();
  });
});
