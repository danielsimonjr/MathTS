import { validateIndex } from '../utils/array.js';
import { isMatrix } from '../utils/is.js';

interface MatrixLike {
  size(): number[];
  subset(index: unknown): unknown;
}

interface MatrixCtor {
  (data: unknown[][]): MatrixLike;
}

type IndexConstructor = new (...ranges: unknown[]) => object;

type RangeFn = (start: number, end: number) => unknown;

/**
 * Extract one row (`axis: 0`) or column (`axis: 1`) from a 2-D matrix.
 * @internal
 */
export function slice2d(
  value: MatrixLike,
  axis: 0 | 1,
  index: number,
  matrix: MatrixCtor,
  Index: IndexConstructor,
  range: RangeFn
): MatrixLike {
  if (value.size().length !== 2) {
    throw new Error('Only two dimensional matrix is supported');
  }

  if (axis === 1) {
    validateIndex(index, value.size()[1]);
    const rowRange = range(0, value.size()[0]);
    const idx = new Index(rowRange, [index]);
    const result = value.subset(idx);
    return isMatrix(result) ? (result as MatrixLike) : matrix([[result]]);
  }

  validateIndex(index, value.size()[0]);
  const columnRange = range(0, value.size()[1]);
  const idx = new Index([index], columnRange);
  const result = value.subset(idx);
  return isMatrix(result) ? (result as MatrixLike) : matrix([[result]]);
}
