# MathTS Documentation Index

Single map of every document in this repo, grouped by purpose and marked
**Current** (live guidance) or **Historical** (completed/superseded, kept for
reference). Looking for something? Skim the group headers, then the table.

> Status legend: ✅ **Current** · 🗄️ **Historical / archived** · ⚠️ **Stale (banner inside)**

---

## 1. Getting Started ✅

| Doc                                            | What it covers                               |
| ---------------------------------------------- | -------------------------------------------- |
| [getting-started.md](getting-started.md)       | Install, first computations, instance setup. |
| [advanced.md](advanced.md)                     | Advanced usage patterns.                     |
| [backends.md](backends.md)                     | JS / WASM / WebGPU backend selection.        |
| [performance.md](performance.md)               | Current performance guidance and numbers.    |
| [../README.md](../README.md)                   | Repo top-level overview.                     |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)       | How to contribute.                           |
| [../SUPPORT.md](../SUPPORT.md)                 | Getting help.                                |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community standards.                         |
| [../SECURITY.md](../SECURITY.md)               | Security policy / reporting.                 |

## 2. Architecture & Reference (current) ✅

| Doc                                                                    | What it covers                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Architecture/OVERVIEW.md](Architecture/OVERVIEW.md)                   | High-level system overview.                                                                                                                                                                                                                                        |
| [Architecture/ARCHITECTURE.md](Architecture/ARCHITECTURE.md)           | Detailed architecture.                                                                                                                                                                                                                                             |
| [Architecture/COMPONENTS.md](Architecture/COMPONENTS.md)               | Per-package component reference — purpose, key exported types, and dependencies for all 24 packages.                                                                                                                                                               |
| [Architecture/API.md](Architecture/API.md)                             | Architectural API surface.                                                                                                                                                                                                                                         |
| [Architecture/DATAFLOW.md](Architecture/DATAFLOW.md)                   | Data-flow through packages.                                                                                                                                                                                                                                        |
| [Architecture/DEPENDENCY_GRAPH.md](Architecture/DEPENDENCY_GRAPH.md)   | Package dependency graph (see also the generated `dependency-graph.json/.yaml`).                                                                                                                                                                                   |
| [Architecture/WASM_ACCELERATION.md](Architecture/WASM_ACCELERATION.md) | WASM acceleration design (AssemblyScript backend).                                                                                                                                                                                                                 |
| [Architecture/wasm-pairing.md](Architecture/wasm-pairing.md)           | WASM-effective function pairing (data: `wasm-pairing.json`).                                                                                                                                                                                                       |
| [Architecture/parallel-pairing.md](Architecture/parallel-pairing.md)   | Worker-pool (parallel) function pairing — effective vs threshold-disabled, against the canonical `DEFAULT_THRESHOLD_BY_OP` (data: `parallel-pairing.json`).                                                                                                        |
| [Architecture/COVERAGE_POLICY.md](Architecture/COVERAGE_POLICY.md)     | Test-coverage policy (data: `coverage-policy.json`).                                                                                                                                                                                                               |
| [Architecture/TEST_COVERAGE.md](Architecture/TEST_COVERAGE.md)         | Coverage report (data: `test-coverage.json`).                                                                                                                                                                                                                      |
| [Architecture/unused-analysis.md](Architecture/unused-analysis.md)     | Unused-export analysis.                                                                                                                                                                                                                                            |
| [Architecture/FILE_INVENTORY.md](Architecture/FILE_INVENTORY.md)       | Complete file census — every tracked repo `.ts` (src/tests/tools/config/examples/docs) tagged reachable/build-entry/test-only/orphan/test/tool/config/example (data: `file-inventory.json`; maximal-walk self-check in `docs:deps` + `bun run check:file-census`). |
| [Architecture/webgpu-pairing.md](Architecture/webgpu-pairing.md)       | WebGPU-effective function pairing (data: `webgpu-pairing.json`).                                                                                                                                                                                                   |
| [Architecture/duplicate-symbols.md](Architecture/duplicate-symbols.md) | Cross-package duplicate-symbol report (data: `duplicate-symbols.json`).                                                                                                                                                                                            |
| [Architecture/duplicate-backlog.md](Architecture/duplicate-backlog.md) | Duplicate-symbol backlog notes.                                                                                                                                                                                                                                    |
| [Architecture/Workbook/README.md](Architecture/Workbook/README.md)     | Workbook architecture folder index.                                                                                                                                                                                                                                |
| [FEATURE_WORKFLOW.md](FEATURE_WORKFLOW.md)                             | Feature lifecycle (idea → ROADMAP → spec → plan → `TODO.md`).                                                                                                                                                                                                      |

