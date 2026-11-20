/**
 * #1271 - `multiply` of two sparse matrices must not build a dense matrix.
 *
 * Before the fix, both operands went through `toArray()`, a dense product and a re-sparsify
 * pass. Time was O(n^3) and memory O(n^2) for the identity plus 0.1% random entries (11.4 s
 * at n = 2000 for a CSC pair, mathjs 6 ms). The product is now a column Gustavson kernel that
 * reads only the stored entries (`functions/src/typed/sparse-product.ts`).
 *
 * The oracle is the mathjs devDependency (15.2.0). mathjs stores a sum that cancels to zero
 * as an explicit entry, and csAmd/slu depend on that structural pattern (#1271, comment 2).
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { isBigNumber, isComplex, isFraction } from '@danielsimonjr/mathts-core';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Csc = {
  _values: unknown[] | null;
  _index: number[];
  _ptr: number[];
  _size: number[];
  toArray(): unknown[][];
  constructor: { name: string };
};
const multiply = math.multiply as unknown as Fn;
const sparse = math.sparse as unknown as (data: unknown) => Csc;
const slu = math.slu as unknown as (
  a: unknown,
  order: number,
  threshold: number
) => { q: number[] };
const mjMultiply = mathjs.multiply as unknown as Fn;
const mjSparse = mathjs.sparse as unknown as (data: unknown) => Csc;

const CscClass = sparse([[1]]).constructor;

/** A public matrix-package (CSR) sparse matrix. */
const csr = (data: number[][]): SparseMatrix => SparseMatrix.fromDense(DenseMatrix.fromArray(data));

/** The matrix with a `toArray` that fails: a product that reads it has built a dense matrix. */
function trap<T extends object>(m: T): T {
  Object.defineProperty(m, 'toArray', {
    value: () => {
      throw new Error('densified');
    },
    configurable: true,
  });
  return m;
}

/** A tiny seeded generator (LCG), so a failure reproduces. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Rows of a column in sorted order, per column. */
function columns(m: Csc): number[][] {
  const out: number[][] = [];
  for (let j = 0; j + 1 < m._ptr.length; j++) {
    out.push(m._index.slice(m._ptr[j], m._ptr[j + 1]).sort((x, y) => x - y));
  }
  return out;
}

