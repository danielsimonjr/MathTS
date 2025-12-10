# @mathts/matrix

High-performance matrix operations with multi-backend support (JS/WASM/GPU).

## Installation

```bash
npm install @mathts/matrix
```

## Usage

```typescript
import { Matrix, DenseMatrix, backends } from '@mathts/matrix';

// Create a matrix from a 2D array
const A = Matrix.from([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

// Basic operations (coming soon)
const det = A.determinant();
const inv = A.inverse();
const eig = A.eigenvalues();

// Configure backend
backends.configure({
  backend: 'wasm',      // Force WASM backend
  autoBackend: true,    // Or let it auto-select
  wasmThreshold: 1000,  // Switch to WASM above 1000 elements
  gpuThreshold: 100000, // Switch to GPU above 100K elements
});
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
- [ ] Matrix operations (add, multiply, etc.)
- [ ] WASM backend
- [ ] GPU backend
- [ ] LU/QR/SVD decompositions
- [ ] Eigenvalue solvers

## License

MIT
