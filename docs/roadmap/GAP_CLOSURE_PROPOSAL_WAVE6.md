# Wave-6 Gap-Closure Proposal — Final Cleanup

**Date:** 2026-05-24
**Source:** Picks up the 5 forward-tracked items left after Wave 5 closed §D / §B.1 / §B.2 / §C of [`FUNCTION_GAPS_AUDIT.md`](./FUNCTION_GAPS_AUDIT.md). Companion to the four prior Wave proposals.
**Status as of opening:** Waves 1-5 complete (33 slices across ~30 commits). All §D Tier-4 ranks and all §B.1 / §B.2 / §C playbook items landed. Effective coverage 100% on active code; 0 circular deps; pipeline 19/19 green.

**Status as of closing (2026-05-24):** ✅ **WAVE 6 COMPLETE — ALL 5 SLICES LANDED.** Commits `d0466b3` (6.1), `048e9e1` (6.2), `3aac312` (6.5), `bba468b` (6.3), `2be52f9` (6.4), plus `dc5c050` (manifest regen). Suite: 6308 vitest + 172 WASM integration tests pass / 7 skipped / zero regressions. AS parity for Carlson kernels wired through `assembly/src/index.ts`; `mathts-as.wasm` now in manifest. The entire `FUNCTION_GAPS_AUDIT.md` roadmap is closed.

## Pre-flight findings (audited the codebase before designing)

- **Schur form already exists internally** in `matrix/src/operations/eig.ts` (line 372: "Extract eigenvalues from quasi-upper-triangular Schur form") but isn't exposed as a public matrix-package primitive. Slice 6.1 either exposes the internal Schur or implements `matrixSchur` standalone.
- **`delaunayTriangulation` (2-D) + `voronoi` + k-d tree already have WASM kernels** in `wasm-rust/crates/mathts-wasm/src/geometry/advanced.rs`. The remaining geometry gap is **`convexHull3D`** only (and a few peripheral 2-D/3-D predicates like `orient3D`/`inSphere` that no consumer in the monorepo currently calls).
- **Complete elliptic** integrals `K(m)` / `E(m)` landed Slice 5.3 with `wasm.elliptic_k_f64` / `wasm.elliptic_e_f64`. The audit's "incomplete + Carlson" sibling is genuinely missing — no Carlson R-form WASM exists.
- **WebGPU paths** (`functions/src/typed/gpu.ts`, `matrix/src/backends/gpu/*`) have no headless-runnable smoke test today — a long-standing infra gap.

## Slicing strategy

| Tier       | Slices        | Character                                              | Dispatch            |
| ---------- | ------------- | ------------------------------------------------------ | ------------------- |
| **Tier 1** | 6.1, 6.2, 6.5 | Disjoint scopes; no WASM toolchain churn between them. | Parallel (3 agents) |
| **Tier 2** | 6.3, 6.4      | WASM kernel ports; sequenced to avoid manifest race.   | Sequential          |

## Tier 1 — Parallel slices (3 agents, disjoint scopes)

### Slice 6.1 — Slice 5.9b: full Higham logm / sqrtm for general matrices ✅ LANDED (`d0466b3`)

**Goal:** Lift the Slice 5.9a limitation — non-diagonalisable / complex-eigenvalue / defective matrices currently throw or fall back to the eig-based formula with a warning. This slice implements the Schur-based general-case algorithms per Higham 2008 §11 (logm) and §6 (sqrtm Björck-Hammarling).

**Files (your scope only):**

- `matrix/src/operations/schur.ts` — NEW. Expose Schur decomposition as a public primitive. Extract the existing internal implementation from `matrix/src/operations/eig.ts` if cleanly extractable, otherwise implement standalone Francis QR-with-double-shifts (~150 LOC). Return `{ Q, T }` where `T` is the (quasi-)upper-triangular Schur form and `Q · T · Q^T = A`.
- `matrix/src/operations/logm.ts` — extend with Schur-based path. Switch from "throw on non-convergence" to "use Schur path when eig fails." Implement the Schur-Padé algorithm per Higham (2008) Algorithm 11.10:
  1. Schur decomposition `A = Q · T · Q^T`.
  2. Inverse scaling-and-squaring on `T` (upper triangular makes square-roots tractable via Björck recurrence).
  3. Padé approximant for `log(T)` near identity.
  4. Multiply back by `2^k`; rotate by Q.
- `matrix/src/operations/sqrtm.ts` — extend with Björck-Hammarling Schur-based algorithm per Higham (2008) Algorithm 6.3:
  1. Schur decomposition.
  2. Compute upper-triangular `U` such that `U^2 = T` by direct back-substitution on the recurrence `U_ii^2 = T_ii` and `T_ij = U_ii·U_ij + U_ij·U_jj + sum(U_ik·U_kj, k>i, k<j)`.
  3. Rotate back: `sqrtm(A) = Q · U · Q^T`.
