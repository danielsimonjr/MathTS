# Advanced MathTS Usage

This guide covers advanced topics including backend selection, parallel computing optimization, and performance tuning.

## Backend Selection

MathTS supports multiple computation backends:

| Backend  | Best For                            | Availability                |
| -------- | ----------------------------------- | --------------------------- |
| **JS**   | Small operations, compatibility     | Always available            |
| **WASM** | SIMD acceleration, medium data      | Node.js and modern browsers |
| **GPU**  | Large matrices, massive parallelism | WebGPU-enabled browsers     |

### Automatic Backend Selection

`DenseMatrix.zeros` allocates a JS-backed matrix. Backend selection happens on
**operations** (for example `multiply` above the WASM threshold, currently 256 elements
for dense matmul), not at construction time:

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const a = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);
const b = DenseMatrix.fromArray([
  [5, 6],
  [7, 8],
]);

// multiply() routes through BackendManager (WASM when built binary is loaded and n is large enough)
const product = a.multiply(b);
```

### Manual Backend Selection

For fine-grained control:

```typescript
import { DenseMatrix, JSBackend, WASMBackend, GPUBackend } from '@danielsimonjr/mathts-matrix';

const a = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);
const b = DenseMatrix.fromArray([
  [5, 6],
  [7, 8],
]);

const js = new JSBackend();
const jsResult = js.multiply(a, b); // DenseMatrix → DenseMatrix (sync)

const wasmBackend = new WASMBackend();
await wasmBackend.initialize();
if (wasmBackend.isAvailable()) {
  const wasmResult = wasmBackend.multiply(a, b);
}

const gpuBackend = new GPUBackend();
if (await gpuBackend.initialize()) {
  const gpuResult = await gpuBackend.matmul(
    new Float32Array(a.toArray().flat()),
    new Float32Array(b.toArray().flat()),
    2,
    2,
    2
  );
}
```

## Parallel Computing

### ComputePool Configuration

```typescript
import { ComputePool, computePool } from '@danielsimonjr/mathts-parallel';

// Pool sizing is set on the constructor (the exported singleton uses defaults)
const pool = new ComputePool({ maxWorkers: 8 });
await pool.initialize();

// The default export has no initialize() arguments
await computePool.initialize();

const stats = computePool.stats();
console.log('Total workers:', stats.totalWorkers);
console.log('Active tasks:', stats.activeTasks);
console.log('Pending tasks:', stats.pendingTasks);
```

### Parallelization Threshold

Small operations may be faster without parallelization overhead:

```typescript
// Operations below threshold run sequentially
const smallData = new Float64Array(100);
const result1 = await computePool.sum(smallData);
// result1.parallelized === false (below threshold)

// sum uses threshold 'never' — stays in-process at every size today
const largeData = new Float64Array(100000);
const result2 = await computePool.sum(largeData);
// result2.parallelized === false

// matmul parallelizes at or above 7,077,888 multiply-adds (aRows * aCols * bCols, 192×192×192);
// the threshold is inclusive
const big = await computePool.matmul(
  new Float64Array(192 * 192),
  192,
  192,
  new Float64Array(192 * 192),
  192
);
// big.parallelized === true when the pool is initialized (exactly 7,077,888 multiply-adds)
```

### Batch Operations

Run multiple independent operations in parallel:

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

const data1 = new Float64Array(50000).fill(1);
const data2 = new Float64Array(50000).fill(2);
const data3 = new Float64Array(50000).fill(3);

// Run all operations concurrently
const [sum1, sum2, sum3] = await Promise.all([
  computePool.sum(data1),
  computePool.sum(data2),
  computePool.sum(data3),
]);

console.log(sum1.result, sum2.result, sum3.result);
```

### Available Parallel Operations