describe('#1271 sparse x sparse reads only the stored entries', () => {
  const A = [
    [1, 0, 2],
    [0, 3, 0],
  ];
  const B = [
    [0, 1],
    [4, 0],
    [0, 5],
  ];
  const AB = [
    [0, 11],
    [12, 0],
  ];

  describe('(a) no densify', () => {
    it('CSC pair', () => {
      const r = multiply(trap(sparse(A)), trap(sparse(B))) as Csc;
      expect(r.toArray()).toEqual(AB);
    });
    it('CSR pair', () => {
      const r = multiply(trap(csr(A)), trap(csr(B))) as { toArray(): number[][] };
      expect(r.toArray()).toEqual(AB);
    });
    it('mixed pair, CSR left', () => {
      const r = multiply(trap(csr(A)), trap(sparse(B))) as { toArray(): number[][] };
      expect(r.toArray()).toEqual(AB);
    });
    it('mixed pair, CSC left', () => {
      const r = multiply(trap(sparse(A)), trap(csr(B))) as { toArray(): number[][] };
      expect(r.toArray()).toEqual(AB);
    });
  });

  describe('(b) values', () => {
    it('numbers', () => {
      expect((multiply(sparse(A), sparse(B)) as Csc).toArray()).toEqual(AB);
    });
    it('Complex entries (no conjugate)', () => {
      const i = math.complex(0, 1);
      const r = multiply(
        sparse([
          [i, 0],
          [0, 1],
        ]),
        sparse([
          [i, 0],
          [0, 2],
        ])
      ) as Csc;
      const out = r.toArray();
      expect(math.equal(out[0][0] as never, math.complex(-1, 0) as never)).toBe(true);
      expect(math.equal(out[1][1] as never, 2 as never)).toBe(true);
    });
    it('a pattern matrix gives a pattern matrix (values null)', () => {
      const p = sparse({ values: undefined, index: [0, 1], ptr: [0, 1, 2], size: [2, 2] });
      const r = multiply(p, p) as Csc;
      expect(r._values).toBeNull();
      expect(r._index).toEqual([0, 1]);
      expect(r._ptr).toEqual([0, 1, 2]);
    });
    it('2x0 * 0x2 is a 2x2 matrix with no entry', () => {
      const a = sparse({ values: [], index: [], ptr: [0], size: [2, 0] });
      const b = sparse({ values: [], index: [], ptr: [0, 0, 0], size: [0, 2] });
      const r = multiply(a, b) as Csc;
      expect(r._size).toEqual([2, 2]);
      expect(r._ptr).toEqual([0, 0, 0]);
      expect(r._index).toEqual([]);
    });
    it('0x3 * 3x0 has size [0, 0]', () => {
      const a = sparse({ values: [], index: [], ptr: [0, 0, 0, 0], size: [0, 3] });
      const b = sparse({ values: [], index: [], ptr: [0], size: [3, 0] });
      const r = multiply(a, b) as Csc;
      expect(r._size).toEqual([0, 0]);
      expect(r._ptr).toEqual([0]);
    });
  });

  describe('(c) structure follows mathjs', () => {
    it('a sum that cancels to zero stays as an explicit entry', () => {
      const a = [
        [1, 1],
        [0, 0],
      ];
      const b = [[1], [-1]];
      const mt = multiply(sparse(a), sparse(b)) as Csc;
      const mj = mjMultiply(mjSparse(a), mjSparse(b)) as Csc;
      expect(mj._values).toEqual([0]);
      expect(mt._values).toEqual([0]);
      expect(mt._index).toEqual([0]);
      expect(mt._ptr).toEqual([0, 1]);
      expect(mt._size).toEqual([2, 1]);
    });
    it('row indices are sorted in each column', () => {
      const a = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ];
      const b = [
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 0],
      ];
      const mt = multiply(sparse(a), sparse(b)) as Csc;
      for (const col of columns(mt)) {
        expect(col).toEqual([...col].sort((x, y) => x - y));
      }
      for (let j = 0; j + 1 < mt._ptr.length; j++) {
        const rows = mt._index.slice(mt._ptr[j], mt._ptr[j + 1]);
        expect(rows).toEqual([...rows].sort((x, y) => x - y));
      }
    });
  });

  describe('(d) differential fuzz against mathjs', () => {
    it('200 random CSC pairs give the same values and the same structure', () => {
      const rnd = lcg(20261120);
      const dim = () => 1 + Math.floor(rnd() * 12);
      const entry = () => {
        if (rnd() >= 0.3) return 0;
        const v = Math.floor(rnd() * 7) - 3;
        return v === 0 ? 1 : v;
      };
      for (let t = 0; t < 200; t++) {
        const r = dim();
        const k = dim();
        const c = dim();
        const a = Array.from({ length: r }, () => Array.from({ length: k }, entry));
        const b = Array.from({ length: k }, () => Array.from({ length: c }, entry));
        const mt = multiply(sparse(a), sparse(b)) as Csc;
        const mj = mjMultiply(mjSparse(a), mjSparse(b)) as Csc;
        expect(mt.toArray()).toEqual(mj.toArray());
        expect(mt._ptr).toEqual(mj._ptr);
        expect(columns(mt)).toEqual(columns(mj));
        expect(mt._size).toEqual(mj._size);
      }
    });
  });

  describe('(e) csAmd order 2 depends on the pattern only', () => {
    it('slu(A, 2, 1).q is the same for two matrices of one pattern, 120 times', () => {
      const rnd = lcg(12345);
      let differ = 0;
      for (let t = 0; t < 120; t++) {
        const n = 5 + Math.floor(rnd() * 26);
        const full = Math.floor(rnd() * n);
        const dens = 0.1 + rnd() * 0.4;
        const pat = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => i === j || i === full || rnd() < dens)
        );
        const val = () => {
          const v = Math.round(rnd() * 8 - 4);
          return v === 0 ? 1 : v;
        };
        const build = () =>
          pat.map((row, i) => row.map((p, j) => (p ? (i === j ? n + 1 : val()) : 0)));
        const qa = slu(sparse(build()), 2, 1).q;
        const qb = slu(sparse(build()), 2, 1).q;
        if (JSON.stringify(qa) !== JSON.stringify(qb)) differ++;
      }
      expect(differ).toBe(0);
    });
  });

  describe('(f) stale tails in the operand arrays', () => {
    it('arrays longer than ptr[cols] give the same product as clean arrays', () => {
      const clean = multiply(sparse(A), sparse(B)) as Csc;
      const a = sparse(A);
      const b = sparse(B);
      a._index.push(0, 1, 0);
      a._values!.push(9, 9, 9);
      b._index.push(1, 2);
      b._values!.push(7, 7);
      const r = multiply(a, b) as Csc;
      expect(r.toArray()).toEqual(clean.toArray());
      expect(r._ptr).toEqual(clean._ptr);
      expect(r._index).toEqual(clean._index);
    });
  });

  describe('(g) entry types, specials, errors, result classes', () => {
    it('Fraction entries keep their type', () => {
      const half = math.fraction(1, 2);
      const third = math.fraction(1, 3);
      const r = multiply(
        sparse([
          [half, 0],
          [0, third],
        ]),
        sparse([
          [2, 0],
          [0, 3],
        ])
      ) as Csc;
      const out = r.toArray();
      expect(isFraction(out[0][0])).toBe(true);
      expect(isFraction(out[1][1])).toBe(true);
      expect(math.equal(out[0][0] as never, 1 as never)).toBe(true);
    });
    it('BigNumber entries keep their type', () => {
      const two = math.bignumber(2);
      const r = multiply(
        sparse([
          [two, 0],
          [0, two],
        ]),
        sparse([
          [3, 0],
          [0, 4],
        ])
      ) as Csc;
      const out = r.toArray();
      expect(isBigNumber(out[0][0])).toBe(true);
      expect(isBigNumber(out[1][1])).toBe(true);
    });
    it('a number operand times a Complex operand works', () => {
      const i = math.complex(0, 1);
      const r = multiply(
        sparse([
          [1, 0],
          [0, 2],
        ]),
        sparse([
          [i, 0],
          [0, i],
        ])
      ) as Csc;
      const out = r.toArray();
      expect(isComplex(out[0][0])).toBe(true);
      expect(math.equal(out[1][1] as never, math.complex(0, 2) as never)).toBe(true);
    });
    it('a structural zero times Infinity gives no NaN (mathjs value)', () => {
      const a = [
        [Infinity, 0],
        [0, 1],
      ];
      const id = [
        [1, 0],
        [0, 1],
      ];
      const mj = (mjMultiply(mjSparse(a), mjSparse(id)) as Csc).toArray();
      expect(mj).toEqual(a);
      expect((multiply(sparse(a), sparse(id)) as Csc).toArray()).toEqual(a);
    });
    it('a dimension mismatch is an Error with the U+00D7 text, for every storage pair', () => {
      const wide = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const square = [
        [1, 2],
        [3, 4],
      ];
      const text = 'Cannot multiply 2×3 matrix with 2×2 matrix';
      for (const [x, y] of [
        [sparse(wide), sparse(square)],
        [csr(wide), csr(square)],
        [csr(wide), sparse(square)],
        [sparse(wide), csr(square)],
      ]) {
        let caught: unknown;
        try {
          multiply(x, y);
        } catch (e) {
          caught = e;
        }
        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).constructor).toBe(Error);
        expect((caught as Error).message).toBe(text);
      }
    });
    it('the class of the result: CSC pair is CSC, CSR pair and number mixed pair are public', () => {
      expect((multiply(sparse(A), sparse(B)) as object).constructor).toBe(CscClass);
      expect(multiply(csr(A), csr(B))).toBeInstanceOf(SparseMatrix);
      expect(multiply(csr(A), sparse(B))).toBeInstanceOf(SparseMatrix);
      expect(multiply(sparse(A), csr(B))).toBeInstanceOf(SparseMatrix);
    });
    it('a mixed pair with a Complex CSC operand is a dense matrix of the Complex values', () => {
      const i = math.complex(0, 1);
      const r = multiply(
        csr([
          [1, 0],
          [0, 2],
        ]),
        sparse([
          [i, 0],
          [0, 1],
        ])
      ) as {
        toArray(): unknown[][];
      };
      const out = r.toArray();
      expect(math.equal(out[0][0] as never, i as never)).toBe(true);
      expect(math.equal(out[1][1] as never, 2 as never)).toBe(true);
    });
    it('a CSR product drops a sum that cancels to zero (the public class stores no zero)', () => {
      const r = multiply(
        csr([
          [1, 1],
          [0, 0],
        ]),
        csr([[1], [-1]])
      ) as SparseMatrix;
      expect(r.toArray()).toEqual([[0], [0]]);
    });
  });
});
