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
const m = DenseMatrix.fromArray([[1, 2], [3, 4]])   // 2×2

// From a flat array with explicit dimensions
const n = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6])

// Zero-filled
DenseMatrix.zeros(3, 4)    // 3×4 matrix of zeros

// One-filled
DenseMatrix.ones(2, 2)     // 2×2 matrix of ones

// Identity matrix
DenseMatrix.identity(4)    // 4×4 identity

// Diagonal matrix from values
DenseMatrix.diag([1, 2, 3])   // 3×3 diagonal

// Filled with a scalar
DenseMatrix.fill(2, 3, 7)  // 2×3 filled with 7

// Random values in [0, 1)
DenseMatrix.random(3, 3)

// Direct constructor (row-major data)
new DenseMatrix(2, 2, [1, 2, 3, 4])
```

### Access and Dimensions

```ts
const m = DenseMatrix.fromArray([[1, 2, 3], [4, 5, 6]])

m.rows    // 2
m.cols    // 3
m.get(0, 1)   // 2  (row 0, col 1)
m.type    // 'DenseMatrix'
```

### Immutability

All operations return **new** matrix instances. No method mutates in place.

### Conversion

```ts
m.toArray()      // number[][]
m.toFlatArray()  // number[] (row-major)
m.toSparse()     // SparseMatrix
```

## SparseMatrix

`SparseMatrix` uses **Compressed Sparse Row (CSR)** format: only non-zero values are stored alongside column indices and row pointers. Efficient when the matrix contains many zeros (typically less than 10% non-zero).

### Creation

```ts
import { SparseMatrix } from '@danielsimonjr/mathts-matrix';

// From a dense matrix (zeros are dropped)
const sparse = SparseMatrix.fromDense(dense)

// From COO (coordinate) triples
const s = SparseMatrix.fromCOO(4, 4, [
  { row: 0, col: 0, value: 1 },
  { row: 2, col: 3, value: 5 },
])

// Structural zeros/identity
SparseMatrix.zeros(100, 100)
SparseMatrix.identity(1000)
SparseMatrix.diag([1, 2, 3, 4])

// Direct CSR constructor
new SparseMatrix(rows, cols, values, colIndices, rowPointers)
```

### Sparsity Information

```ts
const s = SparseMatrix.fromDense(dense)

s.nnz       // number of non-zero elements
s.sparsity  // fraction of zero elements (0–1)
s.density   // 1 - sparsity
```

### Conversion

```ts
sparse.toDense()     // DenseMatrix
sparse.toArray()     // number[][]
sparse.toFlatArray() // number[]
```

## Backends

MathTS dispatches matrix operations to one of three backends based on matrix size:

| Backend | Threshold (elements) | Technology |
|---|---|---|
| **JSBackend** | Always available (default) | Pure TypeScript / `Float64Array` |
| **WASMBackend** | > 1,000 elements | Rust WASM (primary) / AssemblyScript WASM (legacy) with SIMD |
| **GPUBackend** | > 100,000 elements | WebGPU compute shaders |

Operation-specific thresholds override the general rule:

| Operation | WASM threshold | GPU threshold |
|---|---|---|
| `multiply` | 500 | 50,000 |
| `decomposition` | 100 | 10,000 |
| `transpose` | 2,000 | 200,000 |

### Automatic Selection

Backend selection is transparent — you write the same code regardless:

```ts
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const a = DenseMatrix.random(512, 512)   // 262,144 elements
const b = DenseMatrix.random(512, 512)

// Automatically dispatched to GPU if available, then WASM, then JS
const result = a.multiply(b)
```

### Manual Backend Control

You can override the automatic selection via the `backendManager` singleton:

```ts
import { backendManager } from '@danielsimonjr/mathts-matrix';

// Force WASM for all operations
backendManager.setHints({ preferredBackend: 'wasm' })

// Adjust thresholds
backendManager.setHints({ wasmThreshold: 500, gpuThreshold: 50000 })
```

### Fallback Behavior

If a higher-tier backend is unavailable or fails to initialize, MathTS falls back to the next tier automatically. JS is always available and never fails.

## Matrix Bridge (SparseMatrix CSC)

The `MatrixWasmBridge` provides interoperability between the TypeScript matrix layer and native WASM/Rust kernels, including CSC (Compressed Sparse Column) format conversion for sparse operations.

## Decompositions

`@danielsimonjr/mathts-matrix` includes WASM-accelerated decompositions:

```ts
import { eig, svd } from '@danielsimonjr/mathts-matrix';

const { values, vectors } = eig(m.toArray())   // eigenvalues and eigenvectors
const { U, S, V, rank } = svd(m.toArray())     // singular value decomposition
```

## Related

- [Numbers](numbers.md)
- [Complex Numbers](complex_numbers.md)
- See also: `docs/backends.md` for detailed backend configuration
