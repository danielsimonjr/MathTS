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
| [Architecture/FILE_INVENTORY.md](Architecture/FILE_INVENTORY.md)       | Complete file census — every tracked repo `.ts` (src/tests/tools/config/examples/docs) tagged reachable/build-entry/test-only/orphan/test/tool/config/example (data: `file-inventory.json`; maximal-walk self-check in `docs:deps` + `npm run check:file-census`). |

### Reference (API symbols)

| Doc                                              | What it covers                                                |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [reference/index.md](reference/index.md)         | Reference landing page.                                       |
| [reference/functions.md](reference/functions.md) | Function reference (HTML mirror: `reference/functions.html`). |
| [reference/classes.md](reference/classes.md)     | Class reference.                                              |
| [reference/constants.md](reference/constants.md) | Constants reference.                                          |

## 3. API (per package) ✅

| Doc                                  | Package                            |
| ------------------------------------ | ---------------------------------- |
| [api/README.md](api/README.md)       | API docs landing.                  |
| [api/core.md](api/core.md)           | `@danielsimonjr/mathts-core`.      |
| [api/matrix.md](api/matrix.md)       | `@danielsimonjr/mathts-matrix`.    |
| [api/functions.md](api/functions.md) | `@danielsimonjr/mathts-functions`. |
| [api/parallel.md](api/parallel.md)   | `@danielsimonjr/mathts-parallel`.  |
| [api/compat.md](api/compat.md)       | `@danielsimonjr/mathts-compat`.    |

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

| Doc                                                                                                      | What it covers                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md](roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md) | Monorepo bridge/function gap analysis.           |
| [roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md](roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md)                       | WASM-candidate gap analysis.                     |
| [roadmap/REMAINING_ACCELERATION_CANDIDATES.md](roadmap/REMAINING_ACCELERATION_CANDIDATES.md)             | Remaining acceleration triage + plan.            |
| [roadmap/ACCELERATION_BENCHMARKS.md](roadmap/ACCELERATION_BENCHMARKS.md)                                 | Acceleration benchmark records.                  |
| [roadmap/UNIFIED_WEBGPU_PATH.md](roadmap/UNIFIED_WEBGPU_PATH.md)                                         | Unified WebGPU path proposal (decision pending). |
| [roadmap/TYPED_FUNCTION_IMPROVEMENTS.md](roadmap/TYPED_FUNCTION_IMPROVEMENTS.md)                         | Typed-function improvement backlog.              |
| [roadmap/WORKERPOOL_IMPROVEMENTS.md](roadmap/WORKERPOOL_IMPROVEMENTS.md)                                 | WorkerPool improvement backlog.                  |

### Completed / superseded (kept in place — still cross-linked) 🗄️

| Doc                                                                                | Status                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [roadmap/FUNCTION_GAPS.md](roadmap/FUNCTION_GAPS.md)                               | Slices promoted; referenced by TODO/CHANGELOG.               |
| [roadmap/FUNCTION_GAPS_AUDIT.md](roadmap/FUNCTION_GAPS_AUDIT.md)                   | Audit roadmap closed (Waves 1–6); still tracks B.1 playbook. |
| [roadmap/GAP_CLOSURE_PROPOSAL.md](roadmap/GAP_CLOSURE_PROPOSAL.md)                 | Tier-1 landed; still tracks deferred slices.                 |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md)     | Wave 4 landed.                                               |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md)     | Wave 5 landed.                                               |
| [roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md](roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md)     | Wave 6 complete (all 5 slices).                              |
| [roadmap/ITENSOR_PARITY.md](roadmap/ITENSOR_PARITY.md)                             | ITensor parity — six phases, all green.                      |
| [roadmap/EXPANSION_PLAN.md](roadmap/EXPANSION_PLAN.md)                             | v3 — executed (all workstreams complete).                    |
| [roadmap/MATHJS_SYNC_ROADMAP.md](roadmap/MATHJS_SYNC_ROADMAP.md)                   | Superseded by GAP_ANALYSIS_BRIDGES.                          |
| [roadmap/WASM_OPTIMIZATION_EVALUATION.md](roadmap/WASM_OPTIMIZATION_EVALUATION.md) | Implementation complete (2026-04-10).                        |
| [roadmap/WASM_PAIRING_GAP_PLAN.md](roadmap/WASM_PAIRING_GAP_PLAN.md)               | Executed 2026-06-25.                                         |

## 12. Planning ✅/🗄️

| Doc                                                                                                              | Status                                               |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Planning/MASTER_ROADMAP.md](Planning/MASTER_ROADMAP.md)                                                         | ✅ Master index of plans (updated 2026-04-10).       |
| [Planning/PRIORITY_STATUS.md](Planning/PRIORITY_STATUS.md)                                                       | ✅ Sprint completion status (166/166).               |
| [Planning/MATHTS_SPRINT_TRACKER.md](Planning/MATHTS_SPRINT_TRACKER.md)                                           | ✅ Sprint tracker.                                   |
| [Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md](Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md)             | ✅ Implementation-pattern guide.                     |
| [Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md](Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md) | ✅ Guide, part 2.                                    |
| [Planning/CONSOLIDATED_CORRECTIVE_ACTION_PLAN.md](Planning/CONSOLIDATED_CORRECTIVE_ACTION_PLAN.md)               | ✅ Canonical corrective-action plan (v2).            |
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

| Doc                                                      | Status                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [../CHANGELOG.md](../CHANGELOG.md)                       | ✅ Release history.                                                                      |
| [../TODO.md](../TODO.md)                                 | ✅ Live TODO.                                                                            |
| [../AGENTS.md](../AGENTS.md)                             | ✅ Agent / repo orientation.                                                             |
| [../CLAUDE.md](../CLAUDE.md)                             | ✅ Claude Code project guide.                                                            |
| [../BUG_AUDIT_2026-05-25.md](../BUG_AUDIT_2026-05-25.md) | ✅ Bug audit (2026-05-25).                                                               |
| [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md)             | 🗄️ Predates the WASM backend — see [performance.md](performance.md) for current numbers. |

## 15. Archive (historical) 🗄️

Completed/superseded work, moved out of the active tree. See
[archive/README.md](archive/README.md).

| Folder                                                   | Contents                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [archive/plans/](archive/plans/)                         | 14 dated one-off design/plan docs (`2026-03-*`, `2026-04-*`). |
| [archive/superpowers-plans/](archive/superpowers-plans/) | 5 agent execution-note plans (2026-04).                       |
| [archive/refactoring/](archive/refactoring/)             | 6 completed refactoring status/plan/summary reports.          |
| [archive/sprints/](archive/sprints/)                     | 50 sprint TODO JSON files (Phases 1–10, all complete).        |
