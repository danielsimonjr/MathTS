# Migration Guide: mathjs to MathTS

This guide helps you migrate from mathjs to MathTS, either gradually using the compatibility layer or by directly adopting the native MathTS API.

## Overview

MathTS is a modern TypeScript rewrite of mathjs with:
- **TypeScript-first** design with full type safety
- **Parallel-first** architecture using Web Workers
- **WASM/WebGPU** acceleration for large computations
- **Modular packages** for tree-shaking

## Migration Strategies

### Strategy 1: Quick Migration with @mathts/compat (Recommended)

The fastest way to migrate is using the compatibility layer:

```bash
npm install @mathts/compat
```

```typescript
// Before (mathjs)
import { create, all } from 'mathjs';
const math = create(all);

// After (MathTS with compat)
import { create, all } from '@mathts/compat';
const math = create(all);

// Your existing code continues to work
math.add(1, 2);           // 3
math.complex(3, 4);       // Complex(3, 4)
math.matrix([[1,2],[3,4]]); // DenseMatrix
```

This approach allows you to:
1. Drop-in replace your mathjs import
2. Continue using the familiar `math.*` API
3. Gradually migrate to native MathTS as needed

### Strategy 2: Native MathTS API

For new projects or complete rewrites:

```bash
npm install @mathts/core @mathts/functions @mathts/matrix @mathts/parallel
```

```typescript
// Native MathTS imports
import { Complex, Fraction, BigNumber } from '@mathts/core';
import { add, subtract, multiply, divide } from '@mathts/functions';
import { DenseMatrix, SparseMatrix } from '@mathts/matrix';
import { computePool } from '@mathts/parallel';

// Direct usage
const c = new Complex(3, 4);
const result = add(1, 2);
const m = DenseMatrix.fromArray([[1,2],[3,4]]);
```

## Step-by-Step Migration

### Step 1: Install @mathts/compat

```bash
npm uninstall mathjs
npm install @mathts/compat
```

### Step 2: Update Imports

Find and replace:
```typescript
// Before
import { create, all } from 'mathjs';

// After
import { create, all } from '@mathts/compat';
```

### Step 3: Run Your Tests

Your existing code should work. If you encounter issues, check the [API Differences](./api-diff.md) document.

### Step 4: Gradual Native Migration (Optional)

Start replacing compat API with native imports where beneficial:

```typescript
// Mixed usage is fine during migration
import { create, all } from '@mathts/compat';
import { computePool } from '@mathts/parallel';

const math = create(all);

// Use compat for simple operations
const sum = math.add(1, 2);

// Use native parallel for large computations
await computePool.initialize();
const largeArray = new Float64Array(100000);
const parallelSum = await computePool.sum(largeArray);
```

## Common Migration Patterns

### Complex Numbers

```typescript
// mathjs
const c = math.complex(3, 4);
const magnitude = math.abs(c);
const conjugate = math.conj(c);

// MathTS native
import { Complex } from '@mathts/core';
const c = new Complex(3, 4);
const magnitude = c.abs();
const conjugate = c.conjugate();

// MathTS compat (no change needed)
const c = math.complex(3, 4);
const magnitude = math.abs(c);
const conjugate = math.conj(c);
```

### Fractions

```typescript
// mathjs
const f = math.fraction(1, 2);
console.log(f.n, f.d);

// MathTS native
import { Fraction } from '@mathts/core';
const f = new Fraction(1, 2);
console.log(f.numerator, f.denominator); // Note: bigint type

// MathTS compat
const f = math.fraction(1, 2);
console.log(f.numerator, f.denominator);
```

### BigNumbers

```typescript
// mathjs
const bn = math.bignumber('123.456');
const num = bn.toNumber();

// MathTS native
import { BigNumber } from '@mathts/core';
const bn = BigNumber.parse('123.456');
const num = bn.valueOf();

// MathTS compat
const bn = math.bignumber('123.456');
const num = bn.valueOf(); // Use valueOf(), not toNumber()
```

### Matrices

