# mathts-wasm — Numerical Correctness Coverage Audit

Audit of the test coverage and numerical correctness of the
`@danielsimonjr/mathts-wasm` export surface. This document is the
re-runnable scorecard; the two scripts under `tests/audit/` and
`tests/golden/` regenerate every number here.

- **Coverage matrix** (which exports are tested, by family):
  `python -X utf8 tests/audit/coverage_matrix.py` → also writes
  `tests/audit/coverage_matrix.json`.
- **Differential harness** (P0 functions vs trusted oracles):
  `npm run test:diff` (runs `tests/diff-special.test.mjs` +
  `tests/diff-decomposition.test.mjs` against the **release** wasm).
- **Goldens**: `python -X utf8 tests/golden/generate_goldens.py`
  (mpmath 30-digit for special functions; numpy for decompositions).

Last regenerated: 2026-06-24.

---

## 1. Coverage matrix

**297 exported functions · 79 covered · 218 uncovered.** (Before the P0
differential harness landed this session: 56 covered.)

| Family (source module) | Total | Covered | Uncovered | Method |
|---|--:|--:|--:|---|
| `ops/complex-ops` | 44 | 0 | **44** | — |
| `ops/matrix` | 41 | 0 | **41** | — (`matrix_zeros` is alloc-helper only) |
| `ops/scalar` | 52 | 13 | **39** | hardcoded KAT (2 inputs each) |
| `ops/array` | 36 | 0 | **36** | — |
| `ops/complex-array` | 33 | 0 | **33** | — |
| `ops/bitwise` | 7 | 0 | **7** | — |
| `poly` | 5 | 0 | **5** | — |
| `signal` (Welch/Bartlett/Goertzel/CZT) | 5 | 0 | **5** | — |
| `sort` | 3 | 0 | **3** | — |
| `types/complex` | 3 | 0 | **3** | — |
| `tridiag` | 2 | 0 | **2** | — |
| `special` (Bessel/Airy/elliptic/Carlson/lgamma) | 18 | 18 | 0 | **differential vs mpmath** (P0, this session) |
| `algebra/decomposition` (LU/QR/Chol/inv/det) | 5 | 5 | 0 | **numpy + reconstruction** (P0, this session) |
| `ops/number-theory` | 11 | 11 | 0 | KAT (exact integers) |
| `ops/special` (orthogonal polys + integral fns) | 9 | 9 | 0 | KAT, single point |
| `ops/polynomial` | 7 | 7 | 0 | KAT arrays + identities |
| `ops/curvefit` | 3 | 3 | 0 | parameter recovery |
| `ops/optimization` | 3 | 3 | 0 | known optimum + null-space property |
| `ops/signal` (window/medfilt/resample) | 3 | 3 | 0 | KAT |
| `ops/svd` | 2 | 2 | 0 | reconstruction `A=UΣVᵀ` |
| `ops/linalg` (RREF/charpoly) | 2 | 2 | 0 | KAT |
| `ops/approx` | 2 | 2 | 0 | property + KAT |
| `ops/tensor` | 1 | 1 | 0 | KAT + permutation property |

Full per-symbol detail in `tests/audit/coverage_matrix.json`.

---

## 2. Cross-cutting findings (apply to the legacy tests, not the P0 harness)

1. **Legacy tests validate the wrong binary.** `tests/run.js` and the nine
   legacy `*.test.mjs` load `build/mathts-debug.wasm`. But `main` ships
   `build/mathts.wasm` — the release build (`optimizeLevel: 3`,
   `noAssert: true`). The P0 harness (`diff-*.test.mjs`) deliberately tests
   the **release** binary; the legacy tests should be migrated likewise.
2. **No external oracle in the legacy tests** — all hardcoded literals,
   self-consistency, or parameter recovery. The P0 harness introduces real
   oracles (mpmath, numpy).
3. **Single-point coverage** — legacy tests check 1–3 fixed inputs per
   function; no regime sweeps.
4. **No edge cases** anywhere (NaN/Inf/denormal/empty/ill-conditioned).
5. **Ad-hoc tolerances** (1e-6…1e-12, all absolute).

