/**
 * Matrix Bridge and Matrix Factory Tests
 *
 * Tests the MathJSDenseMatrix compatibility adapter and the factory
 * functions it unlocks (transpose, identity, zeros, ones, diag, etc.).
 */

import { describe, it, expect } from 'vitest';
import {
  MathJSDenseMatrix,
  MathJSSparseMatrix,
  createMatrixBridge,
} from '../src/factories/matrix-bridge.js';
import {
  factory_transpose,
  factory_ctranspose,
  identity,
  zeros,
  ones,
  diag,
  kron,
  matrixFromFunction,
  matrixFromColumns,
  matrixFromRows,
  count,
  trace,
  det,
  reshape,
} from '../src/factories/index.js';

// ---------------------------------------------------------------------------
// MathJSDenseMatrix adapter
// ---------------------------------------------------------------------------

describe('MathJSDenseMatrix', () => {
  it('creates from nested array with correct _data and _size', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    expect(m._data).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(m._size).toEqual([2, 2]);
  });

  it('creates from {data, size} object', () => {
    const m = new MathJSDenseMatrix({
      data: [
        [5, 6],
        [7, 8],
      ],
      size: [2, 2],
    });
    expect(m._data).toEqual([
      [5, 6],
      [7, 8],
    ]);
    expect(m._size).toEqual([2, 2]);
  });

  it('creates empty matrix when called with no args', () => {
    const m = new MathJSDenseMatrix();
    expect(m._data).toEqual([]);
    expect(m._size).toEqual([0, 0]);
  });

  it('storage() returns "dense"', () => {
    const m = new MathJSDenseMatrix([[1]]);
    expect(m.storage()).toBe('dense');
  });

  it('valueOf() returns the internal _data reference', () => {
    const data = [
      [1, 2],
      [3, 4],
    ];
    const m = new MathJSDenseMatrix(data);
    expect(m.valueOf()).toBe(data);
  });

  it('size() returns a copy of _size', () => {
    const m = new MathJSDenseMatrix([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    const s = m.size();
    expect(s).toEqual([2, 3]);
    // Mutating the returned array should not affect the matrix
    s[0] = 99;
    expect(m._size[0]).toBe(2);
  });

  it('has isDenseMatrix and isMatrix duck-type markers', () => {
    const m = new MathJSDenseMatrix([[1]]);
    expect((m as any).isDenseMatrix).toBe(true);
    expect((m as any).isMatrix).toBe(true);
    expect((m as any).type).toBe('DenseMatrix');
  });

  it('get() retrieves element by [row, col]', () => {
    const m = new MathJSDenseMatrix([
      [10, 20],
      [30, 40],
    ]);
    expect(m.get([0, 0])).toBe(10);
    expect(m.get([0, 1])).toBe(20);
    expect(m.get([1, 0])).toBe(30);
    expect(m.get([1, 1])).toBe(40);
  });

  it('set() mutates element in place', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    m.set([0, 1], 99);
    expect(m._data[0][1]).toBe(99);
  });

  it('map() produces a new matrix with transformed values', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const doubled = m.map((v) => v * 2);
    expect(doubled._data).toEqual([
      [2, 4],
      [6, 8],
    ]);
    // Original unchanged
    expect(m._data).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('forEach() visits every element', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const visited: Array<{ value: number; index: number[] }> = [];
    m.forEach((value, index) => visited.push({ value, index }));
    expect(visited).toEqual([
      { value: 1, index: [0, 0] },
      { value: 2, index: [0, 1] },
      { value: 3, index: [1, 0] },
      { value: 4, index: [1, 1] },
    ]);
  });

  it('clone() creates an independent copy', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const c = m.clone();
    c.set([0, 0], 99);
    expect(m.get([0, 0])).toBe(1);
    expect(c.get([0, 0])).toBe(99);
  });

  it('toArray() returns a deep copy', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const arr = m.toArray();
    arr[0][0] = 99;
    expect(m._data[0][0]).toBe(1);
  });

  it('toJSON() returns mathjs-compatible format', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const json = m.toJSON();
    expect(json.mathjs).toBe('DenseMatrix');
    expect(json.data).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(json.size).toEqual([2, 2]);
  });

  it('resize() pads with default value (mutates in place)', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const r = m.resize([3, 3], 0);
    expect(r).toBe(m); // Mutates in place
    expect(m._data).toEqual([
      [1, 2, 0],
      [3, 4, 0],
      [0, 0, 0],
    ]);
    expect(m._size).toEqual([3, 3]);
  });

  it('converts to/from native DenseMatrix', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const native = m.toNative();
    expect(native.rows).toBe(2);
    expect(native.cols).toBe(2);
    const back = MathJSDenseMatrix.fromNative(native);
    expect(back._data).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

// ---------------------------------------------------------------------------
// MathJSSparseMatrix stub
// ---------------------------------------------------------------------------

describe('MathJSSparseMatrix', () => {
  it('reports storage as "sparse"', () => {
    const m = new MathJSSparseMatrix([
      [1, 0],
      [0, 2],
    ]);
    expect(m.storage()).toBe('sparse');
  });

  it('has isSparseMatrix marker', () => {
    const m = new MathJSSparseMatrix([[1]]);
    expect((m as any).isSparseMatrix).toBe(true);
    expect((m as any).isMatrix).toBe(true);
    expect((m as any).isDenseMatrix).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createMatrixBridge factory
// ---------------------------------------------------------------------------

describe('createMatrixBridge', () => {
  const matrix = createMatrixBridge();

  it('creates empty matrix with no args', () => {
    const m = matrix();
    expect(m._data).toEqual([]);
  });

  it('creates dense matrix from array', () => {
    const m = matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(m._data).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect((m as any).isDenseMatrix).toBe(true);
  });

  it('creates sparse matrix when storageType is "sparse"', () => {
    const m = matrix(
      [
        [1, 0],
        [0, 2],
      ],
      'sparse'
    );
    expect(m.storage()).toBe('sparse');
    expect((m as any).isSparseMatrix).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Activated matrix factories
// ---------------------------------------------------------------------------

describe('transpose factory', () => {
  it('transposes a 2D array', () => {
    const result = factory_transpose([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(result).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('transposes a MathJSDenseMatrix', () => {
    const m = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const result = factory_transpose(m);
    expect((result as any).isMatrix).toBe(true);
    expect(result.valueOf()).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('passes scalars through unchanged', () => {
    expect(factory_transpose(42)).toBe(42);
  });
});

describe('ctranspose factory', () => {
  it('conjugate-transposes a real matrix (same as transpose)', () => {
    const result = factory_ctranspose([
      [1, 2],
      [3, 4],
    ]);
    expect(result).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
});

describe('identity factory', () => {
  it('creates 3x3 identity (default config returns Matrix)', () => {
    // Default config: matrix='Matrix', so identity(n) returns a Matrix
    const result = identity(3);
    expect((result as any).isMatrix).toBe(true);
    expect(result.valueOf()).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('creates rectangular identity from array spec (returns plain array)', () => {
    // identity([rows, cols]) matches Array signature which returns plain array
    const result = identity([2, 3]);
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
  });

  it('creates identity matrix with explicit dense format', () => {
    const result = identity([2, 2], 'dense');
    expect((result as any).isMatrix).toBe(true);
    expect(result.valueOf()).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe('zeros factory', () => {
  it('creates zero matrix (default config returns Matrix)', () => {
    const result = zeros(2, 3);
    expect((result as any).isMatrix).toBe(true);
    expect(result.valueOf()).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('creates zero vector (default config returns Matrix)', () => {
    const result = zeros(3);
    expect((result as any).isMatrix).toBe(true);
    // 1D matrix stores flat values
    expect(result.size()).toEqual([3]);
  });
});

describe('ones factory', () => {
  it('creates ones matrix (default config returns Matrix)', () => {
    const result = ones(2, 2);
    expect((result as any).isMatrix).toBe(true);
    expect(result.valueOf()).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});

describe('diag factory', () => {
  it('creates diagonal matrix from array (returns plain array)', () => {
    // diag(Array) passes format=null, so valueOf() is returned as plain array
    const result = diag([1, 2, 3]);
    expect(result).toEqual([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
  });

  it('extracts diagonal from matrix', () => {
    const m = new MathJSDenseMatrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const result = diag(m);
    expect((result as any).isMatrix).toBe(true);
    const vals = result.valueOf();
    expect(vals).toEqual([1, 5, 9]);
  });
});

describe('kron factory', () => {
  it('computes Kronecker product of two arrays', () => {
    const result = kron(
      [
        [1, 0],
        [0, 1],
      ],
      [
        [1, 2],
        [3, 4],
      ]
    );
    expect(result).toEqual([
      [1, 2, 0, 0],
      [3, 4, 0, 0],
      [0, 0, 1, 2],
      [0, 0, 3, 4],
    ]);
  });
});

describe('count factory', () => {
  it('counts elements in an array', () => {
    expect(count([1, 2, 3])).toBe(3);
  });

  it('counts elements in a 2D array', () => {
    expect(
      count([
        [1, 2],
        [3, 4],
        [5, 6],
      ])
    ).toBe(6);
  });
});

describe('trace factory', () => {
  it('computes trace of a 2D array', () => {
    const result = trace([
      [1, 2],
      [3, 4],
    ]);
    expect(result).toBe(5);
  });

  it('computes trace of a MathJSDenseMatrix', () => {
    const m = new MathJSDenseMatrix([
      [10, 0],
      [0, 20],
    ]);
    const result = trace(m);
    expect(result).toBe(30);
  });
});

describe('det factory', () => {
  it('computes determinant of 1x1', () => {
    expect(det([[5]])).toBe(5);
  });

  it('computes determinant of 2x2', () => {
    // det([[1,2],[3,4]]) = 1*4 - 2*3 = -2
    const result = det([
      [1, 2],
      [3, 4],
    ]);
    expect(result).toBeCloseTo(-2);
  });

  it('computes determinant of 3x3', () => {
    // det([[1,2,3],[4,5,6],[7,8,10]]) = -3
    const result = det([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10],
    ]);
    expect(result).toBeCloseTo(-3);
  });
});

describe('reshape factory', () => {
  it('reshapes a flat array into a matrix', () => {
    const result = reshape([1, 2, 3, 4, 5, 6], [2, 3]);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });
});

describe('matrixFromFunction factory', () => {
  it('creates matrix from callback (Array signature returns array)', () => {
    // 'Array, function' signature returns .toArray() result
    const result = matrixFromFunction([2, 3], (i: number[]) => i[0] * 3 + i[1]);
    expect(result).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });
});

describe('matrixFromColumns factory', () => {
  it('creates matrix from column vectors', () => {
    const result = matrixFromColumns([1, 2, 3], [4, 5, 6]);
    expect(result).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });
});

describe('matrixFromRows factory', () => {
  it('creates matrix from row vectors', () => {
    const result = matrixFromRows([1, 2, 3], [4, 5, 6]);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });
});
