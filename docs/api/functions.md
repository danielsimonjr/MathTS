# @danielsimonjr/mathts-functions API Reference

Mathematical functions with automatic type dispatch. 158 exports across 11 modules.

## Installation

```bash
npm install @danielsimonjr/mathts-functions
```

## Overview

All functions use typed-function for automatic type dispatch:

```typescript
import { add } from '@danielsimonjr/mathts-functions';

// Works with numbers
add(1, 2);                    // 3

// Works with Complex
add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)

// Works with Fraction
add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)

// Works with BigNumber
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber(0.3)
```

---

## Arithmetic Functions

### Basic Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `add` | `(a, b) => result` | Addition |
| `subtract` | `(a, b) => result` | Subtraction |
| `multiply` | `(a, b) => result` | Multiplication |
| `divide` | `(a, b) => result` | Division |
| `mod` | `(a, b) => result` | Modulo |
| `unaryMinus` | `(x) => result` | Negation |
| `unaryPlus` | `(x) => result` | Identity |

### Power & Roots

| Function | Signature | Description |
|----------|-----------|-------------|
| `pow` | `(base, exp) => result` | Power |
| `sqrt` | `(x) => result` | Square root |
| `cbrt` | `(x) => result` | Cube root |
| `nthRoot` | `(x, n) => result` | Nth root |
| `square` | `(x) => result` | x² |
| `cube` | `(x) => result` | x³ |

### Exponential & Logarithm

| Function | Signature | Description |
|----------|-----------|-------------|
| `exp` | `(x) => result` | e^x |
| `expm1` | `(x) => result` | e^x − 1 (accurate near 0) |
| `log` | `(x) => result` | Natural log |
| `log10` | `(x) => result` | Base-10 log |
| `log2` | `(x) => result` | Base-2 log |
| `log1p` | `(x) => result` | ln(1+x) (accurate near 0) |

### Absolute, Sign & Rounding

| Function | Signature | Description |
|----------|-----------|-------------|
| `abs` | `(x) => result` | Absolute value |
| `sign` | `(x) => result` | Sign (-1, 0, 1) |
| `round` | `(x, decimals?) => result` | Round to nearest |
| `floor` | `(x) => result` | Round down |
| `ceil` | `(x) => result` | Round up |
| `fix` | `(x) => result` | Truncate towards zero |

### Number Theory

| Function | Signature | Description |
|----------|-----------|-------------|
| `gcd` | `(a, b) => result` | Greatest common divisor |
| `lcm` | `(a, b) => result` | Least common multiple |
| `xgcd` | `(a, b) => result` | Extended GCD |
| `norm` | `(x, p?) => number` | p-norm |

### Example

```typescript
import { add, subtract, multiply, divide, pow, sqrt, abs } from '@danielsimonjr/mathts-functions';

add(1, 2);           // 3
subtract(5, 3);      // 2
multiply(3, 4);      // 12
divide(10, 2);       // 5
pow(2, 8);           // 256
sqrt(16);            // 4
abs(-5);             // 5
```

---

## Trigonometric Functions

### Basic Trig

| Function | Signature | Description |
|----------|-----------|-------------|
| `sin` | `(x) => result` | Sine |
| `cos` | `(x) => result` | Cosine |
| `tan` | `(x) => result` | Tangent |
| `cot` | `(x) => result` | Cotangent |
| `sec` | `(x) => result` | Secant |
| `csc` | `(x) => result` | Cosecant |

### Inverse Trig

| Function | Signature | Description |
|----------|-----------|-------------|
| `asin` | `(x) => result` | Arc sine |
| `acos` | `(x) => result` | Arc cosine |
| `atan` | `(x) => result` | Arc tangent |
| `atan2` | `(y, x) => result` | Two-argument arc tangent |
| `acsc` | `(x) => result` | Arc cosecant |
| `asec` | `(x) => result` | Arc secant |
| `acot` | `(x) => result` | Arc cotangent |

### Hyperbolic

| Function | Signature | Description |
|----------|-----------|-------------|
| `sinh` | `(x) => result` | Hyperbolic sine |
| `cosh` | `(x) => result` | Hyperbolic cosine |
| `tanh` | `(x) => result` | Hyperbolic tangent |
| `asinh` | `(x) => result` | Inverse hyperbolic sine |
| `acosh` | `(x) => result` | Inverse hyperbolic cosine |
| `atanh` | `(x) => result` | Inverse hyperbolic tangent |

### Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `toRadians` | `(deg) => number` | Degrees to radians |
| `toDegrees` | `(rad) => number` | Radians to degrees |
| `hypot` | `(...args) => number` | Hypotenuse |

### Example

```typescript
import { sin, cos, tan, atan2 } from '@danielsimonjr/mathts-functions';

sin(0);              // 0
cos(0);              // 1
tan(Math.PI / 4);    // ~1
atan2(1, 1);         // Math.PI / 4

// Works with Complex
sin(new Complex(0, 1)); // i * sinh(1)
```

---

## Statistical Functions

### Basic Statistics