- `matrix/src/operations/index.ts` — re-export `matrixSchur` + types.
- `matrix/tests/operations/{schur,logm,sqrtm}.test.ts` — extend; ≥ 8 new tests covering complex-eigenvalue and defective cases.

**Reference:** Higham (2008) "Functions of Matrices: Theory and Computation," chapters 6 and 11. SciPy's `scipy.linalg.{logm,sqrtm}` are the canonical implementations to cross-check.

**Acceptance:** matrices with negative real eigenvalues, repeated eigenvalues, defective Jordan blocks, and complex eigenvalues all return finite results matching SciPy reference within `1e-10`.

### Slice 6.2 — Non-symmetric `eig` AD (extends Slice 4.8) — **Opus subagent** ✅ LANDED (`048e9e1`)

**Goal:** Lift the symmetric-only restriction on `TapedTensor.eig`. Slice 4.8 throws when `symmetric: false`. This slice implements the general-case eigendecomposition AD using the standard formula (Magnus & Neudecker 1999 §10.6 / Giles 2008 §3.2):

```
For A = V · diag(λ) · V^{-1} (V is the right-eigenvector matrix):

dV (forward): dV = V · (E ∘ (V^{-1} · dA · V))
dλ (forward): dλ = diag(V^{-1} · dA · V)
where E[i,j] = 1/(λ_j - λ_i) for i ≠ j, else 0.

Reverse mode (the adjoint):
dA = V^{-T} · (E ∘ (V^T · dV) + diag(dλ)) · V^T
```

**Files (your scope only):**

- `autograd/src/tape.ts` — extend `TapedTensor.eig({ symmetric: false })` path. Currently throws; replace with the general-case adjoint.
- `autograd/tests/tape-decomposition-ad.test.ts` — extend with ≥ 10 new tests covering complex eigenvalues, near-degenerate cases, and chained-graph use.

**Complications you'll need to handle:**

- **Complex eigenvalues:** The eigenvalues / eigenvectors may be complex even when A is real. Decision: produce complex output (a pair of Float64Arrays for re/im) — the Tensor primitive likely already supports this via the underlying `matrix.eig` shape — or restrict to real Schur form and document. Pick the simpler path; document.
- **Repeated eigenvalues:** Subgradient mask at `REL_TOL = 1e-10`, same as Slice 4.8 for symmetric.
- **Defective matrices** (algebraic multiplicity > geometric multiplicity): The adjoint formula assumes diagonalizability. Throw a clear error if `cond(V) > 1e14` and document.

**Reference:** Townsend (2016) §4 "Differentiating eigendecompositions of general matrices"; PyTorch's `torch.linalg.eig` backward (`aten/src/ATen/native/BatchLinearAlgebra.cpp` — `linalg_eig_backward`).

**Acceptance:** Finite-difference verification at ≥ 5 well-conditioned non-symmetric inputs; clean error on defective inputs; no NaN on near-degenerate.

### Slice 6.5 — WebGPU browser smoke test infrastructure ✅ LANDED (`3aac312`)

**Goal:** Land the Playwright (or `@vitest/browser`) infrastructure so the WebGPU paths in `functions/src/typed/gpu.ts` and `matrix/src/backends/gpu/*` get one smoke test in a real browser environment. Headless-Node tests can't instantiate a WebGPU adapter today.

**Files (your scope only):**

- `package.json` (root) — add `@vitest/browser` + `playwright` as devDependencies.
- `vitest.config.browser.ts` — NEW. Browser-mode vitest config gated to test files matching `*.browser.test.ts`. Run only on CI matrix entries with a software WebGPU adapter (Mesa lavapipe on Linux, DX12 on Windows).
- `functions/tests/gpu-smoke.browser.test.ts` — NEW. One trivial smoke test: `gpuMatmul` on a 4×4 input matches the CPU reference within float32 precision. Should explicitly check that `gpuMatmul` runs on the GPU when the adapter is available, falls back to CPU otherwise.
- `.github/workflows/ci.yml` (or wherever the CI matrix lives — find it) — add a `browser` job that installs Mesa lavapipe on Linux (`apt-get install mesa-vulkan-drivers libegl1`) and runs `npm run test:browser`.
- `package.json` — add `test:browser` script.

**Acceptance:** `npm run test:browser` runs locally (with whatever software WebGPU adapter is available — Mesa lavapipe via WSL2 / Docker / native Linux works); CI matrix entry passes in the GitHub Actions runner.

**Scope-balloon escape:** If the CI matrix configuration turns out to be fiddly (the GitHub-Actions Mesa lavapipe install can be temperamental), commit just the local Playwright + vitest-browser plumbing + the smoke test (working locally), and defer the CI matrix to a follow-up. Document in commit message.

## Tier 2 — Sequential WASM slices

### Slice 6.3 — `convexHull3D` + auxiliary 3-D predicates WASM ✅ LANDED (`bba468b`)

