# MathTS

[![npm version](https://img.shields.io/npm/v/@danielsimonjr/mathts-core.svg)](https://www.npmjs.com/package/@danielsimonjr/mathts-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

MathTS is a ground-up TypeScript rewrite of [mathjs](https://mathjs.org) packaged as an
ESM-only npm workspaces monorepo. It accelerates computation through two WASM toolchains
(Rust primary, AssemblyScript secondary), a WebWorker parallel-execution layer
(`ComputePool`), and an optional WebGPU backend for large matrix operations.
All 22 packages are independently versioned under the `@danielsimonjr/mathts-*` scope.

## Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Performance](#performance)
- [Architecture](#architecture)
- [Development](#development)
- [Status](#status)
- [Contributing](#contributing)
- [License](#license)
- [Documentation](#documentation)

---

## Installation

### Quickest path: compat shim (drop-in for mathjs users)

```bash
npm install @danielsimonjr/mathts-compat
```

### Typed-function API (recommended for new projects)

```bash
npm install @danielsimonjr/mathts-core @danielsimonjr/mathts-functions
```

Add optional packages as needed:

```bash
npm install @danielsimonjr/mathts-matrix   # DenseMatrix, SparseMatrix
npm install @danielsimonjr/mathts-parallel  # ComputePool, parallel ops
npm install @danielsimonjr/mathts-tensor    # rank-N tensors
npm install @danielsimonjr/mathts-autograd  # forward + reverse-mode AD
```

Or install a single focused domain — thin re-export packages (no duplicated code):

```bash
npm install @danielsimonjr/mathts-numbers       # Complex, Fraction, BigNumber
npm install @danielsimonjr/mathts-units         # Unit / dimensional analysis
npm install @danielsimonjr/mathts-linalg        # eig, svd, qr, lu, cholesky, schur
npm install @danielsimonjr/mathts-arithmetic    # add, multiply, sqrt, …
npm install @danielsimonjr/mathts-trigonometry  # sin, cos, tan, …
npm install @danielsimonjr/mathts-statistics    # mean, variance, quantile, …
npm install @danielsimonjr/mathts-signal        # FFT, convolution, filters, …
npm install @danielsimonjr/mathts-parser        # expression parser
npm install @danielsimonjr/mathts-ast           # expression AST nodes
npm install @danielsimonjr/mathts-evaluator     # compile / evaluate expressions
```

---

## Quick Start

### (a) Compat shim — reads like vanilla mathjs

```ts
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);

math.add(1, 2); // 3
math.complex(3, 4); // Complex { re: 3, im: 4 }
math.matrix([
  [1, 2],
  [3, 4],
]); // DenseMatrix
math.evaluate('sin(pi/2)'); // 1
math.evaluate('x^2 + y', { x: 3, y: 4 }); // 13
```

### (b) Typed-function API — direct imports, full TypeScript types

```ts
import { add, multiply, sin, sqrt, evaluate } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

// Scalar dispatch — synchronous
add(1, 2); // 3
add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)
add(new Fraction(1, 3), new Fraction(1, 6)); // Fraction(1/2)
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber(0.3)
sin(Math.PI / 2); // 1

// String evaluation
evaluate('sqrt(2)'); // 1.4142...
evaluate('2^10'); // 1024
```

### (c) Parallel array operations via ComputePool

```ts
import { computePool } from '@danielsimonjr/mathts-parallel';
import { add } from '@danielsimonjr/mathts-functions';

// add(Float64Array, Float64Array) routes through the worker pool
const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([5, 6, 7, 8]);
const result = await add(a, b); // Float64Array([6, 8, 10, 12])

// Direct pool access for larger operations
await computePool.initialize();

const data = new Float64Array(100_000).map(() => Math.random());
const sum = await computePool.sum(data);
const { result: matC } = await computePool.matmul(
  new Float64Array([1, 2, 3, 4]),
  2,
  2,
  new Float64Array([5, 6, 7, 8]),
  2
);

await computePool.terminate();
```

---

## Performance

Benchmark numbers from `npm run bench:wasm` (Rust vs JS, 2026-05-23,
noisy CI container). Source: `tests/benchmark/wasm_rust_vs_as_benchmark.ts`.

| Operation   | Rust WASM vs JS | Rust WASM vs AS (matmul >=100x100) |
| ----------- | --------------- | ---------------------------------- |
| matmul      | up to 34x       | 3.5x–13.7x                         |
| dot product | 2.5x–34x range  | —                                  |
| vector add  | 2.5x–34x range  | —                                  |
| determinant | 2.5x–34x range  | —                                  |

> Numbers were measured on a shared CI container; results on developer hardware
> will differ. The 2.5x–34x range spans all four operations across tested sizes.

Per-operation worker-pool thresholds (from `npm run bench:parallel`,
default values in `parallel/src/ComputePool.ts`):

| Op                         | Default threshold  | Rationale                                   |
| -------------------------- | ------------------ | ------------------------------------------- |
| `matmul`                   | 4,096 elements     | Break-even at 64x64                         |
| `matrixPower`              | 9,216 elements     | Break-even at ~96x96                        |
| `characteristicPolynomial` | 9,216 elements     | Break-even at ~96x96                        |
| `spectrogram`              | 65,536 samples     | Break-even measured on CI                   |
| `erfc`                     | 100,000 elements   | Special-function compute cost               |
| `besselJ`                  | 1,000,000 elements | Special-function compute cost               |
| Most element-wise ops      | `'never'`          | Transfer overhead dominates at tested sizes |

The bitwise WASM tier activates at `WASM_BITWISE_THRESHOLD = 65,536` elements
(source: `functions/src/wasm/bitwise/wasm-bridge.ts`).

Override defaults via `ComputePoolConfig.thresholdByOp` (see
`parallel/src/ComputePool.ts` for the `OpName` union and `OpThreshold` type).

---

## Architecture

### Packages

| Package                                | Role                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `@danielsimonjr/mathts-typed-function` | Symbol-based typed dispatch (forked, survives minification)     |
| `@danielsimonjr/mathts-workerpool`     | Worker pool management (forked, SharedArrayBuffer support)      |
| `@danielsimonjr/mathts-core`           | Complex, Fraction, BigNumber types; mathTyped; FunctionRegistry |
| `@danielsimonjr/mathts-matrix`         | DenseMatrix, SparseMatrix; JS/WASM/GPU backends; SVD/eig/FFT    |
| `@danielsimonjr/mathts-tensor`         | Rank-N Float64Array-backed dense Tensor; einsum/contraction     |
| `@danielsimonjr/mathts-autograd`       | Forward-mode (DualTensor) + reverse-mode (Tape) AD over Tensor  |
| `@danielsimonjr/mathts-functions`      | 374+ math functions via typed dispatch; `evaluate()`            |
| `@danielsimonjr/mathts-parallel`       | ComputePool; 40+ parallel ops; Int32Array bitwise dispatch      |
| `@danielsimonjr/mathts-expression`     | Expression parser, compiler, sandboxed evaluator (16 AST nodes) |
| `@danielsimonjr/mathts-workbook`       | `.mtsw` reactive YAML notebook runtime + CLI                    |
| `@danielsimonjr/mathts-compat`         | mathjs API compatibility shim (`create(all)`)                   |
| `@danielsimonjr/mathts-wasm`           | AssemblyScript WASM kernels — the `functions` backend + matrix basic ops |
| `wasm-rust` (Cargo crate)              | Rust WASM — matrix heavy ops only (fft/eig/svd/decomp); `functions` migrated off Rust to AS (Phase 5) |

### Dependency graph

```
typed-function <- core <- matrix <- functions
                    ^         ^          ^
workerpool <- parallel ------+          |
                    ^                   |
                    +-------------------+
matrix <- tensor <- autograd
core <- workbook
core, matrix, functions, parallel <- compat
```

Zero circular dependencies (verified by `tools/create-dependency-graph`).

### Three-tier dispatch

For each operation, the runtime selects the fastest available tier:

```
WASM (Rust or AS, above size threshold)
  -> WebWorker / ComputePool (above per-op threshold)
    -> In-process JavaScript (always available)
```

The `BackendManager` in `@danielsimonjr/mathts-matrix` handles backend
selection for matrix operations. `ComputePool.shouldParallelize(n, op?)`
resolves per-op thresholds via `thresholdByOp`.

### WASM backends

The stack is **TS → AssemblyScript → (WebGPU for matrix)**. The `functions`
package is **AssemblyScript-only** as of the Rust→AS migration Phase 5 — it
loads `mathts-as.wasm` and its dispatch is AS→JS (the Rust path was removed from
its bridges). The `matrix` package still keeps a Rust backend for heavy ops; its
Rust→AS migration is a separate, pending slice.

| Backend           | Class     | Source              | Binary                | Use                                   |
| ----------------- | --------- | ------------------- | --------------------- | ------------------------------------- |
| `WASMBackend`     | AS        | `assembly/src/`     | `mathts-as.wasm`      | Element-wise + basic matrix ops; the `functions` package backend |
| `RustWASMBackend` | Rust      | `wasm-rust/crates/` | `lib/wasm/mathts.wasm`| matrix heavy ops (FFT, eig, SVD, decomposition) — **migration pending** |

The two backends have clean separate class identities after the Rust/AS split
(see `matrix/src/backends/register-backends.ts`). Four `functions` AS kernels are
on a JS fallback pending Phase 6 fixes (poly fit/cheb/legendre, Airy Ai/Bi for
|x|>5, argsort/rank + slow sort).

### WebGPU (opt-in, f32 only)

`@danielsimonjr/mathts-functions` exports `gpuMatmul`, `gpuAdd`,
`gpuTranspose`, and `gpuScale` from `functions/src/typed/gpu.ts`. Each is
`async` and falls back to CPU when no WebGPU adapter is present. WGSL has no
f64, so these are additive exports — the existing f64 `multiply`/`transpose`
are unaffected.

---

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Cross-package WASM integration tests (separate from turbo graph)
npm run test:wasm:integration

# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint

# WASM benchmarks (Rust vs AS vs JS)
npm run bench:wasm

# Parallel-execution break-even benchmarks
npm run bench:parallel

# Build WASM artifacts (AssemblyScript)
npm run build:wasm

# Build WASM artifacts (Rust)
npm run build:wasm:rust

# Build both WASM toolchains
npm run build:wasm:all

# Format all files
npm run format
```

Single-package commands (examples):

```bash
npx turbo build --filter=@danielsimonjr/mathts-core
npx turbo test --filter=@danielsimonjr/mathts-matrix
cd functions && npx vitest run
```

---

## Status

MathTS is an actively developed monorepo of 22 independently-versioned packages.
The dependency graph has **0 runtime circular dependencies** (verified by
`tools/create-dependency-graph`, which regenerates the reports below).

Live metrics — file / export / module counts, per-file test coverage, and the
WASM↔function pairing — are kept in **generated** reports rather than duplicated
here (so they can't drift). Regenerate with `npm run docs:deps`:

| Report | Contents |
| --- | --- |
| [`docs/Architecture/OVERVIEW.md`](./docs/Architecture/OVERVIEW.md) | Package & architecture metrics |
| [`docs/Architecture/TEST_COVERAGE.md`](./docs/Architecture/TEST_COVERAGE.md) | Per-file test coverage |
| [`docs/Architecture/DEPENDENCY_GRAPH.md`](./docs/Architecture/DEPENDENCY_GRAPH.md) | Dependency graph |
| [`docs/Architecture/wasm-pairing.md`](./docs/Architecture/wasm-pairing.md) | WASM accelerator ↔ function pairing |

### Known open items

- No browser smoke test for WebGPU paths (WebGPU is not available in headless
  Node; needs a CI runner with a software WebGPU backend such as Mesa lavapipe).

See [`TODO.md`](./TODO.md) for the full open-items list.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines, code style, commit
message conventions (Conventional Commits), and the pre-commit hook setup.

---

## License

[MIT](./LICENSE) © Daniel Simon Jr.

---

## Documentation

| Document                                                                           | Contents                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [`CHANGELOG.md`](./CHANGELOG.md)                                                   | Full change history                                    |
| [`docs/Architecture/OVERVIEW.md`](./docs/Architecture/OVERVIEW.md)                 | Package metrics, two-layer code architecture           |
| [`docs/Architecture/ARCHITECTURE.md`](./docs/Architecture/ARCHITECTURE.md)         | Component design, circular-dependency audit            |
| [`docs/Architecture/DEPENDENCY_GRAPH.md`](./docs/Architecture/DEPENDENCY_GRAPH.md) | Generated dependency graph                             |
| [`docs/Architecture/TEST_COVERAGE.md`](./docs/Architecture/TEST_COVERAGE.md)       | Per-file coverage report                               |
| [`docs/migration-guide.md`](./docs/migration-guide.md)                             | Migrating from mathjs v15                              |
| [`docs/integration/upt.md`](./docs/integration/upt.md)                             | Notes for UPT (Universal Physics Tensor) consumers     |
| [`TODO.md`](./TODO.md)                                                             | Open items and deferred decisions                      |
| [`docs/reference/functions.md`](./docs/reference/functions.md)                     | Full typed-function export reference with Accel column |
