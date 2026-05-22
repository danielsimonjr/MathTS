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

By default, MathTS automatically selects the best backend based on operation size:

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// Small matrix - uses JS backend
const small = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);

// Large matrix - automatically uses WASM if available
const large = DenseMatrix.zeros(1000, 1000);
```

### Manual Backend Selection

For fine-grained control:

```typescript
import { DenseMatrix, JSBackend, WASMBackend, GPUBackend } from '@danielsimonjr/mathts-matrix';

// Force specific backend
const matrix = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);

// Use JS backend explicitly
const jsResult = await JSBackend.multiply(matrix.data, matrix.data, 2, 2, 2);

// Use WASM backend (if available)
const wasmBackend = new WASMBackend();
await wasmBackend.initialize();
if (wasmBackend.isReady()) {
  const wasmResult = await wasmBackend.multiply(matrix.data, matrix.data, 2, 2, 2);
}

// Use GPU backend (browser with WebGPU only)
const gpuBackend = new GPUBackend();
const gpuAvailable = await gpuBackend.initialize();
if (gpuAvailable) {
  const gpuResult = await gpuBackend.multiply(matrix.data, matrix.data, 2, 2, 2);
}
```

## Parallel Computing

### ComputePool Configuration

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

// Initialize with options
await computePool.initialize({
  minWorkers: 2,
  maxWorkers: 8, // Default: number of CPU cores
  workerType: 'auto', // 'auto' | 'thread' | 'process'
});

// Check status
const stats = computePool.stats();
console.log('Total workers:', stats.totalWorkers);
console.log('Active tasks:', stats.activeTasks);
console.log('Queued tasks:', stats.queuedTasks);
```

### Parallelization Threshold

Small operations may be faster without parallelization overhead:

```typescript
// Operations below threshold run sequentially
const smallData = new Float64Array(100);
const result1 = await computePool.sum(smallData);
// result1.parallelized === false (below threshold)

// Large operations are parallelized
const largeData = new Float64Array(100000);
const result2 = await computePool.sum(largeData);
// result2.parallelized === true
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

## Numerical Integration

For integrating functions that have no closed-form antiderivative, MathTS provides four quadrature methods:

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

// Laplace transform
laplace('exp(-a*t)', 't', 's'); // '1/(s + a)'
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
const shapiro = shapiroWilkTest(control);
// { W: 0.98, pValue: 0.89, isNormal: true }

// Chi-square goodness of fit
const observed = [18, 22, 20, 25, 15];
const expected = [20, 20, 20, 20, 20];
chiSquareTest(observed, expected);
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
- [Function Reference](./reference/functions.md) - All ~492 math functions
- [Getting Started](./getting-started.md) - Basic usage guide
- [Migration Guide](./migration/guide.md) - Migrating from mathjs