### Reference (API symbols)

| Doc                                              | What it covers                                                |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [reference/index.md](reference/index.md)         | Reference landing page.                                       |
| [reference/functions.md](reference/functions.md) | Function reference (HTML mirror: `reference/functions.html`). |
| [reference/classes.md](reference/classes.md)     | Class reference.                                              |
| [reference/constants.md](reference/constants.md) | Constants reference.                                          |

## 3. API (per package) ✅

| Doc                                    | Package                             |
| -------------------------------------- | ----------------------------------- |
| [api/README.md](api/README.md)         | API docs landing.                   |
| [api/core.md](api/core.md)             | `@danielsimonjr/mathts-core`.       |
| [api/matrix.md](api/matrix.md)         | `@danielsimonjr/mathts-matrix`.     |
| [api/functions.md](api/functions.md)   | `@danielsimonjr/mathts-functions`.  |
| [api/parallel.md](api/parallel.md)     | `@danielsimonjr/mathts-parallel`.   |
| [api/compat.md](api/compat.md)         | `@danielsimonjr/mathts-compat`.     |
| [api/autograd.md](api/autograd.md)     | `@danielsimonjr/mathts-autograd`.   |
| [api/expression.md](api/expression.md) | `@danielsimonjr/mathts-expression`. |
| [api/gpu.md](api/gpu.md)               | `@danielsimonjr/mathts-gpu`.        |
| [api/plot.md](api/plot.md)             | `@danielsimonjr/mathts-plot`.       |
| [api/tensor.md](api/tensor.md)         | `@danielsimonjr/mathts-tensor`.     |
| [api/workbook.md](api/workbook.md)     | `@danielsimonjr/mathts-workbook`.   |

> Per-package usage docs live next to the code as `<pkg>/README.md` and
> `<pkg>/CHANGELOG.md` (core, matrix, functions, tensor, autograd, parallel,
> expression, workbook, compat, the thin re-export packages, plus
> `packages/typed-function`, `packages/workerpool`).

## 4. Core concepts ✅

| Doc                                            | What it covers                         |
| ---------------------------------------------- | -------------------------------------- |
| [core/index.md](core/index.md)                 | Core landing page.                     |
| [core/configuration.md](core/configuration.md) | Config / `DEFAULT_CONFIG`.             |
| [core/extension.md](core/extension.md)         | Extending with custom functions/types. |
| [core/serialization.md](core/serialization.md) | Serialization.                         |

## 5. Data Types ✅

| Doc                                                          | What it covers      |
| ------------------------------------------------------------ | ------------------- |
| [datatypes/index.md](datatypes/index.md)                     | Data-types landing. |
| [datatypes/numbers.md](datatypes/numbers.md)                 | Numbers.            |
| [datatypes/bigints.md](datatypes/bigints.md)                 | BigInts.            |
| [datatypes/bignumbers.md](datatypes/bignumbers.md)           | BigNumbers.         |
| [datatypes/fractions.md](datatypes/fractions.md)             | Fractions.          |
| [datatypes/complex_numbers.md](datatypes/complex_numbers.md) | Complex numbers.    |
| [datatypes/matrices.md](datatypes/matrices.md)               | Matrices.           |

## 6. Expressions ✅

