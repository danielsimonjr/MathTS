# Rust → AssemblyScript Migration — Agent-Driven Plan

**Status:** planned · **Date:** 2026-06-25 · **Input:** [RUST_TO_AS_MIGRATION_EVAL.md](./RUST_TO_AS_MIGRATION_EVAL.md)

## Locked decisions

1. **Delete Rust outright** once AS reaches parity. Dispatch simplifies from
   Rust→AS→JS to **AS→JS**. `wasm-rust/`, `build:wasm:rust`, and the cargo CI step
   are removed.
2. **One shared AS package** — `@danielsimonjr/mathts-wasm` becomes the single
   AssemblyScript binary that **both** `functions` and `matrix` depend on. No
   bundled-copy drift.

## Guiding rules (apply to every task)

- **rules-for-life:** complete all parts; fix every issue found; never defer;
  never assume — measure; honest-claude + dev-workflow are the way.
- **Benchmark-gated:** no bridge is repointed to AS until AS parity for its
  kernels is proven correct (<1e-9 vs mpmath / <1e-12 vs JS) **and** within the
  Phase-1 perf delta. Never wire a path that loses.
- **Strict file ownership** per agent (proven in the reply-paper + condense
  passes): each parallel agent owns disjoint files; a coordinator reassembles.
- **Atomic, reversible:** each phase is its own commit series; Rust stays intact
  and primary until Phase 5, so every intermediate state ships.

---

## Phase 0 — Surface lock (DONE)

The consumed surface and AS parity are established in the eval: **~54 consumed
kernels**, AS covers ~36, authoring gap **17** (13 elementwise + 2 general-order
bessel + 2 poly renames). One automated guard to add:

- **Task 0.1** — add a `--check-wasm-parity` mode to the dep-graph tool that
  diffs the consumed-kernel set against the AS binary's export table and fails if
  the gap changes. Makes the eval's table a regenerated artifact, not a snapshot.

---

## Phase 1 — Perf spike (GATING — do not skip)

Single most important phase: it decides the ABI and whether the whole migration
preserves the 0.2.14 wins.

