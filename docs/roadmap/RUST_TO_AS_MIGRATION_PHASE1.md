# Rust → AssemblyScript Migration — Phase 1 Perf Spike (GATING) Result

**Status:** complete · **Date:** 2026-06-26 · **Decision: HYBRID ABI** —
pointer-ABI AS for the hot elementwise + fusion path; managed-array AS for
special / sort (pending a kernel fix) / signal / poly / interpolation / bitwise.
· **Inputs:** [PLAN](./RUST_TO_AS_MIGRATION_PLAN.md) "Phase 1",
[EVAL](./RUST_TO_AS_MIGRATION_EVAL.md) §4.

This is the GATING measurement: it decides the ABI and confirms the migration can
preserve the 0.2.14 acceleration wins. **No production code was changed** — this
is measurement + a throwaway pointer-ABI AS prototype only.

## TL;DR

- **The hot elementwise path does NOT regress on AssemblyScript.** Across three
  runs, pooled managed-AS `array_sin` is at parity-to-faster than the committed
  Rust `simd_sin_array` (AS-mgd/Rust 0.68–1.18×, full JS round-trip included), and
  the pointer-ABI AS prototype is consistently the fastest variant (AS-ptr/Rust
  0.51–1.06×). AS is **not** in the STOP branch.
- **The managed per-call allocation does not hurt the hot path *when the bridge
  pools buffers*** (the existing `WASMBackend.AsAllocCache` pattern). The eval's
  high-severity risk ("`__newArray` per call erases the wins") only bites a naive
  allocate-per-call bridge — which would also OOM under the AS `--runtime stub`
  bump allocator (no GC/free). Pooling is mandatory.
- **Decision: HYBRID** — not because managed regresses (it does not), but because
  the existing `elementwise/wasm-bridge.ts` is already a lean, zero-per-call-alloc,
  pointer-based path, and the pointer-ABI AS kernel (`array_sin_ptr(inPtr,outPtr,
  n)`) is both the **fastest** variant and a **zero-rewrite drop-in** for it. There
  is no reason to convert the hottest path to the (slightly slower at mid-n,
  more-marshalling) managed ABI. Managed is fine — at parity — for everything else,
  and matches the existing AS export shapes.
- **Two non-ABI flags:** AS `sort_f64` is ~2× slower than Rust on random input and
  **O(n²) on duplicate-heavy input** (≈28–30× at n≈131k — a kernel-quality gap,
  fixable with introsort/better pivot); and result-allocating AS kernels
  (`bessel_j0_f64` returns a new array) leak under `--runtime stub`.

## Machine / toolchain

| | |
|---|---|
| CPU | Intel(R) Core(TM) i7-8850H @ 2.60GHz, 12 logical cores |
| RAM | 68.5 GB |
| OS | Windows 11 (win32) |
| Node | v24.18.0 |
| asc (AssemblyScript) | 0.27.37 |
| Rust binary | `functions/dist/wasm/mathts.wasm` (893 KB, pointer ABI, no `__new`) |
| AS binary | `matrix/dist/wasm/mathts-as.wasm` (61 KB, managed ABI, `__new`/`__pin`, `--runtime stub`) |
| AS-ptr prototype | `tools/benchmark/wasm/_spike/array_sin_ptr.wasm` (2.3 KB) |

> **Caveat — noisy host.** This is a developer laptop with many background
> processes (MCP servers; an earlier spike run also left two ~1.6 GB runaway bench
> processes that had to be killed). Mid-size ratios vary run-to-run by ~±20%
> (compare runs 1 and 2). The *direction* of every conclusion is stable across
> runs; the exact ratios are not. Re-run on the CI/deployment host before quoting
> hard numbers.

## Method (realistic marshalling on both sides)

Each cell pays its own real round-trip: JS `Float64Array` in → wasm → fresh JS
`Float64Array` out, every call.

