# MathTS ↔ mathjs parity audit

## ⚠️ Reliability note — read this first

These results are from a batched LLM audit (9 Sonnet calls, one per mathjs category).
**Quantitative summary numbers are UNRELIABLE.** Source truncation (18K char cap per
MathTS file in the prompt) caused many false-negative "not found" verdicts. Independent
grep verification showed:

- This audit reports **113 found / 102 not-found**.
- Direct grep of `functions/src/typed/*.ts` exports shows **203 already implemented**
  (only 12 genuinely absent, of which 6 were ported in this session).

**The per-function divergence notes below are the useful signal** — they are often
correct when spot-checked (e.g., `combinatorics/divisorSigma` argument-order reversal
was confirmed real). Treat them as candidate findings to verify, not authoritative
verdicts. The "Not found in MathTS active layer" section is the least trustworthy
and likely contains many false negatives caused by truncation.

Spot-check verified:

- ✅ `combinatorics/divisorSigma` arg-order reversal (MathTS `(n, k)` vs mathjs `(k, n)`) — REAL DIVERGENCE
- ❌ `combinatorics/chineseRemainder` "not found" — FALSE NEGATIVE (exists in `typed/combinatorics.ts`)

---

**Functions audited:** 215
**Found in MathTS active layer:** 113 / 215 (53%)
**Signature match:** 6 / 215
**Algorithm match:** 18 / 215
**Signature diverged:** 45
**Algorithm diverged:** 34
**Unknown (couldn't determine):** 105
**Not found in MathTS:** 102

## By category

| Category      | n   | found | sig-match | alg-match | sig-div | alg-div | unknown | not-found |
| ------------- | --- | ----- | --------- | --------- | ------- | ------- | ------- | --------- |
| algebra       | 64  | 35    | 2         | 4         | 21      | 18      | 29      | 29        |
| combinatorics | 16  | 11    | 0         | 3         | 1       | 1       | 5       | 5         |
| geometry      | 12  | 12    | 0         | 3         | 1       | 2       | 3       | 0         |
| graph         | 7   | 7     | 0         | 0         | 7       | 1       | 0       | 0         |
| matrix        | 11  | 7     | 0         | 2         | 1       | 2       | 4       | 4         |
| numeric       | 38  | 14    | 1         | 4         | 9       | 3       | 24      | 24        |
| signal        | 18  | 3     | 0         | 0         | 2       | 1       | 15      | 15        |
| special       | 24  | 8     | 3         | 0         | 0       | 4       | 16      | 16        |
| statistics    | 25  | 16    | 0         | 2         | 3       | 2       | 9       | 9         |

## Divergences (signature or algorithm)

- **algebra/assume** [SIG]: MathTS uses a Map of Sets per variable; mathjs uses a flat Map with single string property.
- **algebra/cancel** [SIG+ALG]: MathTS cancel only handles numeric fractions; mathjs cancel handles symbolic polynomial expressions.
- **algebra/coefficientList** [SIG+ALG]: MathTS coefficientList just trims a coefficient array; mathjs extracts coefficients from an expression string.
- **algebra/curl** [SIG+ALG]: MathTS curl is not found as a standalone export; cas.ts has no curl function visible in truncated source.
- **algebra/degree** [SIG+ALG]: MathTS degree takes a coefficient array; mathjs degree takes an expression string and variable name.
- **algebra/directionalDerivative** [SIG+ALG]: MathTS returns a numeric value with a scope; mathjs returns a symbolic string expression.
- **algebra/discriminant** [SIG]: MathTS takes a coefficient array; mathjs takes an expression string and variable name.
- **algebra/divergence** [SIG+ALG]: MathTS returns a numeric value with scope; mathjs returns a symbolic string expression.
- **algebra/gradientSymbolic** [SIG+ALG]: MathTS returns numeric values with scope; mathjs returns symbolic string expressions per variable.
- **algebra/integrate** [SIG]: MathTS supports definite integrals numerically and returns string/number; mathjs returns only symbolic string.
- **algebra/inverseLaplace** [SIG]: MathTS inverseLaplace is part of cas.ts table lookup; mathjs has a dedicated alias module.
- **algebra/inverseLaplaceTransform** [SIG]: MathTS uses regex pattern table; mathjs uses AST node matching with more patterns supported.
- **algebra/jacobian** [SIG+ALG]: MathTS returns numeric matrix with scope; mathjs returns symbolic string matrix.
- **algebra/laplacian** [SIG+ALG]: MathTS returns numeric value with scope; mathjs returns symbolic string expression.
- **algebra/partialDerivative** [SIG+ALG]: MathTS returns numeric value with scope; mathjs returns symbolic string expression.
- **algebra/polyder** [SIG]: MathTS polyder accepts an order parameter n; mathjs polyder only computes first derivative.
- **algebra/polynomialGCD** [SIG]: MathTS takes coefficient arrays directly; mathjs takes expression strings and a variable name.
- **algebra/polynomialLCM** [SIG]: MathTS takes coefficient arrays directly; mathjs takes expression strings and a variable name.
- **algebra/polynomialQuotient** [SIG]: MathTS takes coefficient arrays directly; mathjs takes expression strings and a variable name.
- **algebra/polynomialRemainder** [SIG]: MathTS takes coefficient arrays directly; mathjs takes expression strings and a variable name.
- **algebra/substitute** [SIG+ALG]: MathTS substitute uses regex string replacement; mathjs uses AST node transformation.
- **combinatorics/divisorSigma** [SIG]: MathTS signature is (n, k) with k defaulting to 1; mathjs signature is (k, n) — argument order is reversed.
- **geometry/area** [SIG+ALG]: MathTS takes a Shape object (circle/rectangle/triangle/polygon); mathjs takes a raw vertices array only.
- **graph/adjacencyMatrix** [SIG]: MathTS requires explicit n and uses boolean directed param; mathjs auto-detects n and accepts options object with undirected flag.
- **graph/connectedComponents** [SIG]: MathTS takes adjacency matrix (number[][]); mathjs takes adjacency list object, so input format is fundamentally different.
- **graph/graphDistance** [SIG]: MathTS takes adjacency matrix with numeric node indices; mathjs takes weighted adjacency list object supporting string or number nodes.
- **graph/isConnected** [SIG]: MathTS takes adjacency matrix (number[][]); mathjs takes adjacency list object, so input format is fundamentally different.
- **graph/minimumSpanningTree** [SIG+ALG]: MathTS uses Prim's algorithm on adjacency matrix; mathjs uses Kruskal's algorithm on an edge list with explicit n parameter.
- **graph/stronglyConnectedComponents** [SIG]: MathTS takes adjacency matrix with integer node indices; mathjs takes adjacency list object supporting string or number node keys.
- **graph/topologicalSort** [SIG]: MathTS takes adjacency matrix returning integer indices; mathjs takes adjacency list object and preserves original node types in output.
- **matrix/cholesky** [SIG]: MathTS returns {L} object and checks symmetry; mathjs returns L directly without symmetry check.
- **numeric/cspline** [SIG]: MathTS cspline returns a function directly; mathjs returns an object with evaluate() and coefficients.
- **numeric/findRoot** [SIG]: MathTS findRoot requires bracket [a,b] only (Brent); mathjs also supports Newton with single x0.
- **numeric/globalMinimize** [SIG+ALG]: MathTS uses basin-hopping; mathjs uses differential evolution. Output is array vs object with fval/iterations.
- **numeric/interpolate** [SIG]: MathTS interpolate returns a function; mathjs returns a scalar value directly.
- **numeric/leastSquares** [SIG+ALG]: MathTS leastSquares solves linear least squares (Ax=b); mathjs uses Gauss-Newton for nonlinear residuals.
- **numeric/maximize** [SIG]: MathTS maximize returns array; mathjs returns object with x, fval, iterations, converged.
- **numeric/minimize** [SIG]: MathTS minimize returns array; mathjs returns object with x, fval, iterations, converged.
- **numeric/pchip** [SIG]: MathTS pchip takes (xs, ys, x) returning scalar; mathjs pchip returns object with evaluate().
- **numeric/trapz** [SIG]: MathTS trapz takes optional x (defaults to uniform h=1); mathjs requires explicit x array or scalar dx.
- **signal/convolve** [SIG]: MathTS uses FFT-based convolution returning Float64Array; mathjs uses direct O(N²) returning plain Array.
- **signal/correlate** [SIG]: MathTS exposes parallelXCorr/crossCorrelation returning Float64Array; mathjs correlate returns plain Array with Matrix overloads.
- **statistics/chiSquareTest** [SIG]: MathTS only supports 1D goodness-of-fit; mathjs also supports 2D contingency table independence test.
- **statistics/kolmogorovSmirnovTest** [SIG+ALG]: MathTS only supports one-sample test with CDF function; two-sample variant is missing. p-value formula differs.
- **statistics/studentTTest** [SIG]: MathTS supports one-sample test (vs mu=0); mathjs only supports two-sample. Return field named statistic vs t.
- **algebra/cancel** [SIG+ALG]: MathTS cancel only handles numeric fractions; mathjs cancel handles symbolic polynomial expressions.
- **algebra/coefficientList** [SIG+ALG]: MathTS coefficientList just trims a coefficient array; mathjs extracts coefficients from an expression string.
- **algebra/collect** [ALG]: MathTS uses regex-based term parsing; mathjs uses numerical Vandermonde evaluation for coefficient extraction.
- **algebra/curl** [SIG+ALG]: MathTS curl is not found as a standalone export; cas.ts has no curl function visible in truncated source.
- **algebra/degree** [SIG+ALG]: MathTS degree takes a coefficient array; mathjs degree takes an expression string and variable name.
- **algebra/directionalDerivative** [SIG+ALG]: MathTS returns a numeric value with a scope; mathjs returns a symbolic string expression.
- **algebra/divergence** [SIG+ALG]: MathTS returns a numeric value with scope; mathjs returns a symbolic string expression.
- **algebra/expand** [ALG]: MathTS uses regex-based string manipulation; mathjs uses AST simplify rules for expansion.
- **algebra/factor** [ALG]: MathTS only factors out numeric GCDs from terms; mathjs uses rational roots theorem for polynomial factoring.
- **algebra/gradientSymbolic** [SIG+ALG]: MathTS returns numeric values with scope; mathjs returns symbolic string expressions per variable.
- **algebra/jacobian** [SIG+ALG]: MathTS returns numeric matrix with scope; mathjs returns symbolic string matrix.
- **algebra/laplacian** [SIG+ALG]: MathTS returns numeric value with scope; mathjs returns symbolic string expression.
- **algebra/multivariateTaylor** [ALG]: MathTS uses numerical derivatives; mathjs uses symbolic derivative function for multivariate Taylor.
- **algebra/partialDerivative** [SIG+ALG]: MathTS returns numeric value with scope; mathjs returns symbolic string expression.
- **algebra/series** [ALG]: MathTS series uses numerical derivatives; mathjs series uses symbolic derivative function iteratively.
- **algebra/seriesCoefficient** [ALG]: MathTS uses numerical differentiation; mathjs uses symbolic derivative function for coefficient extraction.
- **algebra/substitute** [SIG+ALG]: MathTS substitute uses regex string replacement; mathjs uses AST node transformation.
- **algebra/taylor** [ALG]: MathTS uses numerical derivatives; mathjs uses symbolic derivative function iteratively.
- **combinatorics/lucasL** [ALG]: MathTS exports it as 'lucas' (not 'lucasL') and uses fast-doubling via Fibonacci relation; mathjs uses simple iteration.
- **geometry/area** [SIG+ALG]: MathTS takes a Shape object (circle/rectangle/triangle/polygon); mathjs takes a raw vertices array only.
- **geometry/coordinateTransform** [ALG]: MathTS spherical uses different angle convention (phi=inclination vs mathjs theta=inclination), producing different output.
- **graph/minimumSpanningTree** [SIG+ALG]: MathTS uses Prim's algorithm on adjacency matrix; mathjs uses Kruskal's algorithm on an edge list with explicit n parameter.
- **matrix/matrixLog** [ALG]: MathTS uses inverse scaling-and-squaring with Taylor series; mathjs uses eigendecomposition directly.
- **matrix/matrixRank** [ALG]: MathTS computes rank via RREF; mathjs uses SVD singular value thresholding.
- **numeric/globalMinimize** [SIG+ALG]: MathTS uses basin-hopping; mathjs uses differential evolution. Output is array vs object with fval/iterations.
- **numeric/leastSquares** [SIG+ALG]: MathTS leastSquares solves linear least squares (Ax=b); mathjs uses Gauss-Newton for nonlinear residuals.
- **numeric/nintegrate** [ALG]: MathTS uses 5-point Gauss-Legendre with Richardson extrapolation; mathjs uses Gauss-Kronrod 7-15 point.
- **signal/dct** [ALG]: MathTS DCT-II applies orthonormal scaling factors (sqrt(1/N), sqrt(2/N)); mathjs DCT-II has no scaling.
- **special/besselI** [ALG]: MathTS uses direct series expansion with factorial helper; mathjs uses A&S polynomial approximations with backward recurrence.
- **special/besselJ** [ALG]: MathTS uses forward recurrence for small orders and Miller's backward recurrence differently; mathjs uses ACC=160 backward recurrence with normalization.
- **special/besselK** [ALG]: MathTS uses inline k0/k1 helpers with slightly different polynomial coefficients; mathjs uses A&S 9.8 polynomial approximations.
- **special/erfc** [ALG]: MathTS computes erfc as 1-erf using A&S 7.1.26 with max error 1.5e-7; mathjs uses Cody's rational Chebyshev with much higher precision.
- **statistics/kolmogorovSmirnovTest** [SIG+ALG]: MathTS only supports one-sample test with CDF function; two-sample variant is missing. p-value formula differs.
- **statistics/shapiroWilkTest** [ALG]: MathTS uses Blom's approximation for all n; mathjs uses exact tabulated coefficients for n<=11.

## Not found in MathTS active layer

- **algebra/apart**: No apart implementation found in MathTS files.
- **algebra/asymptotic**: No asymptotic implementation found in MathTS files.
- **algebra/combine**: No combine implementation found in MathTS files.
- **algebra/complexExpand**: No complexExpand implementation found in MathTS files.
- **algebra/element**: No element implementation found in MathTS files.
- **algebra/eliminate**: No eliminate implementation found in MathTS files.
- **algebra/expToTrig**: No expToTrig implementation found in MathTS files.
- **algebra/fourierSeries**: No fourierSeries implementation found in MathTS files.
- **algebra/fullSimplify**: No fullSimplify implementation found in MathTS files.
- **algebra/functionExpand**: No functionExpand implementation found in MathTS files.
- **algebra/groebnerBasis**: No groebnerBasis implementation found in MathTS files.
- **algebra/implicitDiff**: No implicitDiff implementation found in MathTS files.
- **algebra/minimalPolynomial**: No minimalPolynomial implementation found in MathTS files.
- **algebra/normalForm**: No normalForm implementation found in MathTS files.
- **algebra/odeGeneral**: No odeGeneral implementation found in MathTS files.
- **algebra/piecewise**: No piecewise implementation found in MathTS files.
- **algebra/powerExpand**: No powerExpand implementation found in MathTS files.
- **algebra/reduce**: No reduce implementation found in MathTS files.
- **algebra/resultant**: No resultant implementation found in MathTS files.
- **algebra/solve**: No solve implementation found in MathTS files.
- **algebra/summation**: No summation implementation found in MathTS files.
- **algebra/symbolicProduct**: No symbolicProduct implementation found in MathTS files.
- **algebra/tangentLine**: No tangentLine implementation found in MathTS files.
- **algebra/toRadicals**: No toRadicals implementation found in MathTS files.
- **algebra/together**: No together implementation found in MathTS files.
- **algebra/trigExpand**: No trigExpand implementation found in MathTS files.
- **algebra/trigReduce**: No trigReduce implementation found in MathTS files.
- **algebra/trigToExp**: No trigToExp implementation found in MathTS files.
- **algebra/zTransform**: No zTransform implementation found in MathTS files.
- **combinatorics/chineseRemainder**: No chineseRemainder implementation found in the MathTS combinatorics file.
- **combinatorics/harmonicNumber**: No harmonicNumber implementation found in the MathTS combinatorics file.
- **combinatorics/integerDigits**: No integerDigits implementation found in the MathTS combinatorics file.
- **combinatorics/jacobiSymbol**: No jacobiSymbol implementation found in the MathTS combinatorics file.
- **combinatorics/partitions**: No partitions implementation found in the MathTS combinatorics file.
- **matrix/jordanForm**: No jordanForm implementation found in the MathTS file.
- **matrix/nullSpace**: No nullSpace implementation found in the MathTS file.
- **matrix/polarDecomposition**: No polarDecomposition implementation found in the MathTS file.
- **matrix/svd**: MathTS delegates to external @danielsimonjr/mathts-matrix svd; no internal SVD implementation present.
- **numeric/bspline**: No bspline implementation found in MathTS files.
- **numeric/chebyshevApprox**: No chebyshevApprox implementation found in MathTS files.
- **numeric/cond**: No cond implementation found in MathTS files.
- **numeric/curvefit**: No curvefit implementation found in MathTS files.
- **numeric/eventDetection**: No eventDetection implementation found in MathTS files.
- **numeric/expfit**: No expfit implementation found in MathTS files.
- **numeric/gradient**: No gradient implementation found in MathTS files.
- **numeric/griddata**: No griddata implementation found in MathTS files.
- **numeric/hessian**: No hessian implementation found in MathTS files.
- **numeric/linprog**: No linprog implementation found in MathTS files.
- **numeric/loess**: No loess implementation found in MathTS files.
- **numeric/logfit**: No logfit implementation found in MathTS files.
- **numeric/nullspace**: No nullspace implementation found in MathTS files.
- **numeric/odeAdaptiveStep**: No odeAdaptiveStep implementation found in MathTS files.
- **numeric/padeApproximant**: No padeApproximant implementation found in MathTS files.
- **numeric/powerfit**: No powerfit implementation found in MathTS files.
- **numeric/quadprog**: No quadprog implementation found in MathTS files.
- **numeric/rank**: No rank implementation found in MathTS files.
- **numeric/rbfInterpolate**: No rbfInterpolate implementation found in MathTS files.
- **numeric/residue**: No residue implementation found in MathTS files.
- **numeric/solveBVP**: No solveBVP implementation found in MathTS files.
- **numeric/solveODESystem**: No solveODESystem implementation found in MathTS files.
- **numeric/solvePDE**: No solvePDE implementation found in MathTS files.
- **numeric/stiffODESolver**: No stiffODESolver implementation found in MathTS files.
- **signal/bandpassFilter**: No bandpassFilter implementation found in MathTS signal.ts file.
- **signal/dst**: No dst implementation found in the MathTS signal.ts file.
- **signal/dwt**: No dwt implementation found in the MathTS signal.ts file.
- **signal/fft2d**: No fft2d implementation found in the MathTS signal.ts file.
- **signal/fourier**: No fourier wrapper implementation found in the MathTS signal.ts file.
- **signal/highpassFilter**: No highpassFilter implementation found in the MathTS signal.ts file.
- **signal/hilbertTransform**: No hilbertTransform implementation found in the MathTS signal.ts file.
- **signal/idst**: No idst implementation found in the MathTS signal.ts file.
- **signal/invFourier**: No invFourier implementation found in the MathTS signal.ts file.
- **signal/lowpassFilter**: No lowpassFilter implementation found in the MathTS signal.ts file.
- **signal/medfilt**: No medfilt implementation found in the MathTS signal.ts file.
- **signal/periodogram**: No periodogram implementation found in the MathTS signal.ts file.
- **signal/resample**: No resample implementation found in the MathTS signal.ts file.
- **signal/spectrogram**: No spectrogram implementation found in the MathTS signal.ts file.
- **signal/windowFunction**: No windowFunction implementation found in the MathTS signal.ts file.
- **special/betainc**: No betainc implementation found in MathTS files.
- **special/chebyshevT**: No chebyshevT implementation found in MathTS files.
- **special/cosIntegral**: No cosIntegral implementation found in MathTS files.
- **special/ellipticE**: No ellipticE implementation found in MathTS files.
- **special/ellipticK**: No ellipticK implementation found in MathTS files.
- **special/erfi**: No erfi implementation found in MathTS files.
- **special/expIntegralEi**: No expIntegralEi implementation found in MathTS files.
- **special/fresnelC**: No fresnelC implementation found in MathTS files.
- **special/fresnelS**: No fresnelS implementation found in MathTS files.
- **special/gammaincp**: No gammaincp implementation found in MathTS files.
- **special/hermiteH**: No hermiteH implementation found in MathTS files.
- **special/laguerreL**: No laguerreL implementation found in MathTS files.
- **special/lambertW**: No lambertW implementation found in MathTS files.
- **special/legendreP**: No legendreP implementation found in MathTS files.
- **special/logIntegral**: No logIntegral implementation found in MathTS files.
- **special/sinIntegral**: No sinIntegral implementation found in MathTS files.
- **statistics/covariance**: No covariance function found in MathTS files; only correlation is present in statistics.ts.
- **statistics/histogram**: No histogram function found in any MathTS file provided.
- **statistics/kurtosis**: No kurtosis function found in any MathTS file provided.
- **statistics/linreg**: No linreg function found in any MathTS file provided.
- **statistics/movingAverage**: No movingAverage function found in any MathTS file provided.
- **statistics/skewness**: No skewness function found in any MathTS file provided.
- **statistics/tDist**: tDist not found in dist-objects.ts visible portion; file is truncated so may exist but cannot confirm.
- **statistics/uniformDist**: uniformDist not found in visible dist-objects.ts portion; file truncated so cannot confirm presence.
- **statistics/weibullDist**: weibullDist not found in visible dist-objects.ts portion; file truncated so cannot confirm presence.

## Unknown / couldn't determine

- **algebra/apart**: No apart implementation found in MathTS files.
- **algebra/asymptotic**: No asymptotic implementation found in MathTS files.
- **algebra/combine**: No combine implementation found in MathTS files.
- **algebra/complexExpand**: No complexExpand implementation found in MathTS files.
- **algebra/element**: No element implementation found in MathTS files.
- **algebra/eliminate**: No eliminate implementation found in MathTS files.
- **algebra/expToTrig**: No expToTrig implementation found in MathTS files.
- **algebra/fourierSeries**: No fourierSeries implementation found in MathTS files.
- **algebra/fullSimplify**: No fullSimplify implementation found in MathTS files.
- **algebra/functionExpand**: No functionExpand implementation found in MathTS files.
- **algebra/groebnerBasis**: No groebnerBasis implementation found in MathTS files.
- **algebra/implicitDiff**: No implicitDiff implementation found in MathTS files.
- **algebra/minimalPolynomial**: No minimalPolynomial implementation found in MathTS files.
- **algebra/normalForm**: No normalForm implementation found in MathTS files.
- **algebra/odeGeneral**: No odeGeneral implementation found in MathTS files.
- **algebra/piecewise**: No piecewise implementation found in MathTS files.
- **algebra/powerExpand**: No powerExpand implementation found in MathTS files.
- **algebra/reduce**: No reduce implementation found in MathTS files.
- **algebra/resultant**: No resultant implementation found in MathTS files.
- **algebra/solve**: No solve implementation found in MathTS files.
- **algebra/summation**: No summation implementation found in MathTS files.
- **algebra/symbolicProduct**: No symbolicProduct implementation found in MathTS files.
- **algebra/tangentLine**: No tangentLine implementation found in MathTS files.
- **algebra/toRadicals**: No toRadicals implementation found in MathTS files.
- **algebra/together**: No together implementation found in MathTS files.
- **algebra/trigExpand**: No trigExpand implementation found in MathTS files.
- **algebra/trigReduce**: No trigReduce implementation found in MathTS files.
- **algebra/trigToExp**: No trigToExp implementation found in MathTS files.
- **algebra/zTransform**: No zTransform implementation found in MathTS files.
- **combinatorics/chineseRemainder**: No chineseRemainder implementation found in the MathTS combinatorics file.
- **combinatorics/harmonicNumber**: No harmonicNumber implementation found in the MathTS combinatorics file.
- **combinatorics/integerDigits**: No integerDigits implementation found in the MathTS combinatorics file.
- **combinatorics/jacobiSymbol**: No jacobiSymbol implementation found in the MathTS combinatorics file.
- **combinatorics/partitions**: No partitions implementation found in the MathTS combinatorics file.
- **geometry/delaunayTriangulation**: MathTS implementation is truncated; WASM dispatch path and full Bowyer-Watson details cannot be fully verified.
- **geometry/kdTree**: MathTS implementation is truncated; WASM threshold dispatch and full nearest/rangeSearch logic cannot be fully verified.
- **geometry/voronoiDiagram**: MathTS implementation is truncated; full Voronoi cell construction and bounds handling cannot be fully verified.
- **matrix/jordanForm**: No jordanForm implementation found in the MathTS file.
- **matrix/nullSpace**: No nullSpace implementation found in the MathTS file.
- **matrix/polarDecomposition**: No polarDecomposition implementation found in the MathTS file.
- **matrix/svd**: MathTS delegates to external @danielsimonjr/mathts-matrix svd; no internal SVD implementation present.
- **numeric/bspline**: No bspline implementation found in MathTS files.
- **numeric/chebyshevApprox**: No chebyshevApprox implementation found in MathTS files.
- **numeric/cond**: No cond implementation found in MathTS files.
- **numeric/curvefit**: No curvefit implementation found in MathTS files.
- **numeric/eventDetection**: No eventDetection implementation found in MathTS files.
- **numeric/expfit**: No expfit implementation found in MathTS files.
- **numeric/gradient**: No gradient implementation found in MathTS files.
- **numeric/griddata**: No griddata implementation found in MathTS files.
- **numeric/hessian**: No hessian implementation found in MathTS files.
- **numeric/linprog**: No linprog implementation found in MathTS files.
- **numeric/loess**: No loess implementation found in MathTS files.
- **numeric/logfit**: No logfit implementation found in MathTS files.
- **numeric/nullspace**: No nullspace implementation found in MathTS files.
- **numeric/odeAdaptiveStep**: No odeAdaptiveStep implementation found in MathTS files.
- **numeric/padeApproximant**: No padeApproximant implementation found in MathTS files.
- **numeric/powerfit**: No powerfit implementation found in MathTS files.
- **numeric/quadprog**: No quadprog implementation found in MathTS files.
- **numeric/rank**: No rank implementation found in MathTS files.
- **numeric/rbfInterpolate**: No rbfInterpolate implementation found in MathTS files.
- **numeric/residue**: No residue implementation found in MathTS files.
- **numeric/solveBVP**: No solveBVP implementation found in MathTS files.
- **numeric/solveODESystem**: No solveODESystem implementation found in MathTS files.
- **numeric/solvePDE**: No solvePDE implementation found in MathTS files.
- **numeric/stiffODESolver**: No stiffODESolver implementation found in MathTS files.
- **signal/bandpassFilter**: No bandpassFilter implementation found in MathTS signal.ts file.
- **signal/dst**: No dst implementation found in the MathTS signal.ts file.
- **signal/dwt**: No dwt implementation found in the MathTS signal.ts file.
- **signal/fft2d**: No fft2d implementation found in the MathTS signal.ts file.
- **signal/fourier**: No fourier wrapper implementation found in the MathTS signal.ts file.
- **signal/highpassFilter**: No highpassFilter implementation found in the MathTS signal.ts file.
- **signal/hilbertTransform**: No hilbertTransform implementation found in the MathTS signal.ts file.
- **signal/idst**: No idst implementation found in the MathTS signal.ts file.
- **signal/invFourier**: No invFourier implementation found in the MathTS signal.ts file.
- **signal/lowpassFilter**: No lowpassFilter implementation found in the MathTS signal.ts file.
- **signal/medfilt**: No medfilt implementation found in the MathTS signal.ts file.
- **signal/periodogram**: No periodogram implementation found in the MathTS signal.ts file.
- **signal/resample**: No resample implementation found in the MathTS signal.ts file.
- **signal/spectrogram**: No spectrogram implementation found in the MathTS signal.ts file.
- **signal/windowFunction**: No windowFunction implementation found in the MathTS signal.ts file.
- **special/betainc**: No betainc implementation found in MathTS files.
- **special/chebyshevT**: No chebyshevT implementation found in MathTS files.
- **special/cosIntegral**: No cosIntegral implementation found in MathTS files.
- **special/ellipticE**: No ellipticE implementation found in MathTS files.
- **special/ellipticK**: No ellipticK implementation found in MathTS files.
- **special/erfi**: No erfi implementation found in MathTS files.
- **special/expIntegralEi**: No expIntegralEi implementation found in MathTS files.
- **special/fresnelC**: No fresnelC implementation found in MathTS files.
- **special/fresnelS**: No fresnelS implementation found in MathTS files.
- **special/gammaincp**: No gammaincp implementation found in MathTS files.
- **special/hermiteH**: No hermiteH implementation found in MathTS files.
- **special/laguerreL**: No laguerreL implementation found in MathTS files.
- **special/lambertW**: No lambertW implementation found in MathTS files.
- **special/legendreP**: No legendreP implementation found in MathTS files.
- **special/logIntegral**: No logIntegral implementation found in MathTS files.
- **special/sinIntegral**: No sinIntegral implementation found in MathTS files.
- **statistics/covariance**: No covariance function found in MathTS files; only correlation is present in statistics.ts.
- **statistics/histogram**: No histogram function found in any MathTS file provided.
- **statistics/kurtosis**: No kurtosis function found in any MathTS file provided.
- **statistics/linreg**: No linreg function found in any MathTS file provided.
- **statistics/movingAverage**: No movingAverage function found in any MathTS file provided.
- **statistics/skewness**: No skewness function found in any MathTS file provided.
- **statistics/tDist**: tDist not found in dist-objects.ts visible portion; file is truncated so may exist but cannot confirm.
- **statistics/uniformDist**: uniformDist not found in visible dist-objects.ts portion; file truncated so cannot confirm presence.
- **statistics/weibullDist**: weibullDist not found in visible dist-objects.ts portion; file truncated so cannot confirm presence.
