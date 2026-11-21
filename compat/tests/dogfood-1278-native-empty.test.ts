/**
 * Dogfood #1264 and #1278 on the compat instance (batch B2).
 *
 * #1278: pow of a 0 x 0 matrix, and sqrtm, sylvester and kron of a native 0 x 0 DenseMatrix,
 * return a matrix and not the Array `[]`. A result with a zero dimension is a public DenseMatrix
 * of the same size, so a 2 x 0 kron result keeps its shape. The sqrtm of a non-empty Matrix
 * is a Matrix.
 * #1264: expm keeps the class and the storage of its argument.
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const m = create(all) as unknown as Record<string, Fn>;
type BridgeMatrix = { storage(): string; size(): number[]; toArray(): unknown };

/** The size of a bridge matrix (`size()`), a native dense or a public CSR matrix (`rows`, `cols`). */
const sz = (r: unknown): number[] => {
  const x = r as { size?: unknown; rows: number; cols: number };
  return typeof x.size === 'function' ? (x.size as () => number[])() : [x.rows, x.cols];
};

const I2 = [
  [1, 0],
  [0, 1],
];

describe('#1278 compat pow of an empty matrix', () => {
  it('T13 a native 0 x 0 matrix and the expression give a 0 x 0 matrix', () => {
    for (const r of [
      m.pow(m.zeros(0, 0), 2),
      m.pow(m.identity(0), 2),
      m.evaluate('zeros(0, 0)^2'),
    ]) {
      expect(Array.isArray(r)).toBe(false);
      expect(sz(r)).toEqual([0, 0]);
    }
  });

  it('T13 the other rows of the issue table', () => {
    expect(m.pow([], 2)).toEqual([]);
    expect(m.pow([], 0)).toEqual([]);
    const dense = m.pow(m.matrix([]), 2) as BridgeMatrix;
    expect(Array.isArray(dense)).toBe(false);
    expect(dense.size()).toEqual([0, 0]);
    const sparse = m.pow(m.sparse([]), 2) as BridgeMatrix;
    expect(Array.isArray(sparse)).toBe(false);
    expect(sparse.storage()).toBe('sparse');
    expect(sparse.size()).toEqual([0, 0]);
  });
});

describe('#1264 compat expm keeps the class', () => {
  it('T13b a dense and a sparse Matrix keep their storage, a native 0 x 0 stays native', () => {
    const d = m.expm(m.matrix(I2)) as BridgeMatrix;
    expect(Array.isArray(d)).toBe(false);
    expect(d.size()).toEqual([2, 2]);
    expect(d.storage()).toBe('dense');
    const s = m.expm(m.sparse(I2)) as BridgeMatrix;
    expect(Array.isArray(s)).toBe(false);
    expect(s.storage()).toBe('sparse');
    const z = m.expm(m.zeros(0, 0));
    expect(z instanceof DenseMatrix).toBe(true);
    expect((z as DenseMatrix).rows).toBe(0);
  });
});

describe('#1278 compat sqrtm, sylvester and kron of a native 0 x 0 matrix', () => {
  it('T14 the result is a matrix of the right size', () => {
    const z = m.zeros(0, 0);
    for (const r of [
      m.sqrtm(z),
      m.sylvester(z, z, z),
      m.kron(
        z,
        m.matrix([
          [1, 2],
          [3, 4],
        ])
      ),
    ]) {
      expect(Array.isArray(r)).toBe(false);
      expect(sz(r)).toEqual([0, 0]);
    }
  });

  it('T14 an n x 0 result keeps its shape', () => {
    const r = m.kron(m.zeros(2, 0), m.matrix([[1]]));
    expect(Array.isArray(r)).toBe(false);
    expect(sz(r)).toEqual([2, 0]);
  });

  it('T14 the adapter changes every factory with a 0 x 0 result, 1-D results stay Arrays', () => {
    const inv = m.inv(m.zeros(0, 0));
    expect(Array.isArray(inv)).toBe(false);
    expect(sz(inv)).toEqual([0, 0]);
    expect(m.flatten(m.zeros(0, 0))).toEqual([]);
  });
});

describe('#1278 compat sqrtm of a non-empty Matrix', () => {
  it('T15 a Matrix gives a Matrix and a native DenseMatrix gives a DenseMatrix', () => {
    const r = m.sqrtm(
      m.matrix([
        [4, 0],
        [0, 9],
      ])
    ) as BridgeMatrix;
    expect(Array.isArray(r)).toBe(false);
    const v = r.toArray() as number[][];
    expect(v[0][0]).toBeCloseTo(2, 9);
    expect(v[0][1]).toBeCloseTo(0, 9);
    expect(v[1][0]).toBeCloseTo(0, 9);
    expect(v[1][1]).toBeCloseTo(3, 9);

    const native = m.sqrtm(
      DenseMatrix.fromArray([
        [4, 0],
        [0, 9],
      ])
    );
    expect(native instanceof DenseMatrix).toBe(true);
  });
});
