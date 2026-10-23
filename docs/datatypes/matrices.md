# Matrices

MathTS provides two matrix types — `DenseMatrix` and `SparseMatrix` — both backed by typed arrays (`Float64Array`) and sharing a common abstract `Matrix<T>` base. A key differentiator from mathjs is the **multi-backend architecture**: matrix operations are automatically dispatched to JS, WASM, or GPU compute depending on matrix size.

Import from `@danielsimonjr/mathts-matrix`:

```ts
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
```

## DenseMatrix

`DenseMatrix` stores all elements (including zeros) in row-major `Float64Array`. It is the right choice for general-purpose dense linear algebra.

### Creation

```ts
// From a 2D array
const m = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]); // 2×2

// From a flat array with explicit dimensions
const n = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);

// Zero-filled
DenseMatrix.zeros(3, 4); // 3×4 matrix of zeros

// One-filled
DenseMatrix.ones(2, 2); // 2×2 matrix of ones

// Identity matrix
DenseMatrix.identity(4); // 4×4 identity

// Diagonal matrix from values
DenseMatrix.diag([1, 2, 3]); // 3×3 diagonal

// Filled with a scalar
DenseMatrix.fill(2, 3, 7); // 2×3 filled with 7

// Random values in [0, 1)
DenseMatrix.random(3, 3);

// Direct constructor (row-major data)
new DenseMatrix(2, 2, [1, 2, 3, 4]);
```

### Access and Dimensions

```ts
const m = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
]);

m.rows; // 2
m.cols; // 3
m.get(0, 1); // 2  (row 0, col 1)
m.type; // 'DenseMatrix'
```

### Immutability

All operations return **new** matrix instances. No method mutates in place.

### Conversion

```ts
m.toArray(); // number[][]
m.toFlatArray(); // number[] (row-major)
m.toSparse(); // SparseMatrix
```

## SparseMatrix

`SparseMatrix` uses **Compressed Sparse Row (CSR)** format: only non-zero values are stored alongside column indices and row pointers. Efficient when the matrix contains many zeros (typically less than 10% non-zero).

### Creation

```ts
import { SparseMatrix } from '@danielsimonjr/mathts-matrix';

// From a dense matrix (zeros are dropped)
const sparse = SparseMatrix.fromDense(dense);

// From COO (coordinate) triples
const s = SparseMatrix.fromCOO(4, 4, [
  { row: 0, col: 0, value: 1 },
  { row: 2, col: 3, value: 5 },
]);

// Structural zeros/identity
SparseMatrix.zeros(100, 100);
SparseMatrix.identity(1000);
SparseMatrix.diag([1, 2, 3, 4]);

// Direct CSR constructor
new SparseMatrix(rows, cols, values, colIndices, rowPointers);
```

### Sparsity Information

```ts
const s = SparseMatrix.fromDense(dense);

s.nnz; // number of non-zero elements
s.sparsity; // fraction of zero elements (0–1)
s.density; // 1 - sparsity
```

### Conversion

```ts
sparse.toDense(); // DenseMatrix
sparse.toArray(); // number[][]
sparse.toFlatArray(); // number[]
```

## Backends

`@danielsimonjr/mathts-matrix` registers **JS** and **WASM** backends on `backendManager`. A `'gpu'` backend is not registered on that manager today; GPU matrix work that exists uses separate `gpuMatmul` paths in functions/matrix, not `backendManager` selection.

`DenseMatrix.prototype.multiply` calls the pure TypeScript `arithmetic.multiply` loop — it does **not** consult `backendManager`. Use `backendManager`-aware APIs (for example decompositions routed through the manager) when you need WASM acceleration.

When the manager does select a backend, operation thresholds include:

| Operation       | WASM threshold (elements) | Notes                              |
| --------------- | ------------------------- | ---------------------------------- |
| `multiply`      | 256                       | SIMD WASM matmul                   |
| `decomposition` | 100                       | LU/QR/Cholesky-style paths         |
| `transpose`     | 2,000 (gate only)         | WASM transpose retired; JS is used |

GPU threshold fields in the manager align to `GPU_MIN_ELEMENTS` (65,536) but are dormant until a GPU backend is registered.

### `backendManager` hints

```ts
import { backendManager } from '@danielsimonjr/mathts-matrix';

backendManager.setHints({ preferredBackend: 'wasm' });
backendManager.setHints({ wasmThreshold: 1000, gpuThreshold: 65536 });
```

JS is always available as fallback when WASM cannot run.

## Matrix Bridge (SparseMatrix CSC)

The matrix WASM bridge provides interoperability between the TypeScript matrix layer and the AssemblyScript WASM kernels, including CSC (Compressed Sparse Column) format conversion for sparse operations.

## Decompositions

Dense LU/QR/Cholesky/inverse/determinant can use WASM via `backendManager` when matrix size exceeds the decomposition WASM threshold. Public `eig` and `svd` run synchronously in JavaScript (WASM kernels were removed after measuring slower performance):

```ts
import { eig, svd } from '@danielsimonjr/mathts-matrix';

const { values, vectors } = eig(m.toArray());
const { U, S, V, rank } = svd(m.toArray());
```

## Related

- [Numbers](numbers.md)
- [Complex Numbers](complex_numbers.md)
- See also: `docs/backends.md` for detailed backend configuration