```typescript
// Statistical operations
await computePool.sum(data);
await computePool.mean(data);
await computePool.variance(data); // Returns { mean, variance, std }
await computePool.std(data);
await computePool.min(data);
await computePool.max(data);
await computePool.minMax(data); // Returns { min, max, minIdx, maxIdx }

// Element-wise operations
await computePool.add(a, b);
await computePool.subtract(a, b);
await computePool.multiply(a, b);
await computePool.divide(a, b);
await computePool.scale(data, scalar);

// Unary operations
await computePool.abs(data);
await computePool.sqrt(data);
await computePool.exp(data);
await computePool.log(data);
await computePool.sin(data);
await computePool.cos(data);

// Matrix operations
await computePool.matmul(A, aRows, aCols, B, bCols);
await computePool.transpose(data, rows, cols);
await computePool.dot(a, b);

// Generic operations
await computePool.map(data, fn);
await computePool.reduce(data, fn, initial);
await computePool.filter(data, predicate);
```

## Performance Optimization

### Use Typed Arrays

```typescript
// Good: TypedArray for numeric data
const data = new Float64Array(10000);

// Avoid: Regular arrays for large numeric data
const slowData = new Array(10000); // Slower, more memory
```

### Reuse Buffers

```typescript
// Create buffer once
const buffer = new Float64Array(10000);

// Reuse for multiple operations
for (let i = 0; i < iterations; i++) {
  // Fill buffer with new data
  buffer.set(newData);

  // Process
  const result = await computePool.sum(buffer);
}
```

### Choose Right Matrix Format

```typescript
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

// Dense: Most elements are non-zero
const dense = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]);

// Sparse: Many zeros (>50% typically)
const sparse = SparseMatrix.fromDense(
  DenseMatrix.fromArray([
    [1, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 3, 0],
    [0, 0, 0, 4],
  ])
);

console.log('Sparse density:', sparse.density); // 0.25
console.log('Sparse nnz:', sparse.nnz); // 4
```

### Minimize Data Transfer

```typescript
// Bad: Multiple small transfers
for (const item of items) {
  await computePool.sum(new Float64Array([item]));
}

// Good: Single large transfer
const allData = new Float64Array(items);
await computePool.sum(allData);
```

## Type Dispatch System

MathTS uses typed-function for polymorphic dispatch:

```typescript
import { add } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

// Same function, different types
add(1, 2); // number + number
add(new Complex(1, 2), new Complex(3, 4)); // Complex + Complex
add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction + Fraction
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber + BigNumber

// Automatic type coercion
add(1, new Complex(2, 3)); // number coerced to Complex
```

### Custom Type Registration

```typescript
import { mathTyped } from '@danielsimonjr/mathts-core';

// Create a typed function
const myFunction = mathTyped('myFunction', {
  number: (x) => x * 2,
  Complex: (z) => z.multiply(new Complex(2, 0)),
  'number, number': (a, b) => a + b,
});

myFunction(5); // 10
myFunction(z); // Complex doubled
myFunction(1, 2); // 3
```

## Memory Management

### Worker Pool Cleanup

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

async function processData() {
  await computePool.initialize();

  try {
    // Do work...
    const result = await computePool.sum(data);
    return result;
  } finally {
    // Always terminate when done
    await computePool.terminate();
  }
}
```

### Large Matrix Handling

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// For very large matrices, consider chunking
async function processLargeMatrix(rows: number, cols: number) {
  const chunkSize = 1000;

  for (let i = 0; i < rows; i += chunkSize) {
    const chunk = DenseMatrix.zeros(Math.min(chunkSize, rows - i), cols);

    // Process chunk...

    // Allow GC between chunks
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
```

## Debugging

### Enable Verbose Logging

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

// Get detailed stats
const stats = computePool.stats();
console.log(JSON.stringify(stats, null, 2));

// Check result metadata
const result = await computePool.sum(data);
console.log('Parallelized:', result.parallelized);
console.log('Workers used:', result.workersUsed);
console.log('Duration (ms):', result.duration);
console.log('Chunks:', result.chunks);
```

### Performance Profiling

```typescript
// Measure operation time
const start = performance.now();
const result = await computePool.matmul(A, 1000, 1000, B, 1000);
const duration = performance.now() - start;

