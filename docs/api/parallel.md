# @danielsimonjr/mathts-parallel API Reference

Parallel execution via Web Workers using ComputePool.

## Installation

```bash
npm install @danielsimonjr/mathts-parallel
```

## Overview

MathTS uses a parallel-first architecture. The `computePool` provides parallel execution for large numerical computations using Web Workers.

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

// Initialize once at app startup
await computePool.initialize();

// Use parallel operations
const data = new Float64Array(100000);
const sum = await computePool.sum(data);

// Cleanup on app shutdown
await computePool.terminate();
```

---

## ComputePool

### Lifecycle Methods

| Method       | Signature                     | Description         |
| ------------ | ----------------------------- | ------------------- |
| `initialize` | `(options?) => Promise<void>` | Start worker pool   |
| `terminate`  | `() => Promise<void>`         | Stop all workers    |
| `stats`      | `() => PoolStats`             | Get pool statistics |

### Initialization Options

```typescript
await computePool.initialize({
  minWorkers: 2, // Minimum workers
  maxWorkers: 8, // Maximum workers (default: CPU cores)
  workerType: 'auto', // 'auto' | 'web' | 'node'
});
```

---

## Statistical Operations

### Basic Statistics

| Method   | Signature                                                                     | Description              |
| -------- | ----------------------------------------------------------------------------- | ------------------------ |
| `sum`    | `(data: Float64Array) => Promise<ParallelResult<number>>`                     | Parallel sum             |
| `mean`   | `(data: Float64Array) => Promise<ParallelResult<number>>`                     | Parallel mean            |
| `min`    | `(data: Float64Array) => Promise<ParallelResult<number>>`                     | Parallel minimum         |
| `max`    | `(data: Float64Array) => Promise<ParallelResult<number>>`                     | Parallel maximum         |
| `minMax` | `(data: Float64Array) => Promise<ParallelResult<{min, max, minIdx, maxIdx}>>` | Min and max with indices |

### Variance & Standard Deviation

| Method     | Signature                                                                | Description         |
| ---------- | ------------------------------------------------------------------------ | ------------------- |
| `variance` | `(data: Float64Array) => Promise<ParallelResult<{mean, variance, std}>>` | Welford's algorithm |
| `std`      | `(data: Float64Array) => Promise<ParallelResult<number>>`                | Standard deviation  |

### Norms & Distance

| Method     | Signature                                                               | Description        |
| ---------- | ----------------------------------------------------------------------- | ------------------ |
| `norm`     | `(data: Float64Array) => Promise<ParallelResult<number>>`               | Euclidean norm     |
| `distance` | `(a: Float64Array, b: Float64Array) => Promise<ParallelResult<number>>` | Euclidean distance |

### Histogram

| Method      | Signature                                                     | Description    |
| ----------- | ------------------------------------------------------------- | -------------- |
| `histogram` | `(data, bins, min, max) => Promise<ParallelResult<number[]>>` | Histogram bins |

### Example

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

await computePool.initialize();

const data = new Float64Array(1000000);
for (let i = 0; i < data.length; i++) {
  data[i] = Math.random() * 100;
}

const sumResult = await computePool.sum(data);
console.log('Sum:', sumResult.result);
console.log('Duration:', sumResult.duration, 'ms');
console.log('Workers used:', sumResult.workersUsed);

const stats = await computePool.variance(data);
console.log('Mean:', stats.result.mean);
console.log('Variance:', stats.result.variance);
console.log('Std Dev:', stats.result.std);

await computePool.terminate();
```

---

## Element-wise Operations

### Binary Operations

| Method        | Signature                             | Description                 |
| ------------- | ------------------------------------- | --------------------------- |
| `add`         | `(a, b) => Promise<Float64Array>`     | Element-wise addition       |
| `subtract`    | `(a, b) => Promise<Float64Array>`     | Element-wise subtraction    |
| `multiply`    | `(a, b) => Promise<Float64Array>`     | Element-wise multiplication |
| `divide`      | `(a, b) => Promise<Float64Array>`     | Element-wise division       |
| `elementwise` | `(a, b, op) => Promise<Float64Array>` | Generic operation           |

### Scalar Operations

| Method  | Signature                                 | Description        |
| ------- | ----------------------------------------- | ------------------ |
| `scale` | `(data, scalar) => Promise<Float64Array>` | Multiply by scalar |

### Unary Operations

| Method   | Signature                         | Description    |
| -------- | --------------------------------- | -------------- |
| `abs`    | `(data) => Promise<Float64Array>` | Absolute value |
| `sqrt`   | `(data) => Promise<Float64Array>` | Square root    |
| `exp`    | `(data) => Promise<Float64Array>` | Exponential    |
| `log`    | `(data) => Promise<Float64Array>` | Natural log    |
| `sin`    | `(data) => Promise<Float64Array>` | Sine           |
| `cos`    | `(data) => Promise<Float64Array>` | Cosine         |
| `tan`    | `(data) => Promise<Float64Array>` | Tangent        |
| `negate` | `(data) => Promise<Float64Array>` | Negation       |
| `square` | `(data) => Promise<Float64Array>` | Square         |

