# Function Reference

All functions are exported from `@danielsimonjr/mathts-functions`.

Functions support multiple numeric types via typed-function dispatch. `Float64Array` inputs automatically run in parallel worker threads and return a `Promise`.

```typescript
import { add, sin, parallelFFT } from '@danielsimonjr/mathts-functions';
```

---

## Arithmetic

| Function | Description | Types |
|---|---|---|
| `add(a, b)` | Addition | number, bigint, Complex, Fraction, Float64Array |
| `subtract(a, b)` | Subtraction | number, bigint, Complex, Fraction, Float64Array |
| `multiply(a, b)` | Multiplication | number, bigint, Complex, Fraction, Float64Array |
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

```typescript
import { add, pow, log, mod } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';

add(1, 2);                                   // 3
add(new Fraction(1n, 3n), new Fraction(1n, 6n)); // Fraction(1, 2)
pow(new Complex(0, 1), 2);                   // Complex(-1, 0)
log(100, 10);                                // 2
mod(17, 5);                                  // 2
```

---

## Trigonometry

Functions support `number`, `Complex`, `BigNumber`, and parallel `Float64Array` inputs.

| Function | Description |
|---|---|
| `sin(x)` | Sine |
| `cos(x)` | Cosine |
| `tan(x)` | Tangent |
| `csc(x)` | Cosecant |
| `sec(x)` | Secant |
| `cot(x)` | Cotangent |
| `asin(x)` | Arcsine |
| `acos(x)` | Arccosine |
| `atan(x)` | Arctangent |
| `atan2(y, x)` | Two-argument arctangent |
| `acsc(x)` | Arc cosecant |
| `asec(x)` | Arc secant |
| `acot(x)` | Arc cotangent |
| `asinh(x)` | Inverse hyperbolic sine |
| `acosh(x)` | Inverse hyperbolic cosine |
| `atanh(x)` | Inverse hyperbolic tangent |
| `toRadians(deg)` | Convert degrees to radians |
| `toDegrees(rad)` | Convert radians to degrees |
| `hypot(a, b)` | Hypotenuse `sqrt(a² + b²)` |

```typescript
import { sin, cos, atan2, toRadians } from '@danielsimonjr/mathts-functions';
import { PI } from '@danielsimonjr/mathts-core';

sin(PI / 6);              // 0.5
cos(new Complex(0, 1));   // Complex(cosh(1), 0) ≈ Complex(1.543, 0)

// Parallel Float64Array
const angles = new Float64Array([0, PI/6, PI/4, PI/3, PI/2]);
const sines = await sin(angles);   // Float64Array([0, 0.5, 0.707, 0.866, 1])

toDegrees(PI);             // 180
toRadians(90);             // 1.5707963267948966
```

---

## Statistics

All statistics functions accept `Float64Array` for parallel execution and return `Promise<T>`. Scalar overloads (2–4 numbers) are synchronous.

| Function | Description |
|---|---|
| `parallelStatSum(a)` | Sum of all elements |
| `parallelStatMean(a)` | Arithmetic mean |
| `parallelStatVariance(a[, type])` | Variance (`'unbiased'` / `'uncorrected'` / `'biased'`) |
| `parallelStatStd(a[, type])` | Standard deviation |
| `parallelStatMin(a)` | Minimum value |
| `parallelStatMax(a)` | Maximum value |
| `parallelStatMinMax(a)` | `{ min, max }` in one pass |
| `parallelStatMedian(a)` | Median |
| `parallelStatMode(a)` | Mode (most frequent value) |
| `parallelStatProd(a)` | Product of elements |
| `parallelStatNorm(a[, p])` | p-norm |
| `parallelStatDistance(a, b)` | Euclidean distance |
| `parallelStatCorr(a, b)` | Pearson correlation coefficient |
| `parallelStatMAD(a)` | Median absolute deviation |
| `parallelStatCumsum(a)` | Cumulative sum |
| `parallelStatQuantile(a, q)` | q-th quantile (0–1) |
| `parallelStatHistogram(a, bins)` | Histogram bin counts |

