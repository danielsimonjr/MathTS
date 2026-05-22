# Getting Started with MathTS

MathTS is a TypeScript math library with parallel computing support, designed as a modern alternative to mathjs.

## Installation

### For mathjs Users (Easiest Migration)

```bash
npm install @danielsimonjr/mathts-compat
```

```typescript
// Just change your import!
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);

// All your existing mathjs code works:
math.add(1, 2);
math.multiply(3, 4);
math.sin(math.pi / 2);
```

### For New Projects (Full Control)

```bash
npm install @danielsimonjr/mathts-core @danielsimonjr/mathts-functions @danielsimonjr/mathts-matrix @danielsimonjr/mathts-parallel
```

```typescript
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { add, multiply, sin, cos, PI } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { computePool } from '@danielsimonjr/mathts-parallel';
```

## Quick Examples

### Basic Arithmetic

```typescript
import { add, subtract, multiply, divide, pow, sqrt } from '@danielsimonjr/mathts-functions';

console.log(add(1, 2)); // 3
console.log(multiply(3, 4)); // 12
console.log(pow(2, 10)); // 1024
console.log(sqrt(16)); // 4
```

### Complex Numbers

```typescript
import { Complex, I } from '@danielsimonjr/mathts-core';
import { add, multiply } from '@danielsimonjr/mathts-functions';

const z1 = new Complex(3, 4); // 3 + 4i
const z2 = new Complex(1, 2); // 1 + 2i

console.log(add(z1, z2).toString()); // "4 + 6i"
console.log(multiply(z1, z2).toString()); // "-5 + 10i"
console.log(z1.abs()); // 5 (magnitude)
console.log(z1.arg()); // 0.927... (angle in radians)
```

### Fractions (Exact Arithmetic)

```typescript
import { Fraction } from '@danielsimonjr/mathts-core';
import { add, multiply, divide } from '@danielsimonjr/mathts-functions';

const f1 = new Fraction(1, 3); // 1/3
const f2 = new Fraction(1, 6); // 1/6

console.log(add(f1, f2).toString()); // "1/2"
console.log(multiply(f1, f2).toString()); // "1/18"
```

### BigNumber (No Floating Point Errors)

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';
import { add } from '@danielsimonjr/mathts-functions';

const bn1 = BigNumber.parse('0.1');
const bn2 = BigNumber.parse('0.2');

console.log(add(bn1, bn2).toString()); // "0.3" (exact!)
console.log(0.1 + 0.2); // 0.30000000000000004 (JS floating point)
```

### Matrix Operations

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const A = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);

const B = DenseMatrix.fromArray([
  [5, 6],
  [7, 8],
]);

console.log(A.add(B).toArray()); // [[6, 8], [10, 12]]
console.log(A.multiply(B).toArray()); // [[19, 22], [43, 50]]
console.log(A.transpose().toArray()); // [[1, 3], [2, 4]]

// Special matrices
const I3 = DenseMatrix.identity(3);
const zeros = DenseMatrix.zeros(2, 3);
const ones = DenseMatrix.ones(2, 2);
```

### Parallel Computing

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

async function main() {
  // Initialize the compute pool
  await computePool.initialize();

  // Create large data
  const data = new Float64Array(100000);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random();
  }

  // Parallel operations
  const sumResult = await computePool.sum(data);
  console.log('Sum:', sumResult.result);
  console.log('Duration:', sumResult.duration, 'ms');
  console.log('Workers used:', sumResult.workersUsed);

  const meanResult = await computePool.mean(data);
  console.log('Mean:', meanResult.result);

  // Clean up
  await computePool.terminate();
}

