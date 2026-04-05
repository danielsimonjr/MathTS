# Test Coverage Analysis

**Generated**: 2026-04-04

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 89 |
| Total Test Files | 57 |
| Source Files with Tests | 55 |
| Source Files without Tests | 34 |
| Coverage | 61.8% |

---

## Source Files Without Test Coverage

The following 34 source files are not directly imported by any test file:

### src/

- `assembly/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `assembly/src/ops/array.ts` → Expected test: `tests/unit/src/array.test.ts`
- `assembly/src/ops/complex-array.ts` → Expected test: `tests/unit/src/complex-array.test.ts`
- `assembly/src/ops/complex-ops.ts` → Expected test: `tests/unit/src/complex-ops.test.ts`
- `assembly/src/ops/matrix.ts` → Expected test: `tests/unit/src/matrix.test.ts`
- `assembly/src/ops/scalar.ts` → Expected test: `tests/unit/src/scalar.test.ts`
- `assembly/src/types/complex.ts` → Expected test: `tests/unit/src/complex.test.ts`
- `core/src/types/interfaces.ts` → Expected test: `tests/unit/src/interfaces.test.ts`
- `expression/src/Help.ts` → Expected test: `tests/unit/src/Help.test.ts`
- `expression/src/Parser.ts` → Expected test: `tests/unit/src/Parser.test.ts`
- `expression/src/error/DimensionError.ts` → Expected test: `tests/unit/src/DimensionError.test.ts`
- `expression/src/error/IndexError.ts` → Expected test: `tests/unit/src/IndexError.test.ts`
- `expression/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `expression/src/keywords.ts` → Expected test: `tests/unit/src/keywords.test.ts`
- `expression/src/node/Node.ts` → Expected test: `tests/unit/src/Node.test.ts`
- `expression/src/operators.ts` → Expected test: `tests/unit/src/operators.test.ts`
- `expression/src/parse.ts` → Expected test: `tests/unit/src/parse.test.ts`
- `expression/src/types.ts` → Expected test: `tests/unit/src/types.test.ts`
- `expression/src/utils/array.ts` → Expected test: `tests/unit/src/array.test.ts`
- `expression/src/utils/bignumber/formatter.ts` → Expected test: `tests/unit/src/formatter.test.ts`
- `expression/src/utils/collection.ts` → Expected test: `tests/unit/src/collection.test.ts`
- `expression/src/utils/customs.ts` → Expected test: `tests/unit/src/customs.test.ts`
- `expression/src/utils/factory.ts` → Expected test: `tests/unit/src/factory.test.ts`
- `expression/src/utils/is.ts` → Expected test: `tests/unit/src/is.test.ts`
- `expression/src/utils/map.ts` → Expected test: `tests/unit/src/map.test.ts`
- `expression/src/utils/number.ts` → Expected test: `tests/unit/src/number.test.ts`
- `expression/src/utils/object.ts` → Expected test: `tests/unit/src/object.test.ts`
- `expression/src/utils/string.ts` → Expected test: `tests/unit/src/string.test.ts`
- `expression/src/utils/switch.ts` → Expected test: `tests/unit/src/switch.test.ts`
- `matrix/src/backends/WasmLoader.ts` → Expected test: `tests/unit/src/WasmLoader.test.ts`
- `parallel/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `parallel/src/operations/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `parallel/src/strategies/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `workbook/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/index.ts` | `compat.test.ts` |
| `src/shims.ts` | `compat.test.ts`, `shims.test.ts` |
| `factory/factory.ts` | `factory.test.ts`, `version.test.ts` |
| `factory/index.ts` | `factory.test.ts`, `version.test.ts` |
| `src/index.ts` | `version.test.ts` |
| `typed/index.ts` | `version.test.ts` |
| `typed/mathts-typed.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `version.test.ts` |
| `typed/type-bridge.ts` | `type-bridge.test.ts`, `version.test.ts` |
| `types/bignumber.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `bignumber-math.test.ts`, `bignumber.test.ts`, `version.test.ts` |
| `types/complex.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `complex.test.ts`, `version.test.ts` |
| `types/fraction.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `fraction.test.ts`, `version.test.ts` |
| `src/index.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/arithmetic.ts` | `arithmetic-extended.test.ts`, `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/index.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/signal.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/statistics.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `statistics-extended.test.ts`, `statistics-extended2.test.ts`, `typed-arithmetic.test.ts` |
| `typed/trigonometry.ts` | `arithmetic-extended.test.ts`, `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `backends/Backend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `backends/BackendManager.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/GPUBackend.ts` | `initialization.test.ts`, `operations.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `backends/GPUMatrixBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/JSBackend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `operations.test.ts` |
| `backends/ParallelBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
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
| `wasm/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `src/config.ts` | `config.test.ts` |
| `src/index.ts` | `typed-operations.test.ts` |
| `src/parallel-matrix.ts` | `typed-operations.test.ts` |
| `src/typed-operations.ts` | `typed-operations.test.ts` |
| `types/DenseMatrix.ts` | `DenseMatrix.test.ts`, `JSBackend.test.ts`, `operations.test.ts`, `SparseMatrix.test.ts`, `typed-operations.test.ts`, `accuracy.test.ts`, `operations.test.ts` |
| `types/Matrix.ts` | `typed-operations.test.ts` |
| `types/SparseMatrix.ts` | `operations.test.ts`, `SparseMatrix.test.ts`, `typed-operations.test.ts` |
| `types/index.ts` | `typed-operations.test.ts` |
| `src/index.ts` | `index.test.ts` |
| `src/index.ts` | `index.test.ts` |
| `src/ComputePool.ts` | `ComputePool.test.ts`, `elementwise.test.ts`, `matmul.test.ts`, `threshold.test.ts` |
| `operations/elementwise.ts` | `elementwise.test.ts` |
| `operations/map.ts` | `map-extended.test.ts`, `map.test.ts` |
| `operations/matmul.ts` | `matmul.test.ts` |
| `operations/reduce.ts` | `reduce.test.ts` |
| `strategies/chunk.ts` | `chunk.test.ts`, `chunk-extended.test.ts` |
| `strategies/threshold.ts` | `threshold.test.ts` |
| `src/executor.ts` | `executor.test.ts` |
| `src/graph.ts` | `graph.test.ts` |
| `src/parser.ts` | `parser.test.ts` |
| `src/types.ts` | `executor.test.ts`, `graph.test.ts`, `parser.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/index.test.ts` | 1 files |
| `tests/index.test.ts` | 1 files |
| `tests/config.test.ts` | 0 files |
| `factory/factory.test.ts` | 2 files |
| `tests/shared.test.ts` | 0 files |
| `typed/mathts-typed-extended.test.ts` | 4 files |
| `typed/mathts-typed.test.ts` | 4 files |
| `typed/type-bridge.test.ts` | 4 files |
| `types/bignumber-math.test.ts` | 1 files |
| `types/bignumber.test.ts` | 1 files |
| `types/complex.test.ts` | 1 files |
| `types/fraction.test.ts` | 1 files |
| `tests/utils.test.ts` | 0 files |
| `tests/version.test.ts` | 9 files |
| `tests/config.test.ts` | 1 files |
| `decomposition/eig.test.ts` | 0 files |
| `decomposition/svd.test.ts` | 0 files |
| `tests/DenseMatrix.test.ts` | 1 files |
| `gpu/initialization.test.ts` | 5 files |
| `gpu/integration.test.ts` | 5 files |
| `gpu/operations.test.ts` | 1 files |
| `tests/JSBackend.test.ts` | 3 files |
| `sparse/operations.test.ts` | 2 files |
| `sparse/SparseMatrix.test.ts` | 2 files |
| `tests/typed-operations.test.ts` | 24 files |
| `wasm/accuracy.test.ts` | 2 files |
| `wasm/loading.test.ts` | 17 files |
| `wasm/operations.test.ts` | 3 files |
| `tests/arithmetic-extended.test.ts` | 2 files |
| `tests/parallel-arithmetic.test.ts` | 6 files |
| `tests/parallel-signal.test.ts` | 6 files |
| `signal/conv.test.ts` | 0 files |
| `signal/fft.test.ts` | 0 files |
| `tests/statistics-extended.test.ts` | 1 files |
| `tests/statistics-extended2.test.ts` | 1 files |
| `tests/typed-arithmetic.test.ts` | 6 files |
| `tests/typed-bridge.test.ts` | 0 files |
| `tests/chunk.test.ts` | 1 files |
| `tests/ComputePool.test.ts` | 1 files |
| `operations/elementwise.test.ts` | 2 files |
| `operations/map-extended.test.ts` | 1 files |
| `operations/map.test.ts` | 1 files |
| `operations/matmul.test.ts` | 2 files |
| `operations/reduce.test.ts` | 1 files |
| `operations/threshold.test.ts` | 2 files |
| `tests/ParallelMatrix.test.ts` | 0 files |
| `strategies/chunk-extended.test.ts` | 1 files |
| `tests/executor.test.ts` | 2 files |
| `tests/graph.test.ts` | 2 files |
| `tests/parser.test.ts` | 2 files |
| `tests/compat.test.ts` | 2 files |
| `tests/shims.test.ts` | 1 files |
| `integration/functions.test.ts` | 0 files |
| `integration/instance.test.ts` | 0 files |
| `wasm/parallel-processing.test.ts` | 0 files |
| `wasm/typescript-integration.test.ts` | 0 files |
| `wasm/wasm-loader.test.ts` | 0 files |

