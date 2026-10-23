/**
 * Basic Matrix Operations Example
 *
 * Demonstrates fundamental matrix operations using @danielsimonjr/mathts-matrix
 *
 * Run from repo root:
 *   bun --tsconfig-override=tsconfig.base.json examples/basic-matrix.ts
 */

import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// DenseMatrix.set returns a new matrix (copy-on-write)
let matrix = new DenseMatrix(3, 3);
matrix = matrix.set(0, 0, 1);
matrix = matrix.set(0, 1, 2);
matrix = matrix.set(0, 2, 3);
matrix = matrix.set(1, 0, 4);
matrix = matrix.set(1, 1, 5);
matrix = matrix.set(1, 2, 6);
matrix = matrix.set(2, 0, 7);
matrix = matrix.set(2, 1, 8);
matrix = matrix.set(2, 2, 9);

console.log('Matrix A:');
console.log(matrix.toArray());

console.log('\nElement at (1, 1):', matrix.get(1, 1));
console.log('Element at (2, 2):', matrix.get(2, 2));
console.log('\nDimensions:', matrix.rows, 'x', matrix.cols);

const transposed = matrix.transpose();
console.log('\nTranspose A^T:');
console.log(transposed.toArray());