console.log(`Matrix multiply: ${duration.toFixed(2)}ms`);
console.log(`Internal duration: ${result.duration.toFixed(2)}ms`);
console.log(`Overhead: ${(duration - result.duration).toFixed(2)}ms`);
```

## Special Functions

MathTS provides high-accuracy special function implementations using polynomial approximations from Hart (1968) and the Abramowitz & Stegun handbook.

```typescript
import { erfc, beta, gammainc, digamma, besselJ0, besselJ1 } from '@danielsimonjr/mathts-functions';

// Complementary error function (useful in statistics and signal processing)
erfc(1); // ~0.1573 — P(|Z| > sqrt(2)) for standard normal
erfc(0); // 1.0

// Beta function (used in probability theory and combinatorics)
beta(0.5, 0.5); // pi (exact closed form)
beta(2, 3); // 1/12

// Regularized incomplete gamma (chi-squared CDF, Poisson CDF)
gammainc(1, 1); // ~0.6321

// Digamma (log-derivative of Gamma, used in Bayesian statistics)
digamma(1); // ~-0.5772 (Euler–Mascheroni constant)
digamma(0.5); // ~-1.9635

// Bessel functions (wave equations, cylindrical symmetry)
besselJ0(0); // 1.0
besselJ1(2.4048); // ~0 (first zero of J0 is a zero crossing for J1 derivative)
```

Since `functions@0.72.0` the special-function layer also covers inverse and scaled error
functions, exponential integrals, spherical Bessel/Hankel functions, angular-momentum coupling
coefficients and the Hurwitz zeta family:

```typescript
import {
  erfinv,
  erfcx,
  dawson,
  expIntegralE1,
  sphericalBesselJ,
  besselJZeros,
  besselJ,
  wigner3j,
  clebschGordan,
  sphericalHarmonic,
  hurwitzZeta,
  dirichletEta,
} from '@danielsimonjr/mathts-functions';

erfinv(0.5); // 0.47693628
erfcx(10); // 0.05614099  (≈ 1/(10·sqrt(pi)); no overflow for large x)
dawson(1); // 0.53807951
expIntegralE1(1); // 0.21938393
sphericalBesselJ(0, Math.PI); // 0  (sin(pi)/pi)
besselJZeros(0, 3); // [2.404826, 5.520078, 8.653728]
besselJ(0.5, 1); // 0.67139671  (real order ν: sqrt(2/pi)·sin(1))
wigner3j(1, 1, 0, 0, 0, 0); // -0.57735027  (= -1/sqrt(3))
clebschGordan(0.5, 0.5, 0.5, -0.5, 0, 0); // 0.70710678
sphericalHarmonic(1, 0, 0, 0).toString(); // '0.4886025119029199'  (Complex; = sqrt(3/(4pi)))
hurwitzZeta(2, 1); // 1.64493407  (= pi^2/6)
dirichletEta(1); // 0.69314718  (= ln 2)
```

## Numerical Integration

For integrating functions that have no closed-form antiderivative, MathTS provides the four classic quadrature methods below plus, since `functions@0.72.0`, tanh-sinh, Clenshaw–Curtis, Gauss–Hermite/Laguerre/Jacobi rules and double/triple integrals:

```typescript
import { trapz, simpson, gaussQuad, romberg } from '@danielsimonjr/mathts-functions';

const f = (x: number) => Math.exp(-x * x); // Gaussian integrand

// Trapezoidal rule: simple, works on sampled data
const xs = Array.from({ length: 101 }, (_, i) => -5 + i * 0.1);
const ys = xs.map(f);
trapz(ys, xs); // ~sqrt(pi) ≈ 1.7725

// Simpson's rule: higher order, callable with function
simpson(f, -5, 5, 100); // ~1.7725

// Gauss-Legendre: optimal for smooth functions (n=2..5 points)
gaussQuad(f, -5, 5, 5); // ~1.7725