- **Rust / AS-ptr (pointer ABI):** self-managed JS-side scratch region, exactly
  like `functions/src/wasm/elementwise/wasm-bridge.ts` — write to wasm memory at a
  fixed offset, call `fn(inPtr,outPtr,n)`, copy out. Zero per-call allocation.
- **AS-managed:** `__new`/`__pin` Float64Array-header glue, **pooled** (acquire the
  in/out header once, reuse every call), mirroring
  `matrix/src/backends/WASMBackend.ts` `AsAllocCache`. The plan-mandated production
  reference glue. `sort_f64`/`bessel_j0_f64` return a managed array; the returned
  header is read back and copied out.
- Median of 7 timed reps (each averaging `iters` calls, ~2e7 elements of work per
  loop, clamped). Correctness: AS results diffed against Rust (`maxdiff`).
- Input: seeded uniform-random in (0,1). Random is the *fair* sort benchmark; the
  existing benches' structured sawtooth (`0.5+(i%997)*1e-3`) is what exposes the AS
  quicksort O(n²) pathology (see sort caveat).

Re-run with: `npx tsx tools/benchmark/wasm/rust-vs-as-abi.spike.mts`

## Results

### Run 1 (median of 7 reps, ms/op — lower is better)

| op | n | Rust ms | AS-managed ms | AS-ptr ms | AS-mgd/Rust | AS-ptr/Rust | maxdiff |
|---|---:|---:|---:|---:|---:|---:|---:|
| array_sin | 1024 | 0.03205 | 0.02754 | 0.02544 | 0.86 | 0.79 | 0.0e+0 |
| array_sin | 10000 | 0.27821 | 0.30951 | 0.19265 | 1.11 | 0.69 | 0.0e+0 |
| array_sin | 100000 | 2.74275 | 3.22700 | 2.91905 | 1.18 | 1.06 | 0.0e+0 |
| array_sin | 1000000 | 29.15319 | 27.38929 | 24.14802 | 0.94 | 0.83 | 0.0e+0 |
| bessel_j0_f64 | 1024 | 0.05515 | 0.05584 | — | 1.01 | — | 0.0e+0 |
| bessel_j0_f64 | 10000 | 0.51101 | 0.85683 | — | 1.68 | — | 0.0e+0 |
| bessel_j0_f64 | 100000 | 7.88814 | 6.47440 | — | 0.82 | — | 0.0e+0 |
| bessel_j0_f64 | 1000000 | 70.94149 | 79.33795 | — | 1.12 | — | 0.0e+0 |
| sort_f64 | 1024 | 0.04617 | 0.12865 | — | 2.79 | — | 0.0e+0 |
| sort_f64 | 10000 | 1.00394 | 2.18834 | — | 2.18 | — | 0.0e+0 |
| sort_f64 | 100000 | 11.71319 | 25.52289 | — | 2.18 | — | 0.0e+0 |
| sort_f64 | 1000000 | 139.18920 | 303.02715 | — | 2.18 | — | 0.0e+0 |

### Run 2 (same harness, re-run — quantifies run-to-run variance)

| op | n | Rust ms | AS-managed ms | AS-ptr ms | AS-mgd/Rust | AS-ptr/Rust | maxdiff |
|---|---:|---:|---:|---:|---:|---:|---:|
| array_sin | 1024 | 0.04757 | 0.03941 | 0.03706 | 0.83 | 0.78 | 0.0e+0 |
| array_sin | 10000 | 0.44787 | 0.31010 | 0.35867 | 0.69 | 0.80 | 0.0e+0 |
| array_sin | 100000 | 2.92950 | 1.98322 | 1.85380 | 0.68 | 0.63 | 0.0e+0 |
| array_sin | 1000000 | 39.57396 | 30.85609 | 20.16482 | 0.78 | 0.51 | 0.0e+0 |
| bessel_j0_f64 | 1024 | 0.04914 | 0.07449 | — | 1.52 | — | 0.0e+0 |
| bessel_j0_f64 | 10000 | 0.86559 | 1.01590 | — | 1.17 | — | 0.0e+0 |
| bessel_j0_f64 | 100000 | 10.19023 | 8.43659 | — | 0.83 | — | 0.0e+0 |
| bessel_j0_f64 | 1000000 | 74.91366 | 65.69721 | — | 0.88 | — | 0.0e+0 |
| sort_f64 | 1024 | 0.06522 | 0.18108 | — | 2.78 | — | 0.0e+0 |
| sort_f64 | 10000 | 1.11126 | 1.44671 | — | 1.30 | — | 0.0e+0 |
| sort_f64 | 100000 | 7.37678 | 17.95917 | — | 2.43 | — | 0.0e+0 |
| sort_f64 | 1000000 | 87.68256 | 217.29392 | — | 2.48 | — | 0.0e+0 |

