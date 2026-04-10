# Test Coverage Analysis

**Generated**: 2026-04-10

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 38 |
| Total Test Files | 17 |
| Source Files with Tests | 33 |
| Source Files without Tests | 5 |
| Coverage | 86.8% |

---

## Source Files Without Test Coverage

The following 5 source files are not directly imported by any test file:

### backends/

- `src/backends/MatrixWasmBridge.ts` → Expected test: `tests/unit/backends/MatrixWasmBridge.test.ts`
- `src/backends/WasmLoader.ts` → Expected test: `tests/unit/backends/WasmLoader.test.ts`

### root/

- `src/matrix.ts` → Expected test: `tests/unit/root/matrix.test.ts`
- `src/types.ts` → Expected test: `tests/unit/root/types.test.ts`

### types/

- `src/types/parallel.d.ts` → Expected test: `tests/unit/types/parallel.d.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `backends/Backend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/BackendManager.ts` | `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/GPUBackend.ts` | `initialization.test.ts`, `operations.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `backends/GPUMatrixBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/JSBackend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `operations.test.ts` |
| `backends/ParallelBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/RustWASMBackend.ts` | `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/RustWasmLoader.ts` | `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/WASMBackend.ts` | `typed-operations.test.ts`, `accuracy.test.ts`, `loading.test.ts`, `operations.test.ts` |
| `gpu/BatchExecutor.ts` | `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/BufferPool.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/GPUContext.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/ShaderManager.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/Sync.ts` | `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/detect.ts` | `initialization.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `wasm/detect.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `wasm/fft-wasm.ts` | `typed-operations.test.ts`, `fft-wasm.test.ts`, `loading.test.ts` |
| `wasm/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `src/config.ts` | `config.test.ts` |
| `src/index.ts` | `typed-operations.test.ts` |
| `operations/eig-wasm.ts` | `eig-wasm.test.ts`, `typed-operations.test.ts` |
| `operations/eig.ts` | `eig.test.ts`, `typed-operations.test.ts` |
| `operations/index.ts` | `typed-operations.test.ts` |
| `operations/svd-wasm.ts` | `typed-operations.test.ts` |
| `operations/svd.ts` | `svd.test.ts`, `typed-operations.test.ts` |
| `src/parallel-matrix.ts` | `typed-operations.test.ts` |
| `src/typed-operations.ts` | `typed-operations.test.ts` |
| `types/DenseMatrix.ts` | `DenseMatrix.test.ts`, `JSBackend.test.ts`, `operations.test.ts`, `SparseMatrix.test.ts`, `typed-operations.test.ts`, `accuracy.test.ts`, `operations.test.ts`, `rust-wasm.test.ts` |
| `types/Matrix.ts` | `typed-operations.test.ts` |
| `types/SparseMatrix.ts` | `operations.test.ts`, `SparseMatrix.test.ts`, `typed-operations.test.ts` |
| `types/index.ts` | `typed-operations.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/config.test.ts` | 1 files |
| `decomposition/eig-wasm.test.ts` | 1 files |
| `decomposition/eig.test.ts` | 1 files |
| `decomposition/svd.test.ts` | 1 files |
| `tests/DenseMatrix.test.ts` | 1 files |
| `gpu/initialization.test.ts` | 5 files |
| `gpu/integration.test.ts` | 5 files |
| `gpu/operations.test.ts` | 1 files |
| `tests/JSBackend.test.ts` | 3 files |
| `sparse/operations.test.ts` | 2 files |
| `sparse/SparseMatrix.test.ts` | 2 files |
| `tests/typed-operations.test.ts` | 32 files |
| `wasm/accuracy.test.ts` | 2 files |
| `wasm/fft-wasm.test.ts` | 1 files |
| `wasm/loading.test.ts` | 20 files |
| `wasm/operations.test.ts` | 3 files |
| `wasm/rust-wasm.test.ts` | 5 files |
