/** Container-preserving elementwise types, including complex sqrt/log. */
import type { Complex } from '@danielsimonjr/mathts-core';
import { log, sin, sqrt } from '@danielsimonjr/mathts-functions';
import type { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

const nums: number[] = sin([0, 1, 2]);
declare const dense: DenseMatrix;
declare const sparse: SparseMatrix;
const denseSin: DenseMatrix = sin(dense);
const sparseSin: SparseMatrix = sin(sparse);

const sqrtScalar: number | Complex = sqrt(-1);
const sqrtArr: (number | Complex)[] = sqrt([-1, 4]);
const sqrtDense: DenseMatrix | (number | Complex)[][] = sqrt(dense);

const logScalar: number | Complex = log(-1);
const logArr: (number | Complex)[] = log([0.5, -2]);

// @ts-expect-error sin has no string signature
sin('no');

// @ts-expect-error sin(number) is number, not string
const notString: string = sin(0);

// @ts-expect-error sqrt(number) may be Complex
const onlyNumber: number = sqrt(-1);

export {
  nums,
  denseSin,
  sparseSin,
  sqrtScalar,
  sqrtArr,
  sqrtDense,
  logScalar,
  logArr,
  notString,
  onlyNumber,
};
