# Numerical analyst — published-package dogfood, 2026-11-11

I am using MathTS the way I use NumPy/SciPy and mathjs: dense factorizations, ill-conditioned Hilbert systems, least squares, stiff ODEs, roots, quadrature, and complex arithmetic. I installed **published** packages into `/tmp/mathts-na` (plain ESM) and `/tmp/mathts-na-ts` (strict NodeNext). I did not build or pack the clone. Clone SHA at session start: `f970c4bee077ea00afc31ae290ce8ac3c8a174e9`.

- Node `v22.23.4`, Linux 6.12.113 x86_64, Intel Xeon 4-core (KVM)
- `@danielsimonjr/mathts-matrix@0.10.0`, `functions@0.84.0`, `linalg@0.2.5`, `core@0.26.0`
- Oracles: closed forms, Hairer Robertson values, `mathjs@15.2.0`, `ml-matrix@6.15.1`
- Intended labels on every issue: `dogfood` + `bug|api|perf|docs|packaging` + `P0|P1|P2` + `persona:numerical-analyst`. Creating those labels returned **HTTP 403** (`Resource not accessible by integration`); issues **#688–#701** opened unlabeled. Do not treat missing labels as “not a dogfood finding.”

I did not fix product code this round.

## What I tried, in order

1. Listed public exports of `mathts-linalg` / `matrix` / `functions`. `linalg` actually exports `luSolve`, `qrPivoted`, `lq`, `ql`, `rq`, `condest` even though its README says those stay on `matrix`.
2. Closed-form 2×2 `det` / `inv` / `lusolve` / `linsolve` vs `[[1],[2]]`. Bit-exact vs the inverse `[[-1/2, 1/2],[1, -2/3]]` and vs mathjs `lusolve`.
3. SPD tridiagonal `[[2,-1,0],[-1,2,-1],[0,-1,2]] x = [1,0,1]` → `[1,1,1]` (max abs `1.11e-16`) through `linsolve` and `lu`+`luSolve`. `cholesky` matched the textbook `L`.
4. `inv` of `[[1,2,3],[0,1,4],[5,6,0]]` (det exactly 1): `A A⁻¹` off-diagonal junk at `1.4e-14`.
5. Symmetric eig `[[2,-1],[-1,2]]` → `{1,3}` exact; rotation `[[0,-1],[1,0]]` → `±i` with a real/imag split in `vectors` / `vectorsIm`.
6. SVD 3×3 vs ml-matrix singular values (max abs `7.1e-15`). Reconstruction is `U diag(S) V` with **V’s columns** (max abs `3.6e-15`), not `V[k][j]`.
7. Hilbert n=5,8,10,12: `inv` vs `invHilbertMatrix`, `cond` / `condest`, `linsolve` residual.
8. Singular `[[1,2],[2,4]]`, NaN/Inf `lusolve`, `pinv`, `cond === Infinity`.
9. Least squares `A = [[1,1],[1,2],[1,3]]`, `b=[1,2,2]` vs `[2/3, 1/2]`.
10. `solveODE` exponential decay, harmonic oscillator, Robertson (BDF/Rosenbrock/RODAS/Radau/RK45), `stiffODESolver`, Van der Pol `μ=1000`.
11. `fsolve` / `findRoot` / `nelderMead` / `minimize` / `minimizeScalar`.
12. `quad`, `nintegrate`, symbolic `integrate('sin(x)','x')`.
13. Complex add/mul/`sqrt(-1)` / `exp(iπ)`.
14. Shape errors, `sin(number[])`, packed `Float64Array` `lusolve`, CAS `solve`.
15. Timed matmul/solve/SVD (200/500/1000), 1e6 `sin`, ODE steps. Warmup + repeats vs mathjs and ml-matrix.
16. Strict `tsc` consumer.

## Accuracy that is fine

| Check | Max abs (rel) | Oracle |
| ----- | ------------- | ------ |
| 2×2 det, lusolve, inv | 0 | closed form |
| 3×3 det | 0 | expansion = 1 |
| SPD 3×3 solve | 1.11e-16 | `[1,1,1]` |
| lstsq | 2.22e-15 (3.3e-15) | normal equations `[2/3, 1/2]` |
| `findRoot` √2 on `[1,2]` | 0 | `Math.SQRT2` |
| `quad` ∫₀¹ e^{-x²} | 2.44e-15 | 0.7468241328124271 |
| `nintegrate` ∫₀^π sin | 5.77e-15 | 2 |
| `exp(-1)` RK45 | rel 4.13e-13 | `e⁻¹` |
| harmonic at `t=2π` | abs 1.57e-12 | `[1,0]` |
| Robertson Radau t=40 | **8.07e-11** | Hairer `[0.7158270684, 9.185534764e-6, 0.2841637460]` |
| Robertson mass | ≤ 9e-16 | `y1+y2+y3=1` |
| SVD S vs ml-matrix | 7.1e-15 | ml-matrix 6.15.1 |
| Hilbert-10 `linsolve` residual | 4.37e-11 | `Ax-b` |
| `nelderMead` Rosenbrock | `fx=1.4e-16` | `[1,1]` |
| `(1+2i)(3+4i)` | 0 | `-5+10i` |
| `exp(iπ)` | 1.22e-16 imag | `-1` |

