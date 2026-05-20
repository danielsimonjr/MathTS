# MathTS vs mathjs API Differences

This document outlines the key differences between MathTS and mathjs APIs to help with migration planning.

## Overview

MathTS is a ground-up TypeScript rewrite of mathjs with modern features:
- **Parallel-first architecture** using Web Workers
- **WASM/WebGPU acceleration** for large computations
- **TypeScript-native** with full type safety
- **AssemblyScript-compatible** for WASM compilation

## Package Structure

### mathjs (Single Package)
```javascript
import { create, all } from 'mathjs';
const math = create(all);
```

### MathTS (Monorepo)
```typescript
import { Complex, Fraction, BigNumber, mathTyped } from '@danielsimonjr/mathts-core';
import { add, subtract, multiply, divide } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { computePool } from '@danielsimonjr/mathts-parallel';
```

## Type System Differences

### Complex Numbers

| Feature | mathjs | MathTS |
|---------|--------|--------|
| Creation | `math.complex(3, 4)` | `new Complex(3, 4)` |
| From number | `math.complex(5)` | `Complex.fromNumber(5)` |
| Properties | `c.re`, `c.im` | `c.re`, `c.im` (same) |
| Magnitude | `math.abs(c)` | `c.abs()` or `abs(c)` |
| Conjugate | `math.conj(c)` | `c.conjugate()` |
| Constants | `math.i` | `I` (exported constant) |

### Fractions

| Feature | mathjs | MathTS |
|---------|--------|--------|
| Creation | `math.fraction(1, 2)` | `new Fraction(1, 2)` |
| From string | `math.fraction('1/2')` | `Fraction.parse('1/2')` |
| Numerator | `f.n` | `f.numerator` (bigint) |
| Denominator | `f.d` | `f.denominator` (bigint) |
| Simplify | Auto-simplified | Auto-simplified |

### BigNumber

| Feature | mathjs | MathTS |
|---------|--------|--------|
| Creation | `math.bignumber('123.456')` | `BigNumber.parse('123.456')` |
| From number | `math.bignumber(123)` | `BigNumber.fromNumber(123)` |
| To number | `bn.toNumber()` | `bn.valueOf()` |
| Config | `math.config({ precision: 64 })` | `BigNumber.config({ precision: 64 })` |

### Matrices

| Feature | mathjs | MathTS |
|---------|--------|--------|
| Dense creation | `math.matrix([[1,2],[3,4]])` | `DenseMatrix.fromArray([[1,2],[3,4]])` |
| Sparse creation | `math.sparse([[1,0],[0,4]])` | `SparseMatrix.fromDense(...)` |
| Element access | `m.get([0,1])` | `m.get(0, 1)` |
| Dimensions | `m.size()` | `m.rows`, `m.cols` (properties) |
| Transpose | `math.transpose(m)` | `m.transpose()` |

## Function API Differences

### Arithmetic Functions

| Function | mathjs | MathTS |
|----------|--------|--------|
| Add | `math.add(a, b)` | `add(a, b)` |
| Subtract | `math.subtract(a, b)` | `subtract(a, b)` |
| Multiply | `math.multiply(a, b)` | `multiply(a, b)` |
| Divide | `math.divide(a, b)` | `divide(a, b)` |
| Power | `math.pow(a, b)` | `pow(a, b)` |
| Square root | `math.sqrt(a)` | `sqrt(a)` |

### Trigonometric Functions

| Function | mathjs | MathTS |
|----------|--------|--------|
| Sine | `math.sin(x)` | `sin(x)` |
| Cosine | `math.cos(x)` | `cos(x)` |
| Tangent | `math.tan(x)` | `tan(x)` |
| Arc sine | `math.asin(x)` | `asin(x)` |
| Arc cosine | `math.acos(x)` | `acos(x)` |
| Arc tangent | `math.atan(x)` | `atan(x)` |

### Statistical Functions

| Function | mathjs | MathTS |
|----------|--------|--------|
| Sum | `math.sum(arr)` | `sum(arr)` |
| Mean | `math.mean(arr)` | `mean(arr)` |
| Variance | `math.variance(arr)` | `variance(arr)` |
| Std dev | `math.std(arr)` | `std(arr)` |
| Min | `math.min(arr)` | `min(arr)` |
| Max | `math.max(arr)` | `max(arr)` |

## Parallel Execution (MathTS Exclusive)

MathTS provides parallel execution via Web Workers:

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

// Initialize pool (once at startup)
await computePool.initialize();

// Parallel operations on Float64Array
const data = new Float64Array(100000);
const result = await computePool.sum(data);     // Parallel sum
const scaled = await computePool.scale(data, 2); // Parallel scale

// Matrix operations
const C = await computePool.matmul(A, aRows, aCols, B, bCols);

// Cleanup
await computePool.terminate();
```

## typed-function Integration

### mathjs
```javascript
const math = create(all);
// Types registered automatically
math.add(1, 2);           // Works
math.add(complex1, complex2); // Works
```

### MathTS
```typescript
import { mathTyped, Complex } from '@danielsimonjr/mathts-core';

// Create typed functions
const add = mathTyped('add', {
  'number, number': (a, b) => a + b,
  'Complex, Complex': (a, b) => a.add(b),
});

add(1, 2);                   // 3
add(new Complex(1,2), new Complex(3,4)); // Complex(4,6)
```

## Breaking Changes Summary

1. **Package imports**: Import from specific packages, not a single `mathjs` package
2. **Type constructors**: Use `new Complex()`, not `math.complex()`
3. **BigNumber API**: Use `BigNumber.parse()`, not `math.bignumber()`
4. **Matrix access**: Use `m.get(row, col)`, not `m.get([row, col])`
5. **Async operations**: Parallel operations return Promises
6. **Numeric precision**: bigint used internally for Fraction (not number)

## Compatibility Shim

For gradual migration, use `@danielsimonjr/mathts-compat`:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);

// mathjs-compatible API
math.add(1, 2);
math.complex(3, 4);
math.matrix([[1,2],[3,4]]);
```

See the [Migration Guide](./guide.md) for step-by-step migration instructions.