```typescript
import {
  parallelStatMean, parallelStatStd, parallelStatCorr
} from '@danielsimonjr/mathts-functions';

const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);

const mean = await parallelStatMean(data);            // 5
const std  = await parallelStatStd(data);             // 2

const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([2, 4, 6, 8]);
const r = await parallelStatCorr(a, b);               // 1.0 (perfect correlation)
```

---

## Signal Processing

All signal functions operate on `Float64Array` and execute in parallel workers.

| Function | Description |
|---|---|
| `parallelFFT(x)` | Fast Fourier Transform → `Complex[]` |
| `parallelIFFT(X)` | Inverse FFT → `Float64Array` |
| `parallelFFTMagnitude(x)` | FFT magnitude spectrum |
| `parallelFFTPower(x)` | FFT power spectrum |
| `parallelConv(a, b)` | Discrete convolution |
| `parallelXCorr(a, b)` | Cross-correlation |
| `parallelAutoCorr(a)` | Auto-correlation |

```typescript
import {
  parallelFFT, parallelFFTMagnitude, parallelConv
} from '@danielsimonjr/mathts-functions';

// FFT of a 1024-point signal
const signal = new Float64Array(1024).map((_, i) => Math.sin(2 * Math.PI * i / 64));
const spectrum  = await parallelFFT(signal);
const magnitude = await parallelFFTMagnitude(signal);

// Convolution
const impulseResponse = new Float64Array([0.25, 0.5, 0.25]);
const filtered = await parallelConv(signal, impulseResponse);
```

---

## Linear Algebra (Factory Functions)

These come from the activated mathjs factory layer:

| Function | Description |
|---|---|
| `det(A)` | Determinant |
| `inv(A)` | Matrix inverse |
| `transpose(A)` | Matrix transpose |
| `multiply(A, B)` | Matrix multiplication |
| `eigs(A)` | Eigenvalues and eigenvectors |
| `lusolve(A, b)` | Solve `Ax = b` via LU decomposition |
| `schur(A)` | Schur decomposition |
| `sylvester(A, B, C)` | Solve `AX + XB = C` |
| `lyap(A, Q)` | Solve Lyapunov equation |
| `rotationMatrix(angle, axis)` | 3D rotation matrix |
| `rotate(v, angle[, axis])` | Rotate a vector |

```typescript
import { det, inv, eigs, lusolve } from '@danielsimonjr/mathts-functions';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const A = new DenseMatrix([[2, 1], [5, 3]]);

det(A);          // 1
inv(A);          // DenseMatrix [[3,-1],[-5,2]]

// Solve Ax = b
const b = new DenseMatrix([[1], [2]]);
lusolve(A, b);   // DenseMatrix [[1], [-1]]

// Eigenvalues
const { values, vectors } = eigs(A);
```

---

## Algebra (Factory Functions)

| Function | Description |
|---|---|
| `simplify(expr)` | Simplify a symbolic expression |
| `derivative(expr, var)` | Symbolic derivative |
| `rationalize(expr)` | Convert to rational form |
| `symbolicEqual(a, b)` | Test symbolic equality |

---

## Expression Evaluation

```typescript
import { evaluate, compileExpr, parse } from '@danielsimonjr/mathts-functions';

evaluate('2 + 3 * 4');           // 14
evaluate('sqrt(16) + 2');        // 6
evaluate('pi * r^2', { r: 5 }); // 78.53981633974483

// Compile once, evaluate many times
const fn = compileExpr('x^2 + 2*x + 1');
fn({ x: 3 });   // 16
fn({ x: 4 });   // 25
```

---

## Complex Number Utilities (Factory Functions)

| Function | Description |
|---|---|
| `arg(z)` | Phase angle of complex number |
| `conj(z)` | Complex conjugate |
| `re(z)` | Real part |
| `im(z)` | Imaginary part |

---

## Special Functions

Functions dispatch on `number`. All are exported from `@danielsimonjr/mathts-functions`.