// Romberg: adaptive accuracy via Richardson extrapolation
romberg(f, -5, 5, 1e-10); // ~1.7725 with high precision
```

**Choosing a method:**

| Method      | Best For                                | Notes                                               |
| ----------- | --------------------------------------- | --------------------------------------------------- |
| `trapz`     | Pre-sampled data (sensor readings, CSV) | O(n) with uniform or non-uniform x                  |
| `simpson`   | Smooth analytic functions               | n must be even; faster than trapz for same accuracy |
| `gaussQuad` | Very smooth functions on fixed interval | Exact for polynomials up to degree 2n-1             |
| `romberg`   | High-accuracy requirements              | Adaptive; converges until `tol` is met              |

### Added in 0.72.0: tanh-sinh, Clenshaw–Curtis, multiple integrals

```typescript
import {
  tanhSinh,
  clenshawCurtis,
  dblquad,
  gaussHermiteIntegrate,
} from '@danielsimonjr/mathts-functions';

const f = (x: number) => Math.exp(-x * x);

tanhSinh(f, -5, 5).value; // 1.7724538509  (sqrt(pi); `.error` holds the estimate)
clenshawCurtis(f, -5, 5, 64); // 1.7724538509
dblquad((y, x) => x * y, 0, 1, 0, 1).value; // 0.25  (inner limits may be functions of x)
gaussHermiteIntegrate((x) => x * x, 10); // 0.8862269255  (∫ x² e^{-x²} dx = sqrt(pi)/2)
```

| Method                  | Best For                                          | Notes                                                |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `tanhSinh`              | Endpoint singularities, very high accuracy        | Double-exponential rule; returns `{ value, error }`  |
| `clenshawCurtis`        | Smooth functions, cheap nested refinement         | `n`-point Chebyshev rule                             |
| `dblquad` / `tplquad`   | Rectangular or variable-limit 2-D / 3-D integrals | Inner limits are numbers or functions                |
| `gaussHermiteIntegrate` | Integrals against `e^{-x²}` on (−∞, ∞)            | Also `gaussLaguerreIntegrate` for `e^{-x}` on (0, ∞) |

## Interpolation

When you have discrete data points and need smooth values between them:

```typescript
import { linearInterp, cubicSpline, pchipInterp, polyFit } from '@danielsimonjr/mathts-functions';

const xs = [0, 1, 2, 3, 4, 5];
const ys = [0, 0.8, 0.9, 0.1, -0.8, -1.0];

// Linear: fast, no overshoot, piecewise
linearInterp(xs, ys, 1.5); // 0.85

// Natural cubic spline: smooth C² curve (can overshoot)
const spline = cubicSpline(xs, ys);
spline(2.5); // smooth interpolated value

// PCHIP: monotonicity-preserving (no spurious oscillations)
const pchip = pchipInterp(xs, ys);
pchip(2.5); // shape-preserving value

// Polynomial least-squares fit
const coeffs = polyFit(xs, ys, 3); // degree-3 polynomial coefficients
// coeffs[0]*x^3 + coeffs[1]*x^2 + coeffs[2]*x + coeffs[3]
```

**Choosing an interpolation method:**

| Method           | Best For                              | Notes                                  |
| ---------------- | ------------------------------------- | -------------------------------------- |
| `linearInterp`   | Monotone data, fast lookup            | No smoothness between points           |
| `lagrangeInterp` | Small datasets, exact fit             | Prone to Runge's phenomenon for n > 10 |
| `cubicSpline`    | Smooth curves through all data points | May oscillate if data is not smooth    |
| `hermiteInterp`  | When derivatives are known            | Requires `dy/dx` at each point         |
| `pchipInterp`    | Non-oscillating smooth curves         | Best for data with local monotonicity  |
| `polyFit`        | Trend fitting, noisy data             | Returns polynomial coefficients        |

## Algebra and Polynomial Operations

MathTS provides a complete algebra module for polynomial arithmetic and symbolic manipulation.

```typescript
import {
  polyval,
  polyadd,
  polymul,
  polyder,
  factor,
  expand,
  substitute,
} from '@danielsimonjr/mathts-functions';