| Doc                                                                | What it covers                  |
| ------------------------------------------------------------------ | ------------------------------- |
| [expressions/index.md](expressions/index.md)                       | Expressions landing.            |
| [expressions/syntax.md](expressions/syntax.md)                     | Expression syntax.              |
| [expressions/parsing.md](expressions/parsing.md)                   | Parsing.                        |
| [expressions/expression_trees.md](expressions/expression_trees.md) | Expression trees / AST.         |
| [expressions/algebra.md](expressions/algebra.md)                   | Symbolic algebra.               |
| [expressions/security.md](expressions/security.md)                 | Sandbox / safe-access security. |

## 7. Migration (mathjs → MathTS) ✅

| Doc                                                            | What it covers                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [migration/guide.md](migration/guide.md)                       | Migration guide (compat layer + native API).                                     |
| [migration-guide.md](migration-guide.md)                       | Migrating an existing mathjs v15 codebase (user-focused companion to the above). |
| [migration/api-diff.md](migration/api-diff.md)                 | API differences.                                                                 |
| [migration/examples/basic.md](migration/examples/basic.md)     | Example: basic.                                                                  |
| [migration/examples/complex.md](migration/examples/complex.md) | Example: complex.                                                                |
| [migration/examples/matrix.md](migration/examples/matrix.md)   | Example: matrix.                                                                 |

## 8. Integration ✅

| Doc                                      | What it covers                              |
| ---------------------------------------- | ------------------------------------------- |
| [integration/upt.md](integration/upt.md) | Universal Physics Tensor (UPT) integration. |

## 9. Workbook (.mtsw) ✅

| Doc                                                                                                                        | What it covers                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md](Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md)           | Workbook (.mtsw) runtime spec.                                              |
| [Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md](Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md)         | Workbench (ISE) spec.                                                       |
| [Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md](Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md)                 | Workbook enhancement roadmap (forward-looking).                             |
| [superpowers/specs/2026-06-27-workbook-headless-v1-design.md](superpowers/specs/2026-06-27-workbook-headless-v1-design.md) | Workbook **headless v1** runtime design spec (CLI/terminal `.mtsw`; Draft). |

> The `Architecture/Workbook/` folder also holds reference source/example files
> (`*.ts`, `*.mtsw`, `mathts-architecture.mermaid`).

## 10. Inventory ⚠️

Snapshot of the codebase surface. See the staleness banner on the summary.

| Doc                                                                                              | What it covers                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| [inventory/00-summary.md](inventory/00-summary.md)                                               | Inventory summary (⚠️ stale banner). |
| [inventory/01-core-types-and-typed-functions.md](inventory/01-core-types-and-typed-functions.md) | Core types & typed functions.        |
| [inventory/02-synced-factories.md](inventory/02-synced-factories.md)                             | Synced mathjs factories.             |
| [inventory/03-matrix-wasm-parallel.md](inventory/03-matrix-wasm-parallel.md)                     | Matrix / WASM / parallel.            |
| [inventory/04-expression-compat-workbook.md](inventory/04-expression-compat-workbook.md)         | Expression / compat / workbook.      |
| [inventory/05-integration-gaps.md](inventory/05-integration-gaps.md)                             | Integration gaps.                    |

## 11. Roadmaps & Gap Analyses ✅/🗄️

`docs/roadmap/` is the live roadmap area. It is heavily cross-linked from
`CHANGELOG.md` and the root `TODO.md`, so files stay here even after a wave
ships — completed proposals double as the source-of-truth for any deferred
items they still track.

### Active ✅

