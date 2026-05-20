# Function Reference

All functions are exported from `@danielsimonjr/mathts-functions`.

```typescript
import { add, sin, parallelFFT, det, integrate } from '@danielsimonjr/mathts-functions';
```

This package exposes functions from **two layers**:

- **Typed layer** — native parallel-first implementations using typed-function
  dispatch. Support `number`, `bigint`, `Complex`, `Fraction`, `BigNumber`, and
  `Float64Array` where applicable. `Float64Array` inputs run in parallel worker
  threads and return a `Promise`.
- **Factory layer** — functions synced from mathjs and activated through the
  factory system (`det`, `inv`, `eigs`, set operations, units, sparse linear
  algebra, expression nodes, etc.).

Where a name exists in both layers (`add`, `multiply`, `sin`, …) the typed
implementation is the public export; the factory version is also exported under
a `factory_` prefix (`factory_add`, …).

**Coverage**: over 500 callable functions across the typed and factory layers,
plus 52 CODATA physical constants (see [Physical Constants](#physical-constants))
and 9 type-conversion functions. Remaining coverage gaps are tracked in
[`docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md`](../roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md).

---

## Arithmetic

| Function | Description | Types |
|---|---|---|
| `add(a, b)` | Addition | number, bigint, Complex, Fraction, Float64Array |
| `subtract(a, b)` | Subtraction | number, bigint, Complex, Fraction, Float64Array |
| `multiply(a, b)` | Multiplication / matrix product | number, bigint, Complex, Fraction, Float64Array |
| `divide(a, b)` | Division | number, bigint, Complex, Fraction, Float64Array |
| `unaryMinus(x)` | Negation `-x` | number, bigint, Complex, Fraction |
| `unaryPlus(x)` | Identity `+x` | number, bigint, Complex, Fraction |
| `abs(x)` | Absolute value | number, bigint, Complex, Fraction, Float64Array |
| `sign(x)` | Sign of x: -1, 0, or 1 | number, bigint, Complex, Fraction |
| `pow(x, y)` | Power `x^y` | number, bigint, Complex, Fraction |
| `sqrt(x)` | Square root | number, Complex, BigNumber, Float64Array |
| `square(x)` | `x²` | number, bigint, Complex, Fraction |
| `cube(x)` | `x³` | number, bigint, Complex, Fraction |
| `cbrt(x)` | Cube root | number, Complex, BigNumber |
| `nthRoot(x, n)` | nth root | number, Complex |
| `exp(x)` | `e^x` | number, Complex, BigNumber |
| `expm1(x)` | `e^x - 1` (stable near 0) | number, Complex |
| `log(x[, base])` | Natural log (or log base) | number, Complex, BigNumber |
| `log2(x)` | Base-2 logarithm | number, Complex, BigNumber |
| `log10(x)` | Base-10 logarithm | number, Complex, BigNumber |
| `log1p(x)` | `ln(1 + x)` (stable near 0) | number, Complex |
| `round(x[, n])` | Round to n digits | number, bigint, Complex, Fraction |
| `floor(x)` | Round down | number, Complex, Fraction |
| `ceil(x)` | Round up | number, Complex, Fraction |
| `fix(x)` | Round toward zero | number, Complex, Fraction |
| `mod(a, b)` | Modulo `a % b` | number, bigint |
| `gcd(a, b)` | Greatest common divisor | number, bigint |
| `lcm(a, b)` | Least common multiple | number, bigint |
| `xgcd(a, b)` | Extended GCD: `{gcd, x, y}` | number |
| `norm(x[, p])` | p-norm | number, Float64Array, DenseMatrix |
| `dot(a, b)` | Vector dot product | Float64Array, array |
| `outer(a, b)` | Vector outer product | Float64Array, array |
| `matmul(A, B)` | Matrix multiplication (parallel-capable) | Float64Array, DenseMatrix |
| `matvec(A, x)` | Matrix–vector product | Float64Array, DenseMatrix |

The factory layer additionally provides scalar variants used internally and by
the expression evaluator: `addScalar`, `subtractScalar`, `multiplyScalar`,
`divideScalar`, `dotMultiply`, `dotDivide`, `dotPow`, `invmod`, `nthRoots`.

```typescript
import { add, pow, log, mod } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';

add(1, 2);                                       // 3
add(new Fraction(1n, 3n), new Fraction(1n, 6n)); // Fraction(1, 2)
pow(new Complex(0, 1), 2);                       // Complex(-1, 0)
log(100, 10);                                    // 2
mod(17, 5);                                      // 2
```

---

## Relational & Comparison

| Function | Description |
|---|---|
| `equal(a, b)` | Equality test |
| `unequal(a, b)` | Inequality test |
| `smaller(a, b)` | `a < b` |
| `smallerEq(a, b)` | `a ≤ b` |
| `larger(a, b)` | `a > b` |
| `largerEq(a, b)` | `a ≥ b` |
| `compare(a, b)` | Three-way compare → -1, 0, 1 |
| `compareNatural(a, b)` | Natural ordering across mixed types |
| `compareText(a, b)` | Lexical string comparison |
| `equalScalar(a, b)` | Scalar equality |
| `equalText(a, b)` | String equality |
| `deepEqual(a, b)` | Element-wise deep equality |

---

## Trigonometry

Functions support `number`, `Complex`, `BigNumber`, and parallel `Float64Array`.

| Function | Description |
|---|---|
| `sin(x)` `cos(x)` `tan(x)` | Sine, cosine, tangent |
| `csc(x)` `sec(x)` `cot(x)` | Cosecant, secant, cotangent |
| `asin(x)` `acos(x)` `atan(x)` | Inverse sine, cosine, tangent |
| `atan2(y, x)` | Two-argument arctangent |
| `acsc(x)` `asec(x)` `acot(x)` | Inverse cosecant, secant, cotangent |
| `sinh(x)` `cosh(x)` `tanh(x)` | Hyperbolic sine, cosine, tangent |
| `asinh(x)` `acosh(x)` `atanh(x)` | Inverse hyperbolic sine, cosine, tangent |
| `csch(x)` `sech(x)` `coth(x)` | Hyperbolic cosecant, secant, cotangent (factory) |
| `acsch(x)` `asech(x)` `acoth(x)` | Inverse hyperbolic csc/sec/cot (factory) |
| `toRadians(deg)` | Convert degrees to radians |
| `toDegrees(rad)` | Convert radians to degrees |
| `hypot(a, b, …)` | Hypotenuse `sqrt(Σ xᵢ²)` |

```typescript
import { sin, cos, atan2, toRadians } from '@danielsimonjr/mathts-functions';
import { PI } from '@danielsimonjr/mathts-core';

sin(PI / 6);              // 0.5
cos(new Complex(0, 1));   // Complex(cosh(1), 0) ≈ Complex(1.543, 0)

const angles = new Float64Array([0, PI/6, PI/4, PI/3, PI/2]);
const sines = await sin(angles);   // parallel → Float64Array

toDegrees(PI);            // 180
```

---

## Logical & Bitwise

| Function | Description |
|---|---|
| `and(a, b)` `or(a, b)` `xor(a, b)` `not(x)` | Logical operators |
| `nullish(a, b)` | Nullish coalescing |
| `bitAnd(a, b)` `bitOr(a, b)` `bitXor(a, b)` `bitNot(x)` | Bitwise operators |
| `leftShift(x, n)` | Bitwise left shift |
| `rightArithShift(x, n)` | Arithmetic (signed) right shift |
| `rightLogShift(x, n)` | Logical (unsigned) right shift |

---

## Special Functions

| Function | Description |
|---|---|
| `erfc(x)` | Complementary error function `1 - erf(x)` |
| `erf(x)` | Error function (factory layer) |
| `erfi(x)` | Imaginary error function |
| `beta(a, b)` | Beta function `Γ(a)·Γ(b)/Γ(a+b)` |
| `betainc(x, a, b)` | Incomplete beta function |
| `gammainc(a, x)` | Regularized lower incomplete gamma `P(a, x)` |
| `gammaincp(a, x)` | Regularized upper incomplete gamma `Q(a, x)` |
| `digamma(x)` | Digamma `d/dx ln Γ(x)` |
| `gamma(x)` | Gamma function (factory layer) |
| `lgamma(x)` | Log-gamma (factory layer) |
| `besselJ0(x)` `besselJ1(x)` `besselJ(n, x)` | Bessel first kind |
| `besselY0(x)` `besselY1(x)` `besselY(n, x)` | Bessel second kind (`x > 0`) |
| `besselI(n, x)` `besselK(n, x)` | Modified Bessel functions |
| `ellipticK(m)` `ellipticE(m)` | Complete elliptic integrals |
| `fresnelC(x)` `fresnelS(x)` | Fresnel integrals |
| `sinIntegral(x)` `cosIntegral(x)` | Sine / cosine integrals |
| `expIntegralEi(x)` | Exponential integral `Ei(x)` |
| `logIntegral(x)` | Logarithmic integral `li(x)` |
| `lambertW(x[, branch])` | Lambert W function |
| `chebyshevT(n, x)` | Chebyshev polynomial (first kind) |
| `hermiteH(n, x)` | Hermite polynomial |
| `laguerreL(n, x)` | Laguerre polynomial |
| `legendreP(n, x)` | Legendre polynomial |
| `zeta(s)` | Riemann zeta function (factory layer) |

```typescript
import { erfc, beta, gammainc, besselJ0, lambertW } from '@danielsimonjr/mathts-functions';

erfc(1);          // ~0.1573
beta(0.5, 0.5);   // pi
gammainc(1, 1);   // ~0.6321 (= 1 - 1/e)
besselJ0(0);      // 1
lambertW(1);      // ~0.5671 (omega constant)
```

---

## Combinatorics & Number Theory

| Function | Description |
|---|---|
| `factorial(n)` | Factorial `n!` (factory layer) |
| `combinations(n, k)` | Binomial coefficient `C(n, k)` |
| `combinationsWithRep(n, k)` | Combinations with repetition |
| `permutations(n[, k])` | Permutations |
| `multinomial(k)` | Multinomial coefficient |
| `composition(n, k)` | Number of compositions |
| `catalan(n)` | nth Catalan number |
| `stirlingS2(n, k)` | Stirling number of the second kind |
| `bellNumbers(n)` | nth Bell number |
| `bernoulli(n)` | nth Bernoulli number |
| `fibonacci(n)` | nth Fibonacci number (O(log n) fast doubling) |
| `lucas(n)` `lucasL(n)` | nth Lucas number |
| `doubleFactorial(n)` | Double factorial `n!!` |
| `risingFactorial(x, n)` | Pochhammer symbol `x·(x+1)·…·(x+n-1)` |
| `fallingFactorial(x, n)` | Falling factorial `x·(x-1)·…·(x-n+1)` |
| `subfactorial(n)` | Derangement count `!n` |
| `harmonicNumber(n)` | nth harmonic number |
| `prime(n)` | nth prime |
| `nextPrime(n)` | Next prime after `n` |
| `primePi(n)` | Prime-counting function `π(n)` |
| `primeFactors(n)` | Prime factorization |
| `divisors(n)` | List of divisors |
| `divisorSigma(n[, k])` | Sum-of-divisors function |
| `eulerPhi(n)` | Euler totient `φ(n)` |
| `carmichaelLambda(n)` | Carmichael function `λ(n)` |
| `moebiusMu(n)` | Möbius function `μ(n)` |
| `jacobiSymbol(a, n)` | Jacobi symbol |
| `chineseRemainder(rems, mods)` | Chinese Remainder Theorem |
| `partitions(n)` | Integer partition count |
| `integerDigits(n[, base])` | Digits of an integer |

```typescript
import { fibonacci, primeFactors, eulerPhi, chineseRemainder } from '@danielsimonjr/mathts-functions';

fibonacci(20);                    // 6765
primeFactors(360);                // [2, 2, 2, 3, 3, 5]
eulerPhi(36);                     // 12
chineseRemainder([2, 3, 2], [3, 5, 7]); // 23
```

---

## Statistics

The typed arithmetic layer provides scalar/array aggregations: `sum`, `mean`,
`min`, `max`, `variance`, `std`. The factory layer adds `prod`, `median`,
`mode`, `corr`, `mad`, `quantileSeq`, `cumsum`.

For `Float64Array` data, the `parallelStat*` family runs in worker threads and
returns a `Promise`. Scalar overloads (2–4 numbers) are synchronous.

| Function | Description |
|---|---|
| `parallelStatSum(a)` | Sum of all elements |
| `parallelStatMean(a)` | Arithmetic mean |
| `parallelStatVariance(a[, type])` | Variance (`unbiased`/`uncorrected`/`biased`) |
| `parallelStatStd(a[, type])` | Standard deviation |
| `parallelStatMin(a)` `parallelStatMax(a)` | Min / max |
| `parallelStatMinMax(a)` | `{ min, max }` in one pass |
| `parallelStatMedian(a)` | Median |
| `parallelStatMode(a)` | Mode |
| `parallelStatProd(a)` | Product |
| `parallelStatNorm(a[, p])` | p-norm |
| `parallelStatDistance(a, b)` | Euclidean distance |
| `parallelStatCorr(a, b)` | Pearson correlation |
| `parallelStatMAD(a)` | Median absolute deviation |
| `parallelStatCumsum(a)` | Cumulative sum |
| `parallelStatQuantile(a, q)` | q-th quantile (0–1) |
| `parallelStatHistogram(a, bins)` | Histogram bin counts |

### Selection (O(n), no full sort)

| Function | Description |
|---|---|
| `quickSelect(arr, k)` | kth smallest element (0-indexed) |
| `medianSelect(arr)` | Exact median via quickselect |
| `minSelect(arr, k)` | `k` smallest elements |
| `maxSelect(arr, k)` | `k` largest elements |

```typescript
import { parallelStatMean, parallelStatStd, quickSelect } from '@danielsimonjr/mathts-functions';

const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
await parallelStatMean(data);          // 5
await parallelStatStd(data);           // 2
quickSelect([3, 1, 4, 1, 5, 9, 2], 3); // 3 (4th smallest)
```

---

## Probability Distributions

### Density / mass functions

| Function | Description |
|---|---|
| `normalPDF(x[, mu, sigma])` | Normal PDF |
| `normalCDF(x[, mu, sigma])` | Normal CDF |
| `exponentialPDF(x, lambda)` | Exponential PDF |
| `exponentialCDF(x, lambda)` | Exponential CDF |
| `poissonPMF(k, lambda)` | Poisson PMF |
| `binomialPMF(k, n, p)` | Binomial PMF |
| `geometricPMF(k, p)` | Geometric PMF |
| `bernoulliPMF(k, p)` | Bernoulli PMF |
| `entropy(probs)` | Shannon entropy (bits) |
| `jsDivergence(p, q)` | Jensen–Shannon divergence |
| `kldivergence(p, q)` | Kullback–Leibler divergence (factory layer) |

### Distribution objects

Constructors returning objects with `pdf`, `cdf`, `ppf` (quantile), and
`sample` methods.

| Function | Description |
|---|---|
| `normalDist([mu, sigma])` | Normal distribution |
| `betaDist(alpha, beta)` | Beta distribution |
| `binomialDist(n, p)` | Binomial distribution |
| `chiSquaredDist(k)` | Chi-squared distribution |
| `exponentialDist([lambda])` | Exponential distribution |
| `fDist(d1, d2)` | F-distribution |
| `gammaDist(shape[, rate])` | Gamma distribution |
| `logNormalDist([mu, sigma])` | Log-normal distribution |
| `poissonDist(lambda)` | Poisson distribution |
| `tDist(nu)` | Student's t-distribution |
| `uniformDist([a, b])` | Uniform distribution |
| `weibullDist(k[, lambda])` | Weibull distribution |

### Random sampling (factory layer)

| Function | Description |
|---|---|
| `random([min, max])` | Uniform random number |
| `randomInt([min, max])` | Uniform random integer |
| `pickRandom(array[, n])` | Random element(s) from an array |

```typescript
import { normalDist, tDist, poissonPMF } from '@danielsimonjr/mathts-functions';

const N = normalDist(0, 1);
N.pdf(0);       // ~0.3989
N.cdf(1.96);    // ~0.975
N.ppf(0.975);   // ~1.96

poissonPMF(2, 3); // ~0.2240
```

---

## Linear Algebra

Operates on `DenseMatrix` (and `SparseMatrix` where applicable). Heavy
operations are eligible for WASM/GPU acceleration via the matrix package.

| Function | Description |
|---|---|
| `det(A)` | Determinant |
| `inv(A)` | Matrix inverse |
| `pinv(A)` | Moore–Penrose pseudoinverse |
| `transpose(A)` | Transpose |
| `ctranspose(A)` | Conjugate (Hermitian) transpose |
| `eigs(A)` | Eigenvalues and eigenvectors |
| `lup(A)` | LU decomposition with partial pivoting |
| `qr(A)` | QR decomposition |
| `schur(A)` | Schur decomposition |
| `slu(A)` | Sparse LU decomposition |
| `lusolve(A, b)` | Solve `Ax = b` via LU |
| `lsolve(A, b)` / `lsolveAll(A, b)` | Forward substitution (lower-triangular) |
| `usolve(A, b)` / `usolveAll(A, b)` | Back substitution (upper-triangular) |
| `sylvester(A, B, C)` | Solve `AX + XB = C` |
| `lyap(A, Q)` | Solve the Lyapunov equation |
| `expm(A)` | Matrix exponential |
| `sqrtm(A)` | Matrix square root |
| `trace(A)` | Trace (sum of the diagonal) |
| `cross(a, b)` | Vector cross product |
| `kron(A, B)` | Kronecker product |
| `rotationMatrix(angle[, axis])` | Rotation matrix |
| `rotate(v, angle[, axis])` | Rotate a vector |

### Decompositions & analysis (typed `matrix-ops`)

| Function | Description |
|---|---|
| `cholesky(A)` | Cholesky decomposition |
| `hessenbergForm(A)` | Hessenberg reduction |
| `jordanForm(A)` | Jordan normal form |
| `characteristicPolynomial(A)` | Characteristic polynomial |
| `matrixRank(A)` | Rank |
| `matrixPower(A, p)` | Matrix power (non-integer) |
| `matrixLog(A)` | Matrix logarithm |
| `polarDecomposition(A)` | Polar decomposition |
| `rowReduce(A)` | Reduced row echelon form |

### Sparse (CSC) routines

`csChol`, `csLu`, `csSpsolve`, `csSqr`, `csCounts`, `csSymperm`, `csAmd`.

```typescript
import { det, inv, eigs, lusolve } from '@danielsimonjr/mathts-functions';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const A = new DenseMatrix([[2, 1], [5, 3]]);
det(A);          // 1
inv(A);          // [[3,-1],[-5,2]]
const { values, vectors } = eigs(A);
```

---

## Matrix Construction & Manipulation

| Function | Description |
|---|---|
| `identity(n)` | Identity matrix |
| `zeros(...dims)` / `ones(...dims)` | Zero / one matrices |
| `diag(v)` | Diagonal matrix or diagonal extraction |
| `range(start, end[, step])` | Numeric range |
| `matrixFromRows(...)` / `matrixFromColumns(...)` | Build matrix from vectors |
| `matrixFromFunction(size, fn)` | Build matrix from a generator |
| `concat(...)` | Concatenate matrices |
| `reshape(A, size)` / `resize(A, size)` | Reshape / resize |
| `flatten(A)` / `squeeze(A)` | Flatten / drop singleton dims |
| `subset(A, index[, replacement])` | Get/set a submatrix |
| `size(A)` / `count(A)` | Dimensions / element count |
| `column(A, i)` / `row(A, i)` | Extract a column / row |
| `diff(A[, axis])` | Discrete differences |
| `sort(A[, compare])` | Sort elements |
| `partitionSelect(A, k)` | kth element via partitioning |
| `map` / `forEach` / `filter` | Functional iteration |
| `mapSlices(A, dim, fn)` | Apply a function along a dimension |
| `getMatrixDataType(A)` | Detect element data type |
| `indexFn(...ranges)` | Construct an `Index` object |

---

## Algebra

Polynomial arithmetic and symbolic manipulation.

| Function | Description |
|---|---|
| `polyval(coeffs, x)` | Evaluate a polynomial (Horner) |
| `polyadd(a, b)` `polymul(a, b)` | Polynomial add / multiply |
| `polyder(coeffs[, n])` | nth polynomial derivative |
| `polynomialGCD(a, b)` `polynomialLCM(a, b)` | Polynomial GCD / LCM |
| `polynomialQuotient(a, b)` `polynomialRemainder(a, b)` | Polynomial division |
| `polynomialRoot(coeffs)` | Polynomial roots (factory layer) |
| `degree(coeffs)` | Polynomial degree |
| `discriminant(coeffs)` | Discriminant |
| `coefficientList(expr, var)` | Extract coefficients |
| `resultant(p, q)` | Resultant of two polynomials |
| `differences(arr[, n])` | nth finite differences |
| `variables(expr)` | Free variables of an expression |
| `substitute(expr, var, val)` | Variable substitution |
| `element(expr, i)` | Extract a sub-expression |
| `expand(expr)` | Expand (distribute) |
| `factor(expr)` | Factor into irreducibles |
| `collect(expr, var)` | Collect like terms |
| `combine(expr)` | Combine fractions |
| `cancel(expr)` | Cancel common factors |
| `apart(expr)` | Partial fraction decomposition |
| `together(expr)` | Combine into a single fraction |
| `reduce(expr)` | Reduce an expression |
| `normalForm(expr)` | Canonical normal form |
| `powerExpand(expr)` | Expand powers |
| `functionExpand(expr)` | Expand special functions |
| `complexExpand(expr)` | Expand complex expressions |
| `trigExpand(expr)` `trigReduce(expr)` | Trig expansion / reduction |
| `expToTrig(expr)` `trigToExp(expr)` | Convert between exp and trig forms |
| `fullSimplify(expr)` | Full algebraic simplification |
| `eliminate(system, var)` | Eliminate a variable from a system |
| `tangentLine(expr, var, point)` | Tangent line |
| `symbolicPartialDerivative(expr, var)` | Symbolic partial derivative |

The factory layer adds the expression-tree functions `simplify`,
`simplifyConstant`, `simplifyCore`, `derivative`, `rationalize`,
`symbolicEqual`, `resolve`, `leafCount`, and node constructors via `parse`.

```typescript
import { polyval, factor, expand } from '@danielsimonjr/mathts-functions';

polyval([1, 0, -1], 3);  // 8  (x² - 1 at x = 3)
factor('x^2 - 1');       // '(x - 1)(x + 1)'
expand('(x + 1)^3');     // 'x^3 + 3*x^2 + 3*x + 1'
```

---

## Computer Algebra System (CAS)

Symbolic calculus, transforms, and equation solving.

| Function | Description |
|---|---|
| `integrate(expr, var[, a, b])` | Symbolic integration (definite/indefinite) |
| `limit(expr, var, point[, dir])` | Symbolic limit |
| `partialDerivative(expr, var)` | Partial derivative |
| `directionalDerivative(expr, vars, dir)` | Directional derivative |
| `gradientSymbolic(expr, vars)` | Gradient vector |
| `jacobian(exprs, vars)` | Jacobian matrix |
| `laplacian(expr, vars)` | Laplacian operator |
| `divergence(field, vars)` | Divergence of a vector field |
| `curl(field, vars)` | Curl of a 3D vector field |
| `implicitDiff(eq, dep, indep)` | Implicit differentiation |
| `laplace(expr, t, s)` | Laplace transform |
| `inverseLaplace(expr, s, t)` | Inverse Laplace transform |
| `inverseLaplaceTransform(...)` | Inverse Laplace (numerical variant) |
| `fourierSeries(expr, var, n)` | Fourier series coefficients |
| `zTransform(expr, n, z)` | Z-transform |
| `taylor(expr, var, point, n)` | Taylor series expansion |
| `multivariateTaylor(expr, vars, point, n)` | Multivariate Taylor expansion |
| `series(expr, var, n)` | General series expansion |
| `seriesCoefficient(expr, var, n)` | nth series coefficient |
| `solve(expr, var)` | Solve an equation |
| `summation(expr, var, from, to)` | Symbolic summation |
| `symbolicProduct(expr, var, from, to)` | Symbolic product |
| `groebnerBasis(polys, vars)` | Gröbner basis |
| `minimalPolynomial(value)` | Minimal polynomial |
| `toRadicals(expr)` | Express roots in radicals |
| `odeGeneral(ode, y, x)` | Solve an ODE symbolically |
| `piecewise(conditions)` | Piecewise function definition |
| `asymptotic(expr, var)` | Asymptotic expansion |
| `assume(var, property)` | Register an assumption |
| `getAssumptions([var])` | Read current assumptions |
| `clearAssumptions()` | Clear all assumptions |

```typescript
import { integrate, limit, taylor, solve } from '@danielsimonjr/mathts-functions';

integrate('x^2', 'x');         // 'x^3/3'
limit('sin(x)/x', 'x', 0);     // '1'
taylor('exp(x)', 'x', 0, 4);   // '1 + x + x^2/2 + x^3/6 + x^4/24'
solve('x^2 - 4', 'x');         // [-2, 2]
```

---

## Numerical Integration

| Function | Description |
|---|---|
| `trapz(y[, x])` | Trapezoidal rule on sampled data |
| `simpson(f, a, b[, n])` | Simpson's 1/3 rule (`n` even) |
| `simpsons(f, a, b[, n])` | Simpson's rule variant (numeric layer) |
| `gaussQuad(f, a, b[, n])` | Gauss–Legendre quadrature |
| `romberg(f, a, b[, tol])` | Romberg integration |
| `nintegrate(f, a, b[, tol])` | Adaptive numerical integration |

```typescript
import { simpson, gaussQuad, romberg } from '@danielsimonjr/mathts-functions';

simpson(Math.sin, 0, Math.PI, 100); // ~2.0
gaussQuad(Math.sin, 0, Math.PI, 5); // ~2.0
romberg(Math.sin, 0, Math.PI);      // ~2.0
```

---

## Interpolation & Curve Fitting

| Function | Description |
|---|---|
| `linearInterp(xs, ys, x)` | Piecewise linear interpolation |
| `lagrangeInterp(xs, ys, x)` | Lagrange polynomial interpolation |
| `cubicSpline(xs, ys)` | Natural cubic spline → evaluator |
| `cspline(xs, ys)` | Cubic spline (numeric layer) |
| `hermiteInterp(xs, ys, dys, x)` | Hermite interpolation |
| `pchipInterp(xs, ys)` / `pchip(xs, ys)` | Shape-preserving PCHIP spline |
| `polyFit(xs, ys, degree)` | Least-squares polynomial fit |
| `interpolate(xs, ys, x[, method])` | General interpolation dispatcher |
| `griddata(xs, ys, values, xi, yi)` | Scattered-data interpolation to a grid |
| `rbfInterpolate(centers, values, query)` | Radial basis function interpolation |
| `loess(xs, ys, x[, bandwidth])` | LOESS local regression |
| `chebyshevApprox(f, a, b, n)` | Chebyshev polynomial approximation |
| `padeApproximant(coeffs, m, n)` | Padé approximant |
| `bezierCurve(controlPoints, t)` | Bézier curve evaluation |
| `bspline(controlPoints, degree, t)` | B-spline curve evaluation |
| `curvefit(xs, ys, model, p0)` | Nonlinear curve fitting |
| `expfit(xs, ys)` | Exponential fit `a·exp(b·x)` |
| `logfit(xs, ys)` | Logarithmic fit |
| `powerfit(xs, ys)` | Power-law fit |

---

## Numerical Methods

Root-finding, optimization, linear systems, and differential equations.

| Function | Description |
|---|---|
| `findRoot(f, a, b[, opts])` | Bracketed root-finding (bisection/Brent) |
| `linsolve(A, b)` | Solve a linear system `Ax = b` |
| `leastSquares(A, b)` | Least-squares solution (overdetermined) |
| `minimize(f, x0[, opts])` | Local minimization |
| `maximize(f, x0[, opts])` | Local maximization |
| `globalMinimize(f, bounds[, opts])` | Global minimization |
| `linprog(c, A, b[, opts])` | Linear programming |
| `quadprog(Q, c, A, b[, opts])` | Quadratic programming |
| `solveODE(f, tspan, y0[, opts])` | ODE solver (factory layer) |
| `solveODESystem(fs, tspan, y0)` | System of ODEs |
| `solveBVP(...)` | Boundary value problem solver |
| `solvePDE(...)` | PDE solver |
| `stiffODESolver(...)` | Stiff-ODE solver |
| `odeAdaptiveStep(...)` | Adaptive-step ODE integration |
| `eventDetection(...)` | ODE event detection |
| `cond(A)` | Condition number |
| `rank(A)` | Numerical rank |
| `nullspace(A)` | Null-space basis |
| `residue(b, a)` | Partial-fraction residues |

```typescript
import { findRoot, minimize, leastSquares } from '@danielsimonjr/mathts-functions';

findRoot(x => x**3 - x - 2, 1, 2);  // ~1.5214
minimize(x => (x - 3)**2, 0);       // ~3.0
leastSquares([[1,0],[1,1],[1,2]], [1,2,3]); // [1, 1]
```

---

## Signal Processing

Parallel `Float64Array` transforms (`parallel*`) run in worker threads and
return a `Promise`.

| Function | Description |
|---|---|
| `parallelFFT(x)` | FFT → `Complex[]` |
| `parallelIFFT(X)` | Inverse FFT → `Float64Array` |
| `parallelFFTMagnitude(x)` | FFT magnitude spectrum |
| `parallelFFTPower(x)` | FFT power spectrum |
| `parallelConv(a, b)` | Convolution |
| `parallelXCorr(a, b)` | Cross-correlation |
| `parallelAutoCorr(a)` | Auto-correlation |
| `fft(x)` / `ifft(X)` | Discrete Fourier transform / inverse (factory layer) |
| `fft2d(matrix)` | 2D FFT |
| `fourier(f)` / `invFourier(F)` | Continuous Fourier transform |
| `dct(x)` / `idct(X)` | Discrete cosine transform / inverse |
| `dst(x)` / `idst(X)` | Discrete sine transform / inverse |
| `dwt(x[, wavelet])` | Discrete wavelet transform |
| `hilbertTransform(x)` | Hilbert transform |
| `convolve(a, b)` / `correlate(a, b)` | Convolution / correlation |
| `crossCorrelation(a, b)` / `autoCorrelation(a)` | Cross / auto-correlation |
| `lowpassFilter(x, fc)` | Low-pass filter |
| `highpassFilter(x, fc)` | High-pass filter |
| `bandpassFilter(x, f1, f2)` | Band-pass filter |
| `medfilt(x[, window])` | Median filter |
| `windowFunction(n, type)` | Window functions (Hamming, Hann, …) |
| `resample(x, ratio)` | Signal resampling |
| `spectrogram(x[, opts])` | Spectrogram |
| `periodogram(x)` | Power spectral density estimate |
| `groupDelay(b, a, w)` | Filter group delay |
| `unwrapPhase(phase)` | Remove 2π phase discontinuities |
| `freqz(b, a)` | Digital filter frequency response (factory layer) |
| `zpk2tf(z, p, k)` | Zero-pole-gain → transfer function (factory layer) |

```typescript
import { parallelFFT, parallelConv, windowFunction } from '@danielsimonjr/mathts-functions';

const signal = new Float64Array(1024).map((_, i) => Math.sin(2*Math.PI*i/64));
const spectrum = await parallelFFT(signal);
const filtered = await parallelConv(signal, new Float64Array([0.25, 0.5, 0.25]));
```

---

## Geometry

Geometric operations on 2D/3D/nD coordinate arrays.

| Function | Description |
|---|---|
| `angle2D(v1, v2)` / `angle3D(v1, v2)` | Angle between vectors |
| `cross3D(a, b)` / `dot3D(a, b)` | 3D cross / dot product |
| `triangleArea(a, b, c)` | Triangle area |
| `polygonArea(vertices)` | Polygon area (shoelace) |
| `polygonPerimeter(vertices)` | Polygon perimeter |
| `area(shape)` | Area of a shape |
| `centroid(polygon)` | Centroid of a polygon |
| `convexHull(points)` | Convex hull (Graham scan) |
| `pointInPolygon(point, polygon)` | Ray-casting containment test |
| `rotateVector2D(v, angle)` / `rotateVector3D(v, axis, angle)` | Vector rotation |
| `reflectVector(v, normal)` | Reflection across a plane |
| `projectVector(v, onto)` | Vector projection |
| `distance2D(a, b)` / `distance3D(a, b)` / `distanceND(a, b)` | Euclidean distance |
| `distancePointToLine2D(point, lineA, lineB)` | Point-to-line distance |
| `manhattanDistance(a, b)` | L1 distance |
| `chebyshevDistance(a, b)` | L∞ distance |
| `minkowskiDistance(a, b, p)` | Lp distance |
| `distance(...)` | mathjs-style distance (factory layer) |
| `intersectLines2D(p1, d1, p2, d2)` | Line intersection |
| `intersectSegments2D(a1, a2, b1, b2)` | Segment intersection |
| `intersect(...)` | mathjs-style intersection (factory layer) |
| `coordinateTransform(point, from, to)` | Coordinate-system conversion |
| `delaunayTriangulation(points)` | Delaunay triangulation |
| `voronoiDiagram(points)` | Voronoi diagram |
| `kdTree(points)` / `kdTreeNearest(tree, query)` | k-d tree + nearest query |
| `nearestNeighbor(points, query)` | Nearest-neighbour search |

```typescript
import { convexHull, distance2D, delaunayTriangulation } from '@danielsimonjr/mathts-functions';

distance2D([0, 0], [3, 4]);                          // 5
convexHull([[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]);     // [[0,0],[1,0],[1,1],[0,1]]
```

---

## Graph Theory

Algorithms over adjacency-matrix representations.

| Function | Description |
|---|---|
| `adjacencyMatrix(edges, n)` | Build adjacency matrix from an edge list |
| `shortestPath(adj, start, end)` | Dijkstra shortest path (node sequence) |
| `graphDistance(adj, start, end)` | Shortest-path length |
| `minimumSpanningTree(adj)` | MST (Prim) → edge list |
| `connectedComponents(adj)` | Connected components |
| `stronglyConnectedComponents(adj)` | SCCs (Kosaraju) |
| `topologicalSort(adj)` | Topological order (DAGs) |
| `isConnected(adj)` | Connectivity test |

---

## Hypothesis Tests

All return structured result objects.

| Function | Returns | Description |
|---|---|---|
| `studentTTest(sample1[, sample2])` | `TTestResult` | One/two-sample t-test |
| `chiSquareTest(observed, expected)` | `ChiSquareResult` | Chi-square test |
| `anova(groups)` | `AnovaResult` | One-way ANOVA |
| `kolmogorovSmirnovTest(sample[, sample2])` | `KSTestResult` | K-S test |
| `mannWhitneyTest(sample1, sample2)` | `MannWhitneyResult` | Mann–Whitney U test |
| `shapiroWilkTest(sample)` | `ShapiroWilkResult` | Normality test |
| `principalComponentAnalysis(data[, k])` | `PCAResult` | PCA |

```typescript
import { studentTTest, anova } from '@danielsimonjr/mathts-functions';

studentTTest([2.1,2.5,2.3], [3.1,3.5,2.9]);
// { t, pValue, degreesOfFreedom, significant }
```

---

## Set Operations

| Function | Description |
|---|---|
| `setUnion(...sets)` | Union |
| `setIntersect(...sets)` | Intersection |
| `setDifference(a, b)` | Difference |
| `setSymDifference(a, b)` | Symmetric difference |
| `setCartesian(a, b)` | Cartesian product |
| `setPowerset(a)` | Power set |
| `setDistinct(a)` | Distinct elements |
| `setMultiplicity(e, a)` | Element multiplicity |
| `setIsSubset(a, b)` | Subset test |
| `setSize(a)` | Set cardinality |

---

## Units

| Function | Description |
|---|---|
| `unit(value, unit)` | Construct a `Unit` |
| `createUnit(defs)` | Define custom units (`factory_createUnit`) |
| `to(unit, target)` | Convert between units |
| `toBest(unit)` | Convert to the best-fitting prefix |
| `splitUnit(unit, parts)` | Split a unit into components |

---

## Physical Constants

52 CODATA physical constants are exported as **values** (not callable
functions). Full values and units are listed in
[`constants.md`](./constants.md). Exported names:

`atomicMass`, `avogadro`, `bohrMagneton`, `bohrRadius`, `boltzmann`,
`classicalElectronRadius`, `conductanceQuantum`, `coulomb`, `coulombConstant`,
`deuteronMass`, `efimovFactor`, `electricConstant`, `electronMass`,
`elementaryCharge`, `faraday`, `fermiCoupling`, `fineStructure`,
`firstRadiation`, `gasConstant`, `gravitationConstant`, `gravity`,
`hartreeEnergy`, `inverseConductanceQuantum`, `josephson`, `klitzing`,
`loschmidt`, `magneticConstant`, `magneticFluxQuantum`, `molarMass`,
`molarMassC12`, `molarPlanckConstant`, `molarVolume`, `neutronMass`,
`nuclearMagneton`, `planckCharge`, `planckConstant`, `planckLength`,
`planckMass`, `planckTemperature`, `planckTime`, `protonMass`,
`quantumOfCirculation`, `reducedPlanckConstant`, `rydberg`, `sackurTetrode`,
`secondRadiation`, `speedOfLight`, `stefanBoltzmann`, `thomsonCrossSection`,
`vacuumImpedance`, `weakMixingAngle`, `wienDisplacement`.

---

## Complex Number Utilities

| Function | Description |
|---|---|
| `arg(z)` | Phase angle |
| `conj(z)` | Complex conjugate |
| `re(z)` | Real part |
| `im(z)` | Imaginary part |

---

## Type Conversion

Convert a value into a specific numeric or container type.

| Function | Description |
|---|---|
| `number(x)` | Convert to a primitive `number` |
| `bigint(x)` | Convert to a `bigint` |
| `bignumber(x)` | Convert to an arbitrary-precision `BigNumber` |
| `fraction(x)` | Convert to an exact `Fraction` |
| `complex(re[, im])` | Convert to / construct a `Complex` |
| `matrix(data)` | Convert to a dense `DenseMatrix` |
| `sparse(data)` | Convert to a `SparseMatrix` (CSC storage) |
| `string(x)` | Convert to a `string` |
| `boolean(x)` | Convert to a `boolean` |

The factory-layer `numeric(x, type)` (see below) is a single-entry dispatcher
over the same conversions.

---

## Type Checking & Utilities

| Function | Description |
|---|---|
| `typeOf(x)` | Runtime type name |
| `clone(x)` | Deep clone |
| `numeric(x, type)` | Convert to a numeric type |
| `isNumeric(x)` / `hasNumericValue(x)` | Numeric tests |
| `isNaN(x)` / `isFinite(x)` / `isBounded(x)` | Value tests |
| `isZero(x)` / `isPositive(x)` / `isNegative(x)` | Sign tests |
| `isInteger(x)` | Integer test |
| `isPrime(x)` | Primality test |
| `format(x[, opts])` | Format a value as a string |
| `print(template, values)` | Interpolate values into a template |
| `bin(x)` / `hex(x)` / `oct(x)` | Binary / hex / octal string |
| `chain(value)` | Start a chained-operation `Chain` |

---

## Expression Evaluation

| Function | Description |
|---|---|
| `evaluate(expr[, scope])` | Evaluate an expression string |
| `compileExpr(expr)` | Compile once, evaluate many |
| `parse(expr)` | Parse an expression into an AST node |
| `parser()` | Create a stateful parser with a scope retained across calls |
| `reviver(key, value)` | `JSON.parse` reviver — restores `Complex`, `Fraction`, non-finite numbers |
| `replacer(key, value)` | `JSON.stringify` replacer — serialises `Complex`, `Fraction`, non-finite numbers |

```typescript
import { evaluate, compileExpr } from '@danielsimonjr/mathts-functions';

evaluate('2 + 3 * 4');          // 14
evaluate('pi * r^2', { r: 5 }); // 78.5398...

const fn = compileExpr('x^2 + 2*x + 1');
fn.evaluate({ x: 3 });          // 16
```

---

## Parallel Return Type

`Float64Array` inputs to arithmetic and trig functions return a
`ParallelResult<Float64Array>`. Statistics and signal functions return the
value type directly as a `Promise`. Unwrap arithmetic/trig results with
`.result`.

The worker pool is created lazily on first use. `initializePool()`,
`getComputePool()`, and `terminatePool()` provide explicit lifecycle control —
call `terminatePool()` to release worker threads (for example, before process
exit).

```typescript
import { add } from '@danielsimonjr/mathts-functions';

const pr = await add(new Float64Array([1,2,3]), new Float64Array([4,5,6]));
// pr.result       → Float64Array([5, 7, 9])
// pr.duration     → elapsed ms
// pr.chunks       → number of work chunks
// pr.parallelized → true
```