---

## 3. P0 differential results (`npm run test:diff`)

Three-tier classification — score = `|actual−expected| / max(|expected|, 1)`:
**PASS** ≤ 1e-9 · **WEAK** 1e-9…1e-6 (accuracy finding, not breakage) ·
**FAIL** > 1e-6 (genuine bug).

### 3a. Decompositions — 30 checks: 30 PASS (worst 1.78e-15)

All five decompositions are numerically excellent. Determinant and inverse
match numpy; LU/QR/Cholesky reconstruct to ~1e-15.

- **API finding (not a numerical bug): `matrix_qr_decompose` returns Q
  transposed.** The valid reconstruction is `A = Qᵀ·R`, not `A = Q·R`
  (verified to ~1e-15, and `QᵀQ = I`). This contradicts the function's own
  doc comment ("orthogonal Q") and the numpy/scipy convention (`A = Q·R`).
  Any consumer expecting standard QR will get wrong results. → either fix the
  accumulation order to return Q, or correct the doc + downstream callers.
- **API finding: ESM bindings can't return decomposition outputs.** The
  generated `build/mathts.js` wrappers for `matrix_lu_decompose`/`qr`/
  `cholesky`/`inverse` lower the output arrays into wasm, call, then
  `__release` them **without lifting the written values back** to JS. So the
  published ESM API for these four is unusable for retrieving results
  (`determinant`, a scalar return, is fine). The P0 test therefore drives
  them via the raw AssemblyScript loader. → fix the binding generation or
  document the raw-loader requirement.

### 3b. Special functions — 110 cases: 73 PASS, 22 WEAK, 15 FAIL

**FAIL (> 1e-6 — genuine numerical bugs):**

| Function | Worst observed error | Notes |
|---|--|---|
| `airy_ai_f64(-5)` | **6.0e-1** | ~60% wrong; Airy for negative args broken |
| `airy_bi_f64(-5)` | 4.8e-2 | negative-arg branch wrong |
| `airy_bi_f64(5)` | 3.2e-6 | just over threshold |
| `bessel_y1_f64(x)` | up to 9.3e-3 | wrong across x∈[0.5,5] |
| `bessel_yn_f64(n,x)` | up to 6.4e-3 | wrong for n∈{2,3,5} |
| `bessel_jn_f64(5,1)` | 1.9e-3 | high order, small x |

**WEAK (1e-9…1e-6 — works but below 1e-9 target):** `bessel_j0_f64`,
`bessel_j1_f64`, `bessel_y0_f64`, lower-order `bessel_jn_f64`, and
`airy_ai_f64(5)`. The Bessel J/Y kernels are generally good to ~1e-8, not
~1e-9.

> The default `npm test` does **not** yet include `test:diff` because these
> are pre-existing defects; gating the build on them would block unrelated
> work until the special functions are fixed. Once §3b is resolved, promote
> `test:diff` into `test`.

---

## 4. Prioritized remaining work

**P0 fixes surfaced by this audit (highest priority — known-wrong code):**
1. `airy_ai_f64` / `airy_bi_f64` negative-argument branch (catastrophic).
2. `bessel_y1_f64` / `bessel_yn_f64` accuracy (≥1e-3 errors).
3. `bessel_jn_f64` high-order accuracy.
4. `matrix_qr_decompose` Q-transpose convention (fix or document).
5. ESM output-parameter lifting for LU/QR/Cholesky/inverse.

**Coverage gaps to extend the harness to next (by risk):**
- **P1:** `ops/matrix` (41 — incl. `matrix_multiply`/`gemm`/`gemv`, the BLAS
  hot path) → numpy oracle; `ops/complex-ops` + `ops/complex-array` (77 —
  branch-cut functions) → mathjs complex oracle.
- **P2:** `poly` (5), `signal` spectral (5), `tridiag` (2), `sort` (3); the
  precision-sensitive `ops/scalar` gaps (`expm1`, `log1p`, `cbrt`,
  `nthRoot`, `atan2`).
- **P3:** `ops/array` (36), `ops/bitwise` (7), `types/complex` (3), trivial
  Math.* scalar wrappers.