(A third independent run by a parallel pass — same harness, random input, 1M
tier — agreed: array_sin AS-mgd/Rust 0.72–1.04×, AS-ptr/Rust 0.55–0.91×; bessel
≈0.99× parity; sort 1.87–2.11×. Consistent with the above.)

### Per-op reading

- **array_sin (the hot path — what the gate turns on).** AS-managed/Rust is
  0.68–1.18× across runs; the single value >1.10 (run 1, n=100000 → 1.18) is
  directly contradicted by 0.68 and 0.73 at the same size in the other two runs, so
  it is measurement noise, not a regression. At the throughput-relevant 1M tier
  AS-managed is *faster* (0.94 / 0.78). AS-ptr is faster than Rust in 7 of 8 cells
  (0.51–1.06×). **AS does not regress the hot elementwise path.**
- **bessel_j0_f64 (managed special, low call-rate, large n).** Parity: 0.82–1.68×,
  fixed-overhead-dominated at tiny n, at parity/faster by 100k. Exactly the "alloc
  amortizes" regime — managed ABI is appropriate.
- **sort_f64.** AS-managed is ~2× slower than Rust on random input, consistently
  (1.30–2.79×). Same marshalling as bessel (which is at parity), so this is a
  *kernel-quality* gap (AS `_qsort` vs Rust's introsort-class sort), not an ABI
  cost. See the sort caveat.
- **Correctness:** `maxdiff` is `0.0e+0` in every cell — AS `array_sin`,
  `bessel_j0_f64`, and `sort_f64` are bit-identical to Rust on this input.

## The ABI decision (applying the plan's gate)

The plan's rule:
1. managed-AS within ~10% of Rust on the hot path → **managed-array everywhere**.
2. managed regresses but pointer-ABI matches Rust → **hybrid**.
3. AS hopeless (>2× slower) even with pointer ABI → **STOP**.

The hot-path (`array_sin`) data is at parity (geomean ≈1.0× run 1, ≈0.74× run 2;
faster at 1M on both), so it satisfies branch 1's threshold and is nowhere near
branch 3. The reason the recommendation is **HYBRID rather than "managed
everywhere"** is an engineering-churn argument that the bare ratio misses:

> The hottest path already ships as a lean, pointer-based, zero-per-call-alloc
> bridge (`elementwise/wasm-bridge.ts`). The pointer-ABI AS kernel mirrors the Rust
> signature exactly (`(inPtr,outPtr,n)`), so it drops into that bridge **with no
> rewrite**, and it is the **fastest** of the three variants. Converting the hot
> path to the managed header ABI would be *more* code and *slightly slower* at
> mid-n for zero benefit. So: pointer-ABI AS for elementwise; managed-AS (which is
> at parity and matches the existing AS exports) for everything else.

This is the hybrid that [EVAL §8 open-decision #1](./RUST_TO_AS_MIGRATION_EVAL.md)
predicted as "likely."

### What this means per bridge for Phase 2/3

| Bridge | ABI | Rationale |
|---|---|---|
| `elementwise/` (+ fusion) | **pointer-ABI AS** | hot path; fastest; zero-rewrite drop-in to the existing lean bridge. Author `array_<op>_ptr` for the 18 ops. `fuseUnaryChain`'s single-copy property is preserved by ping-ponging two scratch offsets, exactly as today. |
| `special/` | **managed AS** | parity (0.82–1.68×); low call-rate, large n; matches existing `bessel_*`/`airy_*`/`elliptic_*` managed exports. |
| `sort/` | **managed AS, but gated** | ~2× slower on random + O(n²) on duplicate-heavy input. Do **not** repoint until the AS sort kernel is fixed (introsort/pivot) or accept a documented threshold; measure before wiring. |
| `signal/`, `poly/`, `interpolation/`, `bitwise/` | **managed AS (verify in Phase 4)** | low-call-rate/large-n like special; not benchmarked here. The sort surprise shows "assume managed is fine" is unsafe — each bridge's differential + perf gate in Phase 4 must confirm. |

The pointer-ABI elementwise kernels are the only *new* ABI surface the hybrid
adds; everything else uses the managed exports AS already has (plus the 2
general-order bessel + 2 poly renames the eval already scoped). Phase 2's authoring
count is essentially unchanged.

## Did the managed-array allocation measurably hurt the hot path?

**No — not when pooled.** This is the crux question. With the WASMBackend-style
pool, managed `array_sin` pays no per-call `__new`; its per-call cost is copy-in +
header-deref'd kernel + copy-out — the same shape as Rust's pointer path — and it
measures at parity-to-faster than Rust. The pointer-ABI AS variant is a further
~10–30% faster (it skips the header indirection and any residual bounds checks),
which quantifies the managed-header overhead as small but real, and is *why* the
hybrid keeps the hot path on pointers. The catastrophic allocation cost the eval
flagged only materializes if a bridge allocates per call — which pooling (and
correctness under the stub allocator) already forbids.

## Flags for Phase 2/3 (non-blocking for the ABI decision)

- **AS `sort_f64` kernel quality.** ~2× slower than Rust on random data, and
  **O(n²) on duplicate-heavy/structured input** (≈28–30× vs Rust at n≈131k with the
  sawtooth input the existing benches use). Correct (bit-identical) but slow. The AS
  `_qsort` needs an introsort/pdqsort-class upgrade (median-of-three or random pivot
  + heapsort fallback) before the `sort/` bridge is repointed to AS — otherwise that
  bridge stays on JS, or accepts the regression behind a documented threshold.
- **Result-allocating AS kernels leak under `--runtime stub`.** `bessel_j0_f64`
  (and the other `*_f64` specials that `return new Float64Array`) allocate a result
  per call with no free. Tolerable for low-call-rate specials within a process, but
  for any hot or long-lived use prefer a caller-provided output-buffer signature
  (like `array_sin(a,result)`) or the pointer ABI. Revisit the `--runtime` choice
  (`minimal`/incremental) when the shared `@danielsimonjr/mathts-wasm` package is
  scaffolded in Phase 2.

## Confidence & caveats

- **High confidence** in the gate result: AS does not regress the hot elementwise
  path (consistent direction across three runs; bit-exact correctness); the
  migration is not in the STOP branch; pointer-ABI is the right ABI for the hot
  path.
- **Medium confidence** in exact ratios: single noisy laptop, mid-size variance
  ~±20%. The decision is robust to that noise (parity vs 2×-slower is not a
  coin-flip). Re-run on the CI/deployment host before quoting hard numbers in
  release notes.
- **Scope:** only the three plan-mandated representatives were benchmarked
  (`array_sin`, `bessel_j0_f64`, `sort_f64`). Signal/poly/interp/bitwise bridges
  inherit the same managed marshalling as bessel and are expected to behave like
  it; verify per-bridge in Phase 4 against the AS binary.

## Artifacts

- Spike bench (kept, re-runnable): `tools/benchmark/wasm/rust-vs-as-abi.spike.mts`
- Pointer-ABI AS prototype source: `tools/benchmark/wasm/_spike/array_sin_ptr.ts`
- Compiled prototype: `tools/benchmark/wasm/_spike/array_sin_ptr.wasm`