// Polynomial evaluation using Horner's method
polyval([1, -3, 2], 4); // 1*16 - 3*4 + 2 = 6

// Polynomial arithmetic
polyadd([1, 2, 3], [4, 5]); // [1, 6, 8]   (x^2 + 6x + 8)
polymul([1, 1], [1, -1]); // [1, 0, -1]  (x+1)(x-1) = x^2-1
polyder([1, 2, 3], 1); // [2, 2]      d/dx (x^2+2x+3) = 2x+2

// Symbolic manipulation (expression strings)
factor('x^2 - 4'); // '(x - 2)(x + 2)'
expand('(a + b)^3'); // 'a^3 + 3*a^2*b + 3*a*b^2 + b^3'
substitute('x^2 + y', 'y', '2*x'); // 'x^2 + 2*x'
```

## Computer Algebra System (CAS)

Symbolic calculus and equation solving.

```typescript
import {
  integrate,
  limit,
  partialDerivative,
  taylor,
  solve,
  solveExact,
  laplace,
} from '@danielsimonjr/mathts-functions';

// Symbolic integration
integrate('x^2', 'x'); // 'x^3/3 + C'
integrate('sin(x)', 'x', 0, 3.14159); // ~2.0

// Limits
limit('sin(x)/x', 'x', 0); // '1'
limit('(1 + 1/n)^n', 'n', Infinity); // 'E'

// Partial derivatives
partialDerivative('x^2*y + y^3', 'y'); // '2*y^2 + x^2'

// Taylor series
taylor('exp(x)', 'x', 0, 4); // '1 + x + x^2/2 + x^3/6 + x^4/24'

// Solve equations
solve('x^2 - 5*x + 6', 'x'); // [2, 3]
solve('x^2 - 2', 'x'); // ['-sqrt(2)', 'sqrt(2)']
solveExact('sin(x) = 0', 'x'); // { roots: ['0', 'pi'], period: '2*pi' }
solveExact('cos(x) = 1/2', 'x'); // { roots: ['pi/3', '5*pi/3'], period: '2*pi' }
solve('exp(x) = 2', 'x'); // ['log(2)']
solve('cos(x) - x', 'x', { numeric: true, range: [0, 1] }); // [0.7390851332151607]

