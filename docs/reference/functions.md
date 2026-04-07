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
