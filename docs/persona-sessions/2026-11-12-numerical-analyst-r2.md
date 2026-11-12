# Numerical analyst — published-package dogfood, round 2 (2026-11-12)

I am the same NumPy/SciPy-minded analyst as round 1: dense factorizations, Hilbert/singular systems, stiff ODEs, roots/quadrature, and complex arithmetic — but this session installs **only published npm** builds from the Nov 12 release train, re-runs every round-1 repro in my lane, and goes deeper on sparse COO solves, defective eigenstructure, Vandermonde least squares, banded SPD, and `eventDetection`.

- Node `v22.23.4`, Linux 6.12.113 x86_64, Intel Xeon 4-core (KVM)
- Registry install: `@danielsimonjr/mathts-core@0.27.0`, `functions@0.85.0`, `matrix@0.10.1`, `linalg@0.2.6` (+ `mathjs@15.2.0`, `ml-matrix@6.15.1` for oracles/benches)
- Oracles: closed forms, SciPy `solve_ivp` (Radau/BDF/events), NumPy `lstsq` / Hilbert residuals, ml-matrix SVD
- Scratch: `/tmp/mathts-na-r2` (ESM harness + `oracle.py`); strict TS consumer `/tmp/mathts-na-ts-r2`
- Intended labels on every **new** issue: `dogfood` + `bug|api|perf|docs|packaging` + `P0|P1|P2` + `persona:numerical-analyst` (GitHub label API still 403; first line `Labels:` in each body)

I did **not** change product code this round.

## What I tried, in order