| Function | Description |
|---|---|
| `erfc(x)` | Complementary error function: `1 - erf(x)` |
| `beta(a, b)` | Beta function: `Γ(a)·Γ(b) / Γ(a+b)` |
| `gammainc(a, x)` | Regularized lower incomplete gamma `P(a, x)` |
| `digamma(x)` | Digamma function: `d/dx ln(Γ(x))` |
| `besselJ0(x)` | Bessel function first kind, order 0: `J₀(x)` |
| `besselJ1(x)` | Bessel function first kind, order 1: `J₁(x)` |
| `besselY0(x)` | Bessel function second kind, order 0: `Y₀(x)`, `x > 0` |
| `besselY1(x)` | Bessel function second kind, order 1: `Y₁(x)`, `x > 0` |

```typescript
import { erfc, beta, gammainc, digamma, besselJ0, besselJ1, besselY0, besselY1 } from '@danielsimonjr/mathts-functions';

erfc(0);         // 1
erfc(1);         // ~0.1573
beta(2, 3);      // ~0.0833 (= 1/12)
beta(0.5, 0.5);  // pi
gammainc(1, 1);  // ~0.6321 (= 1 - 1/e)
digamma(1);      // ~-0.5772 (Euler–Mascheroni constant)
besselJ0(0);     // 1
besselJ1(0);     // 0
besselY0(1);     // ~0.0883
besselY1(1);     // ~-0.7812
```

---

## Probability Distributions

Probability density/mass functions and information-theoretic measures. All dispatch on `number` or `number, number` inputs.

| Function | Description |
|---|---|
| `normalPDF(x[, mu, sigma])` | Normal PDF — default `mu=0, sigma=1` |
| `normalCDF(x[, mu, sigma])` | Normal CDF via erf approximation |
| `exponentialPDF(x, lambda)` | Exponential PDF: `λ·e^{-λx}` for `x ≥ 0` |
| `exponentialCDF(x, lambda)` | Exponential CDF: `1 - e^{-λx}` |
| `poissonPMF(k, lambda)` | Poisson PMF: `e^{-λ}·λ^k / k!` |
| `binomialPMF(k, n, p)` | Binomial PMF: `C(n,k)·p^k·(1-p)^{n-k}` |
| `geometricPMF(k, p)` | Geometric PMF: `(1-p)^{k-1}·p`, `k ≥ 1` |
| `bernoulliPMF(k, p)` | Bernoulli PMF: `p` if `k=1`, `1-p` if `k=0` |
| `entropy(probs)` | Shannon entropy in bits: `-Σ p·log₂(p)` |
| `jsDivergence(p, q)` | Jensen–Shannon divergence (symmetric KL) |

```typescript
import { normalPDF, normalCDF, poissonPMF, binomialPMF, entropy } from '@danielsimonjr/mathts-functions';

normalPDF(0);           // ~0.3989 (standard normal peak)
normalPDF(1, 0, 2);     // ~0.1760 (mu=0, sigma=2)
normalCDF(0);           // 0.5
poissonPMF(2, 3);       // ~0.2240 (k=2, lambda=3)
binomialPMF(3, 10, 0.5); // ~0.1172
entropy([0.5, 0.5]);    // 1.0 (1 bit)
entropy([1, 0]);        // 0.0 (no uncertainty)
```

---

## Numerical Integration

Four quadrature methods exported from `@danielsimonjr/mathts-functions`. These use plain function exports (not typed dispatch) because they accept callback arguments.

| Function | Description |
|---|---|
| `trapz(y[, x])` | Trapezoidal rule on sampled data |
| `simpson(f, a, b, n?)` | Simpson's 1/3 rule, `n` must be even |
| `gaussQuad(f, a, b, n?)` | Gauss–Legendre quadrature, `n` in 2–5 |
| `romberg(f, a, b, tol?)` | Romberg integration via Richardson extrapolation |

```typescript
import { trapz, simpson, gaussQuad, romberg } from '@danielsimonjr/mathts-functions';

// Trapezoidal rule on sampled data
trapz([1, 2, 3], [0, 1, 2]);  // 4
trapz([0, 1, 0]);              // 1 (uniform h=1 spacing)

// Integrate sin(x) from 0 to pi — exact answer is 2
simpson(Math.sin, 0, Math.PI, 100);        // ~2.0 (Simpson's rule)
gaussQuad(Math.sin, 0, Math.PI, 5);        // ~2.0 (5-point Gauss–Legendre)
romberg(Math.sin, 0, Math.PI);             // ~2.0 (adaptive Romberg)
```