| Function | Signature | Description |
|----------|-----------|-------------|
| `sum` | `(arr) => number` | Sum of array |
| `mean` | `(arr) => number` | Arithmetic mean |
| `median` | `(arr) => number` | Median value |
| `mode` | `(arr) => number[]` | Mode(s) |
| `min` | `(arr) => number` | Minimum |
| `max` | `(arr) => number` | Maximum |

### Variance & Deviation

| Function | Signature | Description |
|----------|-----------|-------------|
| `variance` | `(arr, normalization?) => number` | Variance |
| `std` | `(arr, normalization?) => number` | Standard deviation |
| `mad` | `(arr) => number` | Mean absolute deviation |

### Advanced

| Function | Signature | Description |
|----------|-----------|-------------|
| `prod` | `(arr) => number` | Product of array |
| `quantile` | `(arr, q) => number` | Quantile (0–1) |
| `histogram` | `(arr, bins) => number[]` | Histogram bin counts |
| `cumsum` | `(arr) => number[]` | Cumulative sum |
| `corr` | `(a, b) => number` | Pearson correlation |
| `distance` | `(a, b, type?) => number` | Statistical distance |

All statistics functions use parallel-first execution for arrays.

### Example

```typescript
import { sum, mean, std, min, max } from '@danielsimonjr/mathts-functions';

const data = [1, 2, 3, 4, 5];

sum(data);           // 15
mean(data);          // 3
std(data);           // ~1.58
min(data);           // 1
max(data);           // 5
```

---

## Signal Processing

### FFT

| Function | Signature | Description |
|----------|-----------|-------------|
| `parallelFFT` | `(x) => Complex[]` | Fast Fourier Transform |
| `parallelIFFT` | `(X) => Complex[]` | Inverse FFT |
| `parallelFFTMagnitude` | `(x) => number[]` | FFT magnitude spectrum |
| `parallelFFTPower` | `(x) => number[]` | FFT power spectrum |

### Convolution & Correlation

| Function | Signature | Description |
|----------|-----------|-------------|
| `parallelConv` | `(a, b) => number[]` | Convolution |
| `parallelXCorr` | `(a, b) => number[]` | Cross-correlation |
| `parallelAutoCorr` | `(a) => number[]` | Auto-correlation |
| `crossCorrelation` | `(a, b) => number[]` | Cross-correlation (alias) |
| `autoCorrelation` | `(a) => number[]` | Auto-correlation (alias) |

### Analysis

| Function | Signature | Description |
|----------|-----------|-------------|
| `groupDelay` | `(h) => number[]` | Group delay of filter |
| `unwrapPhase` | `(phase) => number[]` | Unwrap phase discontinuities |

### Example

```typescript
import { parallelFFT, parallelIFFT, parallelConv } from '@danielsimonjr/mathts-functions';

const signal = [1, 2, 3, 4];
const spectrum = await parallelFFT(signal);
const recovered = await parallelIFFT(spectrum);

const kernel = [1, 0, -1];
const filtered = await parallelConv(signal, kernel);
```

---

## Special Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `erfc` | `(x) => number` | Complementary error function |
| `beta` | `(a, b) => number` | Beta function B(a,b) |
| `gammainc` | `(x, a) => number` | Incomplete gamma function |
| `digamma` | `(x) => number` | Digamma function ψ(x) |
| `besselJ0` | `(x) => number` | Bessel J₀(x) |
| `besselJ1` | `(x) => number` | Bessel J₁(x) |
| `besselY0` | `(x) => number` | Bessel Y₀(x) |
| `besselY1` | `(x) => number` | Bessel Y₁(x) |

```typescript
import { erfc, beta, besselJ0 } from '@danielsimonjr/mathts-functions';

erfc(1.0);           // 0.1573...
beta(2, 3);          // 0.0833...
besselJ0(0);         // 1.0
```

---

## Probability Distributions

| Function | Signature | Description |
|----------|-----------|-------------|
| `normalPDF` | `(x, mu?, sigma?) => number` | Normal PDF |
| `normalCDF` | `(x, mu?, sigma?) => number` | Normal CDF |
| `exponentialPDF` | `(x, lambda) => number` | Exponential PDF |
| `exponentialCDF` | `(x, lambda) => number` | Exponential CDF |
| `poissonPMF` | `(k, lambda) => number` | Poisson PMF |
| `binomialPMF` | `(k, n, p) => number` | Binomial PMF |
| `geometricPMF` | `(k, p) => number` | Geometric PMF |
| `bernoulliPMF` | `(k, p) => number` | Bernoulli PMF |
| `entropy` | `(probs) => number` | Shannon entropy |
| `jsDivergence` | `(p, q) => number` | Jensen-Shannon divergence |

```typescript
import { normalPDF, normalCDF, poissonPMF } from '@danielsimonjr/mathts-functions';

normalPDF(0);        // 0.3989... (standard normal)
normalCDF(1.96);     // ~0.975
poissonPMF(3, 2);    // P(X=3) where lambda=2
```

---

## Geometry