**Goal:** Add `convexHull3D` to `typed/geometry.ts` via an incremental algorithm (e.g. QuickHull or Chan's). 2-D hull + Delaunay 2-D + Voronoi 2-D + k-d tree are already WASM (per Slice 5.7d + the existing `geometry/advanced.rs`).

**Files:**

- `wasm-rust/crates/mathts-wasm/src/geometry/advanced.rs` — extend with `convex_hull_3d_wasm(pts_ptr, n, faces_ptr) -> i32` (incremental QuickHull-3D).
- `assembly/src/geometry/advanced.ts` (if it exists; check) — AS parity.
- `functions/src/wasm/WasmLoader.ts` — register the new export.
- `functions/src/typed/geometry.ts` — add `convexHull3D` exported.
- `functions/tests/typed-geometry.test.ts` — extend with ≥ 6 hull-3D tests.

**Reference:** Barber, Dobkin, Huhdanpaa (1996) — the QuickHull paper.

**Threshold:** `≥ 1024 points`.

### Slice 6.4 — Carlson symmetric forms + incomplete elliptic integrals ✅ LANDED (`2be52f9`)

**Goal:** Implement `RC`/`RD`/`RF`/`RJ` Carlson symmetric forms and the incomplete elliptic integrals `ellipticF(φ, m)`, `ellipticE_incomplete(φ, m)`, `ellipticPi(n, φ, m)`. Carlson forms converge quadratically and avoid the branch-cut headaches of the Legendre form.

**Files:**

- `wasm-rust/crates/mathts-wasm/src/special/functions.rs` — add scalar `carlson_rc(x, y)`, `carlson_rd(x, y, z)`, `carlson_rf(x, y, z)`, `carlson_rj(x, y, z, p)` per Numerical Recipes §6.11.
- `wasm-rust/crates/mathts-wasm/src/bessel.rs` — add array kernels.
- `assembly/src/special.ts` — AS parity.
- `functions/src/wasm/special/wasm-bridge.ts` — add Carlson + incomplete-elliptic dispatchers.
- `functions/src/wasm/WasmLoader.ts` — register.
- `functions/src/typed/special.ts` — add `ellipticF`, `ellipticPi`, `carlsonRC`/`RD`/`RF`/`RJ` exports.
- `functions/tests/typed-special-wasm.test.ts` — extend with ≥ 12 tests covering reference values from DLMF §19.16-19.36 and Abramowitz & Stegun §17.

**Reference:** Carlson (1995) "Numerical Computation of Real or Complex Elliptic Integrals"; NR §6.11; DLMF §19.

**Threshold:** `≥ 1024 samples`.

## Dispatch plan

**Wave 6A (parallel — 3 agents):**

- Slice 6.1 (sonnet) — matrix-package Schur + general-case logm/sqrtm.
- Slice 6.2 (**opus**) — non-symmetric eig AD; design-heavy with complex-arithmetic edge cases.
- Slice 6.5 (sonnet) — WebGPU smoke infrastructure.

**Wave 6B (sequential — 1 sonnet agent each):**

- Slice 6.3 — convexHull3D WASM.
- Slice 6.4 — Carlson + incomplete elliptic WASM.

After Wave 6 lands, the entire MathTS gap-closure roadmap from `FUNCTION_GAPS_AUDIT.md` is fully closed. The only forward work left is the dormant synced mathjs upstream sync (tracked in `MATHJS_SYNC_ROADMAP.md`), and the mathjs.org "feature parity ratchet" — neither of which fall under the gap audit's scope.

---

## Wave 6 closing summary (2026-05-24)

**All 5 slices shipped. Roadmap closed.**

| Commit    | Slice | Tests | What landed                                                                  |
| --------- | ----- | ----- | ---------------------------------------------------------------------------- |
| `d0466b3` | 6.1   | +19   | Matrix Schur primitive + Higham-2008 general-case logm/sqrtm (Björck-Hammarling) |
| `048e9e1` | 6.2   | +13   | `TapedTensor.eig` non-symmetric reverse-mode AD (Townsend/Magnus-Neudecker)  |
| `3aac312` | 6.5   | infra | `@vitest/browser` + Playwright WebGPU smoke harness + CI job                 |
| `bba468b` | 6.3   | +18   | Rust `convex_hull_3d_wasm` QuickHull-3D kernel + `convexHull3D` dispatch     |
| `2be52f9` | 6.4   | +41   | Carlson `RC/RD/RF/RJ` + incomplete elliptic `F/E/Π` WASM (Rust + AS parity)  |
| `dc5c050` | fix   | —     | Manifest SHA-384 regeneration after combined 6.3+6.4 rebuild + AS wiring     |

**Suite delta:** 6249 → 6308 tests (+59), 236 → 238 files (+2). 172 WASM integration tests pass. Zero regressions.

**Security invariants intact:** WASM SHA-384 manifest verification re-validated for both `mathts.wasm` (Rust, 754 KB, primary) and `mathts-as.wasm` (AS, 62 KB, legacy with full Carlson parity).
