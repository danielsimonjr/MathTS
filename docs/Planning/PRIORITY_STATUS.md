# MathTS Priority Status

**Generated**: 2026-04-03
**Build**: 10/10 | **Typecheck**: 14/14 | **Tests**: 54 files, 1,445 pass

---

## Sprint Completion Summary

| Phase | Sprints | Done | Status |
|-------|---------|------|--------|
| **1: Core Foundation** | 1-4 | 28/28 | **COMPLETE** |
| **2: WASM Acceleration** | 5-8 | 26/26 | **COMPLETE** |
| **3: Parallel Execution** | 9-12 | 21/26 | **5 tasks remain** |
| **4: WebGPU Acceleration** | 13-16 | 25/25 | **COMPLETE** |
| **5: Function Library** | 17-24 | 43/43 | **COMPLETE** |
| **6: Integration & Polish** | 25-28 | 14/18 | **4 tasks remain** |
| **Total** | 1-28 | **157/166** | **94.6%** |

## Integration Plan Status (2026-04-03)

| Task | Description | Status |
|------|-------------|--------|
| 1 | Fix method names (neg→negate, etc.) | **DONE** |
| 2 | Fix factory registry import paths | **DONE** |
| 3 | Add 22 BigNumber math methods | **DONE** |
| 4 | Type compatibility bridge | **DONE** |
| 5 | Typed-function bridge | **DONE** |
| 6 | Activate leaf factories | NOT STARTED |
| 7 | Activate arithmetic factories | NOT STARTED |
| 8 | Activate trigonometry factories | NOT STARTED |
| 9 | Activate statistics factories | NOT STARTED |
| 10 | Connect expression compiler/evaluator | NOT STARTED |
| 11 | Connect workbook to expression | NOT STARTED |
| 12 | Full integration verification | NOT STARTED |

---

## Remaining Work — Prioritized by Dependency & Complexity

### Priority 1: Activate Leaf Factories (LOW complexity, HIGH value)
**Sprint**: 3.10 partial + Integration Task 6
**Dependency**: Tasks 1-5 (all done)
**Effort**: 1-2 days

81 leaf factories depend only on `typed` dispatch — no Matrix, Unit, or Index deps. With the type bridge in place, these can be activated by exporting from `functions/src/index.ts`. Categories: `relational` (13), `logical` (5), `bitwise` (8), `string` (5), `special` (2), `combinatorics` (4 partial), `arithmetic` (partial).

**What to do**: Create `functions/src/factories/index.ts` barrel, export leaf factories, write tests, verify build.

---

### Priority 2: Activate Arithmetic + Trig Factories (MEDIUM complexity, HIGH value)
**Sprint**: Integration Tasks 7-8
**Dependency**: Priority 1 + BigNumber math methods (done)
**Effort**: 3-5 days

40 arithmetic and 26 trigonometry factories. Most depend on `typed` + `BigNumber` + `Complex` + `Fraction`. With BigNumber now having trig/transcendental methods and the type bridge in place, these should activate cleanly. Matrix-dependent overloads may need the matrix bridge first.

**What to do**: Export arithmetic/trig factories from barrel, test with all numeric types, identify which need matrix bridge.

---

### Priority 3: Sprint 28 — Release Prep (MEDIUM complexity, HIGH value)
**Sprint**: 6.28 (1/5 done)
**Dependency**: None (independent)
**Effort**: 3-5 days

4 remaining tasks:
1. **npm publishing setup** — configure packages, CI publish workflow
2. **Bundle size optimization** — tree-shaking, minification, code splitting
3. **Performance regression tests** — create benchmark suite for CI
4. **v1.0.0 release** — changelog, tag, publish

**What to do**: Configure changesets (already present), set up CI publish, measure bundle sizes, create benchmark harness.

---

### Priority 4: Sprint 10-12 Incomplete — WASM/Parallel Optimization (HIGH complexity, MEDIUM value)
**Sprint**: 3.10, 3.11, 3.12 (5 tasks remain)
**Dependency**: Phases 1-2 (done)
**Effort**: 1-2 weeks

5 tasks remaining:
1. Parallel operation benchmarks (Sprint 10)
2. FFT WASM acceleration with SIMD butterfly ops (Sprint 11)
3. Parallel FFT for large arrays (Sprint 11)
4. WASM eig/svd — QR iteration, bidiagonalization in AssemblyScript (Sprint 12)
5. Parallel divide-and-conquer eigensolve (Sprint 12)

These are performance optimizations — the features work but aren't accelerated. Lower priority than activating factory functions.

**What to do**: Start with benchmarks (task 1), then WASM FFT (task 2), then parallel FFT (task 3). WASM eig/svd is the hardest.

---

### Priority 5: Expression Compiler/Evaluator (HIGH complexity, HIGH value)
**Sprint**: Integration Tasks 10-11
**Dependency**: Priority 1-2 (factory activation)
**Effort**: 1-2 weeks

The expression parser is ported (16 node types, 1885-line parse.ts) and builds. But `compiler/` and `evaluator/` directories are empty stubs. To make `math.evaluate('2 + 3')` work:
1. Implement compiler that resolves AST nodes to registered functions
2. Implement evaluator that executes compiled expressions with scope
3. Connect to activated factories for function resolution