| Doc                                                                                                      | What it covers                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md](roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md) | Monorepo bridge/function gap analysis.                                                                                                                    |
| [roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md](roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md)                       | WASM-candidate gap analysis.                                                                                                                              |
| [roadmap/REMAINING_ACCELERATION_CANDIDATES.md](roadmap/REMAINING_ACCELERATION_CANDIDATES.md)             | Remaining acceleration triage + plan.                                                                                                                     |
| [roadmap/ACCELERATION_BENCHMARKS.md](roadmap/ACCELERATION_BENCHMARKS.md)                                 | Acceleration benchmark records.                                                                                                                           |
| [roadmap/BUN_MIGRATION.md](roadmap/BUN_MIGRATION.md)                                                     | Bun package-manager / script-runner migration (Phase 1 landed).                                                                                           |
| [roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md](roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md) | Domain function gap analysis (2026-06-30).                                                                                                                |
| [roadmap/EXPORT_TRIAGE.md](roadmap/EXPORT_TRIAGE.md)                                                     | Export surface triage.                                                                                                                                    |
| [roadmap/ORACLE_COVERAGE_MATRIX.md](roadmap/ORACLE_COVERAGE_MATRIX.md)                                   | Oracle coverage matrix.                                                                                                                                   |
| [roadmap/ORACLE_GAP_INVENTORY_2026-07-15.md](roadmap/ORACLE_GAP_INVENTORY_2026-07-15.md)                 | Oracle gap inventory (2026-07-15).                                                                                                                        |
| [roadmap/SCIENTIFIC_LIBRARY_ROADMAP_2026-07-02.md](roadmap/SCIENTIFIC_LIBRARY_ROADMAP_2026-07-02.md)     | Scientific library roadmap (2026-07-02).                                                                                                                  |
| [roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md](roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md)                 | Statistics gap audit (2026-07-06).                                                                                                                        |
| [roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md](roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md)                     | Upstream fix audit (2026-07-05).                                                                                                                          |
| [roadmap/TYPED_FUNCTION_IMPROVEMENTS.md](roadmap/TYPED_FUNCTION_IMPROVEMENTS.md)                         | Typed-function improvement backlog.                                                                                                                       |
| [roadmap/WORKERPOOL_IMPROVEMENTS.md](roadmap/WORKERPOOL_IMPROVEMENTS.md)                                 | WorkerPool improvement backlog.                                                                                                                           |
| [audit/2026-10-22-codebase-audit.md](audit/2026-10-22-codebase-audit.md)                                 | Whole-codebase audit: duplicates, dead code, reuse map for the PySR roadmap, open issues.                                                                 |
| [roadmap/PYSR_INFORMED_ROADMAP.md](roadmap/PYSR_INFORMED_ROADMAP.md)                                     | ⚠️ Banner still says proposed / no feature code; M1/M3/M4 **are in tree** (see [integration/upt.md](integration/upt.md), [../ROADMAP.md](../ROADMAP.md)). |
| [plans/PYSR_M1_PLAN.md](plans/PYSR_M1_PLAN.md)                                                           | M1 implementation plan: ScalarNode structure and canonical key.                                                                                           |
| [plans/PYSR_M3_PLAN.md](plans/PYSR_M3_PLAN.md)                                                           | M3 implementation plan: batch ScalarNode evaluator.                                                                                                       |
| [plans/PYSR_M4_PLAN.md](plans/PYSR_M4_PLAN.md)                                                           | M4 implementation plan: Pareto front and PySR model selection.                                                                                            |

### Completed / superseded (kept in place — still cross-linked) 🗄️

