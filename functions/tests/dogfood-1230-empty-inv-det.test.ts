/**
 * Dogfood #1230 — inv, det and identity on empty matrices.
 * The inverse of a 0 x 0 matrix is the 0 x 0 matrix. Its determinant is 1.
 * A non-square empty matrix is not square, so det and inv throw.
 */
import { describe, expect, it } from 'vitest';
import { bignumber, det, identity, inv, matrix, sparse, zeros } from '../src/factories/index.js';

type Mat = { storage(): string; size(): number[] };
const dense00 = () => identity(0, 'dense');
const squareRe = /Matrix must be square/;

describe('#1230 identity of size 0', () => {
  it('identity(0) is a 0 x 0 DenseMatrix', () => {
    const r = identity(0) as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0, 0]);
  });
  it('identity(0, 0) is a 0 x 0 DenseMatrix and identity([0, 0]) is []', () => {
    expect((identity(0, 0) as Mat).size()).toEqual([0, 0]);
    expect(identity([0, 0])).toEqual([]);
  });
  it('identity(0, "dense") is a 0 x 0 DenseMatrix', () => {
    const r = identity(0, 'dense') as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0, 0]);
  });
  it('identity(0, "sparse") is a 0 x 0 SparseMatrix', () => {
    const r = identity(0, 'sparse') as Mat;
    expect(r.storage()).toBe('sparse');
    expect(r.size()).toEqual([0, 0]);
  });
  it('identity([0, 0], "sparse") and identity(0, 0, "dense") keep their kind', () => {
    expect((identity([0, 0], 'sparse') as Mat).size()).toEqual([0, 0]);
    expect((identity(0, 0, 'dense') as Mat).storage()).toBe('dense');
  });
  it('a negative or fractional size still throws', () => {
    expect(() => identity(-1)).toThrow(/integers/);
    expect(() => identity(1.5)).toThrow(/integers/);
  });
  it('a size that is not a finite non-negative integer throws', () => {
    const bad = [NaN, Infinity, -Infinity, 1e-20, bignumber('1.5'), bignumber(-1), bignumber(NaN)];
    for (const n of bad) {
      expect(() => (identity as (n: unknown) => unknown)(n)).toThrow(/non-negative integers/);
    }
    expect(() => identity(0, -1)).toThrow(/non-negative integers/);
    expect(() => identity(0, 1.5)).toThrow(/non-negative integers/);
    expect(() => identity([0, -1])).toThrow(/non-negative integers/);
  });
  it('identity(bignumber(0)) is a 0 x 0 DenseMatrix', () => {
    expect(((identity as (n: unknown) => unknown)(bignumber(0)) as Mat).size()).toEqual([0, 0]);
  });
  it('one zero dimension gives an empty matrix of that size', () => {
    expect((identity(0, 3) as Mat).size()).toEqual([0, 3]);
    expect((identity(3, 0) as Mat).size()).toEqual([3, 0]);
    expect((identity(0, 3, 'sparse') as Mat).size()).toEqual([0, 3]);
    expect((identity(3, 0, 'sparse') as Mat).size()).toEqual([3, 0]);
  });
});

describe('#1230 inv of a 0 x 0 input', () => {
  it('inv([]) is []', () => {
    expect(inv([])).toEqual([]);
  });
  it('inv(matrix([])) is a 0 x 0 Matrix of the same storage', () => {
    const r = inv(matrix([])) as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0, 0]);
  });
  it('inv of a 0 x 0 DenseMatrix is a 0 x 0 DenseMatrix', () => {
    const r = inv(dense00()) as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0, 0]);
  });
  it('inv(sparse([])) is a 0 x 0 SparseMatrix', () => {
    const r = inv(sparse([])) as Mat;
    expect(r.storage()).toBe('sparse');
    expect(r.size()).toEqual([0, 0]);
  });
  it('inv of an empty Matrix returns a new object and keeps the input', () => {
    for (const a of [matrix([]), dense00(), sparse([])]) {
      const before = (a as Mat).size();
      const r = inv(a) as Mat;
      expect(r).not.toBe(a);
      expect(r.storage()).toBe((a as Mat).storage());
      expect((a as Mat).size()).toEqual(before);
    }
  });
  it('inv of a non-square empty input throws the square error', () => {
    expect(() => inv([[]])).toThrow(squareRe);
    expect(() => inv(matrix([[]]))).toThrow(squareRe);
    expect(() => inv(matrix([[]]))).toThrow(/\[1, 0\]/);
    expect(() => inv(zeros(0, 1, 'dense'))).toThrow(squareRe);
  });
});

describe('#1230 det of empty input', () => {
  it('det of a 0 x 0 input is 1 in every kind', () => {
    expect(det([])).toBe(1);
    expect(det(matrix([]))).toBe(1);
    expect(det(dense00())).toBe(1);
    expect(det(sparse([]))).toBe(1);
  });
  it('det of a non-square empty input throws the square error', () => {
    expect(() => det([[]])).toThrow(squareRe);
    expect(() => det(matrix([[]]))).toThrow(/\[1, 0\]/);
    expect(() => det(zeros(0, 1, 'dense'))).toThrow(squareRe);
    expect(() => det(zeros(3, 0, 'dense'))).toThrow(/[3, 0]/);
    expect(() => det(zeros(3, 0, 'sparse'))).toThrow(/[3, 0]/);
  });
  it('det of a 3 x 3 input is the same exact value in every kind', () => {
    const a = [
      [2, -1, 0],
      [1, 3, 4],
      [0, 5, -2],
    ];
    expect(det(a)).toBe(-54);
    expect(det(matrix(a))).toBe(-54);
    expect(det(sparse(a))).toBe(-54);
  });
  it('det of a non-empty square input is unchanged', () => {
    expect(
      det([
        [1, 2],
        [3, 4],
      ])
    ).toBe(-2);
  });
});
