/**
 * Shared axis validation and 2-D matricisation for tensor eig / SVD prep.
 * Callers supply error strings so observable messages stay function-specific.
 */

import { Tensor } from '../Tensor.js';

/** Message templates for row-axis validation and reshape (per public entry point). */
export interface ReshapeByRowAxesMessages {
  badAxis: (ax: number, rank: number) => string;
  noColAxis: string;
  noRowAxis: string;
}

/** Result of permuting row/col axes into a dense 2-D matrix view. */
export interface ReshapeByRowAxesResult {
  permuted: Tensor;
  rowDims: number[];
  colDims: number[];
  numRows: number;
  numCols: number;
  matrix: number[][];
}

/**
 * Validate `rowAxes`, build the complementary column axes, permute `t`, and
 * reshape to a row-major `number[][]` matrix. Does not enforce square shape
 * or duplicate row axes (callers add those checks when needed).
 */
export function reshapeByRowAxes(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  messages: ReshapeByRowAxesMessages
): ReshapeByRowAxesResult {
  const rank = t.shape.length;

  for (const ax of rowAxes) {
    if (!Number.isInteger(ax) || ax < 0 || ax >= rank) {
      throw new RangeError(messages.badAxis(ax, rank));
    }
  }

  const rowSet = new Set(rowAxes);
  const colAxes: number[] = [];
  for (let i = 0; i < rank; i++) {
    if (!rowSet.has(i)) colAxes.push(i);
  }

  if (colAxes.length === 0) {
    throw new Error(messages.noColAxis);
  }
  if (rowAxes.length === 0) {
    throw new Error(messages.noRowAxis);
  }

  const rowDims = rowAxes.map((ax) => t.shape[ax]);
  const colDims = colAxes.map((ax) => t.shape[ax]);
  const numRows = rowDims.reduce((a, b) => a * b, 1);
  const numCols = colDims.reduce((a, b) => a * b, 1);

  const perm = [...rowAxes, ...colAxes];
  const permuted = t.transpose(perm);

  const matrix: number[][] = Array.from({ length: numRows }, (_, i) =>
    Array.from({ length: numCols }, (_, j) => permuted.data[i * numCols + j])
  );

  return { permuted, rowDims, colDims, numRows, numCols, matrix };
}
