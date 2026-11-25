> **In-repo archive** of the mathematica deep parity review, produced on 2026-11-25
> (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713),
> tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Sibling reviews and the merged report live in this folder; pass 1 is
> [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Imported data: [inventory](data/mathematica-inventory.csv), [mapping](data/mathematica-mapping.csv).
> Runtime harnesses, scripts, scratch, and vendored clones from the original
> working copy were not imported. Local paths have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# MathTS vs Mathematica (Wolfram Language): deep parity review

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

Written 2026-11-25 (America/Chicago). Read-only toward GitHub. Nothing was pushed, filed or commented. The shared mathjs-parity working copy used by the parallel mathjs review was not touched.

## 1. Versions and sources

- **MathTS:** my own clone in `mathts/`, commit **e09eb301570bbd18fbade0cdb4984a73bffafb54** (2026-11-25 7:41 AM CT, "docs: mathjs 15.3.0 parity fix plan (#1590) (#1591)"). Built with `bun install --frozen-lockfile && bun run build` (exit 0). See SHA.txt, clone.log and build.log.
- **Reference:** Mathematica / Wolfram Language. It is closed source and no kernel was available.
  - The inventory comes from **reference.wolfram.com guide pages**: 289 guides crawled BFS from the Language root guide list (`refs/guides/*.html`, `refs/crawl_meta.json`).
  - Per-symbol descriptions are the `<meta description>` of each `reference.wolfram.com/language/ref/<Symbol>.html`, fetched 2026-11-25 (`refs/ref_desc.json`; 3048 fetched, 0 errors).
- **Runtime stand-ins** (venv from the original review working copy, not imported): SymPy 1.14.0, mpmath 1.3.0 (special functions at 30 digits), SciPy 1.18.1, NumPy 2.5.5, Pint 0.26.2. Mathematica-specific conventions (failure-count geometric, sample-SD Standardize, quantile type 1, unnormalised Sinc, inclusive Range) were applied by hand and are flagged CONVENTION.

## 2. Method

1. **Inventory.** I crawled every math-relevant guide: algebra, polynomials, calculus, integration/sums, series/limits, transforms, equation solving, DEs/PDE/FEM, linear algebra, number theory, combinatorics, special functions, discrete math, graphs, geometry, optimization, statistics, distributions/processes, signal/image basics, interpolation, units, numerics, control and finance.
   - Each guide maps to an area (`scripts/areas.py`). A symbol listed in several guides takes the highest-priority area.
   - This gives 3983 symbols. **935 appear only in out-of-scope guides** (UI, notebooks, cloud, data repositories, external services) and are listed separately in `out_of_scope_symbols.csv`.
   - The other **3048 are in [`inventory.csv`](data/mathematica-inventory.csv)**, which has an extra `kind` column: 2691 function, 110 option, 205 ui/visualization, 42 curated-data.
2. **Mapping** (`scripts/build_mapping.py`).
   - Names were matched against the runtime export lists of every MathTS package (`refs/mathts-names.json`: 2662 top-level names and 710 methods). The matcher uses normalisation, about 900 hand synonyms (`scripts/synonyms.py`) and rule transforms (XQ→isX, XDistribution→xDist/xPDF, and so on).
   - Unmatched names were grepped in source (`refs/src-exports.txt`, `refs/src-defs.txt`). A source-only definition gives "partial (not exported)" only when it is a real implementation. Otherwise the grep hit is only recorded in notes.
   - About 130 rows have hand overrides (`scripts/overrides.py`) based on runtime evidence. These include false-match corrections such as Element, VertexDegree, Root, Fold, Line, Set, UnitStep→plot `step` and Haversine.
   - Priority: P0 is a curated set of everyday symbols (`scripts/curation.py`). P1 is in a curated list or appears in at least 4 guides. P2 is the rest. Plot/UI/data rows are n/a-out-of-scope.
3. **Second method for "missing".** Every missing row is absent from the runtime export lists of all packages, and also absent from the source export/definition greps or present there only as an unrelated identifier (noted). That is verified=`export+grep`.
4. **Runtime differential checks** (`verify/`): 1015 cases in total.

| Suite                                       | Cases | Reference                                               | Tolerance                                                                                                                                                                                                              |
| ------------------------------------------- | ----- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sym_suite.py`                              | 269   | SymPy                                                   | grading by numeric evaluation at 3–5 points, relative error 1e-8; simplify graded by structure                                                                                                                         |
| `sf_suite.py`                               | 331   | mpmath at 30 digits; SciPy/SymPy for Mathieu and Wigner | PASS ≤1e-12 relative, PASS-1e-9 ≤1e-9, LOWACC ≤1e-6, otherwise WRONG                                                                                                                                                   |
| `broad.mjs` + `broad_ref.py`                | 171   | NumPy/SciPy/SymPy                                       | linear algebra, number theory, combinatorics, distributions, stats, signal, interpolation, optimisation, graphs, geometry, units; per-case tolerance 1e-9 to 1e-12                                                     |
| `extra.mjs` + `extra2.mjs` + `extra_ref.py` | 244   | mpmath/NumPy/SciPy                                      | real and complex elementary functions, lists, matrix constructors and decompositions, polynomial transforms, 25 more distributions, 13 windows, signal, graphs, geometry, tests, number theory; 1e-12 to 1e-14 typical |

Rows get verified=`runtime` only when a graded case exists for that symbol.

## 3. Counts

| Area                                     | full | partial | missing | n/a | total | runtime-verified |
| ---------------------------------------- | ---- | ------- | ------- | --- | ----- | ---------------- |
| Special functions                        | 92   | 33      | 162     | 6   | 293   | 111              |
| Computational geometry & regions         | 20   | 4       | 217     | 45  | 286   | 10               |
| Probability & distributions              | 29   | 30      | 159     | 16  | 234   | 37               |
| Statistics                               | 33   | 4       | 155     | 36  | 228   | 26               |
| Graphs & networks                        | 16   | 0       | 202     | 7   | 225   | 9                |
| Linear algebra & matrices                | 89   | 7       | 116     | 7   | 219   | 58               |
| Elementary functions & constants         | 80   | 11      | 89      | 6   | 186   | 70               |
| Combinatorics & discrete math            | 19   | 3       | 136     | 4   | 162   | 13               |
| Signal processing                        | 36   | 3       | 69      | 27  | 135   | 18               |
| Image processing basics                  | 3    | 1       | 100     | 21  | 125   | 0                |
| Polynomial algebra                       | 26   | 18      | 62      | 5   | 111   | 33               |
| Number theory                            | 25   | 1       | 71      | 9   | 106   | 18               |
| Random processes & time series           | 6    | 0       | 84      | 13  | 103   | 2                |
| Series, limits, sums & discrete calculus | 25   | 7       | 57      | 4   | 93    | 19               |
| Differential equations & PDE/FEM         | 2    | 0       | 82      | 3   | 87    | 0                |
| Control systems                          | 2    | 0       | 68      | 5   | 75    | 0                |
| Lists & arrays                           | 4    | 3       | 61      | 1   | 69    | 1                |
| Numerical methods & precision            | 9    | 2       | 32      | 10  | 53    | 0                |
| Calculus (symbolic)                      | 11   | 3       | 31      | 6   | 51    | 3                |
| Algebra & formula manipulation           | 1    | 4       | 41      | 1   | 47    | 2                |
| Integral transforms                      | 6    | 5       | 25      | 4   | 40    | 4                |
| Units & quantities                       | 8    | 0       | 15      | 2   | 25    | 0                |
| Tensors                                  | 2    | 2       | 18      | 0   | 22    | 1                |
| Interpolation & approximation            | 8    | 0       | 8       | 1   | 17    | 1                |
| Equation solving                         | 8    | 2       | 6       | 0   | 16    | 6                |
| Dynamical systems & fractals             | 1    | 0       | 12      | 3   | 16    | 1                |
| Finance & actuarial                      | 0    | 0       | 10      | 5   | 15    | 0                |
| Optimization                             | 1    | 0       | 7       | 1   | 9     | 0                |
| **Total**                                | 562  | 143     | 2095    | 248 | 3048  | 443              |

| Priority | full | partial | missing | n/a |
| -------- | ---- | ------- | ------- | --- |
| P0       | 252  | 83      | 27      | 0   |
| P1       | 245  | 35      | 285     | 1   |
| P2       | 65   | 25      | 1783    | 0   |
| -        | 0    | 0       | 0       | 247 |

- **Runtime-verified:** 443 of the 705 full+partial rows (**62.8%**), which is 14.5% of all 3048 rows. The other 2359 rows are export+grep and 247 are name-only (out of scope).
- **Case outcomes:**
  - sf: 292 PASS, 10 PASS-1e-9, 13 WRONG, 2 LOWACC, 9 ERROR (mostly unsupported domains), 4 NaN, 1 complex-ref.
  - broad: 165 PASS, 3 WRONG (2 conventions plus BUG-9), 2 APPROX, 1 ERROR.
  - extra: 222 PASS, 11 CONVENTION, 4 NOT-TRANSFORMED, 1 NUMERIC-ONLY, 1 WRONG, 4 ERROR (functions that don't exist), 1 skip.
  - sym: see section 5.

## 4. Bugs (minimal repros; `M = await import('mathts/functions/dist/index.js')`)

| #      | Severity                      | Repro                                                                                                                                                | Expected (reference)                                                                                                                    |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-1  | **High, silent wrong answer** | `M.casSimplify('-(x^2+x+1)')` gives `-x^2 + x - 1`. `M.casSimplify('(x+1)^2-(x^2+2*x+1)')` evaluates to 4x.                                          | `-x^2-x-1`; `0`. Negation is applied as -p(-x) (functions/src/typed/cas.ts ~4065).                                                      |
| BUG-2  | **High**                      | `M.solve('x^4+1','x')` gives `[]`. Also: x^4+4 and x^4+x+1 give `[]`; x^6-1 and x^8-1 give only ±1; x^5-x-1 gives only the real root.                | 4, 4, 4, 6, 8 and 5 roots (complex included). An empty list wrongly claims "no solution".                                               |
| BUG-3  | High (API)                    | `M.integrate('exp(2*x)','x')` gives `integral(exp(2*x), x)`.                                                                                         | exp(2x)/2. The public `integrate` handles 4 of 40 antiderivatives; `symbolicIntegral` handles 22 of 40, and `integrate` doesn't use it. |
| BUG-4  | Medium                        | `M.integrate('1/sqrt(x)','x',0,1)` gives Infinity. log(x) on [1e-4,1] has relative error 1.8e-4.                                                     | 2. The definite form is a fixed 1000-panel Simpson with no singularity handling or error control.                                       |
| BUG-5  | **High, silent**              | `M.series('1/sin(x)','x',0,5)` drops the 1/x term. `M.series('sqrt(x)','x',0,3)` returns garbage. Coefficients are rounded to 10 significant digits. | 1/x + x/6 + 7x^3/360…; sqrt(x).                                                                                                         |
| BUG-6  | Medium                        | `M.limit('floor(x)','x',1)` gives 1. `M.limit('log(x)/x','x',Infinity)` gives 1.8e-7. `limit('atan(x)','x',Infinity)` is off by 6e-9.                | Indeterminate (two-sided); 0; π/2. Limits are numeric sampling only.                                                                    |
| BUG-7  | **High**                      | `M.fresnelS(5)` = 0.268 and `M.fresnelC(5)` = -0.0284. `M.fresnelS(10)` = -9.98e59. At x = 4 the relative error is already 1.8e-7.                   | 0.49919, 0.56363, 0.46817. The series is used beyond its range; it needs an asymptotic/auxiliary-function branch.                       |
| BUG-8  | **High**                      | `M.sinIntegral(40)` = 1.6094 (1.4% off). `M.sinIntegral(50)` = -12.47. `M.sinIntegral(100)` = -7.9e23. At 30 the relative error is 2.6e-6.           | 1.58699, 1.55162, 1.56223. Same root cause as BUG-7.                                                                                    |
| BUG-9  | Medium                        | `M.pchip([0,1,2,3],[0,1,0,1],0.5)` gives 0.625.                                                                                                      | 0.75 (SciPy PchipInterpolator; `M.pchipInterp` gives the right value). The two pchip implementations disagree.                          |
| BUG-10 | **High, silent**              | `M.ellipticF(3.0, 0.5)` gives 0.14183.                                                                                                               | 3.56632. Amplitude φ > π/2 isn't reduced by quasi-periodicity, F(φ+kπ) = F(φ) + 2kK.                                                    |
| BUG-11 | Low/Medium                    | `M.hyp2f1(1.5,2.5,4,0.99)` gives 14.51475.                                                                                                           | 14.52036 (relative error 3.9e-4). Slow convergence near z = 1 without a transformation.                                                 |
| BUG-12 | Medium                        | `M.acsch(M.complex(0.6,0.8))` throws `x.acsch is not a function`.                                                                                    | 0.7127085 - 0.6847192i (mpmath acsch). The Complex class has no `acsch`, while asech, acoth, acsc, asec and acot work.                  |
| BUG-13 | **High, silent**              | `M.collect('x*y + 2*x','x')` gives `3*x`. `M.collect('x*y + 3*y','x')` gives `x + 3`.                                                                | `x*(y+2)`; `x + 3*y`. Symbols other than the collect variable are replaced by 1.                                                        |
| BUG-14 | Low                           | `M.coefficientList('3*x^2+2*x+1')` returns `['3','*','x',...]`.                                                                                      | It should either compute [1,2,3] or throw a TypeError. A string is iterated silently.                                                   |
| BUG-15 | Low                           | `M.gamma(171.5)` gives Infinity.                                                                                                                     | 9.4834e307, still finite in double.                                                                                                     |
| BUG-16 | Low                           | `M.zTransform('n^2','n','z')` gives `"Z{n^2}(z)"`, which the parser can't read back.                                                                 | z(z+1)/(z-1)^3. The unevaluated placeholder should be a valid expression or an error.                                                   |
| BUG-17 | Low/Medium (silent)           | `M.resultant('x^2-2','x^2-3','x')` gives NaN. `M.discriminant('x^2+b*x+c','x')` gives NaN.                                                           | 1; b^2-4c. Only numeric coefficient arrays are accepted, and string input returns NaN instead of an error.                              |

**Conventions (not bugs, but differ from Mathematica; document them or add options):**

- `zscore` uses the population SD; Standardize uses the sample SD.
- `geometricPMF` counts trials, while Mathematica's GeometricDistribution counts failures.
- `quantileSeq` is type 7, while Mathematica's Quantile default is type 1.
- `periodogram` defaults to a Hann window.
- `divisorSigma(n, k)` has its arguments in the opposite order to DivisorSigma[k, n].
- FactorInteger returns a flat list.
- `range` is end-exclusive.
- `sinc` is normalised.
- `setDistinct` sorts, while DeleteDuplicates keeps order.
- `count` is a length, not a pattern count.
- `hadamardMatrix` is unnormalised and in Sylvester order.
- `isZero` uses a tolerance.
- `haversine` is a great-circle distance.
- `rationalize` is the mathjs expression→fraction transform; float→rational is `fraction`.
- `gumbelDist` is the max form, while Mathematica's GumbelDistribution is the min form.
- The hypothesis tests and some centralities return Promises.

## 5. Symbolic depth (the main finding)

| Capability                                             | Result (verify/sym_graded.txt)                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Antiderivatives                                        | `integrate` 4/40; `symbolicIntegral` 22/40 (no erf/Si/li/elliptic, no substitution beyond simple linear forms, no integration by parts for log·poly chains)      |
| Definite integrals                                     | 5/9 exact or within tolerance, 2 approx, 2 wrong (BUG-4)                                                                                                         |
| Derivatives                                            | 9/10 (no `erf` rule)                                                                                                                                             |
| Simplify                                               | `simplify` 4/20, `fullSimplify` 1/20, `casSimplify` 1/20 plus 2 WRONG values (BUG-1). Missing: sin²+cos²→1, rational cancellation, exp/log inverses, assumptions |
| Limits                                                 | 17/22 exact, 4 approx (numeric), 1 wrong                                                                                                                         |
| Series                                                 | 18/20 (Taylor fine; Laurent/Puiseux wrong, BUG-5)                                                                                                                |
| Solve                                                  | 14/25 complete, 3 partial (missing roots), 6 errors (2^x=8, x·eˣ=1, x^(1/3)=2, …). No symbolic parameters (a·x+b), no systems                                    |
| Sum / Product                                          | numeric finite bounds only (1/4, 1/2)                                                                                                                            |
| Laplace / inverse / Z                                  | 5/8, 7/8, 3/5                                                                                                                                                    |
| Factor, Apart, Together, Expand, GroebnerBasis         | all correct (manual check of 13 cases)                                                                                                                           |
| PowerExpand, TrigReduce, ComplexExpand, FunctionExpand | no-ops on the basic probes; ToRadicals returns decimals                                                                                                          |
| Missing outright                                       | DSolve/DSolveValue, RSolve, FindInstance, Dt, Normal/SeriesData, Root objects, Assumptions in Simplify/Integrate, Reduce for inequalities                        |

## 6. Top gaps (ranked by everyday impact × size of gap)

1. **Simplify family**: Simplify, FullSimplify, casSimplify correctness (BUG-1), TrigReduce/TrigExpand/TrigFactor, PowerExpand, ComplexExpand, FunctionExpand, Assumptions.
2. **Solve**: complete roots of any degree (complex, via Root/radicals), symbolic parameters, systems, transcendental patterns (ProductLog, exponentials, radicals), Reduce/FindInstance for inequalities.
3. **Integrate**: route the public `integrate` to symbolicIntegral; add risch-lite/heuristic and special-function antiderivatives (erf, Si/Ci, Ei, li, elliptic); exact definite integrals; NIntegrate with infinite limits and singularities (adaptive Gauss-Kronrod/tanh-sinh).
4. **DSolve / RSolve** (missing; P0), plus a more accurate NDSolve default (relative error 4.5e-5 today).
5. **Series/Limit**: exact rational coefficients, Laurent/Puiseux, SeriesData/Normal, symbolic limits (Gruntz).
6. **Special-function accuracy and domains**: Fresnel/Si/Ci asymptotics (BUG-7, BUG-8), EllipticF amplitude reduction (BUG-10), K/E for m<0, complete EllipticPi(n,m), hyp2f1/polylog/lerchPhi analytic continuation, complex erf/besselJ, gamma near overflow.
7. **Symbolic Sum/Product** (closed forms, infinite sums), symbolic Collect (BUG-13), Coefficient/CoefficientList/Exponent on expressions, symbolic Resultant/Discriminant.
8. **Distribution objects**: Expectation, Probability, MixtureDistribution, TransformedDistribution, CharacteristicFunction/MGF, MultinomialDistribution, more of the 161 missing distribution names.
9. **Random processes and time series**: ARIMA/ARMA/GARCH, Wiener/Poisson/Markov processes, TimeSeries, RandomFunction (84 missing).
10. **Graphs**: 202 missing (VertexDegree, GraphDiameter, RandomGraph, Hamiltonian/Eulerian cycles, IncidenceMatrix, PlanarGraphQ, …).
11. **Geometry/regions**: 217 missing (Region objects, RegionUnion/Difference, Volume, ImplicitRegion, MeshRegion, polyhedra, RandomPoint).
12. **List primitives**: Nest/NestList/Fold, Position, Partition, Ordering, Cases, Tally-style Counts, AnyTrue/AllTrue, Append, Length; numeric predicates EvenQ/OddQ, Quotient, FractionalPart, FromDigits, Chop.
13. **Distributions/generalised functions**: DiracDelta, HeavisideTheta/UnitStep, KroneckerDelta (missing, which also blocks Laplace of shifted steps).
14. **Control systems**: 68 missing (state-space models, ControllabilityMatrix, StateFeedbackGains, KalmanEstimator).
15. **PDE/FEM**: NDSolve with PDEs and boundary conditions (DirichletCondition, NeumannValue, NDEigensystem): 82 missing.

## 7. Where MathTS is ahead of (or offers what core Mathematica doesn't)

- Reverse-mode autodiff (`autograd`) and GPU/WASM-accelerated numerics (WebGPU kernels, WASM SVD/eig), all in a browser/Node runtime.
- Interval and exact-scale arithmetic in units (exact SI scaling, CODATA constants with uncertainties), plus `propagateUncertainty` with full covariance.
- Physics-oriented special functions that passed at mpmath precision: Wigner 3j/6j, Coulomb wave functions, Mathieu, spheroidal, Carlson RD/RF/RJ.
- Direct SciPy-style APIs (window functions, IIR design, `levene`, `kruskal`, `anderson`) with SciPy-matching numerics (all 13 windows, the tests and 25 distributions passed within 1e-9 to 1e-12).
- Everything runs in JS with no kernel licence, and there is a mathjs-compatible layer (`compat`).

## 8. Proposed build batches (one cloud-agent PR each, in dependency order)

| #   | Priority | Batch (root cause)                                             | Functions                                                                                                                                                                                                                                                                                                                  |
| --- | -------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | P0       | **CAS correctness hotfix**                                     | casSimplify negation (BUG-1), collect multivariate (BUG-13), coefficientList type guard (BUG-14), zTransform placeholder (BUG-16), regression tests from verify/sym_suite.py                                                                                                                                               |
| B2  | P0       | **Special-function accuracy: auxiliary/asymptotic branches**   | fresnelS/fresnelC (f,g auxiliary functions for x>4), sinIntegral/cosIntegral (asymptotic for x>~20), ellipticF amplitude reduction, gamma near 171 (log-gamma path), hyp2f1 near z=1 (transformation 15.3.6), acsch(Complex)                                                                                               |
| B3  | P0       | **Integrate front door + definite integrals**                  | integrate → symbolicIntegral delegation; exact definite via antiderivative and limits; adaptive Gauss–Kronrod / tanh-sinh for nintegrate/quad including infinite limits and endpoint singularities (BUG-3, BUG-4)                                                                                                          |
| B4  | P0       | **Polynomial root completeness**                               | solve/NSolve/Roots for any degree with complex roots (companion-matrix eig or Aberth), radical forms for degree ≤4, Root[] objects; toRadicals returning radicals (BUG-2)                                                                                                                                                  |
| B5  | P0       | **Simplify engine**                                            | trig identity rules (Pythagorean, double-angle), rational cancellation via polynomialGCD, exp/log inverse rules, PowerExpand, TrigReduce/TrigExpand/TrigFactor, ComplexExpand, FunctionExpand (gamma/factorial integers, half-integers), basic Assumptions                                                                 |
| B6  | P0       | **Series/Limit exactness**                                     | exact rational coefficients, Laurent/Puiseux via leading-term extraction, SeriesData + Normal, symbolic limits by series/Gruntz-lite, Indeterminate for two-sided jumps (BUG-5, BUG-6)                                                                                                                                     |
| B7  | P0       | **Solve breadth** (after B4, B5)                               | symbolic parameters, linear/polynomial systems via groebnerBasis, ProductLog/exp/log/radical patterns, Reduce for univariate inequalities, FindInstance (simple)                                                                                                                                                           |
| B8  | P0       | **Generalised functions + discrete transforms**                | HeavisideTheta/UnitStep, DiracDelta, KroneckerDelta; Laplace of shifted steps, sinh/cosh, t^a; InverseZTransform; symbolic Sum/Product with closed forms (Gosper/Faulhaber), RSolve for linear constant-coefficient recurrences                                                                                            |
| B9  | P0       | **DSolve** (after B3, B5, B8)                                  | first-order separable/linear/exact, 2nd-order constant-coefficient and Euler, systems x'=Ax via matrix exponential; tighten the solveODE/NDSolve default tolerances                                                                                                                                                        |
| B10 | P0/P1    | **List and predicate primitives**                              | Nest, NestList, Fold, FoldList, Position, Partition, Ordering, Cases (simple predicate), Counts, AnyTrue/AllTrue/NoneTrue, Append, Length, EvenQ, OddQ, Quotient, FractionalPart, FromDigits, Chop, RootMeanSquare, Subdivide, general Normalize                                                                           |
| B11 | P0/P1    | **Special-function domain extension**                          | complex erf/erfc (Faddeeva), complex Bessel (Amos), ellipticK/E for m<0, complete ellipticPi(n,m), polylog/lerchPhi/hyp2f1 analytic continuation                                                                                                                                                                           |
| B12 | P1       | **Distribution object completeness**                           | Expectation, Probability, CharacteristicFunction, MomentGeneratingFunction, Cumulant, MixtureDistribution, TransformedDistribution, Multinomial, BetaBinomial, Erlang, Hypoexponential, CensoredDistribution, Likelihood/LogLikelihood; convention options (geometric failures, sample-SD Standardize, quantile types 1–9) |
| B13 | P1       | **Random processes / time series**                             | WienerProcess, PoissonProcess, RandomWalkProcess, AR/MA/ARMA/ARIMA processes, TimeSeries, RandomFunction, TimeSeriesModelFit (basic), DiscreteMarkovProcess                                                                                                                                                                |
| B14 | P1       | **Graph library breadth**                                      | VertexDegree, GraphDiameter, IncidenceMatrix, RandomGraph, FindHamiltonianCycle, FindEulerianCycle, FindVertexCover, FindIndependentVertexSet, PlanarGraphQ, BipartiteGraphQ, EdgeConnectivity, GlobalClusteringCoefficient, GraphAssortativity                                                                            |
| B15 | P1       | **Regions and geometry**                                       | Region objects (Disk, Ball, Polygon, Polyhedron, ImplicitRegion), RegionUnion/Difference, Volume/Area/RegionMeasure, RandomPoint, RegularPolygon, polyhedra, SignedRegionDistance                                                                                                                                          |
| B16 | P1       | **Control systems**                                            | StateSpaceModel/TransferFunctionModel basics, ControllabilityMatrix, ObservabilityMatrix, StateResponse, StateFeedbackGains (Ackermann), KalmanEstimator, series/feedback connect                                                                                                                                          |
| B17 | P2       | **PDE/FEM**                                                    | NDSolve for 1D/2D PDEs (method of lines), DirichletCondition, NeumannValue, NDEigensystem on simple meshes                                                                                                                                                                                                                 |
| B18 | P2       | **Image basics, remaining number theory and combinatorics P2** | GaussianFilter, Binarize, EdgeDetect, ImageAdjust; DivisorSum, SquaresR, Primes, RandomPrime, PermutationCycles, Groupings                                                                                                                                                                                                 |

## 9. Not verified (explicit)

- **Options.** 110 option symbols and every option_gaps entry were mapped by name/source reading only. No option was exercised at runtime except those named in the tests (for example the periodogram window).
- **Export+grep rows.** 2359 rows were checked by export and source grep only, with no runtime value check. That covers all 2095 missing rows, plus 262 full/partial rows with no graded case.
- **Name-only rows.** 247 n/a-out-of-scope rows (plot/UI/curated data) are name-only.
- **Mathematica itself was never run.** All "reference" values come from mpmath/SciPy/SymPy, with Mathematica conventions applied from the documentation descriptions. Where those differ (Gumbel min/max, Nakagami parameterisation, Hadamard ordering) I flagged CONVENTION instead of claiming a mismatch.
- **Untested areas.** FEM/PDE, control, image processing, region objects, most graph algorithms beyond basics (shortest path, MST, centralities, coloring, isomorphism, topological sort), finance and units beyond conversion were not tested.
- **Symbolic tests were graded numerically** at sample points. A PASS means value-equivalence, not identical form (Factor, Apart and so on were checked manually).
- **Performance and big inputs.** No performance, large-input or BigNumber/arbitrary-precision runs; everything ran in double precision.
- **Surface.** Only the `functions` package plus compat/tensor/matrix (for a few rows) were exercised at runtime. GPU/WASM paths were not.
- **Inventory completeness.** The inventory is limited to symbols listed on the 289 crawled guides. Symbols reachable only from unlisted guides could be missing (`refs/crawl_meta.json` lists the frontier).

## 10. Files

- [`inventory.csv`](data/mathematica-inventory.csv) (3048 rows), `out_of_scope_symbols.csv` (935), [`mapping.csv`](data/mathematica-mapping.csv) (3048)
- `verify/` (suites, references, graders, results): `sym_graded.txt`, `sf_graded.json`, `broad_graded.json`, `extra_graded.json`
- `scripts/` (crawl, inventory, matching, synonyms, overrides, build_mapping)
- `refs/` (guides HTML, descriptions, MathTS name lists, source greps)
- `SHA.txt`, build logs
