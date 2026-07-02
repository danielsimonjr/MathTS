# Scientific-Library Completeness Roadmap — subagent-driven plan

> **For agentic workers:** REQUIRED SUB-SKILL — use `superpowers:subagent-driven-development`
> (fresh subagent per task + two-stage review) to execute each workstream, or
> `superpowers:executing-plans` for inline batch execution. Steps use checkbox
> (`- [ ]`) syntax for tracking. Every task follows `dev-workflow` (TDD-strict,
> atomic commit, CHANGELOG/TODO/docs synced in the same commit) and the RFL gate
> (COMPLETE · ROOTED · NO-DEFER · VERIFIED · HONEST · WORKFLOW) before "done".

**Goal:** Move MathTS from _functionally complete but wide-not-deep_ to a
**trustworthy, discoverable, teachable** math/scientific library for students,
engineers, and scientists — driven by the 2026-07-02 DGT-report analysis.

**Architecture:** Nine workstreams (WS-0 … WS-8). Each is an independent
subsystem that produces working, testable software on its own — so each becomes
its **own** detailed plan when scheduled (this document is the program map, not a
single bite-sized plan). Workstreams are ordered by leverage and dependency; the
per-domain tasks _inside_ a workstream are parallelizable across subagents.

**Tech Stack:** existing — TypeScript ESM, vitest, tsup, AssemblyScript WASM,
Turborepo, changesets. New dependencies (e.g. a property-testing lib) are
**decision gates**, never assumed (dev-workflow Cardinal Rule 6).

## Global Constraints (apply to every task)

