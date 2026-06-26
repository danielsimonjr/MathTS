# Rust → AssemblyScript Migration — Detailed Evaluation

> **STATUS: COMPLETE (2026-06-26).** The Rust→AssemblyScript WASM migration is finished — AssemblyScript is the sole WASM backend; the Rust toolchain has been removed. See docs/roadmap/RUST_TO_AS_MIGRATION_COMPLETE.md.

**Status:** evaluation (pre-plan) · **Date:** 2026-06-25 · **Goal:** assess
removing the Rust wasm toolchain (`wasm-rust/`) and serving all `functions`-package
acceleration from AssemblyScript (`assembly/`), keeping a single TS→AS→WebGPU stack.

> This document is the grounded input to the agent-driven refactor plan. Every
> number below is read from the source / the actual `.wasm` export tables, not
> estimated.

---

## 1. Verdict

**Feasible and moderate — roughly 1.5–2.5 engineer-weeks, parallelizable.** The
headline `1,024 Rust exports vs 292 AS` is misleading: the TS layer consumes only
**~54 Rust kernels** (~5%), and AS **already covers ~36 of them** (31 with
identical names + 5 elementwise under `array_*` naming). The migration is
essentially: repoint **one package (`functions`)** from the Rust binary to the AS
binary, author **~17 missing AS kernels** (13 elementwise + 2 general-order
bessel + 2 poly renames), and rework the bridges from Rust's **raw-pointer ABI**
to AS's **managed-array ABI**. `matrix` is *already* AS + WebGPU and needs no
change.

The decision hinges on **one measurement** (Phase 1 spike): does AS's
managed-array marshalling stay within an acceptable perf delta of Rust's
raw-pointer path — especially for the elementwise wins shipped in 0.2.14?

---

## 2. Consumed Rust surface (the real coupling — grounded)

Only these kernels are called by `functions/src/wasm/**`. The other ~970 Rust
exports are dead weight to the TS layer.

| Bridge | Kernels consumed | Count |
|---|---|--:|
| `special/` | bessel_{j0,j1,jn,y0,y1,yn,j,y}_f64, airy_{ai,bi}_f64, carlson_{rc,rd,rf,rj}_f64, elliptic_{e,e_incomplete,f_incomplete,k,pi_incomplete}_f64, lgamma_f64 | 18 |
| `elementwise/` | simd_{sin,cos,tan,exp,log,abs,atan,sinh,tanh,atanh,expm1,log1p,log2,log10,sec,csc,cot}_array, simd_erfc_array | 19 |
| `poly/` | poly_{mul,div_mod,fit,resultant,discriminant}_f64, cheb_fit_f64, legendre_fit_f64 | 7 |
| `signal/` | apply_window_f64, welch_psd_f64, bartlett_psd_f64, goertzel_f64, chirp_z_transform_f64 | 5 |
| `sort/` | sort_f64, argsort_f64, rank_f64 | 3 |
| `interpolation/` | divided_difference_f64, tridiag_solve_f64 | 2 |
| **Total** | | **~54** |

---

## 3. AS parity matrix (from the actual `matrix/dist/wasm/mathts-as.wasm` export table)

| Category | AS parity | Detail |
|---|---|---|
| **Special (20)** | ⚠️ **18/20, identical names** | AS exports `bessel_j0_f64`, `airy_ai_f64`, `elliptic_k_f64`, `lgamma_f64`, … Bug fixes from this session were applied to the AS source too (<1e-9). **Missing:** `bessel_j_f64`, `bessel_y_f64` (general real-order J/Y — AS has only integer-order `bessel_jn_f64`/`bessel_yn_f64`). |
| **Sort (3)** | ✅ full | `sort_f64`, `argsort_f64`, `rank_f64` present. |
| **Signal (5)** | ✅ full | `apply_window_f64`, `welch_psd_f64`, `bartlett_psd_f64`, `goertzel_f64`, `chirp_z_transform_f64` present. |
| **Interp (2)** | ✅ full | `divided_difference_f64`, `tridiag_solve_f64` present. |
| **Poly (7)** | ⚠️ 5/7 + 2 renames | Has `poly_mul_f64`, `poly_div_mod_f64`, `poly_fit_f64`, `cheb_fit_f64`, `legendre_fit_f64`. `poly_resultant_f64`→ AS `resultant`; `poly_discriminant_f64`→ AS `discriminant` (rename only). |
| **Elementwise (19)** | ❌ **5/19 — the real gap** | AS has only `array_{sin,cos,exp,log,abs,sqrt}`. **Missing 13:** tan, atan, sinh, tanh, atanh, expm1, log1p, log2, log10, sec, csc, cot, erfc. Also naming differs (`array_X` vs `simd_X_array`). |

**Net AS authoring gap: 13 elementwise kernels + 2 general-order bessel
(`bessel_j_f64`/`bessel_y_f64`) + 2 poly renames.** Everything else already
exists in AS with the exact name. (Verified by diffing all ~54 consumed names
against the `mathts-as.wasm` export table: special 18/20, sort 3/3, signal 5/5,
interp 2/2, poly 5/7, elementwise 5/18.)

---

## 4. ABI analysis — the core porting cost

This is where the work (and the perf risk) lives.

| | Rust (current) | AssemblyScript (target) |
|---|---|---|
| Special sig | `bessel_j0_f64(xsPtr, n, outPtr)` raw pointers | `bessel_j0_f64(xs: Float64Array): Float64Array` managed |
| Elementwise sig | `simd_sin_array(inPtr, outPtr, n)` raw | `array_sin(a: Float64Array, result: Float64Array)` managed |
| Allocator | none (`memory` only) — bridge self-manages scratch | `__new`/`__pin`/`__unpin` managed runtime |
| Call glue | write to wasm memory at a ptr, call, read back | `__newArray(id, src)` → `__pin` → call → `__getFloat64Array` → `__unpin` |

