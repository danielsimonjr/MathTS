# @mathts/matrix API Reference

Dense and sparse matrix implementations with backend selection.

## Installation

```bash
npm install @mathts/matrix
```

## Classes

### DenseMatrix

Row-major dense matrix backed by Float64Array.

```typescript
import { DenseMatrix } from '@mathts/matrix';
```

#### Static Factory Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `fromArray` | `(arr: number[][]) => DenseMatrix` | Create from 2D array |
| `fromFlat` | `(rows: number, cols: number, data: number[]) => DenseMatrix` | Create from flat array |
| `zeros` | `(rows: number, cols: number) => DenseMatrix` | Zero matrix |
| `ones` | `(rows: number, cols: number) => DenseMatrix` | Matrix of ones |
| `identity` | `(n: number) => DenseMatrix` | Identity matrix |
| `diag` | `(values: number[]) => DenseMatrix` | Diagonal matrix |
| `fill` | `(rows: number, cols: number, value: number) => DenseMatrix` | Filled matrix |
| `random` | `(rows: number, cols: number) => DenseMatrix` | Random [0,1) values |

#### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `rows` | `number` | Number of rows |
| `cols` | `number` | Number of columns |
| `length` | `number` | Total elements (rows * cols) |
| `isSquare` | `boolean` | Whether rows === cols |

#### Element Access

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `(row: number, col: number) => number` | Get element |
| `set` | `(row: number, col: number, value: number) => DenseMatrix` | Set element (returns new matrix) |
| `row` | `(index: number) => DenseMatrix` | Get row as 1×n matrix |
| `column` | `(index: number) => DenseMatrix` | Get column as m×1 matrix |
| `slice` | `(spec: SliceSpec) => DenseMatrix` | Get submatrix |
| `diagonal` | `(k?: number) => DenseMatrix` | Get diagonal |

#### Arithmetic Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| `add` | `(other: Matrix) => DenseMatrix` | Matrix addition |
| `subtract` | `(other: Matrix) => DenseMatrix` | Matrix subtraction |
| `multiply` | `(other: Matrix) => DenseMatrix` | Matrix multiplication |
| `multiplyElementwise` | `(other: Matrix) => DenseMatrix` | Hadamard product |
| `scale` | `(scalar: number) => DenseMatrix` | Scalar multiplication |
| `negate` | `() => DenseMatrix` | Negate all elements |
| `transpose` | `() => DenseMatrix` | Matrix transpose |

#### Reduction Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| `sum` | `() => number` | Sum of all elements |
| `mean` | `() => number` | Mean of all elements |
| `min` | `() => number` | Minimum element |
| `max` | `() => number` | Maximum element |
| `norm` | `() => number` | Frobenius norm |
| `trace` | `() => number` | Sum of diagonal (square only) |

#### Conversion Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `toArray` | `() => number[][]` | Convert to nested array |
| `toFlatArray` | `() => number[]` | Convert to flat array |
| `toFloat64Array` | `() => Float64Array` | Get underlying data |
| `toSparse` | `(dropTolerance?: number) => SparseMatrix` | Convert to sparse |
| `clone` | `() => DenseMatrix` | Deep copy |

#### Iteration

| Method | Signature | Description |
|--------|-----------|-------------|
| `entries` | `() => IterableIterator<MatrixEntry>` | Iterate with indices |
| `values` | `() => IterableIterator<number>` | Iterate values |
| `map` | `(fn: (v, r, c) => number) => DenseMatrix` | Apply function |
| `forEach` | `(fn: (v, r, c) => void) => void` | Side-effect iteration |

#### Example

```typescript
import { DenseMatrix } from '@mathts/matrix';

const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

const B = DenseMatrix.identity(3);
const C = A.multiply(B);      // Same as A
const D = A.transpose();      // 3×3 transposed

console.log(A.get(1, 2));     // 6
console.log(A.sum());         // 45
console.log(A.trace());       // 15

const row = A.row(0);         // [1, 2, 3]
const col = A.column(1);      // [2, 5, 8]

const scaled = A.scale(2);    // All elements * 2
```

---

### SparseMatrix

CSR (Compressed Sparse Row) format sparse matrix.

```typescript
import { SparseMatrix } from '@mathts/matrix';
```

#### Static Factory Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `fromDense` | `(dense: DenseMatrix, dropTolerance?: number) => SparseMatrix` | From dense matrix |
| `fromCOO` | `(rows, cols, entries: {row, col, value}[]) => SparseMatrix` | From COO format |
| `zeros` | `(rows: number, cols: number) => SparseMatrix` | Empty sparse matrix |
| `identity` | `(n: number) => SparseMatrix` | Sparse identity |

#### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `rows` | `number` | Number of rows |
| `cols` | `number` | Number of columns |
| `nnz` | `number` | Number of non-zeros |
| `density` | `number` | nnz / (rows * cols) |

#### Methods

Supports similar methods to DenseMatrix: `get`, `add`, `subtract`, `multiply`, `transpose`, etc.

#### Example

```typescript
import { SparseMatrix, DenseMatrix } from '@mathts/matrix';

// Create from dense
const dense = DenseMatrix.fromArray([
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3]
]);
const sparse = SparseMatrix.fromDense(dense);
console.log(sparse.nnz);      // 3
console.log(sparse.density);  // 0.333...

// Create from COO
const coo = SparseMatrix.fromCOO(3, 3, [
  { row: 0, col: 0, value: 1 },
  { row: 1, col: 1, value: 2 },
  { row: 2, col: 2, value: 3 }
]);
```

---

## Matrix Operations

### Eigenvalue Decomposition

```typescript
import { eig } from '@mathts/matrix';

const A = DenseMatrix.fromArray([[4, -2], [1, 1]]);
const { values, vectors } = eig(A);
// values: eigenvalues
// vectors: eigenvector matrix
```

### SVD (Singular Value Decomposition)

```typescript
import { svd } from '@mathts/matrix';

const { U, S, V } = svd(A);
// A ≈ U * diag(S) * V^T
```

### LU Decomposition

```typescript
import { lu } from '@mathts/matrix';

const { L, U, P } = lu(A);
// P * A = L * U
```

### QR Decomposition

```typescript
import { qr } from '@mathts/matrix';

const { Q, R } = qr(A);
// A = Q * R
```

---

## Type Guards

```typescript
import { isDenseMatrix, isSparseMatrix } from '@mathts/matrix';

if (isDenseMatrix(m)) {
  // m is DenseMatrix
}
```
