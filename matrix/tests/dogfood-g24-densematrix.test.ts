/**
 * Dogfood G24 — DenseMatrix construction, scalar multiply, size cap (#810 #814 #815).
 */
import { describe, it, expect } from 'vitest';
import { DenseMatrix, DENSE_MATRIX_MAX_ELEMENTS } from '../src/index.js';

describe('G24 dogfood — DenseMatrix (#810 #814 #815)', () => {
  it('#810 zeros(1e8,1e8) throws a named too-large error before allocation', () => {
    expect(() => DenseMatrix.zeros(1e8, 1e8)).toThrow(RangeError);
    expect(() => DenseMatrix.zeros(1e8, 1e8)).toThrow(/too large|exceeds limit/);
    expect(() => DenseMatrix.zeros(1e8, 1e8)).not.toThrow(/Invalid typed array length/);
  });

  it('#810 documents MAX_ELEMENTS', () => {
    expect(DENSE_MATRIX_MAX_ELEMENTS).toBe(1e8);
  });

  it('#814 new DenseMatrix([[1,2],[3,4]]) infers shape', () => {
    const m = new DenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(2);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('#814 jagged nested array throws a rectangular error', () => {
    expect(() => new DenseMatrix([[1, 2], [3]])).toThrow(/rectangular/);
  });

  it('#815 multiply(2) scales like mathjs multiply', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(A.multiply(2).toArray()).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });

  it('#815 multiply(null) names scalar vs matrix', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    expect(() => A.multiply(null as unknown as number)).toThrow(TypeError);
    expect(() => A.multiply(null as unknown as number)).toThrow(/scale|scalar|matrix/);
    expect(() => A.multiply(null as unknown as number)).not.toThrow(/undefined×undefined/);
  });

  it('#815 scalar multiply matches mathjs on NaN, Infinity, and negative zero', () => {
    const B = new DenseMatrix([
      [1, 0],
      [-0, -1],
    ]);
    const byNegZero = B.multiply(-0);
    expect(Object.is(byNegZero.get(0, 0), -0)).toBe(true);
    expect(Object.is(byNegZero.get(0, 1), -0)).toBe(true);
    expect(Object.is(byNegZero.get(1, 0), 0)).toBe(true);
    expect(Object.is(byNegZero.get(1, 1), 0)).toBe(true);

    const special = new DenseMatrix([
      [NaN, Infinity],
      [-Infinity, 2],
    ]);
    const byNaN = special.multiply(NaN);
    expect(byNaN.get(0, 0)).toBeNaN();
    expect(byNaN.get(1, 1)).toBeNaN();
    const byInf = special.multiply(Infinity);
    expect(byInf.get(0, 0)).toBeNaN();
    expect(byInf.get(0, 1)).toBe(Infinity);
    expect(byInf.get(1, 0)).toBe(-Infinity);
    expect(byInf.get(1, 1)).toBe(Infinity);
  });

  it('#815 matrix product is unchanged', () => {
    const A = new DenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const B = new DenseMatrix([
      [5, 6],
      [7, 8],
    ]);
    expect(A.multiply(B).toArray()).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('#810 cap covers ones, identity, constructor, and the multiply result', () => {
    const tooLarge = /too large|exceeds limit/;
    expect(() => DenseMatrix.ones(1e8, 1e8)).toThrow(tooLarge);
    expect(() => DenseMatrix.ones(1e8, 1e8)).not.toThrow(/Invalid typed array length/);
    expect(() => DenseMatrix.identity(1e8)).toThrow(tooLarge);
    expect(() => DenseMatrix.identity(1e8)).not.toThrow(/Invalid typed array length/);
    expect(() => new DenseMatrix(1e8, 1e8)).toThrow(tooLarge);
    expect(() => DenseMatrix.fill(1e8, 1e8, 1)).toThrow(tooLarge);
    expect(() => DenseMatrix.random(1e8, 1e8)).toThrow(tooLarge);
    const left = DenseMatrix.zeros(10001, 1);
    const right = DenseMatrix.zeros(1, 10001);
    expect(() => left.multiply(right)).toThrow(tooLarge);
    expect(() => left.multiply(right)).not.toThrow(/Invalid typed array length/);
  });

  it('#810 rejects NaN, negative, non-integer, and overflowing dimensions', () => {
    expect(() => DenseMatrix.zeros(NaN, 2)).toThrow(/finite integers/);
    expect(() => DenseMatrix.ones(-1, 2)).toThrow(/non-negative/);
    expect(() => DenseMatrix.identity(1.5)).toThrow(/finite integers/);
    expect(() => new DenseMatrix(2, Infinity)).toThrow(/finite integers/);
    expect(() => new DenseMatrix(1e8, 1e8)).toThrow(/too large/);
  });

  it('#814 rejects empty and non-numeric nested arrays and keeps (rows, cols)', () => {
    expect(() => new DenseMatrix([])).toThrow(/non-empty/);
    expect(() => new DenseMatrix([[]])).toThrow(/non-empty/);
    expect(() => new DenseMatrix([[1, 'a']] as unknown as number[][])).toThrow(/numbers/);
    expect(() => DenseMatrix.fromArray([[1, 2], [3]])).toThrow(/rectangular/);
    const z = new DenseMatrix(2, 3);
    expect(z.rows).toBe(2);
    expect(z.cols).toBe(3);
    expect(z.toArray()).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});
