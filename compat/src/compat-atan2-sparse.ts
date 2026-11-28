/**
 * mathjs 15.3.0 `atan2` sparse-matrix semantics (#1789): evaluate every grid cell
 * because `atan2(0, x) ≠ 0` when `x < 0` and `atan2(y, 0) ≠ 0` when `y ≠ 0`.
 */

import { isSparseMatrix } from '@danielsimonjr/mathts-matrix';
import { isBigNumber, isNumber } from '@danielsimonjr/mathts-core';

type MatrixLike = {
  isMatrix?: boolean;
  size?: () => number[];
  toArray?: () => unknown[] | unknown[][];
  get?: (index: number[]) => unknown;
  storage?: () => string;
};

type DenseCtor = new (data: unknown) => unknown;
type SparseCtor = new (data: unknown) => unknown;

function isMatrixValue(value: unknown): value is MatrixLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as MatrixLike).isMatrix === true &&
    typeof (value as MatrixLike).size === 'function'
  );
}

function isNestedArray(value: unknown): value is unknown[][] {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
}

function isSparseOperand(value: unknown): boolean {
  if (isSparseMatrix(value)) return true;
  if (typeof value === 'object' && value !== null) {
    const m = value as MatrixLike;
    return m.isMatrix === true && m.storage?.() === 'sparse';
  }
  return false;
}

function scalarAt(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isBigNumber(value)) return (value as { toNumber(): number }).toNumber();
  return Number(value);
}

function readCell(matrix: MatrixLike, row: number, col: number): unknown {
  if (typeof matrix.get === 'function') {
    return matrix.get([row, col]);
  }
  const data = matrix.toArray?.();
  if (Array.isArray(data) && Array.isArray(data[row])) {
    return (data[row] as unknown[])[col];
  }
  return 0;
}

function readArrayCell(data: unknown[][], row: number, col: number): unknown {
  const rowData = data[row];
  if (!Array.isArray(rowData)) return 0;
  const value = rowData[col];
  return value === undefined ? 0 : value;
}

function toNumericCell(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (isNumber(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isBigNumber(value)) return (value as { toNumber(): number }).toNumber();
  return Number(value);
}

function sizeOf(value: unknown): number[] | null {
  if (isMatrixValue(value)) return value.size!();
  if (isNestedArray(value)) return [value.length, (value[0] as unknown[]).length];
  return null;
}

function broadcastSizes(a: number[], b: number[]): number[] {
  const out: number[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[a.length - n + i] ?? 1;
    const bi = b[b.length - n + i] ?? 1;
    if (ai !== bi && ai !== 1 && bi !== 1) {
      throw new RangeError(`Dimension mismatch in atan2 (${a} vs ${b})`);
    }
    out.push(Math.max(ai, bi));
  }
  return out;
}

function evaluateAt(
  y: unknown,
  x: unknown,
  row: number,
  col: number,
  scalarY: number | null,
  scalarX: number | null
): number {
  let yv: number;
  let xv: number;
  if (scalarY !== null) {
    yv = scalarY;
  } else if (isNestedArray(y)) {
    yv = toNumericCell(readArrayCell(y, row, col));
  } else if (isMatrixValue(y)) {
    yv = toNumericCell(readCell(y, row, col));
  } else {
    yv = 0;
  }
  if (scalarX !== null) {
    xv = scalarX;
  } else if (isNestedArray(x)) {
    xv = toNumericCell(readArrayCell(x, row, col));
  } else if (isMatrixValue(x)) {
    xv = toNumericCell(readCell(x, row, col));
  } else {
    xv = 0;
  }
  return Math.atan2(yv, xv);
}

function evaluateDenseGrid(
  y: unknown,
  x: unknown,
  size: number[],
  scalarY: number | null,
  scalarX: number | null
): number[][] {
  const rows = size[0];
  const cols = size[1] ?? 1;
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(evaluateAt(y, x, i, j, scalarY, scalarX));
    }
    out.push(row);
  }
  return out;
}

/** Options for {@link createCompatAtan2}. */
export type CompatAtan2Options = {
  DenseMatrix: DenseCtor;
  SparseMatrix: SparseCtor;
};

/**
 * Wrap `atan2` so sparse grids follow mathjs union semantics (matAlgo05xSfSf), and
 * `atan2(null)` surfaces the mathjs conversion error.
 *
 * @param base - The underlying typed `atan2`.
 * @param options - Matrix constructors for the compat instance.
 * @returns The wrapped `atan2`.
 */
export function createCompatAtan2(
  base: (...args: unknown[]) => unknown,
  options: CompatAtan2Options
): (...args: unknown[]) => unknown {
  const { DenseMatrix, SparseMatrix } = options;
  return (...args: unknown[]): unknown => {
    if (args.length === 1 && (args[0] === null || args[0] === undefined)) {
      throw new TypeError('Unexpected type of argument (type: null, value: null)');
    }
    if (args.length < 2) {
      return base(...args);
    }
    const [y, x] = args;
    const yMatrix = isMatrixValue(y);
    const xMatrix = isMatrixValue(x);
    const yArray = isNestedArray(y);
    const xArray = isNestedArray(x);
    const yScalar = !yMatrix && !yArray;
    const xScalar = !xMatrix && !xArray;
    const ySparse = yMatrix && isSparseOperand(y);
    const xSparse = xMatrix && isSparseOperand(x);
    const touchesSparse = ySparse || xSparse;
    if (!touchesSparse) {
      return base(...args);
    }
    const ySize = sizeOf(y) ?? [1];
    const xSize = sizeOf(x) ?? [1];
    const size = broadcastSizes(ySize, xSize);
    const scalarY = yScalar ? scalarAt(y) : null;
    const scalarX = xScalar ? scalarAt(x) : null;
    const grid = evaluateDenseGrid(y, x, size, scalarY, scalarX);

    if (ySparse && xSparse) {
      return new SparseMatrix(grid);
    }
    if (ySparse && xScalar && scalarX !== null) {
      const fzero = Math.atan2(0, scalarX);
      return fzero === 0 ? new SparseMatrix(grid) : new DenseMatrix(grid);
    }
    if (xSparse && yScalar && scalarY !== null) {
      const fzero = Math.atan2(scalarY, 0);
      return fzero === 0 ? new SparseMatrix(grid) : new DenseMatrix(grid);
    }
    return new DenseMatrix(grid);
  };
}
