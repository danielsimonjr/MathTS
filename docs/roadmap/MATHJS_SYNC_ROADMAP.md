# MathJS → MathTS Sync Roadmap

**Generated**: 2026-04-10
**Source**: mathjs fork v15.4.0–v15.6.0 (216 new functions, 207 not yet in MathTS)

## Summary

The mathjs fork added 216 new mathematical functions across versions 15.4.0–15.6.0. MathTS already has 9 of these (fibonacci, convexHull, pointInPolygon, polyfit, trapz, beta, digamma, erfc, gammainc). The remaining **207 functions** need to be brought into MathTS.

| Strategy | Functions | Effort | Priority |
|----------|-----------|--------|----------|
| **Sync from mathjs JS** | 54 | Low (copy + factory activate) | 1 — quickest wins |
| **New TypeScript** | 74 | Medium (implement from spec) | 2 — CAS, graph theory, distributions |
| **Rust WASM** | 79 | High (implement in Rust + TS wrapper) | 3 — numerical methods, signal processing |
| **Total** | **207** | | |

---

## Phase 1: Sync from mathjs (54 functions)

These are already implemented in the mathjs fork as JavaScript. Sync them using the existing `sync_mathjs_to_mathts.py` script, then activate via the factory system.

### Algebra — Sync (36 functions)
| Function | Description |
|----------|-------------|
| `apart` | Partial fraction decomposition |
| `cancel` | Cancel common factors |
| `coefficientList` | Extract polynomial coefficients |
| `collect` | Collect like terms |
| `combine` | Combine fractions |
| `complexExpand` | Expand complex expressions |
| `degree` | Polynomial degree |
| `differences` | Finite differences |
| `discriminant` | Polynomial discriminant |
| `element` | Extract expression element |
| `eliminate` | Eliminate variable |
| `expToTrig` | Convert exp to trig |
| `expand` | Expand expression |
| `factor` | Factor expression |
| `fullSimplify` | Full simplification |
| `functionExpand` | Expand special functions |
| `normalForm` | Canonical normal form |
| `partialDerivative` | Partial derivative (symbolic) |
| `polyadd` | Polynomial addition |
| `polyder` | Polynomial derivative |
| `polymul` | Polynomial multiplication |
| `polynomialGCD` | Polynomial GCD |
| `polynomialLCM` | Polynomial LCM |
| `polynomialQuotient` | Polynomial division quotient |
| `polynomialRemainder` | Polynomial division remainder |
| `polyval` | Polynomial evaluation |
| `powerExpand` | Expand powers |
| `reduce` | Reduce expression |
| `resultant` | Polynomial resultant |
| `substitute` | Variable substitution |
| `tangentLine` | Tangent line at point |
| `together` | Combine into single fraction |
| `trigExpand` | Expand trig expressions |
| `trigReduce` | Reduce trig expressions |
| `trigToExp` | Convert trig to exponential |
| `variables` | Extract free variables |

### Combinatorics — Sync (8 functions)
| Function | Description |
|----------|-------------|
| `divisors` | List all divisors |
| `eulerPhi` | Euler's totient function |
| `harmonicNumber` | nth harmonic number |
| `integerDigits` | Digits of integer |
| `primeFactors` | Prime factorization |
| `prime` | nth prime number |
| `nextPrime` | Next prime after n |
| `primePi` | Prime counting function |

### Signal — Sync (4 functions)
| Function | Description |
|----------|-------------|
| `convolve` | Signal convolution |
| `correlate` | Signal correlation |
| `windowFunction` | Window functions (Hamming, Hanning, etc.) |
| `medfilt` | Median filter |

### Statistics — Sync (6 functions)
| Function | Description |
|----------|-------------|
| `covariance` | Covariance matrix |
| `histogram` | Histogram binning |
| `kurtosis` | Kurtosis (peakedness) |
| `linreg` | Linear regression |
| `movingAverage` | Moving average filter |
| `skewness` | Skewness measure |

---

## Phase 2: New TypeScript Implementations (74 functions)

These need native TypeScript implementations. They're symbolic/CAS functions, graph algorithms, statistical tests, and distribution objects.

