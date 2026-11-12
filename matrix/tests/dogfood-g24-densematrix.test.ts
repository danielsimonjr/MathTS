/**
 * Dogfood G24 — DenseMatrix construction, scalar multiply, size cap (#810 #814 #815).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '@danielsimonjr/mathts-compat';
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

    const math = create(all);
    const B = math.matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(math.multiply(B, 2).valueOf()).toEqual([
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
});
