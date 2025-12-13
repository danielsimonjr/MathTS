/**
 * Matrix Operations Example
 *
 * Demonstrates matrix creation and operations.
 *
 * Run: npx tsx examples/matrix-operations.ts
 */

import { DenseMatrix, SparseMatrix } from '@mathts/matrix';

console.log('=== MathTS Matrix Operations ===\n');

// Creating matrices
console.log('--- Creating Matrices ---');

const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);
console.log('Matrix A:');
console.log(A.toArray());

const I3 = DenseMatrix.identity(3);
console.log('\nIdentity matrix I3:');
console.log(I3.toArray());

const zeros = DenseMatrix.zeros(2, 3);
console.log('\nZeros(2, 3):');
console.log(zeros.toArray());

const ones = DenseMatrix.ones(2, 2);
console.log('\nOnes(2, 2):');
console.log(ones.toArray());

// Element access
console.log('\n--- Element Access ---');
console.log('A.get(1, 2) =', A.get(1, 2)); // Row 1, Col 2 = 6
console.log('A.rows =', A.rows);
console.log('A.cols =', A.cols);

// Row and column extraction
console.log('\n--- Rows and Columns ---');
console.log('A.row(0):');
console.log(A.row(0).toArray());
console.log('A.column(1):');
console.log(A.column(1).toArray());

// Arithmetic operations
console.log('\n--- Arithmetic Operations ---');

const B = DenseMatrix.fromArray([
  [9, 8, 7],
  [6, 5, 4],
  [3, 2, 1],
]);

console.log('Matrix B:');
console.log(B.toArray());

console.log('\nA + B:');
console.log(A.add(B).toArray());

console.log('\nA - B:');
console.log(A.subtract(B).toArray());

console.log('\nA * 2 (scalar):');
console.log(A.scale(2).toArray());

// Matrix multiplication
console.log('\n--- Matrix Multiplication ---');

const C = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);

const D = DenseMatrix.fromArray([
  [5, 6],
  [7, 8],
]);

console.log('Matrix C:');
console.log(C.toArray());
console.log('\nMatrix D:');
console.log(D.toArray());
console.log('\nC * D:');
console.log(C.multiply(D).toArray());

// Transpose
console.log('\n--- Transpose ---');
const E = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
]);
console.log('Matrix E:');
console.log(E.toArray());
console.log('\nE.transpose():');
console.log(E.transpose().toArray());

// Reductions
console.log('\n--- Reductions ---');
console.log('A.sum() =', A.sum());
console.log('A.mean() =', A.mean());
console.log('A.min() =', A.min());
console.log('A.max() =', A.max());
console.log('A.trace() =', A.trace());
console.log('A.norm() =', A.norm());

// Sparse matrices
console.log('\n--- Sparse Matrices ---');
const sparse = SparseMatrix.fromDense(
  DenseMatrix.fromArray([
    [1, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 3, 0],
    [0, 0, 0, 4],
  ])
);
console.log('Sparse diagonal matrix:');
console.log('nnz (non-zeros):', sparse.nnz);
console.log('density:', sparse.density);
console.log('Element (2,2):', sparse.get(2, 2));

// Converting dense to sparse
console.log('\n--- Dense to Sparse Conversion ---');
const denseWithZeros = DenseMatrix.fromArray([
  [1, 0, 2],
  [0, 0, 0],
  [3, 0, 4],
]);
console.log('Dense matrix:');
console.log(denseWithZeros.toArray());

const sparseVersion = denseWithZeros.toSparse();
console.log('As sparse - nnz:', sparseVersion.nnz);

console.log('\n=== Done ===');