- **Task 1.1 (1 agent)** — Using matrix's existing AS glue (`matrix/src/backends/
  WASMBackend.ts`, `RustWasmLoader.ts`, `@assemblyscript/loader`), benchmark
  **AS vs Rust, including realistic marshalling**, on three representatives:
  `array_sin` (hot elementwise), `bessel_j0_f64` (managed special), `sort_f64`.
  Compare against the committed Rust numbers (`bench:elementwise`,
  `bench:special-array`).
- **Task 1.2** — Prototype a **pointer-ABI AS kernel** (`array_sin(inPtr, outPtr,
  n)` via `usize` + `load`/`store`) and benchmark it against both managed-AS and
  Rust, to quantify the managed-array per-call allocation cost.

**Gate / output — the ABI decision:**
- If managed-AS is within ~10% of Rust on the hot path → **managed-array ABI
  everywhere** (simplest; matches existing AS exports).
- If managed-AS regresses the elementwise/fusion wins → **hybrid**: pointer-ABI
  AS kernels for the hot elementwise + fusion path, managed-array for
  special/sort/signal/poly/interp (low call-rate, large n, alloc amortizes).
- If AS is hopeless on the hot path (unlikely — the Rust "simd" kernels are
  already scalar loops) → **STOP and report**; revisit the "delete Rust" decision.

---

## Phase 2 — Shared AS package + author the 17 missing kernels

Runs after Phase 1 fixes the ABI. Parallel, strict file ownership.

- **Task 2.0 (coordinator)** — Scaffold `@danielsimonjr/mathts-wasm`: move
  `assembly/` into the publishable package, set up `asbuild`, emit `mathts-as.wasm`
  + manifest + a typed loader entry. This becomes the single source both packages
  consume.
- **Task 2.1 (elementwise agent)** — author the 13 missing AS kernels in the
  ABI chosen in Phase 1: `tan, atan, sinh, tanh, atanh, expm1, log1p, log2,
  log10, sec, csc, cot, erfc`. Template: existing `array_sin`. For `erfc`, port
  the validated `erfcScalar` continued-fraction (don't use a cheap rational).
- **Task 2.2 (special agent)** — author general-order `bessel_j_f64` /
  `bessel_y_f64` in AS (AS today has only integer-order `jn`/`yn`). Reuse the
  session's validated recurrence/Hankel logic already in the AS special source.
- **Task 2.3 (poly agent)** — reconcile the 2 renames: expose `poly_resultant_f64`
  / `poly_discriminant_f64` from AS (alias the existing `resultant`/`discriminant`).
- **Task 2.4 (verifier)** — extend the golden harness: every new AS kernel
  validated <1e-9 vs mpmath and <1e-12 vs the JS scalar. No kernel ships unverified.

---

## Phase 3 — Repoint `functions` bridges to AS (parallel per bridge)

Six independent bridges, one agent each, disjoint files. Each: rewrite the wasm
call to the AS ABI from Phase 1, drop the dead `*_f64_as` probe scheme, keep the
JS fallback, run that bridge's differential test.

- **3.1 special/** — mostly wiring: load the AS module, call the plain
  `bessel_j0_f64` etc. (no `_as` suffix). The 21 currently-js-fallback specials
  start actually running wasm (AS has `__new`). Gate: `diff-special` 187 pass.
- **3.2 elementwise/** — the hot path; uses the Phase-1 ABI. Preserve
  `fuseUnaryChain` single-copy semantics (needs pointer-ABI if Phase 1 chose
  hybrid). Gate: `diff-elementwise` 36 + `diff-fusion` 6 + `bench:elementwise`
  within delta.
- **3.3 sort/**, **3.4 signal/**, **3.5 poly/**, **3.6 interpolation/** — repoint
  to AS names (all present after Phase 2). Gate: each bridge's tests.
- **Task 3.7 (coordinator)** — switch the loader/resolve to the shared AS package;
  `functions` depends on `@danielsimonjr/mathts-wasm`. Remove the AS-only
  `allocateFloat64Array`/`__new` special-casing now that the bundled binary *is*
  AS (the loader and kernels finally agree).

---

## Phase 4 — Re-gate (full verification)

- **Task 4.1** — full `functions` vitest (target: 2882 pass, 0 regression) +
  `test:diff` (special/elementwise/fusion) against the AS binary.
- **Task 4.2** — regenerate the pairing: `bundledBackend` flips to
  `assemblyscript`; the runtime probe should now report the specials as
  effective-wasm (AS has `__new`). Confirm effective-wasm count rises as predicted.
- **Task 4.3 (reviewer panel)** — citations/perf/numerical/coherence panel over
  the diff (the proven 4-dimension converge-in-2-rounds pattern). Adversarially
  verify: any kernel whose AS result diverges from Rust beyond tolerance is a
  blocker.
- **Task 4.4** — perf comparison report: AS-now vs Rust-before across the consumed
  hot kernels. Any regression beyond the Phase-1 delta is a blocker, not a footnote.

---

## Phase 5 — Delete Rust + simplify

Only after Phase 4 is green.

- **5.1** — delete `wasm-rust/`; remove `build:wasm:rust` / `build:wasm:all`
  cargo wiring from `package.json` and CI.
- **5.2** — simplify dispatch to **AS→JS** everywhere; remove the Rust-pointer
  code paths and the dead `*_f64_as` probe scheme.
- **5.3** — update the dep-graph pairing tool: the runtime probe's "Rust-only,
  no allocator → js-fallback" branch is now obsolete; `bundledBackend` is
  `assemblyscript`. Drop the Rust-specific framing; keep effective-backend.
- **5.4** — docs sweep: `WASM_ACCELERATION.md`, `ARCHITECTURE.md`/`backends.md`,
  README — remove Rust as a backend, describe the TS→AS→WebGPU stack. CHANGELOG
  entries for the shared package + each consuming package's bump.

---

## Risk register & rollback

| Risk | Gate that catches it | Rollback |
|---|---|---|
| AS managed-ABI regresses elementwise wins | Phase 1 spike (before any wiring) | Pointer-ABI AS kernels (hybrid) |
| AS numerically diverges on some kernel | Phase 2 golden + Phase 4 panel | That bridge stays on JS until fixed; Rust still present pre-Phase-5 |
| Hidden Rust-only consumer | Phase 0 parity check (automated) | — |
| Perf loss on a hot kernel | Phase 4.4 report | Keep that one kernel's JS path; revisit |

Rust remains primary and intact through Phases 1–4, so **every intermediate
commit ships a working package**. Phase 5 is the only irreversible step and runs
only behind a fully-green Phase 4.

---

## Agent roster & parallelization

| Phase | Parallel agents | Barrier |
|---|--:|---|
| 1 spike | 1 (+1 for pointer-ABI proto) | ABI decision before Phase 2 |
| 2 author | 4 (elementwise / special / poly / verifier) | all kernels verified before Phase 3 |
| 3 bridges | 6 (one per bridge) + coordinator | all bridges green before Phase 4 |
| 4 re-gate | reviewer panel (4 dimensions) | green before Phase 5 |
| 5 delete | 1 + docs | — |

Critical path: **Phase 1 → 2 → 3 → 4 → 5** (sequential barriers); within 2 and 3,
agents run concurrently. Estimated **1.5–2.5 weeks** wall-clock solo, less with
the fan-out.

## Success criteria

- `functions` runs entirely on AS (or AS→JS); `wasm-rust/` deleted; cargo gone
  from CI.
- One shared `@danielsimonjr/mathts-wasm` consumed by `functions` + `matrix`.
- All differential gates pass at the same tolerances; pairing shows
  `bundledBackend: assemblyscript` with effective-wasm ≥ today's 18.
- No hot-kernel perf regression beyond the Phase-1-agreed delta (documented).