### Example

```typescript
const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([5, 6, 7, 8]);

const sum = await computePool.add(a, b); // [6, 8, 10, 12]
const scaled = await computePool.scale(a, 2); // [2, 4, 6, 8]
const sqrts = await computePool.sqrt(a); // [1, 1.41, 1.73, 2]
```

---

## Matrix Operations

### Matrix Multiplication

```typescript
const A = new Float64Array([1, 2, 3, 4]); // 2×2 row-major
const B = new Float64Array([5, 6, 7, 8]); // 2×2 row-major

const C = await computePool.matmul(A, 2, 2, B, 2);
// C = [[19, 22], [43, 50]] as flat array
```

| Method      | Signature                                               | Description            |
| ----------- | ------------------------------------------------------- | ---------------------- |
| `matmul`    | `(A, aRows, aCols, B, bCols) => Promise<Float64Array>`  | Matrix multiplication  |
| `matvec`    | `(matrix, rows, cols, vector) => Promise<Float64Array>` | Matrix-vector multiply |
| `transpose` | `(data, rows, cols) => Promise<Float64Array>`           | Matrix transpose       |

### Vector Operations

| Method  | Signature                         | Description   |
| ------- | --------------------------------- | ------------- |
| `dot`   | `(a, b) => Promise<number>`       | Dot product   |
| `outer` | `(a, b) => Promise<Float64Array>` | Outer product |

### Example

```typescript
// Matrix multiplication: (3×2) × (2×4) = (3×4)
const A = new Float64Array(6); // 3×2
const B = new Float64Array(8); // 2×4
const C = await computePool.matmul(A, 3, 2, B, 4);
// C is Float64Array of length 12 (3×4)

// Matrix-vector multiplication
const matrix = new Float64Array([1, 2, 3, 4, 5, 6]); // 2×3
const vector = new Float64Array([1, 2, 3]); // length 3
const result = await computePool.matvec(matrix, 2, 3, vector);
// result is Float64Array of length 2
```

---

## Generic Parallel Operations

### Map, Reduce, Filter

| Method   | Signature                                             | Description     |
| -------- | ----------------------------------------------------- | --------------- |
| `map`    | `(data, fn) => Promise<Float64Array>`                 | Parallel map    |
| `reduce` | `(data, fn, initial) => Promise<number>`              | Parallel reduce |
| `filter` | `(data, predicate) => Promise<Float64Array>`          | Parallel filter |
| `find`   | `(data, predicate) => Promise<{found, value, index}>` | Parallel find   |

### Sort

| Method | Signature                                     | Description         |
| ------ | --------------------------------------------- | ------------------- |
| `sort` | `(data, compareFn?) => Promise<Float64Array>` | Parallel merge sort |

### Example

```typescript
const data = new Float64Array([1, 2, 3, 4, 5]);

// Parallel map
const doubled = await computePool.map(data, (x) => x * 2);

// Parallel reduce
const sum = await computePool.reduce(data, (acc, x) => acc + x, 0);

// Parallel filter
const evens = await computePool.filter(data, (x) => x % 2 === 0);

// Parallel sort
const sorted = await computePool.sort(data, (a, b) => b - a);
```

---

## ParallelResult Interface

All operations return a `ParallelResult<T>`:

```typescript
interface ParallelResult<T> {
  result: T; // The computed result
  duration: number; // Execution time in ms
  chunks: number; // Number of chunks processed
  parallelized: boolean; // Whether parallel execution was used
  workersUsed: number; // Number of workers used
}
```

### Example

```typescript
const result = await computePool.sum(data);

console.log(result.result); // The sum
console.log(result.duration); // 15.3 (ms)
console.log(result.chunks); // 8
console.log(result.parallelized); // true
console.log(result.workersUsed); // 4
```

---

## Performance Tips

1. **Use Float64Array**: Always use typed arrays for best performance
2. **Initialize once**: Call `initialize()` once at app startup
3. **Batch operations**: Use `Promise.all()` for independent operations
4. **Large data**: Parallel execution shines with >10,000 elements

```typescript
// Good: Batch independent operations
const [sum, mean, std] = await Promise.all([
  computePool.sum(data),
  computePool.mean(data),
  computePool.std(data),
]);

// Good: Use typed arrays
const data = new Float64Array(array); // Convert regular array

// Bad: Small data (overhead > benefit)
const tiny = new Float64Array([1, 2, 3]);
// Just use: tiny.reduce((a, b) => a + b, 0)
```