| Doc                                                                                | Status                                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [roadmap/FUNCTION_GAPS.md](roadmap/FUNCTION_GAPS.md)                               | Slices promoted; referenced by TODO/CHANGELOG.                 |
| [roadmap/FUNCTION_GAPS_AUDIT.md](roadmap/FUNCTION_GAPS_AUDIT.md)                   | Audit roadmap closed (Waves 1–6); still tracks B.1 playbook.   |
| [roadmap/GAP_CLOSURE_PROPOSAL.md](roadmap/GAP_CLOSURE_PROPOSAL.md)                 | Tier-1 landed; still tracks deferred slices.                   |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md)     | Wave 4 landed.                                                 |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md)     | Wave 5 landed.                                                 |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md)     | Wave 6 complete (all 5 slices).                                |
| [roadmap/ITENSOR_PARITY.md](roadmap/ITENSOR_PARITY.md)                             | ITensor parity — six phases, all green (historical design).    |
| [roadmap/UNIFIED_WEBGPU_PATH.md](roadmap/UNIFIED_WEBGPU_PATH.md)                   | Unified GPU-resident path — superseded by phased WebGPU specs. |
| [roadmap/EXPANSION_PLAN.md](roadmap/EXPANSION_PLAN.md)                             | v3 — executed (all workstreams complete).                      |
| [roadmap/MATHJS_SYNC_ROADMAP.md](roadmap/MATHJS_SYNC_ROADMAP.md)                   | Superseded by GAP_ANALYSIS_BRIDGES.                            |
| [roadmap/WASM_OPTIMIZATION_EVALUATION.md](roadmap/WASM_OPTIMIZATION_EVALUATION.md) | Implementation complete (2026-04-10).                          |
| [roadmap/WASM_PAIRING_GAP_PLAN.md](roadmap/WASM_PAIRING_GAP_PLAN.md)               | Executed 2026-06-25.                                           |

## 12. Planning ✅/🗄️

| Doc                                                                                                              | Status                                               |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Planning/MASTER_ROADMAP.md](Planning/MASTER_ROADMAP.md)                                                         | 🗄️ April 2026 master index snapshot.                 |
| [Planning/PRIORITY_STATUS.md](Planning/PRIORITY_STATUS.md)                                                       | 🗄️ April 2026 sprint status snapshot (166/166).      |
| [Planning/MATHTS_SPRINT_TRACKER.md](Planning/MATHTS_SPRINT_TRACKER.md)                                           | 🗄️ Sprint tracker snapshot (phases 1–6 complete).    |
| [Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md](Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md)             | ✅ Implementation-pattern guide.                     |
| [Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md](Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md) | ✅ Guide, part 2.                                    |
| [Planning/CONSOLIDATED_CORRECTIVE_ACTION_PLAN.md](Planning/CONSOLIDATED_CORRECTIVE_ACTION_PLAN.md)               | 🗄️ Dec-2025 pre-monorepo corrective plan (v2).       |
| [Planning/CORRECTIVE_ACTION_PLAN.md](Planning/CORRECTIVE_ACTION_PLAN.md)                                         | 🗄️ Superseded by the consolidated v2 above.          |
| [Planning/MATHTS_BUILDING_PLAN.md](Planning/MATHTS_BUILDING_PLAN.md)                                             | 🗄️ Original Dec-2025 building plan (planning phase). |

## 13. Refactoring (active) ✅

Completed refactoring reports were moved to [`archive/refactoring/`](archive/refactoring/).

| Doc                                                                                                          | What it covers                            |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [refactoring/DUPLICATION_AUDIT.md](refactoring/DUPLICATION_AUDIT.md)                                         | Duplication audit (generated 2026-06-26). |
| [refactoring/DEFERRED_WORK_IMPLEMENTATION_PLAN.md](refactoring/DEFERRED_WORK_IMPLEMENTATION_PLAN.md)         | Plan for deferred work.                   |
| [refactoring/PARALLEL_COMPUTING_IMPROVEMENT_PLAN.md](refactoring/PARALLEL_COMPUTING_IMPROVEMENT_PLAN.md)     | Parallel-computing improvement plan.      |
| [refactoring/SCIENTIFIC_COMPUTING_IMPROVEMENT_PLAN.md](refactoring/SCIENTIFIC_COMPUTING_IMPROVEMENT_PLAN.md) | Scientific-computing improvement plan.    |

> Candidate data files: `refactoring/ASSEMBLYSCRIPT_CANDIDATES.json`,
> `refactoring/WASM_REFACTORING_CANDIDATES.json`.

## 14. Repo-root operational docs