main();
```

## Function Categories

`@danielsimonjr/mathts-functions` provides over 500 callable functions (672 total exports, including 52 CODATA physical constants) across 17 categories:

| Category                      | Examples                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **Arithmetic**                | `add`, `subtract`, `multiply`, `divide`, `pow`, `sqrt`, `log`, `mod`, `gcd`                |
| **Trigonometry**              | `sin`, `cos`, `tan`, `atan2`, `sinh`, `cosh`, `hypot`, `toRadians`                         |
| **Statistics**                | `parallelStatMean`, `parallelStatStd`, `parallelStatCorr`, `parallelStatQuantile`          |
| **Signal Processing**         | `parallelFFT`, `parallelIFFT`, `parallelConv`, `crossCorrelation`, `unwrapPhase`, `stft`   |
| **Special Functions**         | `erfc`, `beta`, `gammainc`, `digamma`, `besselJ0/1/Y0/Y1`, Legendre, Chebyshev, zeta       |
| **Probability Distributions** | `normalPDF`, `normalCDF`, `poissonPMF`, `binomialPMF`, `entropy`, `jsDivergence`           |
| **Numerical Integration**     | `trapz`, `simpson`, `gaussQuad`, `romberg`                                                 |
| **Interpolation**             | `linearInterp`, `cubicSpline`, `pchipInterp`, `lagrangeInterp`, `polyFit`                  |
| **Combinatorics**             | `fibonacci`, `lucas`, `doubleFactorial`, `subfactorial`, `partition`, Stirling numbers     |
| **Geometry**                  | `angle2D`, `cross3D`, `convexHull`, `distance2D`, `distanceND`, `intersectLines2D`, Bezier |
| **Statistics Selection**      | `quickSelect`, `medianSelect`, `minSelect`, `maxSelect`                                    |
| **Algebra**                   | `polyval`, `polyadd`, `polymul`, `factor`, `expand`, `substitute`, `discriminant`          |
| **CAS**                       | `integrate`, `limit`, `partialDerivative`, `jacobian`, `laplace`, `taylor`, `solve`        |
| **Graph Theory**              | `shortestPath`, `minimumSpanningTree`, `connectedComponents`, `topologicalSort`            |
| **Distribution Objects**      | `normalDist`, `tDist`, `gammaDist`, `poissonDist` (objects with pdf/cdf/sample)            |
| **Hypothesis Tests**          | `studentTTest`, `chiSquareTest`, `anova`, `mannWhitneyTest`, `shapiroWilkTest`             |
| **Numerical Methods**         | `findRoot`, `minimize`, `leastSquares`, `rbfInterpolate`, `bezierCurve`, `loess`           |

## Package Overview

| Package                            | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `@danielsimonjr/mathts-core`       | Core types: Complex, Fraction, BigNumber    |
| `@danielsimonjr/mathts-functions`  | 500+ math functions with type dispatch      |
| `@danielsimonjr/mathts-matrix`     | Dense and sparse matrices                   |
| `@danielsimonjr/mathts-tensor`     | Rank-N dense Tensor (Float64Array-backed)   |
| `@danielsimonjr/mathts-autograd`   | Forward + reverse-mode autodiff over Tensor |
| `@danielsimonjr/mathts-parallel`   | Parallel computing via ComputePool          |
| `@danielsimonjr/mathts-expression` | Expression parser/evaluator                 |
| `@danielsimonjr/mathts-workbook`   | `.mtsw` reactive notebook runtime           |
| `@danielsimonjr/mathts-compat`     | mathjs compatibility layer                  |

## Next Steps

- [API Reference](./api/README.md) - Complete API documentation
- [Migration Guide](./migration/guide.md) - Migrating from mathjs
- [Advanced Usage](./advanced.md) - Backend selection, optimization
- [Examples](../examples/) - Runnable example projects

## TypeScript Support

MathTS is written in TypeScript and provides full type definitions:

```typescript
import { Complex } from '@danielsimonjr/mathts-core';
import { add } from '@danielsimonjr/mathts-functions';

const z: Complex = new Complex(3, 4);
const result: Complex = add(z, z); // Type-safe!
```

## Browser vs Node.js

MathTS works in both environments:

- **Node.js**: Full support including parallel computing with workers
- **Browser**: Full support, WebGPU acceleration available where supported

```typescript
// Check available features
import { computePool } from '@danielsimonjr/mathts-parallel';

await computePool.initialize();
const stats = computePool.stats();
console.log('Workers:', stats.totalWorkers);
```