// Laplace transform
laplace('exp(-a*t)', 't', 's'); // '1/(s + a)'
```

### How `solve` answers

`solve` returns a finite list of the real or complex roots of an equation. It throws an `Error` when
no finite list holds the solutions. It never scans for roots unless you ask it to.

- `solve` reads the shape of the equation from its syntax tree. It never decides the shape from
  sample values: `sin(2*pi*x)` is zero at every integer and half-integer, and a sampled test
  reads it as the zero polynomial.
- A polynomial of degree 1 to 3 gives its roots in closed form: integers, `sqrt(n)` radicals,
  real numbers, or complex numbers. A polynomial of degree 4 or more gives its real roots, found
  with Sturm sequences over the whole real line (`realRoots`). These are floating-point numbers.
  A coefficient can be any real constant (`pi*x^4 - 1`).
- Each tolerance is relative to the size of the terms that made the value. A large root
  (`x^2 - 1e12` gives `-1000000` and `1000000`) and a small root (`x - 1e-10` gives `1e-10`,
  `x^2 - 1e-18` gives `-1e-9` and `1e-9`) keep their value. A root snaps to an integer only when
  that integer is a root of the polynomial: `x - 1.000000001` gives `1.000000001`, and `x - 1`
  gives `1`. The polynomial reader drops a coefficient only when it is the rounding noise of the
  terms that were added into it (`0.1*x^2 - 0.3*x^2 + 0.2*x^2` is zero).
- A polynomial of a degree above 1000 throws a `RangeError` (`PolynomialDegreeError`) that names
  the limit. The numeric scan has no such limit.
- An identity (`x^2 - x^2`, `0*x`, `x = x`) throws an `Error`: every value of the variable is a
  solution, and no finite list holds them. An equation with no real root (`1 = 2`, `x^4 + 1`) gives
  `[]`. So `[]` always means that the equation has no root, and never that it is an identity.
- An equation of the form `a*F(p*x + q) = b` with `F` equal to `exp`, `log`, `sqrt` or `abs` gives
  exact text roots (`exp(x) = 2` gives `'log(2)'`). The text roots are real roots: a value that
  `F` never takes (`exp(x) = -1`, `sqrt(x) = -1`) gives `[]`. A root of `abs(x) = 3` is the text
  `'-3'` or `'3'`, because every root of this form is text; the roots of the polynomial
  `x^2 - 9` are the numbers `-3` and `3`.
- The solutions of an equation with `sin`, `cos` or `tan` repeat with a period, so no finite list
  holds them. `solve` throws an `Error` that names `solveExact` and the period. A value that the
  function never takes (`sin(x) = 2`) gives `[]`.
- No digit of a root is a rounded result. A constant is exact when it is a small fraction, a
  special value of `sin`, `cos` or `tan` (`sqrt(2)/2`), or a decimal of at most 12 digits. A
  constant with no exact text (`sin(x) = sqrt(2)/3`) makes `solve` and `solveExact` throw an
  `Error` that names the constant and the rule.
- An equation with no closed form (`sin(x) = x`, `sin(x)^2 = 1/4`, `1/x = 2`) throws an
  `Error`. The message names the numeric scan. `solve` does not return `[]` for these
  equations.
- The numeric scan runs only when you pass `{ numeric: true, range: [a, b] }`. It looks for
  sign changes on a grid of `range` and refines each one with Brent's method. It does not look
  outside `range`. It can miss a pair of roots that are closer than one grid step, and a root
  of even multiplicity that is not on a grid point.

### Periodic solution sets: `solveExact`

`solveExact(equation, variable)` returns the exact solution set of an equation
`a*F(p*x + q) = b`, with `F` equal to `sin`, `cos`, `tan`, `exp`, `log`, `sqrt` or `abs`. The
result is a plain object, so it survives `JSON.stringify`, `structuredClone` and a worker
boundary:

```typescript
interface ExactSolution {
  roots: string[]; // the principal roots, one period of a periodic set
  period: string | null; // the period as text, or null when the set is finite
}
```

For a periodic set, add `k * period` to each root, for any integer `k`, to get all roots.

```typescript
solveExact('sin(x) = 1/2', 'x'); // { roots: ['pi/6', '5*pi/6'], period: '2*pi' }
solveExact('sin(x) = 1/3', 'x'); // { roots: ['asin(1/3)', 'pi - asin(1/3)'], period: '2*pi' }
solveExact('sin(2*pi*x) = 0', 'x'); // { roots: ['0', '1/2'], period: '1' }
solveExact('2*sin(3*x + pi/4) = 1', 'x'); // { roots: ['-pi/36', '7*pi/36'], period: '2*pi/3' }
solveExact('exp(x) = 2', 'x'); // { roots: ['log(2)'], period: null }
solveExact('sin(x) = 2', 'x'); // { roots: [], period: null }
```

- A special value gives a multiple of `pi`. Another value gives a symbolic inverse.
- The coefficient `p` is a fraction, or a fraction of `pi`. The offset `q` is a number, or a
  fraction of `pi`.
- `solveExact` takes only this form. A polynomial, or any other form, throws an `Error` that
  names `solve`.
- A constant with no exact text throws an `Error` that names the constant.

## Global Optimisation and Scalar Solvers

`differentialEvolution` and `simulatedAnnealing` are seeded, derivative-free global optimisers;
`minimizeConstrained` is an augmented-Lagrangian wrapper; `ridders` and `fixedPoint` are scalar
solvers; `finiteDifferenceCoefficients` returns Fornberg stencil weights.

```typescript
import {
  differentialEvolution,
  ridders,
  fixedPoint,
  finiteDifferenceCoefficients,
} from '@danielsimonjr/mathts-functions';

