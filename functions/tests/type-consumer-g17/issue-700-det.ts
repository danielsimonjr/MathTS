/** Exact repro from dogfood #700 */
import type { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import { det } from '@danielsimonjr/mathts-functions';
import type { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const d: number = det([
  [1, 2],
  [3, 4],
]);

declare const matrix: DenseMatrix;
const other: number | BigNumber | Complex = det(matrix);

// @ts-expect-error a matrix determinant stays the scalar union
const narrowed: number = det(matrix);

export { d, other, narrowed };