---

## Rust WASM Backend Tests (`wasm-rust/`)

The Rust WASM backend has its own test layer, separate from the Vitest suite.

### Native Rust Tests

```bash
cargo test                      # Run all Rust unit tests in wasm-rust/
cargo test --release            # Run with release optimizations
cargo test -p mathts-wasm       # Run only the mathts-wasm crate tests
```

Rust tests live alongside source files (`#[cfg(test)]` modules inside each `.rs` file). They test Rust-level correctness for faer, rustfft, statrs, and libm integrations before WASM compilation.

### JavaScript Integration Tests (Vitest)

After `npm run build:wasm:rust`, the compiled binary is tested through the existing `matrix/` Vitest suite:

| Test File | What It Covers |
|-----------|---------------|
| `wasm/loading.test.ts` | `WasmLoader` loads Rust binary, memory pool init |
| `wasm/accuracy.test.ts` | Numerical accuracy vs JS reference implementation |
| `wasm/operations.test.ts` | Rust-backed matrix multiply, LU, QR, SVD |
| `wasm/typescript-integration.test.ts` | `MatrixWasmBridge` threshold dispatch |

### Three-Way Benchmark

```bash
npm run bench:wasm              # Run full three-way benchmark
```

Compares Rust WASM vs AssemblyScript WASM vs pure JavaScript for a standard set of matrix operations at sizes 64×64, 256×256, 512×512, and 1024×1024. Results written to `test/benchmark/wasm-results.json`.

Typical results (1024×1024 matrix multiply):
- JavaScript: baseline
- AssemblyScript WASM: ~2-5x faster
- Rust WASM: ~5-25x faster