const rosenbrock = ([a, b]: number[]) => (1 - a) ** 2 + 100 * (b - a * a) ** 2;
const de = differentialEvolution(
  rosenbrock,
  [
    [-5, 5],
    [-5, 5],
  ],
  { seed: 1 }
);
de.x; // [1, 1]  (to 4 decimals)
de.fx; // 0  (to 8 decimals)
de.converged; // true

ridders((x) => Math.cos(x) - x, 0, 1); // 0.7390851332
fixedPoint(Math.cos, 1); // 0.7390851332
finiteDifferenceCoefficients(2, [-1, 0, 1]); // [1, -2, 1]  (central second derivative)
```

## Number Theory and Integer Matrices

```typescript
import {
  modPow,
  sqrtMod,
  legendreSymbol,
  isCarmichael,
  zeckendorf,
  pellSolve,
  linearDiophantine,
  frobeniusNumber,
  smithNormalForm,
  lll,
  realRoots,
} from '@danielsimonjr/mathts-functions';

modPow(2, 100, 1_000_000_007); // 976371285n  (always returns bigint)
sqrtMod(2, 7); // 3  (3² ≡ 2 mod 7); null when no square root exists
legendreSymbol(3, 7); // -1
isCarmichael(561); // true
zeckendorf(100); // [89, 8, 3]  (non-consecutive Fibonacci representation)
pellSolve(61); // { x: 1766319049n, y: 226153980n }  (fundamental solution of x² − 61y² = 1)
linearDiophantine(3, 5, 1); // { x: 2, y: -1, stepX: 5, stepY: -3 }
frobeniusNumber([6, 9, 20]); // 43  (the McNugget number)
smithNormalForm([
  [2, 4, 4],
  [-6, 6, 12],
  [10, -4, -16],
]).invariants; // [2n, 6n, 12n]
lll([
  [1, 1, 1],
  [-1, 0, 2],
  [3, 5, 6],
]); // [[0, 1, 0], [1, 0, 1], [-1, 0, 2]]
realRoots([-6, 11, -6, 1]); // ≈ [1, 2, 3]  (ascending coefficients: −6 + 11x − 6x² + x³; Sturm isolation)
```

## Signal Systems, Special Matrices and Geometry

```typescript
import {
  kaiserWindow,
  tf2ss,
  dtw,
  hilbertMatrix,
  hadamardMatrix,
  subspaceAngles,
  orient2D,
  polygonClip,
  douglasPeucker,
  hausdorffDistance,
} from '@danielsimonjr/mathts-functions';

