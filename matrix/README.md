# @danielsimonjr/mathts-matrix

High-performance matrix operations with multi-backend support (JS/WASM/GPU).

## Installation

```bash
npm install @danielsimonjr/mathts-matrix
```

## Usage

```typescript
import { DenseMatrix, matMul, svd, eig, lu, qr, cholesky } from '@danielsimonjr/mathts-matrix';

// Create a matrix from a 2D array
const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);

// DenseMatrix methods use the JS backend (add, multiply, transpose, …)
const sum = A.add(A);
const product = A.multiply(A);
const transposed = A.transpose();

// `eig` / `svd` take number[][]; `lu` / `qr` / `cholesky` take DenseMatrix
const { U, S, V, rank } = svd(A.toArray());
const { values, vectors } = eig(A.toArray());
const { L, U: Ulu, P } = lu(A);

// Nested-array multiply (same kernel as decomposition internals)
const C = matMul(A.toArray(), A.toArray());
```

### WASM matrix multiply (not `DenseMatrix.multiply`)

After `await backendManager.initialize()`, `backendManager.multiply(a, b)` and
`wasmBackend.multiply(a, b)` can run the AssemblyScript GEMM kernel when size gates
pass. `Tensor.matMul` in `@danielsimonjr/mathts-tensor` routes through the same
manager. Public `lu` / `qr` / `cholesky` / `eig` / `svd` stay on JS; `eigWasm` and
`svdWasm` are async wrappers that still call those JS solvers.

```typescript
import { backendManager, DenseMatrix } from '@danielsimonjr/mathts-matrix';

await backendManager.initialize();
const a = DenseMatrix.random(32, 32);
const c = backendManager.multiply(a, a);
```

## Backends

| Backend  | How you reach it                                                                       | Role                                                           |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **JS**   | `DenseMatrix` methods; `lu`/`qr`/`cholesky`/`eig`/`svd`                                | Default                                                        |
| **WASM** | `backendManager.multiply`, `wasmBackend.multiply`, `Tensor.matMul`                     | SIMD GEMM (+ unused-by-public decomp methods on `WASMBackend`) |
| **GPU**  | `gpuMatrixBackend.multiplyAsync`; `@danielsimonjr/mathts-functions` with `enableGpu()` | f32 opt-in; **not** registered on `BackendManager`             |

Live defaults (`backendManager.getHints().operationThresholds`): multiply WASM **256**
(flop count), GPU hint **65536** (inactive until GPU registers). Element-wise WASM
paths were retired as slower than JS (2026-07).

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
- [x] WASM backend (AssemblyScript) for manager-driven GEMM
- [x] GPU backend (WebGPU) via `GPUMatrixBackend`
- [x] SVD decomposition (JS)
- [x] Eigenvalue solvers (JS)
- [x] LU / QR / Cholesky and related exports (see API reference)

## License

MIT
