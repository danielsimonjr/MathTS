# MathTS Priority Status

**Updated**: 2026-04-03
**Build**: 10/10 | **Typecheck**: 14/14 | **Tests**: 63 files, 1,831 pass
**Factories**: 242/273 active (89%) — remaining 31 are infrastructure types in @mathts/core

---

## Completed This Session

| Task | Result |
|------|--------|
| Fix all pre-existing build/typecheck/config issues | 10/10 build, 14/14 typecheck |
| BigNumber math methods (22) | sin, cos, exp, ln, etc. via Taylor series |
| Type bridge (duck-typing markers) | registerNativeTypes() |
| Typed-function bridge | initTypeBridge() |
| Fix method names (neg→negate, etc.) | 3 renames across typed functions |
| Fix factory registry import paths | 287 paths stripped |
| Matrix compatibility bridge | MathJSDenseMatrix adapter |
| Expression compiler | Tree-walking interpreter, 16 node types |
| Expression evaluator | evaluate('sin(pi/2)') works end-to-end |
| Parse bootstrapping | All 16 node constructors in scope |
| Factory cascade (tiers 1-18) | 242 factories activated |
| Parallel benchmarks | 18 tests, elementwise/reduce/matmul |
| Workbook executeCode() | Function constructor with scope |
| Assembly WASM build | 64 errors → 0 |

## Remaining Work

### Priority 1: Release Preparation (Sprint 6.28)

| Task | Complexity | Blocked By |
|------|-----------|------------|
| npm publishing setup | Medium | Nothing |
| Bundle size optimization | Medium | Nothing |
| Performance regression tests | Medium | Nothing |
| v1.0.0 release | Low | All above |

### Priority 2: WASM/Parallel Optimization (Sprints 3.11, 3.12)

| Task | Complexity | Blocked By |
|------|-----------|------------|
| FFT WASM acceleration (SIMD butterfly) | High | AssemblyScript expertise |
| Parallel FFT for large arrays | Medium | FFT WASM |
| WASM eig/svd (QR iteration in AS) | High | AssemblyScript expertise |
| Parallel divide-and-conquer eigensolve | High | WASM eig |

### Priority 3: Remaining Integration

| Task | Complexity | Blocked By |
|------|-----------|------------|
| SparseMatrix bridge (real CSC impl) | Medium | Nothing |
| Wire workbook to expression evaluator | Low | Nothing (deferred by user) |

### Feature Plans (Not Started)

| Plan | Status | Depends On |
|------|--------|-----------|
| Rust WASM migration | 75 .rs files exist | Independent |
| Scientific calculator (Electron) | Not started | Factory activation (done) |
| ISE Workbench (3-zone layout) | Not started (0/16) | Expression evaluator (done) |
| Deno notebook | Not started | Workbook + Expression |
| typed-function improvements | Partial | Independent |
| workerpool improvements | Partial | Independent |

---

## Sprint Completion

| Phase | Sprints | Done | Status |
|-------|---------|------|--------|
| 1: Core Foundation | 1-4 | 28/28 | **COMPLETE** |
| 2: WASM Acceleration | 5-8 | 26/26 | **COMPLETE** |
| 3: Parallel Execution | 9-12 | 22/26 | 4 optimization tasks remain |
| 4: WebGPU Acceleration | 13-16 | 25/25 | **COMPLETE** |
| 5: Function Library | 17-24 | 43/43 | **COMPLETE** |
| 6: Integration & Polish | 25-28 | 14/18 | 4 release tasks remain |
| **Total** | 1-28 | **158/166** | **95.2%** |
