> **In-repo archive** of the mathcad deep parity review, produced on 2026-11-25
> (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713),
> tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Sibling reviews and the merged report live in this folder; pass 1 is
> [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Imported data: [inventory](data/mathcad-inventory.csv), [mapping](data/mathcad-mapping.csv).
> Runtime harnesses, scripts, scratch, and vendored clones from the original
> working copy were not imported. Local paths have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# MathTS vs PTC Mathcad Prime: deep parity review

## Sources of truth (closed-system review)

This is a feature-coverage review of a closed-source system. MathTS
cannot run the closed system to check results. For correctness of
numeric and symbolic output, the sources of truth are **NumPy**,
**SciPy**, **SymPy**, and **PySR**. The closed system is a **feature
reference only**: it informs API shape and feature coverage, and it is
never used to verify numeric or symbolic output.

Where this report treats the closed system's documented or observed
behavior as expected output — including GNU Octave, mpmath, SymPy, or
other stand-in values used in its place — that expectation is
**unverified** as a closed-system result. A numeric or symbolic claim
is verified for MathTS only when it has been confirmed against NumPy,
SciPy, SymPy, or PySR.

Generated Wed Nov 25, 2026 (America/Chicago). Read-only toward GitHub: no issues, PRs, pushes or comments. The shared mathjs-parity working copy used by the parallel mathjs review was not touched.

## 1. Versions and sources

- **Reference:** PTC Mathcad Prime 12.0.1.0, official online help at https://support.ptc.com/help/mathcad/r12.0/en/ (the r13.0 URL redirects, so 12 is the latest). I downloaded the full help TOC (`refs/toc12.html`, 1316 entries) and all 942 linked pages (`refs/ptc12/*.html`). Function signatures were parsed from the per-function pages (`scripts/extract_funcs.py` → `refs/functions12.json`, 610 functions). Operators, units, solve blocks, symbolic keywords, ranges/vectorize, formatting, constants and worksheet features were added by hand from the matching help pages, with URLs (`scripts/features.py`, 113 rows). `pdesolve` was added by hand.
- **MathTS:** my own clone at `deep/mathcad/mathts`, SHA `e09eb301570bbd18fbade0cdb4984a73bffafb54` (cloned 2026-11-25 07:41 CT). `bun install --frozen-lockfile && bun run build` succeeded (24 tasks, `build.log`). Runtime API is `functions/dist` (`F`) and `compat/dist` (`m = create(all)`, the mathjs-compatible layer). There are 2662 top-level runtime export names (`scripts/mathts-names.json`).
- **Open references used for differential checks** (venv at `deep/mathcad/venv`): NumPy 2.5.5, SciPy 1.18.1, SymPy 1.14.0, mpmath, Pint 0.26.2. Mathcad itself was **not** run (no licence on the box). Mathcad conventions were taken from the PTC help text, and every row that depends on one says so.

## 2. Method

1. **Inventory** ([`inventory.csv`](data/mathcad-inventory.csv), 724 rows): 610 built-in functions from the Prime 12 help, plus 113 feature rows (610 + 113 + pdesolve = 724) (operators, units, solve blocks, symbolics, ranges, formatting, constants, programming, worksheet, plots, function analysis). Each row has its PTC URL.
2. **Mapping** ([`mapping.csv`](data/mathcad-mapping.csv)): I mapped each row by hand (`scripts/map_functions.py`, `scripts/map_features.py`), then `scripts/build_mapping.py` checked it mechanically:
   - Every identifier given as a MathTS location must exist among the runtime exports, and a definition grep must find it in source. This check produced 0 unresolved problems.
   - Every **missing** claim was checked two ways: (a) a case-insensitive runtime export-name search for the Mathcad name and for any alternative names; (b) a source grep over non-test `.ts` files, both for definitions (`function|const|let|class NAME`) and for free text. The evidence is in the notes column. Definition hits were reviewed by hand. All of them were local variables or private helpers in unrelated code, such as `sortRows` in sparse-product.ts or a `lookup` closure in the workbook CLI.
   - `verified` = `runtime` when at least one runtime check exercised the row, `export+grep` when the runtime export and source definition were confirmed, and `name-only` otherwise.
3. **Runtime differential checks** (`verify/`): `mt_run.mjs` (general, 378 labelled calls), `units_run.mjs` (unit propagation, 80 calls) and `compare.py` + `compare_extra.py` (SciPy/NumPy/mpmath/SymPy/Pint references and verdicts) → `results.csv` (450 checks) and `results.md`. The tolerances are listed in `verify/results.md`. All bug repros are in `verify/bug_repros.mjs`, with output in `bug_repros.out`.

## 3. Counts

| Priority | full | partial | missing | n/a | total |
| -------- | ---- | ------- | ------- | --- | ----- |
| P0       | 88   | 41      | 2       | 0   | 131   |
| P1       | 143  | 56      | 13      | 0   | 212   |
| P2       | 65   | 101     | 182     | 33  | 381   |
| all      | 296  | 198     | 197     | 33  | 724   |

| Area                                | rows | full | partial | missing | n/a | runtime-checked |
| ----------------------------------- | ---- | ---- | ------- | ------- | --- | --------------- |
| Image Processing                    | 74   | 2    | 2       | 70      | 0   | 2               |
| Probability Distributions           | 70   | 64   | 3       | 3       | 0   | 65              |
| Data Analysis                       | 62   | 10   | 38      | 14      | 0   | 40              |
| Signal Processing                   | 60   | 26   | 18      | 16      | 0   | 21              |
| Vector and Matrix                   | 54   | 35   | 9       | 10      | 0   | 43              |
| Special Functions                   | 40   | 28   | 6       | 6       | 0   | 40              |
| Operators                           | 36   | 18   | 15      | 2       | 1   | 14              |
| Reading and Writing Files           | 33   | 0    | 0       | 2       | 31  | 0               |
| Utility Functions                   | 33   | 15   | 18      | 0       | 0   | 16              |
| Trigonometric, Log, and Exponential | 31   | 28   | 2       | 1       | 0   | 30              |
| Symbolics                           | 29   | 5    | 14      | 10      | 0   | 23              |
| Statistics                          | 27   | 17   | 6       | 4       | 0   | 23              |
| Solving and Optimization            | 26   | 3    | 17      | 6       | 0   | 18              |
| Design of Experiments               | 24   | 1    | 6       | 17      | 0   | 1               |
| Symbolic Functions                  | 24   | 19   | 4       | 1       | 0   | 20              |
| Finance                             | 18   | 0    | 0       | 18      | 0   | 0               |
| Units                               | 17   | 6    | 5       | 6       | 0   | 13              |
| Solve Blocks                        | 12   | 0    | 10      | 2       | 0   | 5               |
| Function Analysis                   | 9    | 0    | 7       | 2       | 0   | 0               |
| Graphing                            | 8    | 0    | 8       | 0       | 0   | 0               |
| Transforms and Filters              | 8    | 6    | 1       | 1       | 0   | 6               |
| Miscellaneous Functions             | 6    | 2    | 0       | 4       | 0   | 4               |
| Number Theory/Combinatorics         | 5    | 4    | 1       | 0       | 0   | 5               |
| Formatting                          | 5    | 3    | 2       | 0       | 0   | 4               |
| Ranges and Arrays                   | 4    | 1    | 2       | 1       | 0   | 0               |
| Constants                           | 3    | 2    | 1       | 0       | 0   | 0               |
| Worksheet                           | 3    | 1    | 1       | 1       | 0   | 0               |
| Programming                         | 2    | 0    | 1       | 0       | 1   | 0               |
| Plots                               | 1    | 0    | 1       | 0       | 0   | 0               |

Verification: runtime 393 (54.3%), export+grep 271, name-only 60 (33 of these are out-of-scope file I/O rows).

Runtime check outcomes (450 checks): PASS 376, ERROR 35, MISSING 12 (function absent at runtime), FORM 11 (correct but not simplified or closed form), FAIL 9, UNPARSED 4, other 3. By group: distributions 65/65 PASS, signal 30/30, formatting 7/7, special functions 56/62, linear algebra 36/42, statistics 28/29, solvers 22/25, data analysis 16/20, elementary 34/35, units 52/76 PASS (the 20 ERROR + 2 FAIL are the unit-propagation gaps below), symbolics 30/59 PASS.

Full + partial rows runtime-checked: 362 of 494 (73%). All rows: 393 of 724 (54.3%).

## 4. Bugs found (all reproduced at e09eb30; repros in `verify/bug_repros.mjs`)

| id    | repro                                                                                                                                                                      | got                                                                                     | expected                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | `F.fullSimplify('2.1*x')` / `('3.0*x+1')` / `('y + 2.0*x')`                                                                                                                | `2.x` / `4` / `y + 2.0`                                                                 | value preserved. Cause: regexes `/\b1\s*\*\s*/` and `/\b0\s*\*\s*[^+-]*/` in `functions/src/typed/algebra.ts` fullSimplify (~L1810, L1824) match the digit after a decimal point |
| B2    | `F.collect('x*y+x^2+3*x*y','x')`; `F.collect('a*x^2+b*x^2+x','x')`                                                                                                         | `x^2 + 4*x`; `2*x^2 + x`                                                                | `x^2 + 4*x*y`; `(a+b)*x^2 + x` (algebra.ts L1308: regex coefficient parse drops symbolic factors)                                                                                |
| B3    | `F.series('1/sin(x)','x',0,4)`                                                                                                                                             | `0.1666666667*x + 0.01944444444*x^3`                                                    | `1/x + x/6 + 7x^3/360`: the pole term is silently dropped                                                                                                                        |
| B4    | `F.linearInterp([U('0 s'),U('1 s')],[U('0 m'),U('2 m')],U('0.5 s'))`; `F.cubicSpline(units)(U('0.5 s'))`; `F.romberg(f,U('0 s'),U('2 s'))`; `F.curvefit` with a Unit guess | `"0 mNaN"`; `"0 mNaNNaNNaN"`; `Cannot convert "0 sNaN"`; `Cannot convert "1 m / s1e-7"` | 1 m; 1.1875 m; 6 m, or a clean "units not supported" error. Unit objects are string-concatenated                                                                                 |
| B5    | `F.quad(f,U('0 s'),U('2 s'))`, `F.nintegrate(...)`; `F.findRoot(f,U('0 s'),U('5 s'))`                                                                                      | `infinite limits are not supported`; `Unit value must be finite`                        | 6 m; 1.428 s, or an accurate error                                                                                                                                               |
| B6    | `m.evaluate('norm([3 m, 4 m])')`; `m.lusolve([[2,1],[1,3]],[[5 N],[10 N]])`                                                                                                | `Too few arguments in function add`; `equalScalar` type error                           | `5 m`; `[1 N, 3 N]` (the lusolve failure is shared with mathjs)                                                                                                                  |
| B7    | `m.evaluate('sin(2 m)')`; `m.evaluate('log(5 m)')`                                                                                                                         | `Unit in function cot is no angle`; `Too few arguments in function log`                 | a dimension error naming sin / log                                                                                                                                               |
| B8    | `F.pchip([0,1,2,3,4,5],[1,2.7,7.4,20.1,54.6,148.4],0.5)`                                                                                                                   | 1.750390625                                                                             | 1.562890625 (SciPy PCHIP; `F.pchipInterp` is correct). Wrong end-slope formula                                                                                                   |
| B9    | `F.coefficientList('3*x^2+2*x+1','x')`; `F.combine('log(a)+log(b)')`                                                                                                       | a character array; a crash (`reading 'trim'`)                                           | a type error or [1,2,3]; `combine` is string concatenation, not symbolic combine                                                                                                 |
| B10   | `F.zTransform('n^2','n','z')`                                                                                                                                              | the placeholder string `Z{n^2}(z)`                                                      | `z(z+1)/(z-1)^3` or an error                                                                                                                                                     |
| B11   | `F.assume('x','positive'); F.simplify('sqrt(x^2)')`                                                                                                                        | `sqrt(x ^ 2)`                                                                           | `x` (the assumption is stored but ignored)                                                                                                                                       |
| B12   | `F.limit('(1+1/x)^x','x',Infinity)`                                                                                                                                        | 2.7182817983                                                                            | e (                                                                                                                                                                              | Δ   | = 3e-8, from numeric extrapolation) |
| minor | `F.minimizeConstrained` on an infeasible problem                                                                                                                           | NaN x with `converged:false`                                                            | a clear infeasibility status                                                                                                                                                     |

Convention differences, documented in the PTC help (not bugs, but they need compat wrappers):

- `mod`: MathTS uses the sign of the divisor (`mod(-5,3)=1`). Mathcad returns the sign of x (-2).
- `sinc`: MathTS is normalized. Mathcad uses sin(x)/x.
- `atan2`: Mathcad's argument order is (x, y).
- `Γ(a,x)`: Mathcad's is the upper unregularized incomplete gamma. MathTS `gammainc` is regularized lower.
- `expfit`/`pwrfit`/`logfit`: Mathcad fits 3-parameter models with Levenberg-Marquardt. MathTS fits 2-parameter log-linearised forms, which match the NumPy log-linear references.
- `skew`/`kurt`: Mathcad uses the adjusted estimators, which MathTS gives with `{bias:false}` (verified).
- `dgeom`: MathTS counts trials. Mathcad counts failures.
- `gammaDist`: MathTS takes (shape, rate).
- `hypergeometricDist`: MathTS takes (N, K, n), not Mathcad's (m, a, b, n).

## 5. Top gaps, ranked (P0 first, then by everyday impact)

1. **Units through numeric routines (P0).** Mathcad carries units through solvers, integrals, derivatives, ODEs, fits, interpolation and matrices. In MathTS, units propagate through arithmetic, det/inv/dot/cross, stats, fft, toBest/splitUnit/createUnit/toSI, conversions, fractional powers, and explicit-RK `solveODE` (scalar and 2-D system checked against analytic solutions). They fail (ERROR or garbage) in quad, nintegrate, romberg, trapz, derivativeAt, findRoot, fsolve, minimize, curvefit, polyfit/linregress, linearInterp, cubicSpline, BDF/stiff solveODE, lusolve, norm, mod, floor and round.
2. **Solve blocks (P0).** There is no Given/Find/Minerr/Minimize/Maximize/Odesolve construct: no guess-values-plus-constraints DSL, no inequality constraints in Find, no solve block as a reusable function, and no global TOL/CTOL. The function-level solvers exist: fsolve, levenbergMarquardt, minimizeConstrained, linprog/quadprog, solveODE/solveBVP/solveParabolicPDE.
3. **Symbolic simplify (P0).** It does not cancel `(x^2-1)/(x-1)` or reduce `sin²+cos²` to 1. Assumptions are ignored, `together` is a no-op, `apart` fails on repeated factors, and fullSimplify corrupts decimals (B1).
4. **Symbolic solve (P0).** The cubic returns floats, not radicals. There are no systems (`x+y=3` throws) and no inequalities.
5. **Series (P0).** Coefficients are floats, not exact rationals. There is no Laurent/Puiseux expansion, and pole terms are dropped silently (B3).
6. **Numeric integration and derivative operators (P0).** `quad`/`nintegrate`/`integrate` reject infinite limits; only gaussLaguerre/tanhSinh variants exist. There is no Ridders-style any-order numeric derivative of a black-box closure (derivativeAt needs Dual-aware code).
7. **polyroots of any degree (P0).** `polynomialRoot` throws above degree 3. The companion matrix plus eigs works but has no single wrapper or LaGuerre option.
8. **Range variables and vectorize (P0).** The expression language has no implicit range iteration or tabulation, and `sin([1,2])` throws in compat (you have to use map). There is no ORIGIN.
9. **Interpolation (P0).** pchip has a bug (B8). cspline/pspline/lspline end conditions are missing (natural only), there are no 2-D splines (Bicubic2D exists via interpn only), and Units aren't supported.
10. **Rounding family with a step (P0).** `Ceil/Floor/Round/Trunc(x, y)` and Unit-aware rounding are missing (`floor(5.7 m)` throws), and `mod` follows a different sign convention.
11. **Symbolic transforms (P1).** There is no symbolic Fourier/invFourier and no inverse z-transform. The laplace table lacks sinh, and ztrans returns a placeholder (B10).
12. **Symbolic calculus extras (P1).** dsolve fails, there are no closed-form sums with symbolic bounds, no erf in antiderivatives, and no symbolic det/inverse. `coeffs` and `combine` are missing, and rewrite/complexExpand/trigReduce are stubs.
13. **Regression family (P1).** Mathcad's 3-parameter LM models (expfit, pwrfit, logfit, lgsfit, sinfit, medfit, rationalfit) are missing, as are confidence intervals and covariance (`confidence`, `polyfitstat`), linfit with a basis-function vector, and multivariate polyfit.
14. **Array utilities (P1).** csort, rsort, order (argsort), reverse, lookup/vlookup/hlookup/match, linspace/logspace/logpts and `cond(A, p)` are missing.
15. **Special and step functions (P1/P2).** Heaviside Φ, Kronecker δ, Levi-Civita ε, symbolic Dirac Δ, chebyshevU, Airy derivatives and complex erf/erfc are missing. Adams/AdamsBDF multistep with auto-stiffness is also missing.

P2 bulk gaps: image processing (70 of 74 rows missing), design of experiments (17 of 24 missing), finance (18 of 18 missing), signal extras (cepstrum, dht, burg/yulew, music, multirate, snr, whiten, walsh, quantize, Bessel IIR), the geometric CDF/quantile/sampler, Grubbs and box/QQ plot data, function analysis (isContinuous, discontPoints), DMS/hhmmss/time/ln0, money units, the slug unit, CGS/USCS display systems, and READCSV/WRITECSV.

## 6. Where MathTS is ahead of Mathcad Prime

All of these were checked by runtime export, and some also by runtime differential checks:

- **Stiff and specialised ODEs.** Radau and BDF were runtime-verified on stiff problems. The 'Rosenbrock' solveODE method (source grep), `solveDAE` and `solveDDE` (export check) also exist. Mathcad has Stiffb/Stiffr/Radau/BDF. A grep of the Prime 12 TOC and function list finds no delay-differential solver.
- **Dimensional analysis on expressions:** `inferScalarDimension` and `solveParameterDimensions` (export check). These are symbolic dimension inference and solving, which Mathcad has no function for.
- **Automatic differentiation:** autograd `grad`/`jacobian`/`hessian` and Dual numbers. Exact derivatives of user code (jacobian and hessian were runtime-verified).
- **Distributions:** a broad object API (pdf/cdf/quantile/mean/variance/sample) for more families than Mathcad. All 65 distribution checks pass.
- **Signal:** stft/istft, spectrogram, wavelet dwt/wavedec, chirpZTransform, coherence and csd all runtime-verified. Mathcad has no coherence API beyond cspectrum.
- **Statistics:** permutationTest, bootstrapCI, mannWhitneyTest, wilcoxon and kruskalWallis (export check).
- **Linear algebra:** iterative sparse solvers (gmres, bicgstab) and matrix functions (expm, logm, sqrtm). Export check only.
- **Notebook runtime:** `workbook` gives dependency-ordered `.mtsw` cells with HTML, TeX and ipynb export and a JSON-RPC server. It is a headless, scriptable counterpart to the Mathcad worksheet. Existence was checked; the runtime differential was not.
- **Special functions:** lambertW, polylog, hurwitzZeta and others beyond the Mathcad set. Export check only.

## 7. Proposed build batches

Each batch is sized for one cloud-agent PR and grouped by root cause. Batches are in dependency order within each priority tier.

| #   | Pri   | Batch (root cause)                                                                                                                                                                       | Functions / items                                                                                                                                                                                                                                                                                                                                                   | Depends on |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | P0    | Correctness fixes in existing CAS and interpolation                                                                                                                                      | fullSimplify decimal regex (B1); collect multivariate (B2); series errors on poles (B3, until batch 6); pchip end slopes (B8); coefficientList/combine input validation (B9); zTransform placeholder → error (B10); unit error messages for sin/log (B7)                                                                                                            | none       |
| 2   | P0    | Unit adapter for scalar numeric calculus: one shared helper that strips Units to SI magnitudes, runs the solver, and re-attaches output units (integrand unit × variable unit and so on) | quad, nintegrate, integrate, romberg, simpson, tanhSinh, trapz, cumtrapz, derivativeAt, findRoot, brent/bisection/secant/newton, fsolve, minimizeScalar, minimize, minimizeConstrained                                                                                                                                                                              | none       |
| 3   | P0    | Units in data/matrix routines (reuses the batch 2 helper)                                                                                                                                | linearInterp, cubicSpline, pchip/pchipInterp, interp1, curvefit, levenbergMarquardt, polyfit, linregress, lusolve/lsolve (Unit RHS), norm (Unit vectors), solveODE BDF/Radau with Unit tspan, mod/floor/ceil/round/fix on Units                                                                                                                                     | 2          |
| 4   | P0    | Calculus operator completeness                                                                                                                                                           | infinite limits in quad/nintegrate/integrate (variable transform); Ridders numeric derivative of any order for closures; polyroots of any degree (companion + LaGuerre option, Mathcad method names); rkfixed fixed-step RK4; Ceil/Floor/Round/Trunc(x, y) step forms; linspace/logspace/logpts                                                                     | none       |
| 5   | P0    | Solve-block API                                                                                                                                                                          | `solveBlock({unknowns, guesses, equalities, inequalities, method:'LM'\|'CG'\|'QN'\|'linear', tol, ctol, multistart})` with find/minerr/minimize/maximize/odesolve front ends; solve block as a reusable function; Unit support                                                                                                                                      | 2, 3       |
| 6   | P0    | CAS simplify core                                                                                                                                                                        | exact rational arithmetic in CAS output; rational-function cancellation (polynomial gcd); together; apart with repeated factors; trig identity rules; assumption-aware simplify (sqrt(x^2), abs, log rules); exact series coefficients plus Laurent                                                                                                                 | 1          |
| 7   | P0/P1 | CAS solve                                                                                                                                                                                | exact radicals for cubic/quartic; linear and polynomial systems (resultants or Groebner for small systems); inequalities in one variable; symbolic det/inverse/eigen for small matrices; coeffs                                                                                                                                                                     | 6          |
| 8   | P1    | CAS transforms and calculus                                                                                                                                                              | symbolic fourier/invfourier; invztrans; laplace table (sinh/cosh/step/delta/shift); erf/Si/Ci in antiderivatives; closed-form symbolic sums (polynomial, geometric); dsolve for linear constant-coefficient ODEs; series-based exact limits; real combine/rewrite/complexExpand/trigReduce                                                                          | 6, 7       |
| 9   | P1    | Mathcad regression family                                                                                                                                                                | expfit/pwrfit/logfit/lnfit 3-parameter LM forms, lgsfit, sinfit, medfit, rationalfit, confidence/polyfitstat (covariance, CIs), linfit with a basis vector, multivariate polyfit, cspline/pspline/lspline end conditions, 2-D splines                                                                                                                               | 3          |
| 10  | P1    | Array and special-function compat                                                                                                                                                        | csort, rsort, order (argsort), reverse, lookup/vlookup/hlookup/match, cond(A,p), Heaviside Φ, Kronecker δ, Levi-Civita ε, Dirac Δ, chebyshevU, Airy derivatives, complex erf/erfc; compat wrappers for Mathcad conventions (mod sign of x, unnormalized sinc, upper Γ(a,x), atan2(x,y), dgeom failures)                                                             | none       |
| 11  | P1    | Language: ranges, vectorize and units config                                                                                                                                             | range-variable iteration and tabulation in the parser/workbook; elementwise vectorize of scalar functions over matrices; ORIGIN; global TOL/CTOL; CGS/USCS display systems; slug and the remaining USCS units; money dimension; Units in plot axes                                                                                                                  | 5          |
| 12  | P1/P2 | ODE and signal extras                                                                                                                                                                    | Adams/AdamsBDF (LSODA-like auto-stiffness), Bulstoer; FIR bandstop and window argument; cepstrum/ccepstrum, dht/idht, burg/yulew, music, multirate/upsample, quantize, snr, whiten/gaussn/onefn, walsh, Bessel IIR; geometric CDF/quantile/sampler                                                                                                                  | none       |
| 13  | P2    | Design of experiments                                                                                                                                                                    | fullfact, fractfact, fractalias, fractresol, fractruns, foldover, plackettburman, boxbehnken, boxwilson, taguchi, mtaguchi, quickscreen, block, randomize, doelabel, effects, effectsgraph                                                                                                                                                                          | none       |
| 14  | P2    | Finance                                                                                                                                                                                  | pv, fv, fvadj, fvc, pmt, ipmt, ppmt, nper, cnper, rate, crate, irr, mirr, npv, eff, nom, cumint, cumprn                                                                                                                                                                                                                                                             | none       |
| 15  | P2    | Image processing A (color, geometry, histograms)                                                                                                                                         | rgb/hls/hsv/yiq/ycbcr/gray conversions (12), horzflip, vertflip, zoom, translate, center, clip, extract, putregion, replace, scale, imhist, imhist2, hist2d, levelmap, invertimage, equalize, blend, mask, subcolor                                                                                                                                                 | none       |
| 16  | P2    | Image processing B (filters, edges, morphology, segmentation)                                                                                                                            | sobel, prewitt, roberts, kirsch, freichen, robinson3/5, canny, rowgrad, colgrad, compgrad, matconv, matdeconv, funconv, funcdeconv, funmap, quantfilt, wiener2d, centsmooth, addnoise, getnoise, dilate, erode, open, close, gray_*, thin, skeleton, binarize, threshold, concomp, reg_grow, distform, shape_features, moment_invariant, wave2d, iwave2d, wavescale | 15         |
| 17  | P2    | Stats, function analysis and misc                                                                                                                                                        | Grubbs, GrubbsClassic, ThreeSigma, boxplot, qqplot, pareto, ksmooth/supsmooth/VSmooth, Thiele/rationalint, predict (linear prediction); isContinuous, discontPoints, local/global extrema finders; DMS, hhmmss, time, ln0; READCSV/WRITECSV                                                                                                                         | 4          |

## 8. What was NOT verified

- Mathcad Prime was never executed. Mathcad's expected behaviour comes from PTC help text and examples only. That covers numeric output formats, the default solver algorithms and tolerances (TOL/CTOL defaults), dft normalization, Hz vs rad/s handling, how degC multiplication is treated, and error behaviour.
- MathTS vs Mathcad **algorithm parity** for solve blocks (LM vs conjugate gradient vs quasi-Newton vs KNITRO results on hard problems) was not tested. Only easy well-conditioned problems were checked.
- The 271 `export+grep` rows were confirmed only by runtime export plus a source definition, not by a value check. That includes most special-function aliases, utility functions, plot functions and several signal or data-analysis functions. The 60 `name-only` rows (33 are n/a file I/O) are mapped by name or reading only.
- These were not runtime-checked: workbook notebook features, plot rendering, symbolic definition operators (`:=`, `≡`), programming constructs, ORIGIN behaviour, GPU/WASM paths, BigNumber precision modes, and the "MathTS ahead" items marked as export check.
- STFT was checked for structure only, not values against SciPy (window and padding conventions differ). `loess` and `logisticRegression` were not compared (no statsmodels reference). The coherence check is an identity test (x vs 2x), not a SciPy comparison.
- Random-generator checks only test means of 20000 draws within 5 standard errors, not full distributional goodness-of-fit.
- Mathcad's image-processing, DoE and finance semantics were inventoried, not studied in depth. Their argument conventions would need reading before implementation.
- The 2-parameter vs 3-parameter regression results and the `mod`/`sinc`/`Γ(a,x)`/`atan2` conventions were checked against PTC documentation, not against Mathcad output.

## 9. Files

- [`inventory.csv`](data/mathcad-inventory.csv) (724 rows), [`mapping.csv`](data/mathcad-mapping.csv) (724 rows), `sha.txt`, `build.log`
- `refs/` (Prime 12 TOC, 942 help pages, `functions12.json`)
- `scripts/` (extract_funcs.py, features.py, build_inventory.py, map_functions.py, map_features.py, build_mapping.py, mathts_names.mjs, has.py)
- `verify/mt_run.mjs`, `verify/units_run.mjs`, `verify/compare.py`, `verify/compare_extra.py`, `verify/results.csv` (450 checks), `verify/results.md`, `verify/bug_repros.mjs`, `verify/bug_repros.out`
