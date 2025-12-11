/**
 * Basic Matrix Operations Example
 *
 * Demonstrates fundamental matrix operations using @mathts/matrix
 */

import { DenseMatrix } from '@mathts/matrix';

// Create a 3x3 matrix
const matrix = new DenseMatrix(3, 3);

// Set values
matrix.set(0, 0, 1);
matrix.set(0, 1, 2);
matrix.set(0, 2, 3);
matrix.set(1, 0, 4);
matrix.set(1, 1, 5);
matrix.set(1, 2, 6);
matrix.set(2, 0, 7);
matrix.set(2, 1, 8);
matrix.set(2, 2, 9);

// Display the matrix
console.log('Matrix A:');
console.log(matrix.toArray());

// Get specific elements
console.log('\nElement at (1, 1):', matrix.get(1, 1));
console.log('Element at (2, 2):', matrix.get(2, 2));

// Matrix dimensions
console.log('\nDimensions:', matrix.rows, 'x', matrix.cols);

// Note: Additional operations like multiply, add, transpose, etc.
// are planned for future implementation with backend selection
// (JS, WASM, WebGPU) based on matrix size.