- TDD strict: failing test → RED → implement → GREEN → refactor. No code before test.
- No `--no-verify` / `--no-gpg-sign` / hook-skip. Commit footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session`.
- Atomic commits; one logical change each. Root-cause fixes, no symptom masks.
- Every package stays `strict: true`, eslint-zero, `npm run typecheck` 0 errors, `docs:functions:check` green.
- Do not touch `.github/workflows/*` (security guard) — surface CI-edit needs to the maintainer.
- `@danielsimonjr/mathts-workbook` stays changeset-ignored (not released) unless the maintainer says otherwise.
- Tests import built `dist/` — rebuild changed deps (turbo) before downstream vitest.
- **Effort/sequencing estimates below are my judgment, not measured; the report-derived counts (452, 96/17/105, 39/218, 97.5%) are grounded facts.**

---

## Readiness legend

- 🟢 **Ready** — no open design decision; a subagent can start under TDD today.
- 🟡 **Ready after a scoped audit** — a read-only subagent pass produces the work-list first.
- ⚠️ **Decision gate** — needs a user/ADR decision (new dependency, architecture, or public-API shape) before any code. Listed in "Decision gates" at the end.

---

## WS-0 — Benchmark + accuracy harness & regression gate 🟡 (meta / proposal #0)

**Why:** the parallel thresholds were measured _once_ on a "noisy CI container
(2026-05-23)" and never re-run; the WASM audit was a one-off. Without a repeatable
harness, WS-1/WS-2 findings silently rot. This unblocks WS-2's retune.

**Files:** `tools/benchmark/parallel/run.ts` (exists — extend), `tools/benchmarks/`
(exists), new `tools/benchmark/accuracy/` (oracle-error harness), a generated
`docs/Architecture/benchmarks.md` (new report, mirror the pairing-report pattern).

**Atomic commits (sequential):**

- [x] `bench(parallel): stable-hardware harness emitting JSON per op` — deterministic warmup/iteration counts, machine-tagged output; no threshold change yet. **DONE** — `--json[=path]` writes a `buildBenchReport` artifact with per-op `recommendedThreshold` (number or `'never'`); pure transform unit-tested in `tests/benchmark/parallel-report.test.ts`.
- [ ] `bench(accuracy): ULP/relative-error harness vs pinned oracle values` — reuse the `gap-*.test.ts` oracle fixtures as the reference set.
- [ ] `docs(bench): generated benchmarks.md report + docs:bench script` — the perf/accuracy analog of `parallel-pairing.md`.
- [ ] `chore(ci): document the benchmarks:check step for the maintainer` — snippet only; do **not** edit `.github/workflows/` (surface to maintainer).

**Verification gate:** harness runs green locally twice with stable numbers (variance noted); report regenerates idempotently.

**Subagent parallelization:** the parallel-harness and accuracy-harness commits are independent → 2 concurrent subagents; the report commit joins after both.

---

## WS-1 — Trust foundation: oracle + property-based tests 🟡→🟢 (proposals #1, #2)

**Why (highest leverage):** several domains were historically "tested only
self-referentially"; gap-closure added ~18 oracle-pinned files but coverage is
uneven. A scientist adopts what they can verify. Current effective coverage is
97.5% (196/201 active files) by _line_, but that says nothing about _numerical
correctness_.

**Phase 1 (🟡 audit, 1 read-only subagent):**

- [x] Produce `docs/roadmap/ORACLE_COVERAGE_MATRIX.md` — per domain, list which functions have external-oracle pins vs self-referential-only tests. **DONE** — 395 fns classified: **318 ORACLE / 75 SELF-REF / 2 UNTESTED**. Findings: special+distributions strongest (SciPy/DLMF-pinned); arithmetic/trig/typed-stats have zero external pins (closed-form or `Math.*`-tautological); the 7 core `hypothesis.ts` tests and 10 linalg decompositions are self-referential (reconstruction, not pinned factors); `gammaQuantile`/`betaQuantile` UNTESTED. P2 priority: `qr`, `lu`, `gammaQuantile`, `betaQuantile`, `matrixSchur`, the hypothesis block.

**Phase 2 (🟢 per-domain, parallel subagents — one per domain):** each is an atomic commit:

- [ ] `test(special): oracle-pin <fns> vs mpmath/SciPy reference values`
- [ ] `test(linalg): reference-pin decompositions (A≈QR, LUP·A, chol·cholᵀ) vs numpy`
- [~] `test(distributions): pin CDF/quantile vs scipy.stats` — **started**: the two UNTESTED quantiles (`gammaQuantile`, `betaQuantile`) are now oracle-pinned (`functions/tests/gap-quantile-oracle.test.ts`, chi-square-table + closed-form; 7/7 GREEN, both already correct). Remaining: factory `.cdf`/`.quantile` self-ref promotions, `poissonDist.cdf`.
- [ ] `test(stats|signal|cas): oracle pins per remaining domain`
      Each: RED (assert against pinned constants) → the value is either correct (GREEN, no src change) or a **real bug** surfaced (fix at root in the same effort, RFL Rule 2).

**Phase 3 — property-based invariants:** ⚠️ **Decision gate G1** (adds `fast-check` dev-dep). If approved, per-domain atomic commits:

- [ ] `test(props): d/dx ∫f ≈ f; inverse-fn round-trips; CDF monotone in [0,1]; fft∘ifft ≈ id` (fast-check generators, seeded).

**Phase 4 — precision docs (#2), 🟢:**

- [ ] `docs(reference): add an "Accuracy" note per numerically-sensitive fn` (digits/ULP vs oracle, from WS-0 accuracy harness).
- [ ] `docs(backends): make the WebGPU 32-bit-precision caveat prominent` — GPU path is `f32`; flag it as a correctness caveat and keep GPU opt-in for precision-sensitive ops.

**Verification gate:** full affected suites GREEN; any surfaced bug fixed at root with its own regression test; `docs:functions:check` green.

---

## WS-2 — Acceleration honesty 🟢 (needs WS-0 for the retune) (proposals #3, #4)

**Why:** `parallel-pairing.md` = 17 threshold-disabled ops + the surfaced
`DEFAULT_THRESHOLD_BY_OP` inconsistency (`sqrt/square/norm/dot/min/max` default-active
vs `abs/negate/sum/mean` explicit `'never'`); `wasm-pairing.md` = poly-fit/Airy/argsort+rank
AS kernels "broken or unstable".

**Tasks / atomic commits:**

- [~] `perf(parallel): set every OpName threshold explicitly (no implicit global fallback)` — **started**: added `sqrt`/`square`/`norm`/`dot`(+`min`/`max`) bench cases, measured them (all `recommendedThreshold=never`), and set the 4 that are `OpName`s to explicit `'never'` — resolves the sqrt-vs-abs inconsistency. Remaining: `min`/`max` need adding to `OpName`; `distance`/`minMax`/`prod`/`std`/`histogram` still default to global (want bench cases); a **target-hardware** run (values here are from a dev box).
- [ ] `refactor(parallel): delete worker paths that provably never win` — remove dead `'never'` dispatch branches whose benchmark shows no crossover at any feasible size; keep only genuinely-tunable ones. (Mirrors the WASM-branch cleanup already done in matrix.)
- [ ] `fix(wasm): stabilize the poly-fit AS kernel + deterministic test` **or** `chore(wasm): retire the poly-fit kernel, document the JS path` — one atomic commit per kernel (poly-fit, Airy, argsort/rank). ⚠️ **Decision gate G2**: fix vs retire per kernel.
- [ ] `docs: regenerate wasm-pairing + reconcile ARCHITECTURE §6a` after each kernel decision.

**Verification gate:** matrix/functions suites GREEN; `npm run build:wasm` clean; regenerated reports committed in the same change.

**Subagent parallelization:** the three kernel decisions are independent files → up to 3 concurrent subagents (worktree isolation, since they touch `assembly/src/`).

---

## WS-3 — API surface hygiene: triage the 452 unused exports 🟡 (proposal #5)

**Why:** `unused-analysis.md` = 452 potentially-unused exports (0 unused files). A
"complete library" needs a curated, discoverable surface, not 452 dangling exports.

**Phase 1 (🟡 audit, 1 read-only subagent):**

- [x] `docs/roadmap/EXPORT_TRIAGE.md` — classify the 452 into PROMOTE / INTERNALIZE / DELETE. **DONE** — ~24 PROMOTE / ~122 KEEP / ~277 INTERNALIZE / ~30 DELETE?. **Key correction: the "452 unused" figure is largely a DGT false positive** — the tool doesn't count `export … from` re-exports as imports, so most flagged exports are live public API (KEEP) or barrel-unreachable internals (INTERNALIZE), not dead. Only ~30 are deletion candidates, and a spot-check already found one false positive (`complexFromPolar` is live) → Phase 2b must re-verify each DELETE item in its own commit. Top PROMOTE: matrix `config.ts` (17 backend-config setters, tested but not barrel-exported), workbook `importWorkbook`/RPC types, expression `EvaluateOptions`.

**Phase 2 (🟢 per-bucket, parallel by package):** atomic commits:

- [ ] `docs(reference): document the PROMOTE exports in the curated domain tables` (per the standing "curated-tables not just generated-index" rule).
- [ ] `refactor(<pkg>): mark INTERNALIZE exports @internal / move to internal subpath`
- [ ] `refactor(<pkg>): delete the DELETE exports + any now-dead code` — one commit per package; verify no downstream import breaks (rebuild + full suite).

**Verification gate:** `npm run typecheck` 0, full suite GREEN, `unused-analysis.md` count drops (regenerate + assert), `docs:functions:check` green.

---

## WS-4 — Domain completeness: statistics & hypothesis testing depth 🟡 (proposal #6)

**Why:** historically the thinnest domains (~55%); gap-closure added many but
parity vs `scipy.stats` is unverified for ANOVA family, mixed/repeated-measures,
bootstrap/permutation tests, effect sizes, and multiple-comparison corrections.

**Phase 1 (🟡 audit, 1 read-only subagent):**

- [ ] `docs/roadmap/STATS_PARITY_GAP.md` — MathTS stats/hypothesis surface vs `scipy.stats`/`statsmodels`; ranked missing-function list with oracle references.

**Phase 2 (🟢 per-function, parallel subagents):** each new function = one atomic commit, TDD with a scipy-pinned oracle test (`functions/tests/gap-*.test.ts` convention):

- [ ] `feat(statistics): <fn> vs scipy` × N (bootstrap CI, permutation test, Cohen's d / Hedges g, Holm/BH correction, repeated-measures ANOVA, …).

**Verification gate:** each function oracle-pinned + degenerate-input hardened (throw, not NaN — matching the 2026-06-30 hardening standard); `functions` suite GREEN; documented in curated tables + CHANGELOG.

---

## WS-5 — Unit-aware operator dispatch ⚠️ (proposal #7)

**Why:** gap analysis flags "no `Unit` in operators" — engineers compute with
physical quantities. `add(5 m, 3 ft)`, unit-carrying matrices/integrals, dimension
checks that reject `m + s`.

**Status: DECISION GATE G3 — design required before any code.** Open questions
for the maintainer: (a) dispatch strategy — extend `mathTyped` signatures to
`Unit` across arithmetic/relational, vs a Unit-wrapping layer? (b) how far —
scalars only, or `Unit`-typed `DenseMatrix`/`Float64Array`? (c) auto-conversion
policy on mixed compatible units. Deliverable of the gate: a spec in
`docs/roadmap/UNIT_DISPATCH_SPEC.md`, then this workstream gets its own bite-sized
plan. **Do not fabricate tasks before the spec exists.**

---

## WS-6 — Interactive reach: notebook + plotting ⚠️ (proposals #8, #9)

**Why:** the Workbook is headless ("a GUI is a separate future project"); there is
no plotting. These are the biggest _student-adoption_ levers.

**Status: DECISION GATES G4 (notebook) + G5 (plotting).** These are large,
architecture-level, and likely a separate repo/app (per CLAUDE.md the GUI is a
distinct future project). Open questions: web app vs VS Code extension vs Jupyter
kernel; plotting via a thin adapter (which lib?) vs bespoke SVG; render inside the
notebook. Deliverable of the gate: `docs/roadmap/NOTEBOOK_SPEC.md` +
`PLOTTING_SPEC.md`. **No tasks until specs exist.** Lower priority than WS-1…WS-4
unless student-facing adoption is the immediate objective.

---

## WS-7 — Pedagogy docs: recipes & course-aligned tutorials 🟢 (proposal #10)

**Why:** `functions.md` is a superb _reference_ but not a _teacher_; the promise
targets students. Task-oriented, runnable guides close that gap and reuse the
`docs:functions` infra.

**Tasks / atomic commits (parallel by topic):**

- [ ] `docs(guide): Linear Algebra with MathTS` (runnable, matrix ops → decompositions).
- [ ] `docs(guide): Statistics Cookbook` (aligns with WS-4 outputs).
- [ ] `docs(guide): Signal Processing` / `Numerical Methods` / `Calculus & AD`.
      Each: runnable examples verified against the built API; linked from `docs/README.md`.

**Verification gate:** every code block in a guide executes against the current build (a `docs:guides:check` smoke runner is a nice-to-have first commit).

---

## WS-8 — Keep the DGT reports load-bearing 🟢 (cross-cutting)

- [ ] `chore(ci): document a docs:deps + docs:functions:check + benchmarks:check gate for the maintainer` (workflow edit is maintainer-only). Ensures the claim-vs-reality gap WS-1/2/3 close cannot silently reopen.

---

## Recommended first sprint (subagent-driven)

Start where leverage is highest and no gate blocks:

1. **WS-1 Phase 1** (oracle-coverage audit) — 1 read-only subagent → work-list.
2. **WS-3 Phase 1** (export triage) — 1 read-only subagent → work-list.
3. **WS-0** parallel-benchmark harness — 1 subagent (unblocks WS-2).
4. Then fan out **WS-1 Phase 2** per-domain oracle pins (N parallel subagents), reviewing between tasks.

Decision gates **G1** (fast-check), **G2** (wasm fix-vs-retire), **G3** (unit
dispatch), **G4/G5** (notebook/plotting) should be answered before their
workstreams schedule.

## Decision gates needing your input

| Gate   | Blocks       | Question                                                                                   |
| ------ | ------------ | ------------------------------------------------------------------------------------------ |
| **G1** | WS-1 Phase 3 | Add `fast-check` as a dev-dependency for property-based tests?                             |
| **G2** | WS-2         | Per kernel (poly-fit / Airy / argsort-rank): **fix** the AS kernel or **retire** it to JS? |
| **G3** | WS-5         | Unit-dispatch design — scope & strategy (needs a spec doc first).                          |
| **G4** | WS-6         | Notebook host — web app / VS Code / Jupyter kernel? (separate app likely.)                 |
| **G5** | WS-6         | Plotting — adapter to an existing lib (which?) vs bespoke SVG?                             |

## Self-review (writing-plans checklist)

- **Spec coverage:** all 10 proposals map to a workstream (1→WS-1, 2→WS-1/WS-2 GPU note, 3→WS-2, 4→WS-2, 5→WS-3, 6→WS-4, 7→WS-5, 8+9→WS-6, 10→WS-7, meta→WS-0/WS-8). ✓
- **No fabricated code:** gated/undesigned workstreams (WS-5/6) carry _no_ invented signatures — they carry design gates instead (honest-claude). ✓
- **Atomic-commit boundaries:** each bullet under a workstream is one commit with its own verification gate. ✓
- **Dependencies stated:** WS-2 retune depends on WS-0; WS-4/WS-7 stats coupling noted; new deps are gates. ✓
