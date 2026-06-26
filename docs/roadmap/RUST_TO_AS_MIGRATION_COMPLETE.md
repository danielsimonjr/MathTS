# Rust → AssemblyScript Migration — COMPLETE

**Status:** COMPLETE · **Completion date:** 2026-06-26

AssemblyScript is now the **sole WASM backend** for the entire MathTS repo. The
Rust WASM toolchain has been removed. The acceleration stack is
**TypeScript → AssemblyScript WASM → WebGPU (matrix)**.

See the historical record: [PLAN](./RUST_TO_AS_MIGRATION_PLAN.md),
[EVAL](./RUST_TO_AS_MIGRATION_EVAL.md),
[PHASE1](./RUST_TO_AS_MIGRATION_PHASE1.md),
[PHASE5](./RUST_TO_AS_MIGRATION_PHASE5.md).

## What was migrated

Both consuming packages now run entirely on the AssemblyScript binary
(`mathts-as.wasm`, source `assembly/src/`):

- **`functions` package** — fully on AS. Dispatch is **AS → JS**. Covers the
  elementwise transcendentals (`abs/sin/cos/tan/exp/log` + `atan/sinh/tanh/
  atanh/expm1/log1p/log2/log10/sec/csc/cot/erfc`) and the special / poly / sort /
  signal / interpolation kernels (bessel, elliptic, Carlson R-forms, lgamma,
  poly mul/div/resultant/discriminant, `sort_f64`, welch/bartlett/goertzel/
  chirp-Z, tridiag solve, divided-difference).
- **`matrix` package** — fully on AS. The heavy ops (`svd`/`eig`/`fft` and all
  dense decompositions — LU/QR/Cholesky/inverse/determinant) run on the same
  AssemblyScript binary, alongside multiply/transpose and the basic ops.

Effective-wasm coverage of the typed `functions` API rose to **37 of 39**
wasm-routed functions running on the AS binary (the 2 fall-backs being
`airyAi`/`airyBi` for |x|>5). The dep-graph probe reports `bundledBackend` =
`assemblyscript`.

## What was removed in Phase 7c

- The **`wasm-rust/` Cargo workspace** (the Rust crate + build scripts).
- The npm scripts **`build:wasm:rust`**, **`build:wasm:all`**, and **`bench:wasm`**.
- The dead **`MatrixWasmBridge`** in the `matrix` package.
- The **`MATHTS_WASM_BACKEND=rust`** loader opt-in.
- The Rust-vs-AssemblyScript differential benchmark.

## Retained

- **SHA-384 integrity verification** of the AS binary is unchanged and still
  enforced — the `.wasm` buffer is hashed against `wasm-manifest.json` before
  compile/instantiate (security invariant; regression-tested by
  `functions/tests/security/wasm-integrity.test.ts`).
- `npm run build:wasm` (AssemblyScript) is the single WASM build command.
- `--check-wasm-parity` (dep-graph tool) now exits 0 by construction: there is no
  Rust binary left to diff the AS export table against.

## Remaining notes

- A few kernels deliberately stay on the **JS fallback** where their AS kernels
  are still being stabilized: poly fits (`polyFit`/`chebyshevFit`/`legendreFit`),
  Airy `Ai`/`Bi` for |x|>5, and `argsort`/`rank`. These route to a `*Dispatch`
  but the JS reference runs until the AS kernel is locked in.
- The dep-graph generator's `wasm-pairing.{md,json}` and `wasm-parity.{md,json}`
  under `docs/Architecture/` are **regenerated artifacts** — regenerate with
  `npm run docs:deps` rather than hand-editing.
