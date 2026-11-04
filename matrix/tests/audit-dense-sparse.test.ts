import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { SparseMatrix } from '../src/types/SparseMatrix.js';
import { JSBackend } from '../src/backends/JSBackend.js';
import * as reduction from '../src/types/dense/reduction.js';

function seq(rows: number, cols: number): DenseMatrix {
  const d = new Float64Array(rows * cols);
  for (let i = 0; i < d.length; i++) d[i] = i + 1;
  return new DenseMatrix(rows, cols, d);
}

function oracleDiag(m: DenseMatrix, k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < m.rows; i++) {
    const j = i + k;
    if (j >= 0 && j < m.cols) out.push(m.get(i, j));
  }
  return out;
}

describe('DenseMatrix.diagonal on non-square matrices', () => {
  for (const [r, c] of [
    [3, 5],
    [5, 3],
  ] as const) {
    for (const k of [-1, 0, 1, 2]) {
      it(`${r}x${c} k=${k} matches oracle and SparseMatrix`, () => {
        const m = seq(r, c);
        const expected = oracleDiag(m, k);
        const d = m.diagonal(k);
        expect(d.rows).toBe(expected.length);
        expect(Array.from(d.toFloat64Array())).toEqual(expected);
        const sp = SparseMatrix.fromDense(m).diagonal(k);
        expect(sp.rows).toBe(d.rows);
        expect(Array.from(sp.toDense().toFloat64Array())).toEqual(expected);
      });
    }
  }
});

describe('DenseMatrix constructor validation', () => {
  it('rejects unsupported data types', () => {
    expect(() => new DenseMatrix(1, 1, 'abc' as unknown as number[])).toThrow(TypeError);
    expect(() => new DenseMatrix(1, 1, 5 as unknown as number[])).toThrow(TypeError);
  });
  it('rejects non-integer and NaN dimensions', () => {
    expect(() => new DenseMatrix(1.5, 2)).toThrow(/integers/);
    expect(() => new DenseMatrix(2, NaN)).toThrow(/integers/);
    expect(() => new DenseMatrix(Infinity, 2)).toThrow(/integers/);
  });
  it('still rejects negative dimensions', () => {
    expect(() => new DenseMatrix(-1, 2)).toThrow(/non-negative/);
  });
});

describe('DenseMatrix.toSparse', () => {
  it('converts to CSR keeping only nonzeros', () => {
    const m = new DenseMatrix(2, 3, [1, 0, 2, 0, 0, 3]);
    const s = m.toSparse() as SparseMatrix;
    expect(s.rows).toBe(2);
    expect(s.cols).toBe(3);
    expect(s.nnz).toBe(3);
    expect(Array.from(s.toDense().toFloat64Array())).toEqual([1, 0, 2, 0, 0, 3]);
  });
  it('honours dropTolerance', () => {
    const m = new DenseMatrix(1, 3, [1, 1e-9, -2]);
    const s = m.toSparse(1e-6) as SparseMatrix;
    expect(s.nnz).toBe(2);
    expect(Array.from(s.toDense().toFloat64Array())).toEqual([1, 0, -2]);
  });
});

/** 2x3 strided view into a 3x4 sequence matrix: rows 0-1, cols 1-3 (values 2,3,4 / 6,7,8). */
function stridedView(): DenseMatrix {
  const data = Float64Array.from({ length: 12 }, (_, i) => i + 1);
  return new DenseMatrix(2, 3, data, { isView: true, offset: 1, rowStride: 4 });
}

describe('JSBackend flat-path ops', () => {
  const js = new JSBackend();
  const a = seq(3, 4);
  const b = new DenseMatrix(
    3,
    4,
    Float64Array.from({ length: 12 }, (_, i) => (i % 5) - 2.5)
  );
  it('element-wise ops do not mutate inputs and match scalar get()', () => {
    const aCopy = a.toFloat64Array();
    const bCopy = b.toFloat64Array();
    const sum = js.add(a, b);
    const dif = js.subtract(a, b);
    const prd = js.multiplyElementwise(a, b);
    const quo = js.divideElementwise(a, b);
    const scl = js.scale(a, 3);
    const ab = js.abs(b);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        expect(sum.get(i, j)).toBe(a.get(i, j) + b.get(i, j));
        expect(dif.get(i, j)).toBe(a.get(i, j) - b.get(i, j));
        expect(prd.get(i, j)).toBe(a.get(i, j) * b.get(i, j));
        expect(quo.get(i, j)).toBe(a.get(i, j) / b.get(i, j));
        expect(scl.get(i, j)).toBe(a.get(i, j) * 3);
        expect(ab.get(i, j)).toBe(Math.abs(b.get(i, j)));
      }
    }
    expect(a.toFloat64Array()).toEqual(aCopy);
    expect(b.toFloat64Array()).toEqual(bCopy);
  });
  it('transpose, sum, sumAxis, dot work, including on views', () => {
    const t = js.transpose(a);
    expect(t.rows).toBe(4);
    expect(t.get(2, 1)).toBe(a.get(1, 2));
    expect(js.sum(a)).toBe(78);
    expect(Array.from(js.sumAxis(a, 0).toFloat64Array())).toEqual([15, 18, 21, 24]);
    expect(Array.from(js.sumAxis(a, 1).toFloat64Array())).toEqual([10, 26, 42]);
    const v = new DenseMatrix(1, 3, [1, 2, 3]);
    const w = new DenseMatrix(3, 1, [4, 5, 6]);
    expect(js.dot(v, w)).toBe(32);
    const view = stridedView();
    expect(js.sum(view)).toBe(2 + 3 + 4 + 6 + 7 + 8);
    expect(js.add(view, view).get(1, 1)).toBe(14);
    expect(js.transpose(view).get(2, 1)).toBe(8);
  });
  it('dense reductions (sum/min/max/norm) agree with get() on views', () => {
    const view = stridedView();
    expect(reduction.sum(view)).toBe(2 + 3 + 4 + 6 + 7 + 8);
    expect(reduction.min(view)).toBe(2);
    expect(reduction.max(view)).toBe(8);
    expect(reduction.norm(view)).toBeCloseTo(Math.sqrt(4 + 9 + 16 + 36 + 49 + 64), 12);
  });
});

