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

> **Status: all P0 issues resolved (0.1.5).** Special functions: **140 checks,
> 140 PASS** (worst 6.0e-10). Decompositions: **30 checks, 30 PASS** (worst
> 1.78e-15). `test:diff` is now part of the default `npm test`. The history
> below is retained for the record.

### 3a. Decompositions — 30 PASS (worst 1.78e-15)

All five decompositions are numerically excellent. Determinant and inverse
match numpy; LU/QR/Cholesky reconstruct to ~1e-15.

- **`matrix_qr_decompose` returns Q transposed — documented, not a bug.** The
  reconstruction is `A = Qᵀ·R` (verified to ~1e-15, with `QᵀQ = I`). This is
  the deliberate matrix-package convention (`WASMBackend.qrDecompositionJS`);
  the in-body note always documented it. **Resolved (0.1.5):** the misleading
  header comment ("orthogonal Q") was corrected to state the `A = Qᵀ·R`
  convention; behavior is unchanged to avoid breaking the consumer.
- **ESM bindings can't return decomposition outputs — AS-codegen limitation.**
  The generated `build/mathts.js` wrappers for `matrix_lu_decompose`/`qr`/
  `cholesky`/`inverse` lower the output arrays into wasm, call, then
  `__release` them without lifting the written values back (AssemblyScript has
  no out-parameter concept). `determinant` (scalar return) is unaffected; the
  return-based `matrix_svd` is the pattern for ESM-friendly results. These
  four output-param functions must be driven via the raw AssemblyScript loader
  (as the matrix package and `tests/diff-decomposition.test.mjs` do). This is
  a documented usage constraint, not a correctness defect.

### 3b. Special functions — 140 PASS (was: 73 PASS, 22 WEAK, 15 FAIL)

The original 15 FAIL / 22 WEAK were all resolved in 0.1.5:

| Original problem | Worst error (before) | Fix |
|---|--|---|
| `airy_ai/bi` negative args | 6.0e-1 | corrected DLMF 9.7.9/9.7.10 P/Q signs + sin/cos pairing |
| `airy` asymptotic accuracy | 1.7e-7 | u_k generated by recurrence (wrong hardcoded u_5/u_6) |
| `bessel_y1` / `bessel_yn` | 9.3e-3 | series + Hankel asymptotic rewrite |
| `bessel_jn` (n > x) | 1.9e-3 | Miller backward recurrence + off-by-one fix |
| `bessel_j0/j1/y0` accuracy | ~1e-8 | series + Hankel asymptotic rewrite |

---

## 4. Prioritized remaining work

**P0 fixes (all resolved in 0.1.5):**
1. ✅ `airy_ai/bi` negative-argument branch.
2. ✅ `bessel_y1` / `bessel_yn` accuracy.
3. ✅ `bessel_jn` recurrence (direction + Miller off-by-one).
4. ✅ `matrix_qr_decompose` Qᵀ convention (header doc corrected).
5. ✅ ESM output-parameter limitation (documented; raw-loader path).

**Coverage gaps to extend the harness to next (by risk):**
- **P1:** `ops/matrix` (41 — incl. `matrix_multiply`/`gemm`/`gemv`, the BLAS
  hot path) → numpy oracle; `ops/complex-ops` + `ops/complex-array` (77 —
  branch-cut functions) → mathjs complex oracle.
- **P2:** `poly` (5), `signal` spectral (5), `tridiag` (2), `sort` (3); the
  precision-sensitive `ops/scalar` gaps (`expm1`, `log1p`, `cbrt`,
  `nthRoot`, `atan2`).
- **P3:** `ops/array` (36), `ops/bitwise` (7), `types/complex` (3), trivial
  Math.* scalar wrappers.