### Algebra — CAS (28 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `integrate` | Symbolic integration | High |
| `limit` | Symbolic limits | High |
| `solve` | Equation solver | High |
| `laplace` / `inverseLaplace` | Laplace transform | High |
| `taylor` / `multivariateTaylor` | Taylor series expansion | Medium |
| `series` / `seriesCoefficient` | Power series | Medium |
| `groebnerBasis` | Gröbner basis computation | High |
| `fourierSeries` | Fourier series expansion | Medium |
| `zTransform` | Z-transform | Medium |
| `gradientSymbolic` / `jacobian` / `laplacian` | Vector calculus (symbolic) | Medium |
| `curl` / `divergence` / `directionalDerivative` | Vector calculus (symbolic) | Medium |
| `implicitDiff` | Implicit differentiation | Medium |
| `odeGeneral` | General ODE solver (symbolic) | High |
| `piecewise` | Piecewise function definition | Low |
| `assume` / `asymptotic` | Assumption system | Medium |
| `summation` / `symbolicProduct` | Symbolic sum/product | Medium |
| `minimalPolynomial` | Minimal polynomial | High |
| `toRadicals` | Express in radicals | High |
| `normalForm` | Expression normal form | Medium |

### Graph Theory — TypeScript (8 functions, NEW CATEGORY)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `adjacencyMatrix` | Create adjacency matrix | Low |
| `shortestPath` | Dijkstra's algorithm | Medium |
| `minimumSpanningTree` | Kruskal's/Prim's MST | Medium |
| `connectedComponents` | Find connected components | Medium |
| `stronglyConnectedComponents` | Tarjan's algorithm | Medium |
| `topologicalSort` | Topological ordering (DAG) | Low |
| `isConnected` | Check graph connectivity | Low |
| `graphDistance` | Graph distance metric | Medium |

### Matrix — TypeScript (8 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `characteristicPolynomial` | Characteristic polynomial | Medium |
| `jordanForm` | Jordan normal form | High |
| `matrixLog` | Matrix logarithm | High |
| `matrixPower` | Matrix power (non-integer) | Medium |
| `matrixRank` | Matrix rank | Low |
| `nullSpace` | Null space basis | Medium |
| `polarDecomposition` | Polar decomposition | Medium |
| `rowReduce` | Row echelon form (RREF) | Low |

### Statistics — Hypothesis Tests (7 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `studentTTest` | Student's t-test | Medium |
| `chiSquareTest` | Chi-square test | Medium |
| `anova` | Analysis of variance | Medium |
| `kolmogorovSmirnovTest` | K-S test | Medium |
| `mannWhitneyTest` | Mann-Whitney U test | Medium |
| `shapiroWilkTest` | Shapiro-Wilk normality test | Medium |
| `principalComponentAnalysis` | PCA | Medium |

### Statistics — Distribution Objects (12 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `normalDist` | Normal distribution object (.pdf, .cdf, .quantile) | Low |
| `betaDist` | Beta distribution | Low |
| `binomialDist` | Binomial distribution | Low |
| `chiSquaredDist` | Chi-squared distribution | Low |
| `exponentialDist` | Exponential distribution | Low |
| `fDist` | F-distribution | Low |
| `gammaDist` | Gamma distribution | Low |
| `logNormalDist` | Log-normal distribution | Low |
| `poissonDist` | Poisson distribution | Low |
| `tDist` | Student's t-distribution | Low |
| `uniformDist` | Uniform distribution | Low |
| `weibullDist` | Weibull distribution | Low |

### Geometry — TypeScript (4 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `area` | Area of shape | Low |
| `centroid` | Centroid of polygon | Low |
| `coordinateTransform` | Polar/spherical/cylindrical | Medium |
| `polygonPerimeter` | Perimeter of polygon | Low |

### Combinatorics — Number Theory (7 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `carmichaelLambda` | Carmichael function | Medium |
| `chineseRemainder` | Chinese Remainder Theorem | Medium |
| `divisorSigma` | Sum of divisors | Low |
| `jacobiSymbol` | Jacobi symbol | Medium |
| `lucasL` | Lucas numbers | Low |
| `moebiusMu` | Möbius function | Medium |
| `partitions` | Integer partitions | Medium |

---

## Phase 3: Rust WASM Implementations (79 functions)

These are computation-heavy functions that benefit from WASM acceleration. Implement in Rust with TypeScript wrappers and JS fallbacks.

