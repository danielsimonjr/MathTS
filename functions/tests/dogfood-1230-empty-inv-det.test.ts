/**
 * Dogfood #1230 — inv, det and identity on empty matrices.
 * The inverse of a 0 x 0 matrix is the 0 x 0 matrix. Its determinant is 1.
 * A non-square empty matrix is not square, so det and inv throw.
 */
import { describe, expect, it } from 'vitest';
import { det, identity, inv, matrix, sparse, zeros } from '../src/factories/index.js';

type Mat = { storage(): string; size(): number[] };
const dense00 = () => identity(0, 'dense');
const squareRe = /Matrix must be square/;

describe('#1230 identity of size 0', () => {
  it('identity(0) is a 0 x 0 array', () => {
    expect((identity(0) as Mat).size()).toEqual([0, 0]);
  });
  it('identity(0, 0) and identity([0, 0]) are 0 x 0 arrays', () => {
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
});

describe('#1230 inv of a 0 x 0 input', () => {
  it('inv([]) is []', () => {
    expect(inv([])).toEqual([]);
  });
  it('inv(matrix([])) is an empty Matrix of the same kind', () => {
    const r = inv(matrix([])) as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0]);
  });
  it('inv of a 0 x 0 DenseMatrix is a 0 x 0 DenseMatrix', () => {
    const r = inv(dense00()) as Mat;
    expect(r.storage()).toBe('dense');
    expect(r.size()).toEqual([0, 0]);
  });
  it('inv(sparse([])) is a SparseMatrix', () => {
    const r = inv(sparse([])) as Mat;
    expect(r.storage()).toBe('sparse');
    expect(r.size()[0]).toBe(0);
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
