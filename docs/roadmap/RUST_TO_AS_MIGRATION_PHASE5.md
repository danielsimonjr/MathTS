# Rust → AssemblyScript Migration — Phase 5 (functions cutover) closing note

**Date:** 2026-06-26 · **Status:** functions cutover COMPLETE; Rust NOT deleted.

See also: [RUST_TO_AS_MIGRATION_PLAN.md](./RUST_TO_AS_MIGRATION_PLAN.md),
[RUST_TO_AS_MIGRATION_EVAL.md](./RUST_TO_AS_MIGRATION_EVAL.md).

## Scope executed (functions-only)

Phase 5 as originally planned was "delete Rust + simplify to AS-only repo-wide".
The pre-delete dependency check found this is **not yet safe**, so the executed
scope was narrowed to a **functions-package cutover** (the irreversible Rust
deletion is deferred). What changed:

1. **`functions` dispatch simplified to AS→JS.** The dead `isRustWasm`-gated
   Rust-pointer branches and the dual-name (`*_f64_as`) probe scheme were removed
   from the 7 bridges under `functions/src/wasm/**`
   (`elementwise`, `special`, `poly`, `sort`, `interpolation`, `signal`,
   `bitwise`) and from `bridges/common.ts`. The `isRustWasm` and
   `runRustUnaryF64` helpers and all Rust type aliases were deleted.
   `makeUnaryArrayDispatch` is now AS→JS. The AS-managed marshalling
   (`withAsF64`/`withAsI32`/`asReadReturned*`) and JS fallbacks are preserved.
2. **SHA-384 loader verification untouched** — `functions/src/wasm/WasmLoader.ts`
   still hashes the `.wasm` against `wasm-manifest.json` before instantiation.
   `getDefaultWasmPath` (incl. the `MATHTS_WASM_BACKEND=rust` opt-in and the Rust
   differential test `functions/tests/diff-wasm-rust.test.mjs`) is unchanged; a
   Rust binary loaded that way simply routes to JS in the bridges now.
3. **Dep-graph pairing tool** (`tools/create-dependency-graph`): the runtime
   probe reads the binary functions actually loads (`mathts-as.wasm`),
   `bundledBackend` is `assemblyscript`, and effective-wasm rose **18 → 37**.
   `--check-wasm-parity` still works and exits 0.
4. **Docs swept** to the accurate current state (CLAUDE.md, AGENTS.md, README,
   docs/backends.md, docs/Architecture/WASM_ACCELERATION.md, CHANGELOG).

## What was NOT done, and why — the remaining Rust consumer

`wasm-rust/` was **NOT deleted**, and `build:wasm:rust` / `build:wasm:all`
**remain** in `package.json`. The pre-delete grep found a live, non-`functions`
consumer of the Rust build output:

- **`matrix/src/backends/RustWASMBackend.ts`** (full backend) +
  **`RustWasmLoader.ts`** load `lib/wasm/mathts.wasm` (the `build:wasm:rust`
  output, flat-pointer Rust ABI anchored at `__heap_base`).
- **`matrix/src/backends/register-backends.ts`** registers `rustWasmBackend`,
  and **`BackendManager.selectBackend`** routes to `'rust-wasm'` for
  `rustWasmPreferredOps: ['fft','eig','svd','decomposition']` and for
  `elementCount >= rustWasmThreshold` (1000).

Deleting `wasm-rust/` would make `lib/wasm/mathts.wasm` permanently unbuildable
and silently demote matrix's heavy-op path to JS/AS. That is out of scope for a
functions cutover, so the irreversible deletion is deferred.

### Remaining migration slice (a separate follow-up)

- Migrate `matrix`'s heavy ops (fft/eig/svd/decomposition, large multiply) off
  `RustWASMBackend` to AssemblyScript (or accept JS where AS lacks parity).
- Remove `rust-wasm` from `register-backends.ts` / `BackendManager` /
  `Backend.ts` (`BackendType`) / `index.ts` / `matrix/src/operations/svd-wasm.ts`,
  and update matrix tests + `matrix/CHANGELOG.md`.
- Only then: delete `wasm-rust/`, drop `build:wasm:rust` / `build:wasm:all`, and
  remove the CI cargo step.

> **CI note:** `.github/workflows/` is protected. If a workflow runs `cargo` /
> `build:wasm:rust`, it should stay as-is for now (matrix still needs the Rust
> binary). No workflow change is required for this functions-only cutover.

## The 4 `functions` AS-kernel Phase-6 follow-ups (kept on JS)

These dispatchers deliberately stay on the JS fallback because the AS kernels are
broken/unstable. They are the next migration phase, NOT regressions:

1. **Poly fits** — `polyFitDispatch` / `chebFitDispatch` / `legendreFitDispatch`:
   the AS QR/normal-equations solver returns near-zero garbage where the JS
   solver recovers coefficients exactly (e.g. a degree-2 fit of `1−x+0.5x²` over
   `[−3,3]` returns ~`[0.007,−0.007,0.004]` instead of `[1,−1,0.5]`).
2. **Airy Ai/Bi** — `airyAiDispatch` / `airyBiDispatch`: the AS asymptotic kernel
   diverges ~1e-6 (relative) from JS for `|x| > 5`, above the 1e-12 bar.
3. **argsort / rank** — `argsortF64Dispatch` / `rankF64Dispatch`: the AS sort is
   **unstable**, so for tied values it returns a different (still valid)
   permutation than the JS stable reference.
4. **sort performance** — the AS `sort_f64` is O(n²) on duplicate-heavy input
   (`sortF64Dispatch` uses it for value-sorts, which are bit-identical, but the
   kernel itself wants replacing with a robust introsort/mergesort).

## Gate results (2026-06-26)

- `tsc --noEmit` (functions): **0 errors**.
- functions vitest: **2909 pass / 0 fail** (2 full-suite `await import` timeouts
  that pass in isolation — environmental, not logic).
- `functions/tests/security/wasm-integrity.test.ts`: **5/5** (SHA-384 intact).
- `--check-wasm-parity`: **exit 0** (gap 0 of 26 consumed).
- `npm run build` (turbo): **green** without the Rust toolchain (AS only for
  functions; matrix's Rust backend falls back when the binary is absent).
