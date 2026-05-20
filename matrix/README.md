# @danielsimonjr/mathts-matrix

High-performance matrix operations with multi-backend support (JS/WASM/GPU).

## Installation

```bash
npm install @danielsimonjr/mathts-matrix
```

## Usage

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// Create a matrix from a 2D array
const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

// Basic operations
const sum = A.add(A);
const product = A.multiply(A);
const transposed = A.transpose();

// Decompositions (operate on number[][])
import { svd, eig } from '@danielsimonjr/mathts-matrix';
const { U, S, V } = svd(A.toArray());
```

## Backends

| Backend | Trigger | Performance |
|---------|---------|-------------|
| **JS** | Default | 1x baseline |
| **WASM** | >1K elements | ~10x faster |
| **GPU** | >100K elements | ~100x faster |

## Matrix Types

- `DenseMatrix` - Standard dense storage (row-major)
- `SparseMatrix` - CSR format for sparse data

## Status

This package is under active development. Currently implemented:

- [x] Type definitions
- [x] Backend infrastructure
- [x] Dense matrix structure
- [x] Sparse matrix (CSR) structure
- [x] Matrix operations (add, multiply, transpose, etc.)
- [x] WASM backend (Rust primary, AssemblyScript legacy)
- [x] GPU backend (WebGPU)
- [x] SVD decomposition
- [x] Eigenvalue solvers

## License

MIT