**What to do**: Implement minimal compiler/evaluator supporting arithmetic/trig/variable expressions. Wire to function registry.

---

### Priority 6: Activate Remaining Factories (HIGH complexity, MEDIUM value)
**Sprint**: Integration Task 9 + new work
**Dependency**: Priorities 1-2, plus Matrix/Unit bridges
**Effort**: 2-4 weeks

150+ factories depend on Matrix, Unit, Index, Range, Chain subsystems that don't exist in native form. Activating these requires either:
- Building adapter layers (DenseMatrix → mathjs Matrix interface)
- Implementing missing subsystems (Unit, Index, Range)

Categories: `matrix` (42), `algebra` (28), `statistics` (14), `probability` (12), `set` (10), `geometry` (2), `unit` (2).

---

### Priority 7: Workbook ↔ Expression Integration (MEDIUM complexity, LOW value for now)
**Sprint**: Integration Task 11
**Dependency**: Priority 5 (expression evaluator)
**Effort**: 2-3 days

Replace the `Function` constructor-based `executeCode()` with the expression evaluator. Enables math-aware cell evaluation with type dispatch and function registry.

---

## Dependency Chain

```
Priority 1 (leaf factories)
    ↓
Priority 2 (arithmetic + trig factories)
    ↓
Priority 5 (expression compiler/evaluator)
    ↓
Priority 6 (remaining factories — needs matrix bridge)
    ↓
Priority 7 (workbook ↔ expression)

Priority 3 (release prep) — independent, can run in parallel
Priority 4 (WASM/parallel optimization) — independent, can run in parallel
```

## Feature Plans Status (docs/plans/)

| Plan | Date | Topic | Status | Evidence |
|------|------|-------|--------|----------|
| ts-wasm-optimization | 2026-03-01 | WASM SIMD, workPtr validation, dedup | **MOSTLY DONE** | Assembly builds, 432 exports, WASMBackend works |
| scientific-calculator | 2026-03-04 | Electron desktop app (5 panels) | **NOT STARTED** | No mathjs-calc directory |
| deno-notebook | 2026-03-05 | Deno notebook for live documents | **NOT STARTED** | No deno.json |
| ise-gap-analysis | 2026-03-05 | ISE Workbench gap analysis | **DESIGN ONLY** | Analysis doc, no implementation |
| ise-guided-discovery | 2026-03-05 | ISE user education design | **DESIGN ONLY** | Design doc, no implementation |
| ise-workbench | 2026-03-05 | ISE 3-zone workbench (calc+graph+expr) | **NOT STARTED** | 0/16 plan tasks, no implementation |
| as-to-rust-wasm | 2026-03-11 | Migrate WASM from AssemblyScript to Rust | **PARTIALLY DONE** | 75 .rs files, 2 .wasm built, crate structure exists |
| wasm-opportunity-audit | 2026-03-11 | Audit codebase for WASM opportunities | **DONE** | Tiered recommendations generated |

## Roadmap Status (docs/roadmap/)

| Plan | Topic | Status | Evidence |
|------|-------|--------|----------|
| typed-function improvements | Fork enhancements: error msgs, perf, types | **PARTIALLY DONE** | Package exists, has tests, but improvements list not tracked |
| workerpool improvements | Fork enhancements: TypeScript, monitoring | **PARTIALLY DONE** | Package exists, has tests, but improvements list not tracked |

## Feature Plans — Priority by Dependency & Complexity

| Priority | Plan | Depends On | Complexity | Value |
|----------|------|-----------|------------|-------|
| **A** | Rust WASM migration | WASM optimization (done) | High | High — Rust WASM is 2-5x faster than AS |
| **B** | Scientific calculator | Core integration (Priorities 1-2) | Medium | High — demonstrates library capabilities |
| **C** | ISE Workbench | Expression evaluator (Priority 5), calculator | High | High — flagship product |
| **D** | typed-function improvements | Independent | Low | Medium — improves error messages, perf |
| **E** | workerpool improvements | Independent | Low | Medium — improves monitoring, TypeScript |
| **F** | Deno notebook | Workbook + Expression | Medium | Low — alternative to ISE |

---

## What's Verified Working Today

| Component | Evidence |
|-----------|----------|
| Core types (Complex, Fraction, BigNumber) | 96 methods on BigNumber, 83 on Complex, 61 on Fraction |
| Matrix (DenseMatrix, SparseMatrix) | 33 src files, 14 tests, 3 backends |
| WASM | 432 exports, builds to .wasm, binding layer works |
| GPU | WebGPU compute shaders, 40 methods on GPUMatrixBackend |
| Parallel | ComputePool, 14 src files, 10 test files, 202 tests |
| Typed functions | 96 active exports (arithmetic, trig, statistics, signal) |
| Type bridge | registerNativeTypes() — duck-typing markers on prototypes |
| Factory registries | factoriesAny.ts (303 exports), factoriesNumber.ts (192) — paths fixed |
| Compat | create(all) works, 54 shims, 87 test cases |
| Expression | Parser builds, 16 node types — compiler/evaluator stubbed |
| Workbook | executeCode() works via Function constructor, 52 tests |
| Build pipeline | 10/10 packages build, 14/14 typecheck, 1445 tests pass |
