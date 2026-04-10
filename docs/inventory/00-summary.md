# MathTS Codebase Inventory — Unified Summary

> Generated 2026-04-10 by RLM pipeline with 5 parallel agents.
> Detailed reports in `01-*` through `05-*` files.

---

## Code Metrics

| Layer | Files | Lines | Status |
|-------|-------|-------|--------|
| **Native MathTS** | | | |
| core/src (native) | 95 | 23,780 | Active, tested |
| matrix/src | 38 | 15,250 | Active, tested |
| functions/src/typed | 11 | ~4,600 | Active, tested |
| parallel/src | 16 | 4,156 | Active, tested |
| assembly/src (WASM) | 10 | 3,324 | Active, builds |
| workbook/src | 6 | 690 | Partial (executeCode stubbed) |
| compat/src | 3 | 883 | Active, 87+ test cases |
| **Native subtotal** | **~179** | **~52,700** | |
| | | | |
| **Synced from mathjs** | | | |
| functions/src (categories) | 290 | ~51,100 | Dormant |
| functions/src (support dirs) | 470 | ~79,000 | Dormant |
| expression/src | 391 | 20,993 | Builds, disconnected |
| core/src (synced utils) | ~60 | ~7,600 | Dormant |
| **Synced subtotal** | **~1,211** | **~158,700** | |
| | | | |
| **Tests** | 76 | ~20,500 | 2,304 pass |

---

## What Works Today

### Core Types (3 types, fully implemented)

| Type | Methods | Notes |
|------|---------|-------|
| **Complex** | 83 | All trig, hyperbolic, transcendental |
| **Fraction** | 61 | Arithmetic, comparison, rounding |
| **BigNumber** | 96 | Arithmetic + trig + transcendental (decimal.js) |

### Active Typed Functions (158 exports, 11 modules)

| Module | Exports | Description |
|--------|---------|-------------|
| **arithmetic** | 48 | add, subtract, multiply, divide, pow, sqrt, abs, gcd, lcm, etc. |
| **trigonometry** | 20 | sin, cos, tan, inverses, hyperbolic, hypot |
| **statistics** | 23 | mean, median, std, variance, quantile, histogram (parallel-first) |
| **signal** | 12 | parallelFFT, parallelIFFT, convolution, correlation, groupDelay |
| **special** | 9 | erfc, beta, gammainc, digamma, Bessel functions |
| **distributions** | 11 | normalPDF/CDF, exponential, Poisson, binomial, entropy |
| **geometry** | 18 | distance, angle, cross/dot product, convex hull, polygon ops |
| **interpolation** | 6 | linearInterp, lagrangeInterp, cubicSpline, hermiteInterp, pchipInterp, polyFit |
| **integration** | 4 | trapz, simpson, gaussQuad, romberg |
| **combinatorics** | 6 | fibonacci, lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial |
| **typed-bridge** | 1 | initTypeBridge |

**60 functions beyond mathjs** (special, distributions, geometry, interpolation, integration, combinatorics)

### Matrix System
- **DenseMatrix** — Float64Array-backed, numbers-only, full operation set
- **SparseMatrix** — CSC format implementation
- **3 backends**: JSBackend (always), WASMBackend (>1K elements), GPUBackend (>100K elements)
- **BackendManager** — adaptive threshold tuning at runtime
- **Decompositions** — SVD, LU, QR, Cholesky, eigendecomposition

### WASM

**Rust WASM (primary) — 1,017 exports**:
- 826 core Rust exports (arithmetic, linear algebra, FFT, statistics, special functions)
- 192 AssemblyScript compat wrappers (`wasm-rust/crates/mathts-wasm/src/compat/`) — full AS parity achieved
- Dual-backend migration is complete; Rust backend supersedes AssemblyScript for all operations

**AssemblyScript WASM (legacy, benchmarking) — 432 exports**:
- Scalar: 52 ops (arithmetic, trig, transcendental)
- Array: 36 ops (element-wise, norms, dot products)
- Matrix: 41 ops (multiply, transpose, LU, QR, determinant)
- Complex scalar: 44 ops
- Complex array: 33 ops

### Parallel
- **ComputePool** singleton with WebWorker dispatch
- 40+ parallel functions across elementwise, matmul, reduce, map
- 7 threshold categories with adaptive minimums

### Compat
- 54 shim functions, ALL wired to real implementations
- `create(all)` works, returns full `MathInstance`
- 87+ test cases covering arithmetic, matrix, complex, constants

---

## Package Summary