Consequences:
- **Every `functions` bridge needs ABI rework** to the managed-array convention.
  Reference glue already exists and ships in production: `matrix/src/backends/
  WASMBackend.ts` + `RustWasmLoader.ts` (`__new`/`__pin`/`AS_ID_ARRAY_BUFFER`).
- The `special/` bridge **already contains AS-path code** (the `*_f64_as` probes,
  "typed-array ABI"), but it is **dead in `functions`**: (a) `functions` never
  loads the AS module, and (b) it probes the `_as`-suffixed name while the AS
  binary exports the plain `bessel_j0_f64`. So special is mostly "load AS module +
  fix probe name," not a rewrite.
- The loader's `allocateFloat64Array` already uses `__new` — it was written for
  AS. Switching to the AS binary **aligns the loader with the kernels** and would
  make the 21 currently-js-fallback specials actually run wasm (correctness
  consistency; not a measured speedup).

### The perf risk (must measure — Phase 1)

The AS managed-array ABI **allocates a managed array per call** (`__newArray` +
GC bookkeeping). The Rust elementwise path shipped in 0.2.14 uses a **reused
JS-side scratch region with zero per-call allocation**. So a naive managed-ABI
migration could **shrink or erase the 1.4–7× elementwise/erfc wins**.

Mitigation if the spike shows regression: author **pointer-ABI AS kernels**
(`array_sin(inPtr, outPtr, n)` using `usize` + `load`/`store`) mirroring the Rust
ABI, so the existing lean self-scratch bridge works unchanged against AS. AS
supports this; it's more authoring but preserves the perf profile.

---

## 5. WebGPU status

**Real, not aspirational** — but scoped to `matrix`. `matrix/src/backends/gpu/`
has genuine `requestAdapter` / `createComputePipeline` / `GPUBuffer` code
(`GPUContext`, `BufferPool`, `BatchExecutor`, `detect`). It accelerates linear
algebra, independent of the Rust-vs-AS question. Extending WebGPU to
large-array elementwise in `functions` is **additive** and out of scope for
"remove Rust," though it's the natural home for the very-large-array path.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| AS managed-ABI per-call allocation regresses the 0.2.14 elementwise/erfc wins | **High** | Phase-1 spike; fall back to pointer-ABI AS kernels if needed |
| AS slower than Rust+LLVM on hot kernels (no LLVM vectorization) | Medium | Phase-1 spike benchmarks special + elementwise; the "simd" Rust kernels are already *scalar* loops, so parity is likely |
| Numerical parity beyond specials (sort/signal/poly/interp) unverified vs AS | Medium | Re-run the existing diff harnesses against the AS binary (Phase 4) |
| `functions` doesn't currently bundle/load the AS binary at all | Low | `matrix` already does; reuse its resolve + loader |
| 13 missing AS elementwise kernels + 2 poly renames | Low | Mechanical authoring; `array_sin` is the template |
| Hidden Rust-only consumers not caught by the grep | Low | Phase-0 exhaustive re-scan (this doc is grep-derived; confirm with the dep-graph tool's wasm-pairing + a wasm-name diff) |

---

## 7. Effort estimate (phased, parallelizable)

| Phase | Work | Est. |
|---|---|---|
| 0 | Exhaustive consumed-surface confirmation (this doc + automated diff of Rust-vs-AS export names) | 0.5 d |
| 1 | **Perf spike** — benchmark AS special + `array_sin` vs Rust via matrix's glue; decide managed-ABI vs pointer-ABI-AS | 1–2 d |
| 2 | Author 13 missing AS elementwise kernels + 2 general-order bessel (`bessel_j_f64`/`bessel_y_f64`) + 2 poly renames; mpmath-validate | 2–3 d |
| 3 | Rework the 6 `functions` bridges to the AS ABI (special is mostly wiring; elementwise is the bulk) + bundle/load the AS binary | 3–5 d |
| 4 | Re-gate: diff harnesses (special 187 / elementwise 36 / fusion 6 / sort / signal) + perf benchmarks against AS | 1–2 d |
| 5 | Delete `wasm-rust/`, drop `build:wasm:rust`, remove cargo from CI, update docs/pairing tool (drop the Rust-allocator probe) | 0.5 d |
| | **Total** | **~1.5–2.5 wk**, parallelizable per-bridge across agents |

---

## 8. Open decisions for the plan

1. **ABI choice (gated on Phase 1):** managed-array AS (simpler, matches existing
   AS exports) vs pointer-ABI AS kernels (preserves the lean zero-alloc
   elementwise path). Likely **hybrid**: managed for special/sort/signal/poly
   (call-rate low, n large → alloc amortizes), pointer-ABI for the hot
   elementwise/fusion path.
2. **One binary or two?** Today: `functions`→Rust, `matrix`→AS. Target: both →
   the single AS binary (`mathts-as.wasm`), or a shared `@danielsimonjr/mathts-wasm`
   AS package both depend on.
3. **Keep Rust as an optional high-perf backend** behind a flag, or delete
   outright? The dispatch order (Rust→AS→JS) currently assumes Rust primacy;
   removing Rust simplifies it to AS→JS.
4. **op-fusion under AS:** the Tier-3 `fuseUnaryChain` ping-pongs raw pointers in
   the Rust module's memory. Under managed AS this needs the pointer-ABI kernels
   (decision #1) to keep the single-copy property.