| Doc                                                                                | Status                                                                                   |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [../CHANGELOG.md](../CHANGELOG.md)                                                 | ✅ Release history.                                                                      |
| [../TODO.md](../TODO.md)                                                           | ✅ Live TODO.                                                                            |
| [../AGENTS.md](../AGENTS.md)                                                       | ✅ Agent / repo orientation.                                                             |
| [../CLAUDE.md](../CLAUDE.md)                                                       | ✅ Claude Code project guide.                                                            |
| [../BUG_AUDIT_2026-05-25.md](../BUG_AUDIT_2026-05-25.md)                           | ✅ Bug audit (2026-05-25).                                                               |
| [../MATH_CORRECTNESS_AUDIT_2026-06-29.md](../MATH_CORRECTNESS_AUDIT_2026-06-29.md) | ✅ Math correctness audit (2026-06-29); harness in `tools/math-correctness-audit/`.      |
| [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md)                                       | 🗄️ Predates the WASM backend — see [performance.md](performance.md) for current numbers. |

## 15. Superpowers (historical design records) 🗄️

Agent-authored execution plans and design specs (2026-06/07). Kept for traceability;
most work is landed or superseded by `docs/roadmap/` and package changelogs.

### Plans (`superpowers/plans/`, 19 files)

| Doc                                                                                                                                                        | Topic                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| [superpowers/plans/2026-07-03-unit-merge.md](superpowers/plans/2026-07-03-unit-merge.md)                                                                   | Unit merge into core           |
| [superpowers/plans/2026-07-07-plotting.md](superpowers/plans/2026-07-07-plotting.md)                                                                       | Plot package                   |
| [superpowers/plans/2026-07-08-plot-tikz-backend.md](superpowers/plans/2026-07-08-plot-tikz-backend.md)                                                     | TikZ backend                   |
| [superpowers/plans/2026-07-08-workbook-tex-export.md](superpowers/plans/2026-07-08-workbook-tex-export.md)                                                 | Workbook TeX export            |
| [superpowers/plans/2026-07-09-export-formats-expansion.md](superpowers/plans/2026-07-09-export-formats-expansion.md)                                       | Export formats expansion       |
| [superpowers/plans/2026-07-10-extract-mathts-gpu-foundation.md](superpowers/plans/2026-07-10-extract-mathts-gpu-foundation.md)                             | GPU foundation extraction      |
| [superpowers/plans/2026-07-10-webgpu-spec1a-extract-gpu.md](superpowers/plans/2026-07-10-webgpu-spec1a-extract-gpu.md)                                     | WebGPU Spec 1a                 |
| [superpowers/plans/2026-07-15-phase0-correctness-fixes.md](superpowers/plans/2026-07-15-phase0-correctness-fixes.md)                                       | Phase 0 correctness            |
| [superpowers/plans/2026-07-15-phase1-foundational-primitives.md](superpowers/plans/2026-07-15-phase1-foundational-primitives.md)                           | Phase 1 primitives             |
| [superpowers/plans/2026-07-15-phase2-optimization-core.md](superpowers/plans/2026-07-15-phase2-optimization-core.md)                                       | Phase 2 optimization           |
| [superpowers/plans/2026-07-16-phase3-regression-ml.md](superpowers/plans/2026-07-16-phase3-regression-ml.md)                                               | Phase 3 regression / ML        |
| [superpowers/plans/2026-07-16-phase4-statistics-inference.md](superpowers/plans/2026-07-16-phase4-statistics-inference.md)                                 | Phase 4 statistics             |
| [superpowers/plans/2026-07-16-phase5-special-functions.md](superpowers/plans/2026-07-16-phase5-special-functions.md)                                       | Phase 5 special functions      |
| [superpowers/plans/2026-07-16-phase6-signal-breadth.md](superpowers/plans/2026-07-16-phase6-signal-breadth.md)                                             | Phase 6 signal                 |
| [superpowers/plans/2026-07-16-phase7-advanced-linalg.md](superpowers/plans/2026-07-16-phase7-advanced-linalg.md)                                           | Phase 7 linalg                 |
| [superpowers/plans/2026-07-16-phase8-graph-geometry-cas-intervals.md](superpowers/plans/2026-07-16-phase8-graph-geometry-cas-intervals.md)                 | Phase 8 graph / geometry / CAS |
| [superpowers/plans/2026-07-20-factorization-layer1-univariate.md](superpowers/plans/2026-07-20-factorization-layer1-univariate.md)                         | Factorization layer 1          |
| [superpowers/plans/2026-07-20-factorization-layer2-multivariate-kronecker.md](superpowers/plans/2026-07-20-factorization-layer2-multivariate-kronecker.md) | Factorization layer 2          |
| [superpowers/plans/2026-07-20-risch-layer1-rational-integration.md](superpowers/plans/2026-07-20-risch-layer1-rational-integration.md)                     | Risch layer 1                  |

