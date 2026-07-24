# MathTS API Reference

Complete API documentation for all MathTS packages.

## Packages

| Package                            | Description                                         | Documentation                    |
| ---------------------------------- | --------------------------------------------------- | -------------------------------- |
| `@danielsimonjr/mathts-core`       | Core types: Complex, Fraction, BigNumber            | [API Reference](./core.md)       |
| `@danielsimonjr/mathts-functions`  | Mathematical functions with typed dispatch          | [API Reference](./functions.md)  |
| `@danielsimonjr/mathts-matrix`     | Dense and sparse matrices                           | [API Reference](./matrix.md)     |
| `@danielsimonjr/mathts-gpu`        | Shared WebGPU foundation (no domain kernels)        | [API Reference](./gpu.md)        |
| `@danielsimonjr/mathts-tensor`     | Rank-N dense tensors with einsum/contraction        | [API Reference](./tensor.md)     |
| `@danielsimonjr/mathts-autograd`   | Forward- and reverse-mode automatic differentiation | [API Reference](./autograd.md)   |
| `@danielsimonjr/mathts-parallel`   | Parallel execution via ComputePool                  | [API Reference](./parallel.md)   |
| `@danielsimonjr/mathts-expression` | Expression parser, AST, compile/evaluate            | [API Reference](./expression.md) |
| `@danielsimonjr/mathts-workbook`   | `.mtsw` reactive notebook runtime + `mtsw` CLI      | [API Reference](./workbook.md)   |
| `@danielsimonjr/mathts-plot`       | Headless SVG/TikZ 2D/3D plotting                    | [API Reference](./plot.md)       |
| `@danielsimonjr/mathts-compat`     | mathjs compatibility layer                          | [API Reference](./compat.md)     |

## Quick Reference

### Installation

```bash
# For mathjs users (easiest migration)
npm install @danielsimonjr/mathts-compat

# For new projects (full control)
npm install @danielsimonjr/mathts-core @danielsimonjr/mathts-functions @danielsimonjr/mathts-matrix @danielsimonjr/mathts-parallel
```

### Import Patterns

```typescript
// mathjs-compatible
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);

// Native MathTS
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { add, multiply, sin, cos } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { computePool } from '@danielsimonjr/mathts-parallel';
```

### Type Overview

| Type           | Package                        | Description                  |
| -------------- | ------------------------------ | ---------------------------- |
| `Complex`      | `@danielsimonjr/mathts-core`   | Complex numbers (re + im\*i) |
| `Fraction`     | `@danielsimonjr/mathts-core`   | Exact rationals (bigint)     |
| `BigNumber`    | `@danielsimonjr/mathts-core`   | Arbitrary precision decimals |
| `DenseMatrix`  | `@danielsimonjr/mathts-matrix` | Row-major dense matrix       |
| `SparseMatrix` | `@danielsimonjr/mathts-matrix` | CSR sparse matrix            |

### Common Operations

```typescript
// Arithmetic (works with all numeric types)
add(a, b);
subtract(a, b);
multiply(a, b);
divide(a, b);
pow(base, exp);
sqrt(x);

// Trigonometry
(sin(x), cos(x), tan(x));
(asin(x), acos(x), atan(x));

// Statistics
(sum(arr), mean(arr), std(arr));
(min(arr), max(arr));

// Matrix
DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);
DenseMatrix.identity(n);
matrix.multiply(other);
matrix.transpose();

// Parallel (for large data)
await computePool.sum(Float64Array);
await computePool.matmul(A, rows, cols, B, bCols);
```

## See Also

- [Migration Guide](../migration/guide.md) - Migrating from mathjs
- [API Differences](../migration/api-diff.md) - mathjs vs MathTS
- [README](../../README.md) - Getting started
