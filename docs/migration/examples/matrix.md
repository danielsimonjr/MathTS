# Matrix Migration Example

Migrating matrix operations from mathjs to MathTS.

## Before (mathjs)

```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Create matrices
const A = math.matrix([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);

const B = math.matrix([
  [9, 8, 7],
  [6, 5, 4],
  [3, 2, 1],
]);

// Matrix operations
const sum = math.add(A, B);
const product = math.multiply(A, B);
const transposed = math.transpose(A);
const determinant = math.det(A);

// Identity and zeros
const I3 = math.identity(3);
const Z = math.zeros(2, 3);

// Element access
const element = A.get([1, 2]); // mathjs uses array notation
const size = A.size();

// Sparse matrices
const sparse = math.sparse([
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3],
]);
```

## After (MathTS with compat layer)

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);

// Create matrices - same API
const A = math.matrix([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);

const B = math.matrix([
  [9, 8, 7],
  [6, 5, 4],
  [3, 2, 1],
]);

// Matrix operations - same API
const sum = math.add(A, B);
const product = math.multiply(A, B);
const transposed = math.transpose(A);
const determinant = math.det(A);

// Identity and zeros - same API
const I3 = math.identity(3);
const Z = math.zeros(2, 3);

// Element access - slight difference
const element = A.get(1, 2); // MathTS uses direct arguments
const size = math.size(A);

// Sparse matrices
const sparse = math.sparse([
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3],
]);
```

## After (Native MathTS API)

```typescript
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

// Create matrices using static methods
const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);

const B = DenseMatrix.fromArray([
  [9, 8, 7],
  [6, 5, 4],
  [3, 2, 1],
]);

// Matrix operations as methods
const sum = A.add(B);
const product = A.multiply(B);
const transposed = A.transpose();
// Note: decompositions like svd/eig operate on number[][]
import { svd } from '@danielsimonjr/mathts-matrix';
const { U, S, V } = svd(A.toArray());

// Factory methods for special matrices
const I3 = DenseMatrix.identity(3);
const Z = DenseMatrix.zeros(2, 3);
const O = DenseMatrix.ones(2, 2);

// Element access
const element = A.get(1, 2);
const rows = A.rows;
const cols = A.cols;

// Sparse matrices
const sparse = SparseMatrix.fromDense(
  DenseMatrix.fromArray([
    [1, 0, 0],
    [0, 2, 0],
    [0, 0, 3],
  ])
);

console.log('Non-zeros:', sparse.nnz);
console.log('Density:', sparse.density);

// Convert between formats
const denseFromSparse = sparse.toDense();
const sparseFromDense = A.toSparse();
```

## Key Differences

| mathjs                 | MathTS Compat          | MathTS Native                    |
| ---------------------- | ---------------------- | -------------------------------- |
| `math.matrix([[...]])` | `math.matrix([[...]])` | `DenseMatrix.fromArray([[...]])` |
| `math.sparse([[...]])` | `math.sparse([[...]])` | `SparseMatrix.fromDense(...)`    |
| `A.get([i, j])`        | `A.get(i, j)`          | `A.get(i, j)`                    |
| `A.size()`             | `math.size(A)`         | `[A.rows, A.cols]`               |
| `math.add(A, B)`       | `math.add(A, B)`       | `A.add(B)`                       |
| `math.multiply(A, B)`  | `math.multiply(A, B)`  | `A.multiply(B)`                  |
| `math.identity(n)`     | `math.identity(n)`     | `DenseMatrix.identity(n)`        |
| `math.zeros(m, n)`     | `math.zeros(m, n)`     | `DenseMatrix.zeros(m, n)`        |

## Migration Steps

1. **Quick migration**: Change import, update `A.get([i, j])` to `A.get(i, j)`
2. **Gradual adoption**: Replace `math.matrix()` with `DenseMatrix.fromArray()`
3. **Full migration**: Use method chaining for better readability
