# @danielsimonjr/mathts-matrix

High-performance matrix operations with multi-backend support (JS/WASM/GPU).

## Installation

```bash
npm install @danielsimonjr/mathts-matrix
```

## Usage

```typescript node
import {
  DenseMatrix,
  matMul,
  transposeNestedArray,
  svd,
  eig,
  lu,
  qr,
  cholesky,
} from '@danielsimonjr/mathts-matrix';

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

// Nested-array multiply / transpose (same kernels as decomposition internals)
const C = matMul(A.toArray(), A.toArray());
const At = transposeNestedArray(A.toArray());
```

### WASM matrix multiply (not `DenseMatrix.multiply`)

After `await backendManager.initialize()`, `backendManager.multiply(a, b)` and
`wasmBackend.multiply(a, b)` can run the AssemblyScript GEMM kernel when size gates
pass. `Tensor.matMul` in `@danielsimonjr/mathts-tensor` routes through the same
manager. Public `lu` / `qr` / `cholesky` / `eig` / `svd` stay on JS; `eigWasm` and
`svdWasm` are async wrappers that still call those JS solvers.

```typescript node
import { backendManager, DenseMatrix } from '@danielsimonjr/mathts-matrix';

await backendManager.initialize();
const a = DenseMatrix.random(32, 32);
const c = backendManager.multiply(a, a);
```

## Backends

| Backend | How you reach it                                        | Role    |
| ------- | ------------------------------------------------------- | ------- |
| **JS**  | `DenseMatrix` methods; `lu`/`qr`/`cholesky`/`eig`/`svd` | Default |

Dense `svd` stays on a pure JavaScript Golub–Reinsch implementation (the WASM eigen/SVD
kernels were retired after measuring slower than JS). On Node 22, a 500×500 SPD matrix is
typically ~1.05–1.15× `ml-matrix` wall time with residuals matching to ~1e-14 (see dogfood
#699); use `ml-matrix` or an external solver if you need every last percent of SVD throughput.
| **WASM** | `backendManager.multiply`, `wasmBackend.multiply`, `Tensor.matMul` | SIMD GEMM (+ unused-by-public decomp methods on `WASMBackend`) |
| **GPU** | `gpuMatrixBackend.multiplyAsync`; `@danielsimonjr/mathts-functions` with `enableGpu()` | f32 opt-in; **not** registered on `BackendManager` |

Live defaults come from one table: `matrix/src/config.ts` `DEFAULT_CONFIG` (multiply
WASM **256** flop count; `gpu.enabled` **false**). `DEFAULT_EXTENDED_HINTS` on
`BackendManager` is derived from that table at load time. GPU hint **65536** is
dormant until a GPU backend registers. Element-wise WASM paths were retired as
slower than JS (2026-07).

## Matrix Types

- `DenseMatrix` - Standard dense storage (row-major). You can pass a nested 2-D array
  to the constructor (`new DenseMatrix([[1,2],[3,4]])`) or use `DenseMatrix.fromArray`.
  Allocation is capped at `DENSE_MATRIX_MAX_ELEMENTS` (**1e8** stored doubles, ~800 MiB)
  so huge `rows×cols` products throw `RangeError: DenseMatrix too large` before V8 tries
  to allocate an invalid `Float64Array`. Scalar scaling matches mathjs: `A.multiply(2)` or
  `A.scale(2)`; matrix product is `A.multiply(B)` with another matrix.
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