Hilbert-12 inverse vs exact integers is **8.1% relative** with `cond₂ ≈ 1.8e16`; that is f64, not a MathTS-only failure. Residuals of the solve stay `~5e-9`. `condest` is ~2× `cond` (1-norm estimator vs 2-norm) — I did not file that.

Van der Pol `μ=1000`, `y0=[2,0]`, BDF to `t=1`: `y ≈ [1.999333, -6.670e-4]`, which is the slow-manifold `z ≈ y/(μ(1-y²))`. RK45 to `t=0.1` also sat on that manifold. I did not run SciPy in this environment.

Shape errors are generally usable: `Cannot multiply 2×2 matrix with 3×1 matrix`, `linsolve: matrix must be square`, `Dimension mismatch (2 != 3) in element-wise operation`, `multiply(Array, Array) requires two 2-D matrices; use dot()`.

## Findings

### 1. P0 — `lusolve` lies on a consistent singular system — [#688](https://github.com/danielsimonjr/MathTS/issues/688)

`lusolve([[1,2],[2,4]], [1,2])` → `[[1],[0]]` with no warning. `linsolve` throws `linsolve: singular matrix`. Inconsistent RHS throws. NaN/Inf coefficients return `[[0],[1]]`. NumPy raises `LinAlgError`. reproduces on master: **yes**.

### 2. P0 — `fsolve` TypeError on a scalar residual — [#689](https://github.com/danielsimonjr/MathTS/issues/689)

`fsolve(x => x*x-2, 1)` → `TypeError: v is not iterable` in `maxNorm`. Vector form works (√2 to 1.6e-12). `findRoot` is bit-exact. reproduces on master: **yes**.

### 3. P1 — `solve` is CAS and returns `[]` for `A x = b` — [#690](https://github.com/danielsimonjr/MathTS/issues/690)

`solve('x^2-2','x')` is correct. `solve([[4,3],[6,3]],[10,12])` is `[]`. I wanted `numpy.linalg.solve`. Use `linsolve`.

### 4. P1 — `stiffODESolver(f, y0, tspan)` vs `solveODE(f, tspan, y0)` — [#691](https://github.com/danielsimonjr/MathTS/issues/691)

Swapped args: `Maximum number of iterations reached, try changing options`. Correct order on Robertson: max abs vs Hairer ~6e-8, 369 steps. reproduces on master: **yes**.

### 5. P1 — `sin(number[])` rejected — [#692](https://github.com/danielsimonjr/MathTS/issues/692)

Only `Float64Array` (and scalars). typed-function lists Dual/string/boolean. `sin(Float64Array(1e6))` median **6.53 ms** vs a `Math.sin` loop **3.85 ms** (1.70×). mathjs 15 also refuses arrays unless `map`.

### 6. P1 — GEMM slower than ml-matrix — [#693](https://github.com/danielsimonjr/MathTS/issues/693)

See bench table. n=1000 `DenseMatrix.multiply` **1155 ms** vs ml-matrix **642 ms** (1.80×). Nested `matMul` 1601 ms. mathjs 7415 ms.

### 7. P1 — `lusolve` slower than matrix `lu` — [#694](https://github.com/danielsimonjr/MathTS/issues/694)

n=1000: `lusolve` 845 ms, `linsolve` 633 ms, `lu`+`luSolve` 390 ms, ml-matrix 277 ms, mathjs 4537 ms.

### 8. P2 — linalg README vs barrel — [#695](https://github.com/danielsimonjr/MathTS/issues/695)

README: extras intentionally not re-exported. `0.2.5` and master `linalg/src/index.ts` export them. reproduces on master: **yes**.

### 9. P2 — `./package.json` not exported — [#696](https://github.com/danielsimonjr/MathTS/issues/696)

`createRequire(...)(pkg+'/package.json')` → `ERR_PACKAGE_PATH_NOT_EXPORTED`.

### 10. P2 — workerpool `.d.ts` needs `@types/node` — [#697](https://github.com/danielsimonjr/MathTS/issues/697)

`skipLibCheck: false` NodeNext consumer of `functions` dies in `workerpool/types/Pool.d.ts` (`child_process`, `worker_threads`, `NodeJS`).

### 11. P1 — RK45 on Robertson, generic maxIter — [#698](https://github.com/danielsimonjr/MathTS/issues/698)

Same sentence as the swapped `stiffODESolver` call. Implicit methods work; Radau is the accuracy winner.

### 12. P2 — SVD n=500 1.10× ml-matrix — [#699](https://github.com/danielsimonjr/MathTS/issues/699)

n=200 is a tie (~65 ms). n=1000 not timed.