```typescript
// mathjs
const m = math.matrix([[1,2],[3,4]]);
const element = m.get([0, 1]);
const dims = m.size();

// MathTS native
import { DenseMatrix } from '@mathts/matrix';
const m = DenseMatrix.fromArray([[1,2],[3,4]]);
const element = m.get(0, 1);    // Direct indices, not array
const dims = [m.rows, m.cols];  // Properties, not method

// MathTS compat
const m = math.matrix([[1,2],[3,4]]);
const element = m.get(0, 1);     // Updated API
const dims = math.size(m);       // Returns [rows, cols]
```

### Parallel Operations (MathTS Exclusive)

MathTS provides parallel execution for large datasets:

```typescript
import { computePool } from '@mathts/parallel';

// Initialize once at app startup
await computePool.initialize();

// Parallel operations
const data = new Float64Array(100000);
const sum = await computePool.sum(data);
const mean = await computePool.mean(data);
const variance = await computePool.variance(data);

// Matrix multiplication
const A = new Float64Array([1,2,3,4]);
const B = new Float64Array([5,6,7,8]);
const C = await computePool.matmul(A, 2, 2, B, 2);

// Cleanup on app shutdown
await computePool.terminate();
```

## Breaking Changes

### 1. Type Constructors

| mathjs | MathTS |
|--------|--------|
| `math.complex(3, 4)` | `new Complex(3, 4)` |
| `math.fraction(1, 2)` | `new Fraction(1, 2)` |
| `math.bignumber('123')` | `BigNumber.parse('123')` |
| `math.matrix([[1,2]])` | `DenseMatrix.fromArray([[1,2]])` |

### 2. Method Names

| mathjs | MathTS |
|--------|--------|
| `bn.toNumber()` | `bn.valueOf()` |
| `m.get([row, col])` | `m.get(row, col)` |
| `m.size()` | `m.rows, m.cols` |
| `f.n, f.d` | `f.numerator, f.denominator` |

### 3. Fraction Internals

MathTS Fractions use `bigint` internally for perfect precision:

```typescript
const f = new Fraction(1, 2);
console.log(typeof f.numerator);   // 'bigint'
console.log(typeof f.denominator); // 'bigint'
```

### 4. Async Operations

Parallel operations return Promises:

```typescript
// Synchronous (small data)
const sum = add(1, 2);

// Asynchronous (large data)
const parallelSum = await computePool.sum(largeArray);
```

## Troubleshooting

### Import Errors

If you see module resolution errors, ensure your tsconfig.json has:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

### Type Errors

The compat layer uses different types than mathjs. If you have explicit mathjs types:

```typescript
// Before
import type { Complex as MathJSComplex } from 'mathjs';

// After
import type { Complex } from '@mathts/core';
// or
import type { Complex } from '@mathts/compat';
```

### Performance Issues

If you notice performance differences:

1. For large arrays, use parallel operations:
```typescript
// Instead of
const sum = math.sum(largeArray);

// Use
const sum = await computePool.sum(new Float64Array(largeArray));
```

2. Use TypedArrays (Float64Array) for numerical data:
```typescript
// Slower
const arr = [1, 2, 3, 4, 5];

// Faster
const arr = new Float64Array([1, 2, 3, 4, 5]);
```

## Feature Comparison

| Feature | mathjs | MathTS |
|---------|--------|--------|
| TypeScript types | Partial | Full |
| Tree-shaking | Limited | Full |
| Web Workers | No | Yes |
| WASM acceleration | No | Yes |
| WebGPU | No | Planned |
| Expression parser | Yes | Planned |
| Units | Yes | Planned |
| Matrix operations | Yes | Yes |
| Complex numbers | Yes | Yes |
| Fractions | Yes | Yes |
| BigNumber | Yes | Yes |

## Getting Help

- [API Differences Reference](./api-diff.md)
- [GitHub Issues](https://github.com/danielsimonjr/mathts/issues)
- [Documentation](https://github.com/danielsimonjr/mathts#readme)
