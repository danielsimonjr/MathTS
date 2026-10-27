interface Matrix {
  type: string;
  storage(): string;
  datatype(): string | undefined;
  size(): number[];
  clone(): Matrix;
  toArray(): unknown;
  forEach?(cb: (value: unknown, index: number[], matrix: Matrix) => void): void;
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
