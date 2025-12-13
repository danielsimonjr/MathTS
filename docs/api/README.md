# MathTS API Reference

Complete API documentation for all MathTS packages.

## Packages

| Package | Description | Documentation |
|---------|-------------|---------------|
| `@mathts/core` | Core types: Complex, Fraction, BigNumber | [API Reference](./core.md) |
| `@mathts/functions` | Mathematical functions with typed dispatch | [API Reference](./functions.md) |
| `@mathts/matrix` | Dense and sparse matrices | [API Reference](./matrix.md) |
| `@mathts/parallel` | Parallel execution via ComputePool | [API Reference](./parallel.md) |
| `@mathts/compat` | mathjs compatibility layer | [API Reference](./compat.md) |

## Quick Reference

### Installation

```bash
# For mathjs users (easiest migration)
npm install @mathts/compat

# For new projects (full control)
npm install @mathts/core @mathts/functions @mathts/matrix @mathts/parallel
```

### Import Patterns

```typescript
// mathjs-compatible
import { create, all } from '@mathts/compat';
const math = create(all);

// Native MathTS
import { Complex, Fraction, BigNumber } from '@mathts/core';
import { add, multiply, sin, cos } from '@mathts/functions';
import { DenseMatrix, SparseMatrix } from '@mathts/matrix';
import { computePool } from '@mathts/parallel';
```

### Type Overview

| Type | Package | Description |
|------|---------|-------------|
| `Complex` | `@mathts/core` | Complex numbers (re + im*i) |
| `Fraction` | `@mathts/core` | Exact rationals (bigint) |
| `BigNumber` | `@mathts/core` | Arbitrary precision decimals |
| `DenseMatrix` | `@mathts/matrix` | Row-major dense matrix |
| `SparseMatrix` | `@mathts/matrix` | CSR sparse matrix |

### Common Operations

```typescript
// Arithmetic (works with all numeric types)
add(a, b)
subtract(a, b)
multiply(a, b)
divide(a, b)
pow(base, exp)
sqrt(x)

// Trigonometry
sin(x), cos(x), tan(x)
asin(x), acos(x), atan(x)

// Statistics
sum(arr), mean(arr), std(arr)
min(arr), max(arr)

// Matrix
DenseMatrix.fromArray([[1,2],[3,4]])
DenseMatrix.identity(n)
matrix.multiply(other)
matrix.transpose()

// Parallel (for large data)
await computePool.sum(Float64Array)
await computePool.matmul(A, rows, cols, B, bCols)
```

## See Also

- [Migration Guide](../migration/guide.md) - Migrating from mathjs
- [API Differences](../migration/api-diff.md) - mathjs vs MathTS
- [README](../../README.md) - Getting started
