# MathTS Master Roadmap

**Updated**: 2026-04-10
**Current State**: v0.1.2 published, 79 test files, 2304 tests, 302+ functions

---

## Active Items (sorted by time × complexity)

| # | Item | Status | Effort | Dependency |
|---|------|--------|--------|-----------|
| 1 | Sync 207 mathjs functions (Phase 1: 54 sync, Phase 2: 74 TS, Phase 3: 79 Rust) | Not started | 1 day → 6 weeks | None |
| 2 | Workbook ↔ Expression wiring | Deferred | 2-3 days | None |
| 3 | Scientific Calculator (Electron, 5 panels) | Not started | 3-4 weeks | Factory activation (done) |
| 4 | Deno Notebook (live documents) | Not started | 1-2 weeks | Workbook + Expression |
| 5 | ISE Workbench (3-zone split, LaTeX, graphing) | Not started (0/16 tasks) | 6-8 weeks | Scientific Calculator |
| 6 | ISE Guided Discovery & Education | Not started | 2-3 weeks | ISE Workbench |

## Completed Items

| Item | Status | Date |
|------|--------|------|
| 166/166 sprint tasks | 100% | 2026-04-05 |
| 242/273 factory activation (89%) | Done — 31 are infrastructure | 2026-04-05 |
| Fix all pre-existing issues | Done (18 bugs from code review) | 2026-04-05 |
| 60 new functions beyond mathjs | Done | 2026-04-05 |
| typed-function improvements (Symbol-based type ID, safe conversions) | Done | 2026-04-05 |
| workerpool improvements (SharedArrayBuffer, warmup, metrics) | Done | 2026-04-05 |
| Rust WASM full migration (AS → Rust, 1,017 exports, full AS parity) | Done | 2026-04-10 |
| Rust WASM integration (RustWasmLoader, BackendManager routing) | Done | 2026-04-05 |
| Expression compiler/evaluator (16 node types, evaluate()) | Done | 2026-04-03 |
| Matrix bridge (MathJSDenseMatrix, MathJSSparseMatrix CSC) | Done | 2026-04-03 |
| BigNumber math methods (22 Taylor series) | Done | 2026-04-03 |
| Type bridge (duck-typing markers) | Done | 2026-04-03 |
| WASM FFT + eig/svd + parallel dispatch | Done | 2026-04-05 |
| npm publishing (10 packages at v0.1.2) | Done | 2026-04-05 |
| Bundle optimization (57% reduction, 662 KB) | Done | 2026-04-05 |
| Performance regression tests (23 benchmarks) | Done | 2026-04-05 |
| User-facing documentation (21 files) | Done | 2026-04-05 |
| All dependency graphs regenerated | Done | 2026-04-10 |

## Design Specs (not yet implemented)

| Spec | Size | Location |
|------|------|----------|
| Workbench Specification | 229 KB | docs/Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md |
| Enhancement Roadmap | 46 KB | docs/Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md |
| Workbook Specification | 8 KB | docs/Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md |
| ISE Gap Analysis | 8 KB | docs/plans/2026-03-05-ise-gap-analysis.md |

## Plan Documents

| Plan | Location |
|------|----------|
| mathjs Sync Roadmap (207 functions) | docs/roadmap/MATHJS_SYNC_ROADMAP.md |
| Rust WASM Migration Design | docs/plans/2026-03-11-assemblyscript-to-rust-wasm-design.md |
| Scientific Calculator Plan | docs/plans/2026-03-04-scientific-calculator-plan.md |
| ISE Workbench Plan (16 tasks) | docs/plans/2026-03-05-ise-workbench-plan.md |
| Deno Notebook Option | docs/plans/2026-03-05-deno-notebook-option.md |
| New Math Functions Design | docs/plans/2026-04-05-new-math-functions-design.md |