---

## Interpolation

Six interpolation methods for fitting curves through data points.

| Function | Description |
|---|---|
| `linearInterp(xs, ys, x)` | Piecewise linear interpolation; extrapolates outside range |
| `lagrangeInterp(xs, ys, x)` | Lagrange polynomial through all `n` data points |
| `cubicSpline(xs, ys)` | Natural cubic spline — returns evaluator `(x) => number` |
| `hermiteInterp(xs, ys, dys, x)` | Hermite interpolation with derivative data `dys` |
| `pchipInterp(xs, ys)` | Shape-preserving PCHIP spline — returns evaluator |
| `polyFit(xs, ys, degree)` | Least-squares polynomial fit — returns coefficient array |

```typescript
import { linearInterp, lagrangeInterp, cubicSpline, polyFit } from '@danielsimonjr/mathts-functions';

linearInterp([0, 1, 2], [0, 1, 4], 1.5);   // 2.5
lagrangeInterp([0, 1, 2], [0, 1, 4], 1.5); // 2.25 (quadratic fit)

const spline = cubicSpline([0, 1, 2, 3], [0, 1, 4, 9]);
spline(1.5);  // smooth interpolation

const coeffs = polyFit([0, 1, 2, 3], [0, 1, 4, 9], 2);
// coeffs approximates [0, 0, 1] for x^2
```

---

## Extended Combinatorics

Factorial variants and combinatorial sequences. All dispatch on `number` inputs via typed-function.

| Function | Description |
|---|---|
| `fibonacci(n)` | nth Fibonacci number via fast doubling O(log n) |
| `lucas(n)` | nth Lucas number |
| `doubleFactorial(n)` | Double factorial: `n!! = n·(n-2)·(n-4)·…` |
| `risingFactorial(x, n)` | Pochhammer symbol: `x·(x+1)·…·(x+n-1)` |
| `fallingFactorial(x, n)` | Falling factorial: `x·(x-1)·…·(x-n+1)` |
| `subfactorial(n)` | Number of derangements `!n` |

```typescript
import { fibonacci, lucas, doubleFactorial, risingFactorial, subfactorial } from '@danielsimonjr/mathts-functions';

fibonacci(10);         // 55
fibonacci(20);         // 6765
lucas(10);             // 123
doubleFactorial(7);    // 105  (7!! = 7·5·3·1)
doubleFactorial(6);    // 48   (6!! = 6·4·2)
risingFactorial(3, 4); // 360  (3·4·5·6)
subfactorial(4);       // 9    (!4 = 9 derangements)
```

---

## Extended Geometry

Geometric operations on 2D/3D/nD coordinate arrays. All use plain number array inputs.

### Angle & Product Functions

| Function | Description |
|---|---|
| `angle2D(v1, v2)` | Angle between two 2D vectors (radians, `[0, π]`) |
| `angle3D(v1, v2)` | Angle between two 3D vectors (radians, `[0, π]`) |
| `cross3D(a, b)` | Cross product of two 3D vectors |
| `dot3D(a, b)` | Dot product of two 3D vectors |

### Area & Polygon Functions

| Function | Description |
|---|---|
| `triangleArea(a, b, c)` | Area of triangle from three 2D vertices |
| `polygonArea(vertices)` | Area of simple polygon via shoelace formula |
| `convexHull(points)` | Convex hull of a 2D point set (Graham scan) |
| `pointInPolygon(point, polygon)` | Ray-casting point-in-polygon test |

### Vector Transforms

| Function | Description |
|---|---|
| `rotateVector2D(v, angle)` | Rotate 2D vector by angle (radians) |
| `rotateVector3D(v, axis, angle)` | Rotate 3D vector around axis by angle |
| `reflectVector(v, normal)` | Reflect vector across a plane defined by normal |
| `projectVector(v, onto)` | Project vector `v` onto vector `onto` |