### Numerical Methods — Rust (36 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `findRoot` | Root finding (Newton/Brent) | Medium |
| `minimize` / `maximize` / `globalMinimize` | Optimization | High |
| `linprog` / `quadprog` | Linear/quadratic programming | High |
| `nintegrate` | Numerical integration (adaptive) | Medium |
| `simpsons` | Simpson's rule | Low |
| `leastSquares` / `linsolve` | Linear algebra solvers | Medium |
| `interpolate` / `pchip` / `cspline` | Interpolation methods | Medium |
| `bezierCurve` / `bspline` | Parametric curves | Medium |
| `curvefit` / `expfit` / `logfit` / `powerfit` | Curve fitting | Medium |
| `chebyshevApprox` / `padeApproximant` | Function approximation | Medium |
| `griddata` / `rbfInterpolate` / `loess` | Scattered data interpolation | High |
| `solveODESystem` / `solveBVP` / `solvePDE` | Differential equation solvers | High |
| `stiffODESolver` / `odeAdaptiveStep` / `eventDetection` | Advanced ODE features | High |
| `cond` / `rank` / `nullspace` / `residue` | Matrix analysis | Medium |

### Signal Processing — Rust (14 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `fft2d` | 2D FFT | Medium |
| `dct` / `dst` / `idst` | Discrete cosine/sine transforms | Medium |
| `dwt` | Discrete wavelet transform | High |
| `hilbertTransform` | Hilbert transform | Medium |
| `fourier` / `invFourier` | Continuous Fourier transform | Medium |
| `spectrogram` / `periodogram` | Time-frequency analysis | Medium |
| `lowpassFilter` / `highpassFilter` / `bandpassFilter` | Digital filters | Medium |
| `resample` | Signal resampling | Medium |

### Special Functions — Rust (20 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `besselI` / `besselJ` / `besselK` / `besselY` | Bessel functions (all kinds) | Medium |
| `betainc` / `gammaincp` | Incomplete beta/gamma | Medium |
| `ellipticE` / `ellipticK` | Elliptic integrals | Medium |
| `chebyshevT` / `hermiteH` / `laguerreL` / `legendreP` | Orthogonal polynomials | Medium |
| `lambertW` | Lambert W function | Medium |
| `erfi` | Imaginary error function | Low |
| `cosIntegral` / `sinIntegral` / `logIntegral` / `expIntegralEi` | Integral functions | Medium |
| `fresnelC` / `fresnelS` | Fresnel integrals | Medium |

### Geometry — Rust (6 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `delaunayTriangulation` | Delaunay triangulation | High |
| `voronoiDiagram` | Voronoi diagram | High |
| `kdTree` | k-d tree spatial index | High |
| `chebyshevDistance` / `manhattanDistance` / `minkowskiDistance` | Distance metrics | Low |

### Matrix — Rust (3 functions)
| Function | Description | Complexity |
|----------|-------------|-----------|
| `cholesky` | Cholesky decomposition | Medium |
| `hessenbergForm` | Hessenberg reduction | Medium |
| `svd` | Singular value decomposition | High |

---

## Implementation Priority

| Priority | Phase | Functions | Effort | Value |
|----------|-------|-----------|--------|-------|
| **1** | Sync from mathjs | 54 | 1-2 days | High — immediate parity |
| **2** | Distribution objects (TS) | 12 | 2-3 days | High — widely used |
| **3** | Graph theory (TS) | 8 | 3-5 days | High — new capability |
| **4** | Number theory (TS) | 7+8 | 3-5 days | Medium |
| **5** | Special functions (Rust) | 20 | 1-2 weeks | High — scientific computing |
| **6** | Statistical tests (TS) | 7 | 1 week | Medium |
| **7** | Signal processing (Rust) | 14 | 1-2 weeks | Medium |
| **8** | Numerical methods (Rust) | 36 | 2-4 weeks | High — core capability |
| **9** | Symbolic CAS (TS) | 28 | 3-6 weeks | High — differentiator |
| **10** | Matrix advanced (TS+Rust) | 11 | 1-2 weeks | Medium |
| **11** | Geometry advanced (Rust) | 10 | 1 week | Low |

## Dependency Chain

```
Phase 1 (sync 54) → immediate, no blockers
    ↓
Phase 2 (distributions 12) → needs Phase 1 for statistical distribution base
Phase 3 (graph theory 8) → independent, new package possible
Phase 4 (number theory 15) → independent
    ↓
Phase 5-7 (Rust WASM 34+14+20) → can start immediately, independent of Phases 2-4
    ↓
Phase 8 (numerical methods 36) → some depend on Phase 5 special functions
Phase 9 (symbolic CAS 28) → depends on expression parser infrastructure
Phase 10 (matrix 11) → depends on Phase 5 special functions
Phase 11 (geometry 10) → independent
```

Phases 1-4 and 5-7 can run in parallel. Phase 9 (CAS) is the longest chain.