| Function | Signature | Description |
|----------|-----------|-------------|
| `distance2D` | `(p1, p2) => number` | 2D Euclidean distance |
| `distance3D` | `(p1, p2) => number` | 3D Euclidean distance |
| `distanceND` | `(p1, p2) => number` | N-dimensional distance |
| `angle2D` | `(v1, v2) => number` | Angle between 2D vectors |
| `angle3D` | `(v1, v2) => number` | Angle between 3D vectors |
| `cross3D` | `(a, b) => number[]` | 3D cross product |
| `dot3D` | `(a, b) => number` | 3D dot product |
| `triangleArea` | `(p1, p2, p3) => number` | Triangle area |
| `polygonArea` | `(pts) => number` | Polygon area (shoelace) |
| `convexHull` | `(pts) => number[][]` | Convex hull |
| `pointInPolygon` | `(pt, poly) => boolean` | Point-in-polygon test |
| `rotateVector2D` | `(v, angle) => number[]` | Rotate 2D vector |
| `rotateVector3D` | `(v, axis, angle) => number[]` | Rotate 3D vector |
| `reflectVector` | `(v, normal) => number[]` | Reflect vector |
| `projectVector` | `(v, onto) => number[]` | Project vector |
| `distancePointToLine2D` | `(pt, l1, l2) => number` | Point to line distance |
| `intersectLines2D` | `(l1, l2) => number[] \| null` | Line intersection |
| `intersectSegments2D` | `(s1, s2) => number[] \| null` | Segment intersection |

```typescript
import { distance2D, convexHull, triangleArea } from '@danielsimonjr/mathts-functions';

distance2D([0,0], [3,4]);             // 5
triangleArea([0,0], [4,0], [0,3]);    // 6
```

---

## Interpolation

| Function | Signature | Description |
|----------|-----------|-------------|
| `linearInterp` | `(x, xs, ys) => number` | Linear interpolation |
| `lagrangeInterp` | `(x, xs, ys) => number` | Lagrange polynomial |
| `cubicSpline` | `(x, xs, ys) => number` | Natural cubic spline |
| `hermiteInterp` | `(x, xs, ys, ds) => number` | Hermite interpolation |
| `pchipInterp` | `(x, xs, ys) => number` | Piecewise cubic Hermite |
| `polyFit` | `(xs, ys, deg) => number[]` | Polynomial regression |

```typescript
import { cubicSpline, polyFit } from '@danielsimonjr/mathts-functions';

const xs = [0, 1, 2, 3];
const ys = [0, 1, 4, 9];
cubicSpline(1.5, xs, ys);      // ~2.25 (smooth interpolation)
const coeffs = polyFit(xs, ys, 2); // quadratic fit
```

---

## Numerical Integration

| Function | Signature | Description |
|----------|-----------|-------------|
| `trapz` | `(ys, xs?) => number` | Trapezoidal rule |
| `simpson` | `(ys, xs?) => number` | Simpson's rule |
| `gaussQuad` | `(f, a, b, n?) => number` | Gaussian quadrature |
| `romberg` | `(f, a, b, tol?) => number` | Romberg integration |

```typescript
import { trapz, gaussQuad } from '@danielsimonjr/mathts-functions';

const ys = [0, 0.25, 1, 2.25, 4];
trapz(ys);                          // ~2.0 (approx. integral of x²)
gaussQuad(x => x * x, 0, 2);       // ~2.6667 (exact)
```

---

## Combinatorics

| Function | Signature | Description |
|----------|-----------|-------------|
| `fibonacci` | `(n) => number` | Fibonacci number F(n) |
| `lucas` | `(n) => number` | Lucas number L(n) |
| `doubleFactorial` | `(n) => number` | n!! double factorial |
| `risingFactorial` | `(x, n) => number` | Pochhammer symbol |
| `fallingFactorial` | `(x, n) => number` | Falling factorial |
| `subfactorial` | `(n) => number` | Derangements D(n) |

```typescript
import { fibonacci, subfactorial } from '@danielsimonjr/mathts-functions';

fibonacci(10);        // 55
subfactorial(4);      // 9 (derangements of 4 items)
```

---

## Comparison Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `equal` | `(a, b) => boolean` | Equality |
| `smaller` | `(a, b) => boolean` | Less than |
| `larger` | `(a, b) => boolean` | Greater than |
| `smallerEq` | `(a, b) => boolean` | Less than or equal |
| `largerEq` | `(a, b) => boolean` | Greater than or equal |
| `compare` | `(a, b) => -1|0|1` | Three-way comparison |

---

## Rounding Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `round` | `(x, decimals?) => number` | Round to nearest |
| `floor` | `(x) => number` | Round down |
| `ceil` | `(x) => number` | Round up |
| `fix` | `(x) => number` | Truncate towards zero |

### Example

```typescript
import { round, floor, ceil } from '@danielsimonjr/mathts-functions';

round(2.5);          // 3
round(2.567, 2);     // 2.57
floor(2.9);          // 2
ceil(2.1);           // 3
```