kaiserWindow(5, 2); // [0.438676, 0.834761, 1, 0.834761, 0.438676]
tf2ss([1], [1, 3, 2]); // { A: [[-3, -2], [1, 0]], B: [[1], [0]], C: [[0, 1]], D: [[0]] }
dtw([1, 2, 3], [1, 2, 2, 3]); // { distance: 0, path: [[0,0],[1,1],[1,2],[2,3]] }
hilbertMatrix(3)[2]; // [0.3333333333333333, 0.25, 0.2]
hadamardMatrix(4)[1]; // [1, -1, 1, -1]
subspaceAngles([[1], [0]], [[0], [1]]); // [1.57079633]  (pi/2)
orient2D([0, 0], [1, 0], [0, 1]); // 1  (counter-clockwise)
polygonClip(
  [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
  [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ]
); // [[1,1],[2,1],[2,2],[1,2]]
douglasPeucker(
  [
    [0, 0],
    [1, 0.1],
    [2, -0.1],
    [3, 5],
    [4, 6],
    [5, 7],
  ],
  0.5
); // [[0,0],[2,-0.1],[3,5],[5,7]]
hausdorffDistance(
  [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
  [
    [1, 1],
    [3, 1],
    [3, 3],
    [1, 3],
  ]
); // 1.41421356
```

## Graph Theory

Graph algorithms on adjacency matrix representations.

```typescript
import {
  shortestPath,
  minimumSpanningTree,
  connectedComponents,
  topologicalSort,
} from '@danielsimonjr/mathts-functions';

// Weighted graph as adjacency matrix (0 = no edge)
const adj = [
  [0, 1, 4, 0],
  [1, 0, 2, 5],
  [4, 2, 0, 1],
  [0, 5, 1, 0],
];

// Dijkstra shortest path
shortestPath(adj, 0, 3); // [0, 2, 3]  (via node 2, cost 5)

// Minimum spanning tree (Prim's)
minimumSpanningTree(adj); // edge list of MST

// Find connected components
const disconnected = [
  [0, 1, 0, 0],
  [1, 0, 0, 0],
  [0, 0, 0, 1],
  [0, 0, 1, 0],
];
connectedComponents(disconnected); // [[0, 1], [2, 3]]

// Topological sort for DAG
const dag = [
  [0, 1, 1, 0],
  [0, 0, 0, 1],
  [0, 0, 0, 1],
  [0, 0, 0, 0],
];
topologicalSort(dag); // [0, 1, 2, 3] or [0, 2, 1, 3]
```

## Distribution Objects

Distribution object constructors return objects with `pdf`, `cdf`, `ppf` (quantile), and `sample` methods — a higher-level API than the standalone distribution functions.

```typescript
import { normalDist, tDist, gammaDist, binomialDist } from '@danielsimonjr/mathts-functions';

// Create distribution instances
const normal = normalDist(0, 1); // standard normal
normal.pdf(0); // ~0.3989
normal.cdf(1.96); // ~0.975  (95th percentile)
normal.ppf(0.975); // ~1.96   (inverse CDF)
normal.sample(100); // Float64Array of 100 samples

// t-distribution for small samples
const t10 = tDist(10);
t10.cdf(2.228); // ~0.975  (two-tailed, df=10)

// Gamma distribution
const gamma = gammaDist(2, 1);
gamma.pdf(1); // ~0.368
gamma.cdf(2); // ~0.594

// Binomial for discrete data
const binom = binomialDist(20, 0.5);
binom.pdf(10); // P(X=10) for n=20, p=0.5 ≈ 0.176
```

## Hypothesis Tests

Statistical hypothesis tests return structured result objects with test statistics, p-values, and a `significant` flag.

```typescript
import {
  studentTTest,
  anova,
  chiSquareTest,
  shapiroWilkTest,
  principalComponentAnalysis,
} from '@danielsimonjr/mathts-functions';

// Two-sample t-test
const control = [2.1, 2.5, 2.3, 2.8, 2.4];
const treatment = [3.1, 3.5, 2.9, 3.2, 3.4];

const tResult = studentTTest(control, treatment);
// { t: -3.2, pValue: 0.012, degreesOfFreedom: 8, significant: true }

// One-way ANOVA (multiple groups)
const groups = [
  [2.1, 2.3, 2.5],
  [3.1, 3.4, 3.2],
  [1.8, 2.0, 1.9],
];
const anovaResult = anova(groups);
// { F: 28.4, pValue: 0.0003, significant: true }

// Test for normality
const shapiro = await shapiroWilkTest(control);
// { W: 0.98, pValue: 0.89, isNormal: true }

// Chi-square goodness of fit
const observed = [18, 22, 20, 25, 15];
const expected = [20, 20, 20, 20, 20];
await chiSquareTest(observed, expected);
// { statistic: 2.3, pValue: 0.68, significant: false }

// PCA dimensionality reduction
const data = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [2, 4, 6],
];
const pca = principalComponentAnalysis(data, 2); // reduce to 2 components
// { components: [...], scores: [...], explainedVariance: [...] }
```

## See Also

- [API Reference](./api/README.md) - Complete API documentation
- [Function Reference](./reference/functions.md) - All exports (browsable at [danielsimonjr.com/MathTS](https://danielsimonjr.com/MathTS/))
- [Getting Started](./getting-started.md) - Basic usage guide
- [Migration Guide](./migration/guide.md) - Migrating from mathjs