### Specs (`superpowers/specs/`, 14 files)

| Doc                                                                                                                                      | Topic                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [superpowers/specs/2026-06-27-workbook-cell-mutation-design.md](superpowers/specs/2026-06-27-workbook-cell-mutation-design.md)           | Workbook cell mutation       |
| [superpowers/specs/2026-06-27-workbook-gui-read-contract-design.md](superpowers/specs/2026-06-27-workbook-gui-read-contract-design.md)   | Workbook GUI read contract   |
| [superpowers/specs/2026-06-27-workbook-headless-v1-design.md](superpowers/specs/2026-06-27-workbook-headless-v1-design.md)               | Workbook headless v1         |
| [superpowers/specs/2026-06-27-workbook-roundtrip-cli-design.md](superpowers/specs/2026-06-27-workbook-roundtrip-cli-design.md)           | Workbook CLI round-trip      |
| [superpowers/specs/2026-06-27-workbook-serve-design.md](superpowers/specs/2026-06-27-workbook-serve-design.md)                           | Workbook serve               |
| [superpowers/specs/2026-06-28-workbook-render-export-design.md](superpowers/specs/2026-06-28-workbook-render-export-design.md)           | Workbook render / export     |
| [superpowers/specs/2026-07-07-plotting-design.md](superpowers/specs/2026-07-07-plotting-design.md)                                       | Plotting design              |
| [superpowers/specs/2026-07-08-latex-output-design.md](superpowers/specs/2026-07-08-latex-output-design.md)                               | LaTeX output                 |
| [superpowers/specs/2026-07-09-export-formats-expansion-design.md](superpowers/specs/2026-07-09-export-formats-expansion-design.md)       | Export formats design        |
| [superpowers/specs/2026-07-10-webgpu-acceleration-design.md](superpowers/specs/2026-07-10-webgpu-acceleration-design.md)                 | WebGPU acceleration (phased) |
| [superpowers/specs/2026-07-10-webgpu-spec1b-flag-matmul.md](superpowers/specs/2026-07-10-webgpu-spec1b-flag-matmul.md)                   | WebGPU Spec 1b flag / matmul |
| [superpowers/specs/2026-07-20-multivariate-factorization-design.md](superpowers/specs/2026-07-20-multivariate-factorization-design.md)   | Multivariate factorization   |
| [superpowers/specs/2026-07-20-risch-integration-design.md](superpowers/specs/2026-07-20-risch-integration-design.md)                     | Risch integration            |
| [superpowers/specs/2026-07-21-risch-layer2-quadratic-surd-design.md](superpowers/specs/2026-07-21-risch-layer2-quadratic-surd-design.md) | Risch layer 2 quadratic surd |

## 16. Archive (historical) 🗄️

Completed/superseded work, moved out of the active tree. See
[archive/README.md](archive/README.md).

| Folder                                                   | Contents                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [archive/plans/](archive/plans/)                         | 12 dated one-off design/plan docs (`2026-03-*`, `2026-04-*`). |
| [archive/superpowers-plans/](archive/superpowers-plans/) | 4 agent execution-note plans (2026-04).                       |
| [archive/refactoring/](archive/refactoring/)             | 6 completed refactoring status/plan/summary reports.          |
| [archive/sprints/](archive/sprints/)                     | 50 sprint TODO JSON files (Phases 1–10, all complete).        |