1. Confirmed `npm ls` versions against the owner publish list (all matched).
2. Re-ran round-1 repros [#688–#701](https://github.com/danielsimonjr/MathTS/issues?q=label%3Apersona%3Anumerical-analyst+label%3Adogfood).
3. Closed-form / SPD tridiagonal / Hilbert `linsolve` residuals vs NumPy.
4. `inv`, `det`, `cond`, `pinv` Vandermonde fit vs `numpy.linalg.lstsq`.
5. `eig` / `eigs` on Jordan and near-degenerate matrices.
6. `SparseMatrix.fromCOO` SPD tridiagonal → `linsolve` / `lsolve` / `luSolve`.
7. Banded dense SPD `n=8` vs NumPy.
8. Robertson + Van der Pol `μ=1000` vs SciPy; `eventDetection` root; RK45 vs implicit methods.
9. `fsolve` / `findRoot`, `quad`, complex multiply, broadcast errors.
10. Timed matmul / solve / SVD at 200/500/1000, `sin(1e6)`, Robertson Radau.
11. Strict `tsc` consumer `skipLibCheck: false` on `functions@0.85.0`.

## Round-1 re-check

| Issue                                                      | Fixed?      | Notes (published `0.85.0` / `0.10.1`)                                                                                                                                                      |
| ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#688](https://github.com/danielsimonjr/MathTS/issues/688) | **yes**     | Singular consistent `lusolve` throws; NaN path throws (singular message).                                                                                                                  |
| [#689](https://github.com/danielsimonjr/MathTS/issues/689) | **yes**     | Scalar `fsolve` → √2.                                                                                                                                                                      |
| [#690](https://github.com/danielsimonjr/MathTS/issues/690) | **yes**     | `solve(A,b)` throws with `linsolve` / `lusolve` hint.                                                                                                                                      |
| [#691](https://github.com/danielsimonjr/MathTS/issues/691) | **yes**     | `stiffODESolver(f,y0,tspan)` and `(f,tspan,y0)` both integrate Robertson.                                                                                                                  |
| [#692](https://github.com/danielsimonjr/MathTS/issues/692) | **yes**     | `sin([0,1])` works.                                                                                                                                                                        |
| [#693](https://github.com/danielsimonjr/MathTS/issues/693) | **yes**     | `DenseMatrix.multiply` medians **below** ml-matrix at 200/500/1000 on this VM (see bench JSON).                                                                                            |
| [#694](https://github.com/danielsimonjr/MathTS/issues/694) | **partial** | `lusolve` n=1000 **515 ms** vs ml **395 ms** (~1.31×); large improvement vs 0.84.0 but not parity.                                                                                         |
| [#695](https://github.com/danielsimonjr/MathTS/issues/695) | **yes**     | `luSolve` exported from `linalg`.                                                                                                                                                          |
| [#696](https://github.com/danielsimonjr/MathTS/issues/696) | **yes**     | `createRequire` can read `functions/package.json`.                                                                                                                                         |
| [#697](https://github.com/danielsimonjr/MathTS/issues/697) | **partial** | Workerpool `@types/node` noise gone; strict consumer still fails on **WebGPU DOM types** in `@danielsimonjr/mathts-gpu` (open [#890](https://github.com/danielsimonjr/MathTS/issues/890)). |
| [#698](https://github.com/danielsimonjr/MathTS/issues/698) | **yes**     | `maxIter` failure: `solveODE RK45: exceeded maxIter=5 … try … BDF                                                                                                                          | Radau | Rosenbrock`. |
| [#699](https://github.com/danielsimonjr/MathTS/issues/699) | **no**      | `svd` n=500 median **1645 ms** vs ml-matrix **1098 ms** (**1.50×**); values still match.                                                                                                   |
| [#700](https://github.com/danielsimonjr/MathTS/issues/700) | **yes**     | `det(2×2)` runtime `number`.                                                                                                                                                               |
| [#701](https://github.com/danielsimonjr/MathTS/issues/701) | **yes**     | `lusolve(Float64Array(4), b)` OK.                                                                                                                                                          |

I could not post dedupe comments on [#890](https://github.com/danielsimonjr/MathTS/issues/890) / [#699](https://github.com/danielsimonjr/MathTS/issues/699) (integration **403**); details are in this log and the bench file.

## Accuracy highlights (max abs unless noted)

| Check                          | Error    | Oracle             |
| ------------------------------ | -------- | ------------------ |
| SPD 3×3 tridiagonal solve      | 0        | NumPy `[1,1,1]`    |
| Hilbert-10 `linsolve` residual | 4.37e-11 | `‖Ax−b‖∞`          |
| Hilbert-12 residual            | 4.66e-9  | same               |
| Robertson Radau `t=40`         | 1.04e-6  | SciPy Radau        |
| VdP `μ=1000` BDF `t=1`         | 3.48e-8  | SciPy BDF          |
| Vandermonde `pinv(A)·b`        | 3.64e-14 | NumPy `lstsq`      |
| `quad` ∫₀¹ e^{-x²}             | 2.44e-15 | 0.7468241328124271 |
| `eventDetection` `y₀=0.5`      | 4.4e-16  | ln 2               |
| SVD `S` vs ml-matrix `n=200`   | 7.1e-15  | ml-matrix          |
| Complex `(1+2i)(3+4i)`         | 0        | −5+10i             |

RK45 on Robertson **without** a step cap reaches `t=40` in **34 553** steps (Hairer err ~6.4e-6) — it completes but is not a stiff default; implicit methods stay ~1–2 ms.

## New findings (round 2)

### 1. P1 — defective Jordan eigenvectors — [#926](https://github.com/danielsimonjr/MathTS/issues/926)

`eig` / `eigs` on `[[2,1,0],[0,2,0],[0,0,3]]` list two λ=2 eigenvectors with ‖(A−2I)v₂−v₁‖∞ ≈ 1. NumPy does not supply a proper generalized eigenpair either on this block; MathTS should not present both columns as independent.

### 2. P1 — sparse solve crashes — [#927](https://github.com/danielsimonjr/MathTS/issues/927)

`SparseMatrix.fromCOO` + `linsolve` → `Cannot read properties of undefined (reading 'length')`; `lsolve` → `m.size is not a function`; `luSolve(lu(S),b)` rejects type. Dense same pattern is exact.

### 3. P2 — no `lstsq` export — [#928](https://github.com/danielsimonjr/MathTS/issues/928)

Rectangular `lsolve` throws square-only message; `pinv` path matches NumPy to 1e-14 but is undiscoverable.

## Bench (median ms)

See `docs/persona-sessions/bench/2026-11-12-numerical-analyst-r2.json`. Headline vs round-1 published builds on this hardware class:

- **GEMM** flipped: MathTS **wins** vs ml-matrix at 200–1000 (e.g. n=1000 **524** vs **991** ms).
- **Solve**: `lusolve` much faster than 0.84.0 but still ~1.3× ml-matrix at n=1000; `linsolve` path slower than `lusolve` at n=500+.
- **SVD**: n=500 **1.50×** ml-matrix (regression vs #699 target).
- **sin 1e6**: `sin(Float64Array)` **14.8 ms** vs JS loop **12.2 ms** (~1.21×).

## Verdict

Round-1 **P0** landmines (`lusolve` on singular, scalar `fsolve`, silent `solve(A,b)`) are **fixed** on npm. Implicit ODEs, quadrature, dense SPD/Hilbert solves, and complex arithmetic remain credible vs SciPy/NumPy at 1e-6–1e-14 on well-scaled problems. I would still block production sparse pipelines and defective-eigen analyses until [#927](https://github.com/danielsimonjr/MathTS/issues/927) / [#926](https://github.com/danielsimonjr/MathTS/issues/926) are addressed; use `linsolve` or `luSolve(lu(A),b)` for dense square systems, `pinv` for least squares until `lstsq` exists, and **Radau/BDF** for stiff IVPs. Strict TS consumers need a GPU-types story ([#890](https://github.com/danielsimonjr/MathTS/issues/890)).

## Issue index (round 2)

| #                                                          | Title                                       | Severity | Intended labels                             |
| ---------------------------------------------------------- | ------------------------------------------- | -------- | ------------------------------------------- |
| [#926](https://github.com/danielsimonjr/MathTS/issues/926) | eig/eigs false eigenvectors on Jordan block | P1       | dogfood, bug, P1, persona:numerical-analyst |
| [#927](https://github.com/danielsimonjr/MathTS/issues/927) | linsolve/lsolve crash on SparseMatrix       | P1       | dogfood, bug, P1, persona:numerical-analyst |
| [#928](https://github.com/danielsimonjr/MathTS/issues/928) | No lstsq; rectangular lsolve unhelpful      | P2       | dogfood, api, P2, persona:numerical-analyst |
