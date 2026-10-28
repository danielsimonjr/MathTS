import { buildSparseCscFromEntries } from './sparse-csc-tail.js';

interface Matrix {
  type: string;
  storage(): string;
  datatype(): string | undefined;
  size(): number[];
  clone(): Matrix;
  toArray(): unknown;
  forEach?(cb: (value: unknown, index: number[], matrix: Matrix) => void): void;
}

interface FlattenFunction {
  (arr: unknown): unknown[];
}

interface MatrixConstructor {
  (
    data:
      | unknown[]
      | unknown[][]
      | { values: unknown[]; index: number[]; ptr: number[]; size: number[] },
    storage?: 'dense' | 'sparse'
  ): Matrix;
}

interface SizeFunction {
  (arr: unknown): number[];
}

/**
 * Return the logical length of a 1-D or 2-D column/row vector.
 * @private
 */
/**
 * Build a sparse CSC matrix from a list of column or row vectors (zeros omitted).
 * @internal Module export only — not on the package barrel.
 */
export function sparseMatrixFromVectors(
  arr: Matrix[],
  axis: 'column' | 'row',
  size: SizeFunction,
  flatten: FlattenFunction,
  matrix: MatrixConstructor
): Matrix {
  const count = arr.length;
  const len = vectorLength(arr[0], size);
  const numRows = axis === 'column' ? len : count;
  const numCols = axis === 'column' ? count : len;
  const cscSize: [number, number] = [numRows, numCols];

  const entries: { row: number; col: number; value: unknown }[] = [];

  for (let j = 0; j < count; j++) {
    const vec = arr[j];
    const alongLen = vectorLength(vec, size);
    if (alongLen !== len) {
      throw new TypeError(
        'The vectors had different length: ' + (len | 0) + ' ≠ ' + (alongLen | 0)
      );
    }

    if (typeof vec.forEach === 'function') {
      const s = size(vec);
      const is1D = s.length === 1;
      const isCol = s.length === 2 && s[1] === 1;

      vec.forEach((val, idx) => {
        let along: number;
        if (is1D) {
          along = idx[0];
        } else if (isCol) {
          along = idx[0];
        } else {
          along = idx[1];
        }
        const row = axis === 'column' ? along : j;
        const col = axis === 'column' ? j : along;
        if (val !== 0) {
          entries.push({ row, col, value: val });
        }
      });
    } else {
      const f = flatten(vec);
      for (let k = 0; k < len; k++) {
        if (f[k] !== 0) {
          const row = axis === 'column' ? k : j;
          const col = axis === 'column' ? j : k;
          entries.push({ row, col, value: f[k] });
        }
      }
    }
  }

  return buildSparseCscFromEntries(entries, numCols, cscSize, matrix) as Matrix;
}

export function vectorLength(vec: unknown, size: SizeFunction): number {
  const s = size(vec);

  if (s.length === 1) {
    return s[0];
  } else if (s.length === 2) {
    if (s[0] === 1) {
      return s[1];
    } else if (s[1] === 1) {
      return s[0];
    } else {
      throw new TypeError('At least one of the arguments is not a vector.');
    }
  } else {
    throw new TypeError('Only one- or two-dimensional vectors are supported.');
  }
}

/**
 * Shared variadic handler for `matrixFromColumns` / `matrixFromRows`.
 * @private
 */
export function matrixFromVectorList(
  arr: (unknown[] | Matrix)[],
  kind: 'column' | 'row',
  matrix: MatrixConstructor,
  createSparse: (arr: Matrix[]) => Matrix,
  createArray: (arrays: unknown[]) => unknown[][]
): unknown[][] | Matrix {
  if (arr.length === 0) {
    throw new TypeError(
      kind === 'column'
        ? 'At least one column is needed to construct a matrix.'
        : 'At least one row is needed to construct a matrix.'
    );
  }

  const allMatrix = arr.every(
    (item) => typeof (item as { toArray?: unknown }).toArray === 'function'
  );
  const hasArray = arr.some((item) => Array.isArray(item));

  const isSparse =
    allMatrix &&
    !hasArray &&
    arr.some(
      (item) =>
        typeof (item as Matrix).storage === 'function' && (item as Matrix).storage() === 'sparse'
    );

  if (isSparse) {
    return createSparse(arr as Matrix[]);
  }

  const arrays = arr.map((item) =>
    typeof (item as { toArray?: unknown }).toArray === 'function'
      ? (item as Matrix).toArray()
      : item
  );

  const result = createArray(arrays);

  if (allMatrix && !hasArray) {
    return matrix(result, 'dense');
  }
  return result;
}
