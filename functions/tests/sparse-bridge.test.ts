import { describe, it, expect } from 'vitest';
import { MathJSSparseMatrix, createMatrixBridge } from '../src/factories/matrix-bridge.js';

/** Duck-type markers attached to bridge matrix instances. */
type MatrixMarkers = {
  isMatrix?: boolean;
  isDenseMatrix?: boolean;
  isSparseMatrix?: boolean;
  type?: string;
};

describe('MathJSSparseMatrix', () => {
  // ---- Construction ----

  describe('construction', () => {
    it('creates empty matrix with no args', () => {
      const s = new MathJSSparseMatrix();
      expect(s._values).toEqual([]);
      expect(s._index).toEqual([]);
      expect(s._ptr).toEqual([0]);
      expect(s._size).toEqual([0, 0]);
      expect(s.storage()).toBe('sparse');
    });

    it('constructs from dense 2D array', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      expect(s._values).toEqual([1, 2]);
      expect(s._index).toEqual([0, 1]);
      expect(s._ptr).toEqual([0, 1, 2]);
      expect(s._size).toEqual([2, 2]);
    });

    it('constructs from CSC object with values/index/ptr/size', () => {
      const s = new MathJSSparseMatrix({
        values: [3, 5, 7],
        index: [0, 1, 0],
        ptr: [0, 2, 3],
        size: [2, 2],
      });
      expect(s._values).toEqual([3, 5, 7]);
      expect(s._index).toEqual([0, 1, 0]);
      expect(s._ptr).toEqual([0, 2, 3]);
      expect(s._size).toEqual([2, 2]);
    });

    it('constructs from CSC object with underscore-prefixed fields', () => {
      const s = new MathJSSparseMatrix({
        _values: [10, 20],
        _index: [0, 1],
        _ptr: [0, 1, 2],
        _size: [2, 2],
      });
      expect(s._values).toEqual([10, 20]);
      expect(s.get([0, 0])).toBe(10);
      expect(s.get([1, 1])).toBe(20);
    });

    it('constructs from { data, size } object', () => {
      const s = new MathJSSparseMatrix({
        data: [
          [1, 0, 3],
          [0, 2, 0],
        ],
        size: [2, 3],
      });
      expect(s.get([0, 0])).toBe(1);
      expect(s.get([0, 1])).toBe(0);
      expect(s.get([1, 1])).toBe(2);
      expect(s.get([0, 2])).toBe(3);
    });

    it('handles pattern-only matrix (values = null)', () => {
      const s = new MathJSSparseMatrix({
        values: null,
        index: [0, 1],
        ptr: [0, 1, 2],
        size: [2, 2],
      });
      expect(s._values).toBeNull();
      // Pattern matrices return 1 for non-zero entries
      expect(s.get([0, 0])).toBe(1);
      expect(s.get([1, 0])).toBe(0);
      expect(s.get([1, 1])).toBe(1);
    });
  });

  // ---- Duck-typing markers ----

  describe('duck-typing', () => {
    it('has correct type markers', () => {
      const s = new MathJSSparseMatrix();
      expect((s as MatrixMarkers).isSparseMatrix).toBe(true);
      expect((s as MatrixMarkers).isMatrix).toBe(true);
      expect((s as MatrixMarkers).isDenseMatrix).toBe(false);
      expect((s as MatrixMarkers).type).toBe('SparseMatrix');
    });

    it('has rows and cols getters', () => {
      const s = new MathJSSparseMatrix([
        [1, 0, 3],
        [0, 2, 0],
      ]);
      expect(s.rows).toBe(2);
      expect(s.cols).toBe(3);
    });
  });

  // ---- get / set ----

  describe('get', () => {
    it('returns correct values', () => {
      const s = new MathJSSparseMatrix([
        [1, 0, 3],
        [0, 2, 0],
      ]);
      expect(s.get([0, 0])).toBe(1);
      expect(s.get([0, 1])).toBe(0);
      expect(s.get([1, 1])).toBe(2);
      expect(s.get([0, 2])).toBe(3);
      expect(s.get([1, 0])).toBe(0);
      expect(s.get([1, 2])).toBe(0);
    });

    it('throws on out-of-range index', () => {
      const s = new MathJSSparseMatrix([[1]]);
      expect(() => s.get([1, 0])).toThrow(RangeError);
      expect(() => s.get([0, 1])).toThrow(RangeError);
    });
  });

  describe('set', () => {
    it('updates existing entry', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      s.set([0, 0], 99);
      expect(s.get([0, 0])).toBe(99);
      expect(s._values).toEqual([99, 2]);
    });

    it('inserts new entry', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      s.set([1, 0], 7);
      expect(s.get([1, 0])).toBe(7);
      // Column 0 should now have entries at rows 0 and 1
      expect(s._ptr[1] - s._ptr[0]).toBe(2);
    });

    it('removes entry when set to zero', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      s.set([0, 0], 0);
      expect(s.get([0, 0])).toBe(0);
      expect(s._values!.length).toBe(1); // only the 2 remains
    });

    it('expands matrix dimensions as needed', () => {
      const s = new MathJSSparseMatrix([[1]]);
      s.set([2, 3], 5);
      expect(s._size).toEqual([3, 4]);
      expect(s.get([2, 3])).toBe(5);
    });

    it('returns this for chaining', () => {
      const s = new MathJSSparseMatrix([[0]]);
      const result = s.set([0, 0], 1);
      expect(result).toBe(s);
    });
  });

  // ---- valueOf / toArray ----

  describe('valueOf / toArray', () => {
    it('reconstructs dense array from CSC', () => {
      const data = [
        [1, 0],
        [0, 2],
      ];
      const s = new MathJSSparseMatrix(data);
      expect(s.valueOf()).toEqual(data);
      expect(s.toArray()).toEqual(data);
    });

    it('handles 3x3 sparse matrix', () => {
      const data = [
        [0, 0, 3],
        [4, 0, 0],
        [0, 5, 0],
      ];
      const s = new MathJSSparseMatrix(data);
      expect(s.valueOf()).toEqual(data);
    });
  });

  // ---- clone ----

  describe('clone', () => {
    it('creates independent copy', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      const c = s.clone();
      c.set([0, 0], 99);
      expect(s.get([0, 0])).toBe(1); // original unchanged
      expect(c.get([0, 0])).toBe(99);
    });

    it('preserves datatype', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      s._datatype = 'number';
      const c = s.clone();
      expect(c._datatype).toBe('number');
    });
  });

  // ---- create / createSparseMatrix ----

  describe('create / createSparseMatrix', () => {
    it('create() builds from dense array', () => {
      const s = new MathJSSparseMatrix();
      const m = s.create([
        [1, 2],
        [3, 4],
      ]);
      expect(m).toBeInstanceOf(MathJSSparseMatrix);
      expect(m.get([0, 0])).toBe(1);
      expect(m.get([1, 1])).toBe(4);
    });

    it('createSparseMatrix() builds from CSC opts', () => {
      const s = new MathJSSparseMatrix();
      const m = s.createSparseMatrix({
        values: [5, 10],
        index: [0, 1],
        ptr: [0, 1, 2],
        size: [2, 2],
      });
      expect(m).toBeInstanceOf(MathJSSparseMatrix);
      expect(m.get([0, 0])).toBe(5);
      expect(m.get([1, 1])).toBe(10);
    });
  });

  // ---- map / forEach ----

  describe('map', () => {
    it('maps non-zero values', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      const doubled = s.map((v) => v * 2);
      expect(doubled.valueOf()).toEqual([
        [2, 0],
        [0, 4],
      ]);
    });

    it('removes entries that map to zero', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      const zeroed = s.map(() => 0);
      expect(zeroed._values).toEqual([]);
      expect(zeroed._index).toEqual([]);
    });
  });

  describe('forEach', () => {
    it('iterates over non-zero elements', () => {
      const s = new MathJSSparseMatrix([
        [1, 0, 3],
        [0, 2, 0],
      ]);
      const entries: [number, number, number][] = [];
      s.forEach((v, idx) => {
        entries.push([idx[0], idx[1], v]);
      });
      expect(entries).toEqual([
        [0, 0, 1],
        [1, 1, 2],
        [0, 2, 3],
      ]);
    });
  });

  // ---- resize ----

  describe('resize', () => {
    it('truncates rows', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
        [3, 0],
      ]);
      s.resize([2, 2]);
      expect(s._size).toEqual([2, 2]);
      expect(s.valueOf()).toEqual([
        [1, 0],
        [0, 2],
      ]);
    });

    it('truncates columns', () => {
      const s = new MathJSSparseMatrix([
        [1, 0, 3],
        [0, 2, 0],
      ]);
      s.resize([2, 2]);
      expect(s._size).toEqual([2, 2]);
      expect(s.valueOf()).toEqual([
        [1, 0],
        [0, 2],
      ]);
    });

    it('extends columns', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      s.resize([2, 4]);
      expect(s._size).toEqual([2, 4]);
      expect(s._ptr.length).toBe(5); // 4 cols + 1
    });
  });

  // ---- Static methods for algebra factories ----

  describe('static _swapRows', () => {
    it('swaps two rows in CSC arrays', () => {
      // Matrix: [[1, 2], [3, 4]]
      const values = [1, 3, 2, 4];
      const index = [0, 1, 0, 1];
      const ptr = [0, 2, 4];
      MathJSSparseMatrix._swapRows(0, 1, 2, values, index, ptr);
      // After swap: [[3, 4], [1, 2]]
      // Col 0: row 0->3, row 1->1 => swap => row 0->1, row 1->3
      expect(values).toEqual([3, 1, 4, 2]);
    });

    it('handles swap when only one row has entry', () => {
      // Matrix: [[1, 0], [0, 2]]
      const values = [1, 2];
      const index = [0, 1];
      const ptr = [0, 1, 2];
      MathJSSparseMatrix._swapRows(0, 1, 2, values, index, ptr);
      // After swap: row indices should change
      expect(index).toEqual([1, 0]);
    });
  });

  describe('static _forEachRow', () => {
    it('iterates entries in a given row', () => {
      // Matrix: [[1, 2, 3], [4, 5, 6]]
      const values = [1, 4, 2, 5, 3, 6];
      const index = [0, 1, 0, 1, 0, 1];
      const ptr = [0, 2, 4, 6];
      const row0: [number, number][] = [];
      MathJSSparseMatrix._forEachRow(0, values, index, ptr, (col, val) => {
        row0.push([col, val]);
      });
      expect(row0).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
      ]);
    });
  });

  describe('static diagonal', () => {
    it('creates identity-like diagonal', () => {
      const s = MathJSSparseMatrix.diagonal([3, 3], 1);
      expect(s.valueOf()).toEqual([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]);
    });

    it('creates diagonal from array of values', () => {
      const s = MathJSSparseMatrix.diagonal([3, 3], [2, 4, 6]);
      expect(s.valueOf()).toEqual([
        [2, 0, 0],
        [0, 4, 0],
        [0, 0, 6],
      ]);
    });

    it('handles offset diagonal', () => {
      const s = MathJSSparseMatrix.diagonal([3, 3], 1, 1);
      expect(s.valueOf()).toEqual([
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ]);
    });
  });

  // ---- Matrix bridge integration ----

  describe('createMatrixBridge', () => {
    const matrix = createMatrixBridge();

    it('creates sparse matrix via matrix("sparse")', () => {
      const s = matrix('sparse');
      expect(s).toBeInstanceOf(MathJSSparseMatrix);
      expect(s.storage()).toBe('sparse');
    });

    it('creates sparse matrix from data via matrix(data, "sparse")', () => {
      const s = matrix(
        [
          [1, 0],
          [0, 2],
        ],
        'sparse'
      );
      expect(s).toBeInstanceOf(MathJSSparseMatrix);
      expect(s.get([0, 0])).toBe(1);
    });
  });

  // ---- toJSON / toString ----

  describe('serialization', () => {
    it('toJSON returns CSC representation', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      const json = s.toJSON();
      expect(json.mathjs).toBe('SparseMatrix');
      expect(json.values).toEqual([1, 2]);
      expect(json.index).toEqual([0, 1]);
      expect(json.ptr).toEqual([0, 1, 2]);
      expect(json.size).toEqual([2, 2]);
    });

    it('toString shows sparse format', () => {
      const s = new MathJSSparseMatrix([
        [1, 0],
        [0, 2],
      ]);
      const str = s.toString();
      expect(str).toContain('Sparse Matrix');
      expect(str).toContain('2 non-zero');
    });
  });
});