### 13. P2 — `det(number[][])` typed as `number | BigNumber | Complex` — [#700](https://github.com/danielsimonjr/MathTS/issues/700)

Runtime is a JS number.

### 14. P2 — `lusolve` rejects packed `Float64Array` — [#701](https://github.com/danielsimonjr/MathTS/issues/701)

`DenseMatrix` accepts the buffer; `lusolve` does not.

## Bench (median ms)

| op | n | MathTS | mathjs | ml-matrix |
| -- | - | ------ | ------ | --------- |
| DenseMatrix.multiply / multiply / mmul | 200 | 9.46 | 25.1 | **6.94** |
| | 500 | 147.5 | 542 | **104.3** |
| | 1000 | 1155 | 7415 | **642** |
| lusolve / lusolve / solve | 200 | 7.68 | 38.5 | **3.47** |
| | 500 | 95.8 | 581 | **36.4** |
| | 1000 | 845 | 4537 | **277** |
| lu+luSolve (matrix) | 1000 | 390 | — | — |
| svd | 200 | 65.4 | — | 65.2 |
| svd | 500 | 1045 | — | **953** |
| sin 1e6 | — | 6.53 (f64) | 65.8 (`map`) | — (JS loop 3.85) |
| Robertson BDF t=40 | — | 1.56 | — | — |
| Robertson Radau | — | 1.90 | — | — |
| VdP μ=1000 BDF t=1 | — | 0.71 | — | — |

JSON: `docs/persona-sessions/bench/2026-11-11-numerical-analyst.json`.

## Verdict

For **well-scaled dense algebra, quadrature, complex arithmetic, and stiff IVPs with `method: 'Radau'|'BDF'|'Rosenbrock'`**, published MathTS matches closed forms / Hairer to 1e-10–1e-16 and beats mathjs on GEMM/solve by several times. I would **not** drop it in as a NumPy substitute yet: `lusolve` can return a particular solution on a singular matrix, `solve` is a CAS no-op on matrices, `fsolve` crashes on scalars, `stiffODESolver` argument order is reversed, public GEMM/solve trail `ml-matrix`, and dtype/`number[]` handling is inconsistent. Prefer `linsolve` or `lu`+`luSolve`, `findRoot` for 1-D, `solveODE` with an implicit method, and `Float64Array` for elementwise.

## Issue index

| # | Title | Severity | Intended labels |
| - | ----- | -------- | ---------------- |
| [688](https://github.com/danielsimonjr/MathTS/issues/688) | lusolve silent particular solution on consistent singular / NaN / Inf | P0 | dogfood, bug, P0, persona:numerical-analyst |
| [689](https://github.com/danielsimonjr/MathTS/issues/689) | fsolve TypeError v is not iterable | P0 | dogfood, bug, P0, persona:numerical-analyst |
| [690](https://github.com/danielsimonjr/MathTS/issues/690) | solve() CAS returns [] for Ax=b | P1 | dogfood, api, P1, persona:numerical-analyst |
| [691](https://github.com/danielsimonjr/MathTS/issues/691) | stiffODESolver arg order vs solveODE | P1 | dogfood, api, P1, persona:numerical-analyst |
| [692](https://github.com/danielsimonjr/MathTS/issues/692) | sin rejects number[] | P1 | dogfood, api, P1, persona:numerical-analyst |
| [693](https://github.com/danielsimonjr/MathTS/issues/693) | DenseMatrix.multiply 1.8× vs ml-matrix n=1000 | P1 | dogfood, perf, P1, persona:numerical-analyst |
| [694](https://github.com/danielsimonjr/MathTS/issues/694) | lusolve 2.2× vs matrix lu+luSolve n=1000 | P1 | dogfood, perf, P1, persona:numerical-analyst |
| [695](https://github.com/danielsimonjr/MathTS/issues/695) | linalg README export list wrong | P2 | dogfood, docs, P2, persona:numerical-analyst |
| [696](https://github.com/danielsimonjr/MathTS/issues/696) | package.json not in exports | P2 | dogfood, packaging, P2, persona:numerical-analyst |
| [697](https://github.com/danielsimonjr/MathTS/issues/697) | workerpool types need @types/node | P2 | dogfood, packaging, P2, persona:numerical-analyst |
| [698](https://github.com/danielsimonjr/MathTS/issues/698) | RK45 stiff maxIter message | P1 | dogfood, api, P1, persona:numerical-analyst |
| [699](https://github.com/danielsimonjr/MathTS/issues/699) | svd n=500 1.10× ml-matrix | P2 | dogfood, perf, P2, persona:numerical-analyst |
| [700](https://github.com/danielsimonjr/MathTS/issues/700) | det() union return type | P2 | dogfood, api, P2, persona:numerical-analyst |
| [701](https://github.com/danielsimonjr/MathTS/issues/701) | lusolve rejects Float64Array | P2 | dogfood, api, P2, persona:numerical-analyst |