| Package | Source Files | Lines | Test Files | Exports |
|---------|-------------|-------|------------|---------|
| core | 95 | 23,780 | 12 | 625 |
| matrix | 38 | 15,250 | 17 | 351 |
| functions | 760 | 130,146 | 24 | 3,871 |
| parallel | 16 | 4,156 | 13 | 176 |
| expression | 391 | 20,993 | 2 | 608 |
| workbook | 6 | 690 | 3 | 29 |
| compat | 3 | 883 | 2 | 132 |
| assembly (WASM-AS) | 10 | 3,324 | 0 | 432 |
| wasm-rust | 63 | ~18,500 | — | 1,017 |
| typed-function | 2 | 692 | 2 | 62 |
| workerpool | 3 | 2,637 | 1 | 37 |

All packages at **v0.1.2**, published to npm.

---

## What Doesn't Work

### Expression Package
- Parser ported (16 node types, 1,885-line parse.ts) — builds
- **compiler/, evaluator/ are empty stubs**
- Minimal tests (2 files)
- Not connected to `@danielsimonjr/mathts-core` type system

### Workbook
- Infrastructure works (dep graph, topological sort, reactive engine)
- **`executeCode()` throws "not yet implemented"**
- No integration with expression parser

### Synced Factories (231 functions, all dormant)
- `factoriesAny.ts` and `factoriesNumber.ts` have broken import paths
- None are exported from `functions/src/index.ts`
- None are registered in the native factory system

---

## Integration Barriers

### 1. Two Incompatible typed-function Instances
- **Native** `mathTyped`: 15 types, `instanceof`-based checks
- **Synced** `createTyped`: 40+ types, duck-typing checks

### 2. Two Incompatible Type Hierarchies
- Native `Complex/Fraction/BigNumber` have different APIs than synced mathjs type wrappers
- Synced factories expect `complex.js`/`fraction.js`/`decimal.js` objects directly

### 3. Two Incompatible Factory Registries
- Native `FunctionRegistry`: `{ name, dependencies, factory }` pattern
- Synced mathjs: `factory(scope)` with `.isFactory` marker

### 4. Matrix Architecture Mismatch
- Native `DenseMatrix`: `Float64Array`-backed, numbers-only
- Synced factories expect: nested `Array<any>` with `._data`, `._size`, `.storage()`, `datatype()`

### 5. Missing Subsystems
Required by 100+ factories but not implemented:
- Unit, Index, Range, Chain, ResultSet, Help

---

## Sprint Completion

| Phase | Description | Status |
|-------|-------------|--------|
| 1: Core Foundation | Sprints 1-4 | **COMPLETE** |
| 2: WASM Acceleration | Sprints 5-8 | **COMPLETE** |
| 3: Parallel Execution | Sprints 9-12 | **COMPLETE** |
| 4: WebGPU Acceleration | Sprints 13-16 | **COMPLETE** |
| 5: Function Library | Sprints 17-24 | **COMPLETE** |
| 6: Integration & Polish | Sprints 25-28 | **COMPLETE** |

All 166 sprint tasks complete. Published to npm at v0.1.2.

---

## Synced Factory Categories (231 factories, dormant)

| Category | Factories | Files | Lines |
|----------|-----------|-------|-------|
| algebra | 28 | 45 | 11,441 |
| arithmetic | 40 | 40 | 7,416 |
| bitwise | 7 | 8 | 797 |
| combinatorics | 4 | 4 | 388 |
| complex | 4 | 4 | 280 |
| geometry | 2 | 2 | 1,251 |
| logical | 5 | 5 | 665 |
| matrix | 42 | 44 | 9,604 |
| numeric | 1 | 1 | 712 |
| probability | 12 | 14 | 1,740 |
| relational | 12 | 13 | 1,807 |
| set | 10 | 10 | 847 |
| signal | 2 | 5 | 1,349 |
| special | 2 | 2 | 502 |
| statistics | 13 | 14 | 2,461 |
| string | 5 | 5 | 441 |
| trigonometry | 25 | 26 | 1,658 |
| unit | 2 | 2 | 137 |
| utils | 15 | 46 | 7,649 |

---

## Future Activation Path

### Phase 1: Quick Wins (days)
- Fix method name mismatches (neg→negate, reciprocal→inverse, div→divide)
- Fix factoriesAny.ts / factoriesNumber.ts import paths

### Phase 2: Bridge typed-function (2-3 weeks)
- Register native types in the synced `createTyped` instance
- Or adapt synced factories to use `mathTyped` dispatch
- 56 leaf factories (typed-only deps) become activatable

### Phase 3: Matrix Bridge (2-4 weeks)
- Make native DenseMatrix satisfy synced factory expectations
- Unlocks ~42 matrix factories

### Phase 4: Full Activation (months)
- Implement Unit, Index, Range, Chain subsystems
- Wire expression parser to function registry
- Connect workbook executeCode() to expression evaluator
- Activate remaining 200+ factories progressively
