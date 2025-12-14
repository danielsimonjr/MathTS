# Advanced MathTS Usage

This guide covers advanced topics including backend selection, parallel computing optimization, and performance tuning.

## Backend Selection

MathTS supports multiple computation backends:

| Backend | Best For | Availability |
|---------|----------|--------------|
| **JS** | Small operations, compatibility | Always available |
| **WASM** | SIMD acceleration, medium data | Node.js and modern browsers |
| **GPU** | Large matrices, massive parallelism | WebGPU-enabled browsers |

### Automatic Backend Selection

By default, MathTS automatically selects the best backend based on operation size:

```typescript
import { DenseMatrix } from '@mathts/matrix';

// Small matrix - uses JS backend
const small = DenseMatrix.fromArray([[1, 2], [3, 4]]);

// Large matrix - automatically uses WASM if available
const large = DenseMatrix.zeros(1000, 1000);
```

### Manual Backend Selection

For fine-grained control:

```typescript
import { DenseMatrix, JSBackend, WASMBackend, GPUBackend } from '@mathts/matrix';

// Force specific backend
const matrix = DenseMatrix.fromArray([[1, 2], [3, 4]]);

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
import { computePool } from '@mathts/parallel';

// Initialize with options
await computePool.initialize({
  minWorkers: 2,
  maxWorkers: 8,        // Default: number of CPU cores
  workerType: 'auto'    // 'auto' | 'thread' | 'process'
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
import { computePool } from '@mathts/parallel';

const data1 = new Float64Array(50000).fill(1);
const data2 = new Float64Array(50000).fill(2);
const data3 = new Float64Array(50000).fill(3);

// Run all operations concurrently
const [sum1, sum2, sum3] = await Promise.all([
  computePool.sum(data1),
  computePool.sum(data2),
  computePool.sum(data3)
]);

console.log(sum1.result, sum2.result, sum3.result);
```

### Available Parallel Operations

```typescript
// Statistical operations
await computePool.sum(data);
await computePool.mean(data);
await computePool.variance(data);  // Returns { mean, variance, std }
await computePool.std(data);
await computePool.min(data);
await computePool.max(data);
await computePool.minMax(data);    // Returns { min, max, minIdx, maxIdx }

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
const slowData = new Array(10000);  // Slower, more memory
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
import { DenseMatrix, SparseMatrix } from '@mathts/matrix';

// Dense: Most elements are non-zero
const dense = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

// Sparse: Many zeros (>50% typically)
const sparse = SparseMatrix.fromDense(DenseMatrix.fromArray([
  [1, 0, 0, 0],
  [0, 2, 0, 0],
  [0, 0, 3, 0],
  [0, 0, 0, 4]
]));

console.log('Sparse density:', sparse.density);  // 0.25
console.log('Sparse nnz:', sparse.nnz);          // 4
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
import { add } from '@mathts/functions';
import { Complex, Fraction, BigNumber } from '@mathts/core';

// Same function, different types
add(1, 2);                                      // number + number
add(new Complex(1, 2), new Complex(3, 4));      // Complex + Complex
add(new Fraction(1, 2), new Fraction(1, 3));    // Fraction + Fraction
add(BigNumber.parse('0.1'), BigNumber.parse('0.2'));  // BigNumber + BigNumber

// Automatic type coercion
add(1, new Complex(2, 3));  // number coerced to Complex
```

### Custom Type Registration

```typescript
import { mathTyped } from '@mathts/core';

// Create a typed function
const myFunction = mathTyped('myFunction', {
  'number': (x) => x * 2,
  'Complex': (z) => z.multiply(new Complex(2, 0)),
  'number, number': (a, b) => a + b
});

myFunction(5);           // 10
myFunction(z);           // Complex doubled
myFunction(1, 2);        // 3
```

## Memory Management

### Worker Pool Cleanup

```typescript
import { computePool } from '@mathts/parallel';

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
import { DenseMatrix } from '@mathts/matrix';

// For very large matrices, consider chunking
async function processLargeMatrix(rows: number, cols: number) {
  const chunkSize = 1000;

  for (let i = 0; i < rows; i += chunkSize) {
    const chunk = DenseMatrix.zeros(
      Math.min(chunkSize, rows - i),
      cols
    );

    // Process chunk...

    // Allow GC between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

## Debugging

### Enable Verbose Logging

```typescript
import { computePool } from '@mathts/parallel';

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

## See Also

- [API Reference](./api/README.md) - Complete API documentation
- [Getting Started](./getting-started.md) - Basic usage guide
- [Migration Guide](./migration/guide.md) - Migrating from mathjs
