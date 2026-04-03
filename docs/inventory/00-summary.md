# MathTS Codebase Inventory — Unified Summary

> Generated 2026-04-03 by RLM pipeline with 5 parallel agents.
> Detailed reports in `01-*` through `05-*` files.

---

## Code Metrics

| Layer | Files | Lines | Status |
|-------|-------|-------|--------|
| **Native MathTS** | | | |
| core/src (native) | ~30 | ~15,250 | Active, tested |
| matrix/src | 32 | ~12,000 | Active, tested |
| functions/src/typed | 5 | ~2,500 | Active, tested (type gaps) |
| parallel/src | 14 | ~3,100 | Active, tested |
| assembly/src (WASM) | 10 | ~3,300 | Active, builds |
| workbook/src | 6 | ~660 | Partial (executeCode stubbed) |
| compat/src | 2 | ~800 | Active, 87 test cases |
| **Native subtotal** | **~99** | **~37,600** | |
| | | | |
| **Synced from mathjs** | | | |
| functions/src (categories) | 290 | ~51,100 | Dormant |
| functions/src (support dirs) | 494 | ~77,700 | Dormant |
| expression/src | 329 | ~19,800 | Builds, disconnected |
| core/src (synced utils) | ~60 | ~7,600 | Dormant |
| **Synced subtotal** | **~1,173** | **~156,200** | |
| | | | |
| **Tests** | 47 | ~12,600 | 1,342 pass |

---

## What Works Today

### Core Types (3 types, fully implemented)
- **Complex** — 60 methods including all trig, hyperbolic, transcendental
- **Fraction** — 43 methods, arithmetic + comparison + rounding
- **BigNumber** — 56 methods, arithmetic + comparison + rounding (NO trig/transcendental)

### Active Typed Functions (95 exports)
- **arithmetic** — 48 exports: add, subtract, multiply, divide, pow, sqrt, abs, etc.
- **trigonometry** — 20 exports: sin, cos, tan, inverses, hypot
- **statistics** — 19 exports: mean, median, std, variance, etc. (parallel-first)
- **signal** — 8 exports: fft, ifft, convolve, correlate

### Matrix System
- **DenseMatrix** — Float64Array-backed, numbers-only, full operation set
- **SparseMatrix** — CSC format implementation
- **3 backends**: JSBackend (always), WASMBackend (>1K elements), GPUBackend (>100K elements)
- **BackendManager** — adaptive threshold tuning at runtime
- **Decompositions** — SVD, LU, QR, Cholesky, eigendecomposition

### WASM (209 exported operations)
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
- 87 test cases covering arithmetic, matrix, complex, constants

---

## What Doesn't Work

### Type Gaps (23 issues in typed functions)
| Gap | Affected | Fix |
|-----|----------|-----|
| `neg()` called but method is `negate()` | Complex, Fraction, BigNumber | Rename in typed functions |
| `reciprocal()` called but method is `inverse()` | Complex | Rename in typed functions |
| `div()` called but method is `divide()` | BigNumber | Rename in typed functions |
| BigNumber missing trig methods | sin, cos, tan, asin, acos, atan | Implement on BigNumber (wrap decimal.js) |
| BigNumber missing transcendentals | exp, ln, log10, log2, cbrt, mod | Implement on BigNumber (wrap decimal.js) |
| BigNumber missing hyperbolic | sinh, cosh, tanh, asinh, acosh, atanh | Implement on BigNumber (wrap decimal.js) |

### Expression Package
- Parser ported (16 node types, 1,885-line parse.ts) — builds
- **compiler/, evaluator/ are empty stubs**
- **Zero tests**
- Not connected to `@mathts/core` type system

### Workbook
- Infrastructure works (dep graph, topological sort, reactive engine, 50 tests)
- **`executeCode()` throws "not yet implemented"**
- No integration with expression parser

### Synced Factories (252 functions, all dormant)
- `factoriesAny.ts` and `factoriesNumber.ts` have **broken import paths** (still use `./function/utils/...`)
- None are exported from `functions/src/index.ts`
- None are registered in the native factory system

---

## Integration Barriers (from Opus analysis)

### 1. Two Incompatible typed-function Instances
- **Native** `mathTyped`: 15 types, `instanceof`-based checks
- **Synced** `createTyped`: 40+ types, duck-typing checks
- A `@mathts/core` Complex won't pass mathjs's `isComplex` check

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

## Recommended Activation Path

### Phase 1: Quick Wins (days)
- Fix 3 method name mismatches in typed functions (neg→negate, reciprocal→inverse, div→divide)
- Fix factoriesAny.ts / factoriesNumber.ts import paths
- This gets typecheck passing for active code and registries resolving

### Phase 2: BigNumber Math (1-2 weeks)
- Add trig + transcendental methods to BigNumber (wrap decimal.js which has them)
- This unlocks all BigNumber overloads in typed functions

### Phase 3: Bridge typed-function (2-3 weeks)
- Register native types in the synced `createTyped` instance
- Or adapt synced factories to use `mathTyped` dispatch
- 56 leaf factories (typed-only deps) become activatable

### Phase 4: Matrix Bridge (2-4 weeks)
- Make native DenseMatrix satisfy synced factory expectations
- Or create adapter that wraps DenseMatrix with mathjs Matrix interface
- Unlocks ~42 matrix factories

### Phase 5: Full Activation (months)
- Implement Unit, Index, Range, Chain subsystems
- Wire expression parser to function registry
- Connect workbook executeCode() to expression evaluator
- Activate remaining 200+ factories progressively

### Effort by Category

| Category | Factories | Deps Beyond typed | Effort | Priority |
|----------|-----------|-------------------|--------|----------|
| arithmetic | 44 | BigNumber, Complex | Medium | High |
| relational | 22 | typed only (most) | Low | High |
| logical | 5 | typed only | Low | High |
| bitwise | 8 | typed only | Low | Medium |
| trigonometry | 26 | BigNumber | Medium | High |
| statistics | 14 | Matrix | Medium | Medium |
| matrix | 42 | Matrix, DenseMatrix | High | High |
| algebra | 28 | Matrix, Complex | High | Medium |
| probability | 14 | BigNumber | Medium | Low |
| combinatorics | 4 | BigNumber | Low | Low |
| set | 10 | Matrix | Medium | Low |
| complex | 4 | Complex class | Low | Medium |
| geometry | 2 | Matrix | Medium | Low |
| special | 2 | typed only | Low | Low |
| string | 5 | typed only | Low | Low |
| unit | 2 | Unit subsystem | High | Low |
| signal | 2 | Matrix | Medium | Medium |
| numeric | 1 | Matrix | Low | Low |
