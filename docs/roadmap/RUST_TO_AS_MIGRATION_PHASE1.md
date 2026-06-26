# Rust → AS Migration — Phase 1 Perf Spike (GATING) — Result & ABI Decision

**Status:** complete · **Date:** 2026-06-26 · Input: `RUST_TO_AS_MIGRATION_PLAN.md` §"Phase 1"

Bench harness: `tools/benchmark/wasm/rust-vs-as-abi.spike.mts` (re-runnable).
Pointer-ABI AS prototype: `tools/benchmark/wasm/_spike/array_sin_ptr.{ts,wasm}`.

## Measurement

- Machine: Intel i7-8850H @ 2.60GHz, 12 cores, 68.5 GB, node v24.18.0, win32.
- Method: median of 5 reps, full `Float64Array` in → wasm → out each call, each ABI
  paying its **own** real marshalling (Rust/AS-ptr: self-managed JS scratch region,
  zero per-call alloc, mirroring `elementwise/wasm-bridge.ts`; AS-managed:
  `__new`/`__pin` pooled glue mirroring `matrix/.../WASMBackend.ts`).
- The 1,000,000 tier was dropped: AS-managed cells thrash the stub bump-allocator
  (no GC) and hang. The asymptotic per-element ABI ratio is already clear by ~131k.

| op | n | Rust ms | AS-managed ms | AS-ptr ms | AS-mgd/Rust | AS-ptr/Rust | maxdiff |
|---|--:|--:|--:|--:|--:|--:|--:|
| array_sin | 1024 | 0.04055 | 0.03537 | 0.03338 | 0.87 | 0.82 | 0 |
| array_sin | 16384 | 0.59264 | 0.61248 | 0.49155 | 1.03 | 0.83 | 0 |
| array_sin | 131072 | 4.69373 | 6.50876 | 5.46722 | 1.39 | 1.16 | 0 |
| bessel_j0_f64 | 1024 | 0.07909 | 0.08773 | — | 1.11 | — | 0 |
| bessel_j0_f64 | 16384 | 1.21697 | 1.18491 | — | 0.97 | — | 0 |
| bessel_j0_f64 | 131072 | 7.47746 | 10.33532 | — | 1.38 | — | 0 |
| sort_f64 | 1024 | 0.08090 | 0.12190 | — | 1.51 | — | 0 |
| sort_f64 | 16384 | 1.41240 | 3.39525 | — | 2.40 | — | 0 |
| sort_f64 | 131072 | 9.19166 | 272.34328 | — | 29.63 | — | 0 |

All kernels are **bit-identical** across ABIs (maxdiff 0) — correctness is not at risk; this is purely about marshalling/throughput.

## Decision: HYBRID ABI

Per the plan's gate (managed regresses the hot path; pointer-ABI matches Rust):

1. **Hot elementwise + fusion path → POINTER-ABI AS.** Managed-AS `array_sin`
   regresses to **1.39× Rust at 131k** (the per-call managed-array allocation),
   which would erase the 0.2.14 elementwise wins. The pointer-ABI AS prototype
   `array_sin_ptr(inPtr,outPtr,n)` stays at **0.82–1.16× Rust** — i.e. preserves
   the perf — and, mirroring the Rust signature, lets the existing lean
   zero-alloc `elementwise/wasm-bridge.ts` work essentially unchanged.
   → **Phase 2 authors the elementwise kernels in pointer-ABI AS** (`array_<op>_ptr`
   for all 18 ops, since even the 5 existing managed `array_<op>` need a ptr twin).
2. **Special (bessel/airy/elliptic/lgamma/carlson) → MANAGED-AS.** bessel_j0
   managed is **0.97–1.38× Rust** — acceptable: these are low-call-rate, large-n,
   and already "break-even-to-slower" even in Rust (the pairing notes mark them
   js-fallback-is-not-a-regression). Alloc amortizes. The 2 missing general-order
   bessel kernels (`bessel_j_f64`, `bessel_y_f64`) are authored managed.
3. **sort/argsort/rank → DO NOT naively repoint to AS-managed.** ⚠️ AS-managed
   `sort_f64` is **29.6× slower at 131k** (272ms vs 9ms), correct but catastrophic
   (likely the AS sort impl / managed-runtime interaction). Options for Phase 3:
   author a pointer-ABI AS sort, fix the AS sort algorithm, or keep sort on the
   JS/Rust path until resolved. **Flagged as a Phase-3 blocker — measure before wiring.**
4. **signal / poly / interpolation / bitwise → assume managed-AS acceptable but
   VERIFY in Phase 4.** Not benchmarked here; they are low-call-rate/large-n like
   special, but the sort surprise shows "assume managed is fine" is unsafe — each
   bridge's differential + perf gate in Phase 4 must confirm no regression.

## Consequence for downstream phases

- Phase 2 kernel count is unchanged (~15 authoring targets) but the **elementwise
  ones are pointer-ABI** (`array_<op>_ptr`), not managed `array_<op>`.
- Phase 3 bridge rework gains an explicit sort sub-investigation.
- AS is **not hopeless** — migration proceeds. Rust stays primary/intact through Phase 4.

## Confidence / caveats

- High confidence on the elementwise hybrid call (clear, monotone trend; prototype
  validated bit-identical).
- The sort regression is reproducible (median of 5) but its **root cause is not yet
  diagnosed** (AS sort algorithm vs managed-runtime overhead) — treat the 29.6× as a
  measured fact, the cause as TBD for Phase 3.
- 1M tier not measured (allocator hang); ratios extrapolated from the 1k→131k trend.