describe('SparseMatrix.fromCOO', () => {
  it('sums duplicate entries', () => {
    const s = SparseMatrix.fromCOO(2, 2, [
      { row: 0, col: 1, value: 1 },
      { row: 0, col: 1, value: 2.5 },
      { row: 1, col: 0, value: 4 },
      { row: 1, col: 0, value: -4 },
    ]);
    expect(s.get(0, 1)).toBe(3.5);
    expect(s.get(1, 0)).toBe(0);
    expect(s.nnz).toBe(1);
    SparseMatrix.validate(s);
  });
  it('throws on out-of-range or non-integer indices', () => {
    expect(() => SparseMatrix.fromCOO(2, 2, [{ row: 2, col: 0, value: 1 }])).toThrow(RangeError);
    expect(() => SparseMatrix.fromCOO(2, 2, [{ row: 0, col: -1, value: 1 }])).toThrow(RangeError);
    expect(() => SparseMatrix.fromCOO(2, 2, [{ row: 0, col: 2, value: 1 }])).toThrow(RangeError);
    expect(() => SparseMatrix.fromCOO(2, 2, [{ row: 0.5, col: 0, value: 1 }])).toThrow(RangeError);
  });
});

describe('SparseMatrix structural validation', () => {
  it('constructor rejects out-of-range column indices and bad row pointers', () => {
    expect(() => new SparseMatrix(1, 2, [1], [2], [0, 1])).toThrow(RangeError);
    expect(() => new SparseMatrix(2, 2, [1, 1], [0, 1], [0, 2, 1])).toThrow();
    expect(() => new SparseMatrix(1, 2, [1], [0], [1, 1])).toThrow();
  });
  it('validate() rejects unsorted and duplicate columns within a row', () => {
    const unsorted = new SparseMatrix(1, 3, [1, 2], [2, 0], [0, 2]);
    expect(() => SparseMatrix.validate(unsorted)).toThrow(/strictly increasing/);
    const dup = new SparseMatrix(1, 3, [1, 2], [1, 1], [0, 2]);
    expect(() => SparseMatrix.validate(dup)).toThrow(/strictly increasing/);
  });
});

describe('SparseMatrix.transpose (counting sort)', () => {
  function oldTranspose(m: SparseMatrix): SparseMatrix {
    const entries: Array<{ row: number; col: number; value: number }> = [];
    for (let i = 0; i < m.rows; i++) {
      for (let j = 0; j < m.cols; j++) {
        const v = m.get(i, j);
        if (v !== 0) entries.push({ row: j, col: i, value: v });
      }
    }
    return SparseMatrix.fromCOO(m.cols, m.rows, entries);
  }
  it('matches the COO-based result on random sparse matrices', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let t = 0; t < 30; t++) {
      const rows = 1 + Math.floor(rnd() * 12);
      const cols = 1 + Math.floor(rnd() * 12);
      const d = new Float64Array(rows * cols);
      for (let i = 0; i < d.length; i++) d[i] = rnd() < 0.25 ? Math.round(rnd() * 20 - 10) + 0 : 0;
      const s = SparseMatrix.fromDense(new DenseMatrix(rows, cols, d));
      const fast = s.transpose();
      const slow = oldTranspose(s);
      SparseMatrix.validate(fast);
      expect(fast.rows).toBe(cols);
      expect(fast.cols).toBe(rows);
      expect(fast.nnz).toBe(slow.nnz);
      expect(Array.from(fast.toDense().toFloat64Array())).toEqual(
        Array.from(slow.toDense().toFloat64Array())
      );
      expect(Array.from(fast.transpose().toDense().toFloat64Array())).toEqual(Array.from(d));
    }
  });
});