### Distance Functions

| Function | Description |
|---|---|
| `distance2D(a, b)` | Euclidean distance between two 2D points |
| `distance3D(a, b)` | Euclidean distance between two 3D points |
| `distanceND(a, b)` | Euclidean distance in N dimensions |
| `distancePointToLine2D(point, lineA, lineB)` | Distance from point to infinite line |

### Intersection Functions

| Function | Description |
|---|---|
| `intersectLines2D(p1, d1, p2, d2)` | Intersection of two infinite lines (point or null) |
| `intersectSegments2D(a1, a2, b1, b2)` | Intersection of two line segments (point or null) |

```typescript
import {
  angle2D, cross3D, triangleArea, convexHull,
  rotateVector2D, distance2D, distanceND
} from '@danielsimonjr/mathts-functions';

angle2D([1, 0], [0, 1]);                         // pi/2 (90°)
cross3D([1, 0, 0], [0, 1, 0]);                   // [0, 0, 1]
triangleArea([0,0], [3,0], [0,4]);               // 6
convexHull([[0,0],[1,0],[0,1],[1,1],[0.5,0.5]]); // [[0,0],[1,0],[1,1],[0,1]]
rotateVector2D([1, 0], Math.PI / 2);              // [0, 1]
distance2D([0, 0], [3, 4]);                       // 5
distanceND([0,0,0,0], [1,1,1,1]);                // 2
```

---

## Extended Signal Processing

Additional signal processing utilities beyond the core parallel FFT/convolution functions.

| Function | Description |
|---|---|
| `crossCorrelation(a, b)` | Cross-correlation of two sequences |
| `autoCorrelation(a)` | Auto-correlation of a sequence |
| `groupDelay(b, a, w)` | Group delay of a digital filter at frequencies `w` |
| `unwrapPhase(phase)` | Unwrap phase array by removing 2π discontinuities |

```typescript
import { crossCorrelation, autoCorrelation, unwrapPhase } from '@danielsimonjr/mathts-functions';

const a = [1, 2, 3];
const b = [0, 1, 2];
crossCorrelation(a, b);  // cross-correlation sequence

const sig = [1, 2, 1, 0];
autoCorrelation(sig);    // auto-correlation sequence

const phase = [0, 1, 2, 3 - 2 * Math.PI, 4 - 2 * Math.PI];
unwrapPhase(phase);      // [0, 1, 2, 3, 4] (discontinuity removed)
```

---

## Statistics Selection

O(n) selection algorithms that avoid full sorting.

| Function | Description |
|---|---|
| `quickSelect(arr, k)` | kth smallest element (0-indexed) in O(n) average time |
| `medianSelect(arr)` | Exact median using quickselect |
| `minSelect(arr, k)` | Array of the `k` smallest elements |
| `maxSelect(arr, k)` | Array of the `k` largest elements |

```typescript
import { quickSelect, medianSelect, minSelect, maxSelect } from '@danielsimonjr/mathts-functions';

quickSelect([3, 1, 4, 1, 5, 9, 2], 0);    // 1 (smallest)
quickSelect([3, 1, 4, 1, 5, 9, 2], 3);    // 3 (4th smallest)
medianSelect([3, 1, 4, 1, 5, 9, 2]);      // 3
minSelect([5, 3, 1, 4, 2], 3);            // [1, 2, 3]
maxSelect([5, 3, 1, 4, 2], 2);            // [5, 4]
```

---

## Parallel Return Type

`Float64Array` inputs to arithmetic and trig functions return a `ParallelResult<Float64Array>`. The statistics and signal functions return the value type directly as a `Promise`. Use `.result` to unwrap arithmetic/trig parallel results:

```typescript
import { add } from '@danielsimonjr/mathts-functions';

const a = new Float64Array([1, 2, 3]);
const b = new Float64Array([4, 5, 6]);

const pr = await add(a, b);
// pr.result      → Float64Array([5, 7, 9])
// pr.duration    → elapsed ms
// pr.chunks      → number of work chunks
// pr.parallelized → true
```
