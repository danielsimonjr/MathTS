# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTS is a ground-up TypeScript rewrite of mathjs with WASM/WebGPU/WebWorker optimization. It includes a Scientific Workbook system (`.mtsw` files) for reactive YAML-based notebooks targeting theoretical physics and tensor mathematics, specifically the Universal Physics Tensor Framework (UPTF).

## Build & Development Commands

The workbook package is located in `docs/`:

```bash
cd docs

# Install dependencies
npm install

# Build the project
npm run build           # tsup builds src/index.ts and src/cli.ts

# Development mode (watch)
npm run dev

# Run tests
npm run test            # vitest
npm run test -- --watch # Watch mode

# Run specific test file
npx vitest run path/to/test.ts

# Type checking
npm run typecheck       # tsc --noEmit

# Linting
npm run lint            # eslint src --ext .ts
```

### CLI Tool (mtsw)

```bash
# Run a workbook
mtsw run <file.mtsw>
mtsw run <file.mtsw> -c <cell-id>    # Run specific cell
mtsw run <file.mtsw> -v              # Verbose output

# Watch mode
mtsw watch <file.mtsw>

# Validate workbook structure
mtsw validate <file.mtsw>

# Strip outputs for git
mtsw strip <file.mtsw> -o clean.mtsw

# Show dependency graph
mtsw graph <file.mtsw>               # Text format
mtsw graph <file.mtsw> -f mermaid    # Mermaid diagram

# Create new workbook from template
mtsw new <name> -t basic             # basic | tensor-physics | data-science

# Export to other formats
mtsw export <file.mtsw> -f html      # html | pdf | ipynb | latex
```

## Architecture

### Workbook Runtime (`docs/`)

The workbook package (`@mathts/workbook`) provides a YAML-based reactive notebook system:

- **`types.ts`** - Core type definitions: `Workbook`, `Cell`, `DependencyGraph`, `ExecutionContext`
- **`index.ts`** - YAML parser/serializer: `parseWorkbook()`, `serializeWorkbook()`, `stripOutputs()`
- **`graph.ts`** - Dependency graph: `buildDependencyGraph()`, `topologicalSort()`, `getDependents()`
- **`executor.ts`** - Cell execution: `WorkbookExecutor` class with reactive execution
- **`cli.ts`** - Command-line interface

### Cell Types

The workbook supports 8 cell types, each detected by its primary key:
- `markdown` - Documentation with LaTeX math support
- `code` - TypeScript/JavaScript execution
- `tensor` - Einstein notation for tensor math
- `equation` - LaTeX equations with labels
- `visualization` - Three.js/D3/Plotly rendering
- `data` - YAML/JSON/CSV data cells
- `test` - Assertions with timeout support
- `export` - Publication output generation

### Dependency Resolution

Cells declare dependencies via:
1. Explicit `depends_on: [cell-ids]` field
2. Auto-detection from `import ... from '#cell-id'` patterns

The executor runs cells in topological order, supporting three modes:
- `reactive` - Auto-rerun when dependencies change
- `sequential` - Top-to-bottom execution
- `manual` - Explicit trigger only

### Planned Package Structure (Full MathTS)

```
mathts/
├── packages/
│   ├── typed-function/    # Type dispatch system
│   └── workerpool/        # Worker pool management
├── core/                  # @mathts/core - types, config, factory
├── matrix/                # @mathts/matrix - DenseMatrix, SparseMatrix, backends
├── functions/             # @mathts/functions - arithmetic, algebra, stats
├── parallel/              # @mathts/parallel - ComputePool, workers
└── expression/            # @mathts/expression - parser, evaluator
```

### Backend Selection Strategy

Matrix operations support three backends with automatic selection:
- **JSBackend** - Pure TypeScript (default)
- **WASMBackend** - AssemblyScript with SIMD (>1K elements)
- **GPUBackend** - WebGPU compute shaders (>100K elements)

## Key Patterns

### Workbook Parsing
```typescript
const result = parseWorkbook(yamlContent);
if (result.success && result.workbook) {
  const executor = createExecutor(result.workbook);
  await executor.runAll();
}
```

### Cell References
Cells reference each other using `#cell-id` syntax:
```typescript
import { result } from '#previous-cell';
```

### Event Handling
```typescript
executor.on((event: WorkbookEvent) => {
  switch (event.type) {
    case 'cell:success': // Handle success
    case 'cell:error':   // Handle error
    case 'cell:stale':   // Dependencies changed
  }
});
```

## File Format (.mtsw)

YAML-based workbook format designed for Git-friendliness:
```yaml
version: "1.0"
metadata:
  title: "Workbook Title"
  author: "Author Name"
runtime:
  engine: mathts
  execution: reactive
cells:
  - markdown: |
      # Title
    id: intro
  - code: |
      const x = 42;
      export { x };
    id: compute
```

## Code Style

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Examples:
```
feat(matrix): add sparse matrix CSR format support
fix(workbook): resolve circular dependency detection
perf(wasm): optimize matmul with SIMD instructions
```

## Implementation Status

Current workbook runtime is implemented. Pending:
- MathTS core library integration
- Three.js visualization bindings
- Web UI (Monaco + reactive rendering)
- LaTeX/PDF export

## AssemblyScript-Friendly TypeScript Guidelines

### CRITICAL: All Code Must Be WASM-Ready

MathTS targets WebAssembly compilation via AssemblyScript. **All TypeScript code must be written with AssemblyScript compatibility in mind.** This ensures seamless WASM acceleration across the codebase.

### AssemblyScript-Compatible Type System

#### Numeric Types - Use Explicit Sizes

```typescript
// ✅ CORRECT: Use explicit numeric types
const i: i32 = 42;              // 32-bit signed integer
const u: u32 = 42;              // 32-bit unsigned integer
const f: f64 = 3.14159;         // 64-bit float (default for decimals)
const big: i64 = 9007199254740992n; // 64-bit signed integer

// ❌ AVOID: Ambiguous number type
const x: number = 42;           // Compiles but loses precision info

// ✅ For TypeScript compatibility, use type aliases
type i32 = number;
type i64 = bigint;
type f32 = number;
type f64 = number;
```

#### Array Types - Use Typed Arrays

```typescript
// ✅ CORRECT: Use TypedArrays for numeric data
const floats = new Float64Array(1000);
const ints = new Int32Array(1000);
const bytes = new Uint8Array(buffer);

// ❌ AVOID: Generic arrays for numeric data
const numbers: number[] = [];   // No WASM optimization possible

// ✅ For mixed data, use explicit typing
const matrix = new Float64Array(rows * cols);  // Flat row-major
```

#### String Handling

```typescript
// ✅ CORRECT: Simple string operations
const s = "hello";
const len = s.length;
const char = s.charCodeAt(0);

// ❌ AVOID: Complex string methods not in AssemblyScript
// s.normalize(), s.localeCompare(), regex with lookbehind
```

### Memory Management Patterns

#### Avoid Closures in Hot Paths

```typescript
// ❌ AVOID: Closures capture variables (GC overhead)
function process(data: Float64Array): Float64Array {
  const scale = 2.0;
  return data.map(x => x * scale);  // Closure captures 'scale'
}

// ✅ CORRECT: Pass all parameters explicitly
function process(data: Float64Array, scale: f64): Float64Array {
  const result = new Float64Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] * scale;
  }
  return result;
}
```

#### Pre-allocate Buffers

```typescript
// ❌ AVOID: Dynamic allocation in loops
function sum(arrays: Float64Array[]): number {
  let total = 0;
  for (const arr of arrays) {
    const temp = new Float64Array(arr.length);  // GC pressure!
    // ...
  }
  return total;
}

// ✅ CORRECT: Reuse buffers
class VectorOps {
  private buffer: Float64Array;

  constructor(maxSize: i32) {
    this.buffer = new Float64Array(maxSize);
  }

  process(data: Float64Array): Float64Array {
    // Reuse this.buffer instead of allocating
    return this.buffer.subarray(0, data.length);
  }
}
```

### Control Flow Constraints

#### Simple Loop Constructs

```typescript
// ✅ CORRECT: Standard for loops
for (let i: i32 = 0; i < n; i++) { }
while (condition) { }
do { } while (condition);

// ❌ AVOID: Iterator-based loops in hot paths
for (const item of collection) { }  // Iterator overhead
collection.forEach(fn);              // Callback overhead
```

#### No Exceptions in Hot Paths

```typescript
// ❌ AVOID: try/catch in performance-critical code
function divide(a: f64, b: f64): f64 {
  try {
    return a / b;
  } catch (e) {
    return 0;
  }
}

// ✅ CORRECT: Explicit error handling
function divide(a: f64, b: f64): f64 {
  if (b === 0) return NaN;  // Or return error code
  return a / b;
}
```

### Class Design for WASM

#### Simple Classes with Fixed Fields

```typescript
// ✅ CORRECT: Fixed-size class with typed fields
class Complex {
  re: f64;
  im: f64;

  constructor(re: f64 = 0, im: f64 = 0) {
    this.re = re;
    this.im = im;
  }

  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }
}

// ❌ AVOID: Dynamic properties, getters/setters with logic
class BadComplex {
  private _data: Map<string, number>;  // No Map in AssemblyScript
  get magnitude() { return Math.sqrt(...); }  // Getter overhead
}
```

#### No Inheritance Hierarchies

```typescript
// ❌ AVOID: Deep inheritance
class Animal { }
class Mammal extends Animal { }
class Dog extends Mammal { }

// ✅ CORRECT: Composition and interfaces
interface Scalar {
  add(other: this): this;
  multiply(other: this): this;
}

class Complex implements Scalar { ... }
class Fraction implements Scalar { ... }
```

### Function Signatures for WASM Export

```typescript
// ✅ CORRECT: WASM-exportable function signature
// - Use primitive types or TypedArrays
// - Return single value or TypedArray
export function matmul(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bCols: i32
): Float64Array {
  const result = new Float64Array(aRows * bCols);
  // ... implementation
  return result;
}

// ❌ AVOID: Complex return types
export function compute(data: any): { result: number; metadata: object } {
  // Objects with mixed types can't cross WASM boundary efficiently
}
```

## Sprint Development Guidelines

### CRITICAL: Parallel-First Implementation with typed-function and workerpool

**Every sprint MUST implement parallel-first code with typed-function and workerpool integration.** This is the core architectural philosophy of MathTS.

### The Parallel-First Mandate

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MathTS Execution Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User Code                                                              │
│       │                                                                  │
│       ▼                                                                  │
│   ┌─────────────────┐                                                    │
│   │  typed-function │ ◄── Runtime type dispatch                          │
│   │  (polymorphism) │     Automatic type coercion                        │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────┐                                                    │
│   │   ComputePool   │ ◄── ALL operations go through workers              │
│   │  (workerpool)   │     Never bypass for "small" data                  │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────┐                            │
│   │           Worker Threads                 │                           │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │                           │
│   │  │Worker 1 │ │Worker 2 │ │Worker N │    │                           │
│   │  │         │ │         │ │         │    │                           │
│   │  │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │    │                           │
│   │  │ │WASM │ │ │ │WASM │ │ │ │WASM │ │    │ ◄── SIMD acceleration     │
│   │  │ └─────┘ │ │ └─────┘ │ │ └─────┘ │    │     inside workers        │
│   │  └─────────┘ └─────────┘ └─────────┘    │                           │
│   └─────────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### typed-function Integration Pattern

All new types and functions must register with the typed-function system for runtime polymorphic dispatch:

```typescript
// 1. Import the mathTyped instance
import { mathTyped, Complex, Fraction, BigNumber } from '@mathts/core';

// 2. Create polymorphic functions with type signatures
const add = mathTyped('add', {
  'number, number': (a, b) => a + b,
  'Complex, Complex': (a, b) => a.add(b),
  'Fraction, Fraction': (a, b) => a.add(b),
  'BigNumber, BigNumber': (a, b) => a.add(b),
  'Matrix, Matrix': (a, b) => a.add(b),
});

// 3. For new types, add to MATHTS_TYPES in core/src/typed/mathts-typed.ts
export const MATHTS_TYPES: TypeDef[] = [
  { name: 'YourNewType', test: isYourNewType },
  // ...
];

// 4. Add conversions in MATHTS_CONVERSIONS
export const MATHTS_CONVERSIONS: ConversionDef[] = [
  { from: 'number', to: 'YourNewType', convert: (n) => YourNewType.fromNumber(n) },
  // ...
];
```

#### workerpool Integration Pattern

**Use parallel execution whenever possible.** The ComputePool should be the default approach, not just for large datasets. Workers provide isolation, prevent main thread blocking, and enable true concurrency.

```typescript
import { computePool, ComputePool } from '@mathts/parallel';

// 1. Initialize pool (once at startup)
await computePool.initialize();

// 2. ALWAYS prefer parallel execution - use workers by default
const result = await computePool.matmul(a, aRows, aCols, b, bCols);
const sum = await computePool.sum(data);
const mapped = await computePool.map(data, fn);

// 3. Available parallel operations:
await computePool.sum(data);                    // Parallel reduction
await computePool.elementwise(a, b, 'add');     // Element-wise ops
await computePool.matmul(a, aRows, aCols, b, bCols);  // Matrix multiply
await computePool.map(data, fn);                // Parallel map
await computePool.exec('customMethod', params); // Custom worker method

// 4. Batch operations - run multiple independent tasks in parallel
const [result1, result2, result3] = await Promise.all([
  computePool.sum(data1),
  computePool.sum(data2),
  computePool.sum(data3),
]);
```

**Parallel-first philosophy:**
- Use workers for ALL matrix operations regardless of size
- Use workers for ALL array transformations (map, reduce, filter)
- Use workers for ALL numerical computations that can be batched
- Only fall back to sequential for trivial scalar operations
- Leverage `Promise.all()` for independent parallel tasks

### Complete ComputePool API Reference

The ComputePool provides comprehensive parallel operations. **Always use these instead of sequential implementations:**

#### Statistical Operations
```typescript
// Min/Max with indices
const { min, max, minIdx, maxIdx } = (await computePool.minMax(data)).result;

// Variance, mean, standard deviation (Welford's algorithm)
const { mean, variance, std } = (await computePool.variance(data)).result;

// Individual statistics
const meanVal = (await computePool.mean(data)).result;
const stdVal = (await computePool.std(data)).result;
const minVal = (await computePool.min(data)).result;
const maxVal = (await computePool.max(data)).result;

// Euclidean norm and distance
const norm = (await computePool.norm(data)).result;
const dist = (await computePool.distance(a, b)).result;

// Histogram
const bins = (await computePool.histogram(data, 10, min, max)).result;
```

#### Element-wise Operations
```typescript
// Binary operations
const sum = await computePool.add(a, b);
const diff = await computePool.subtract(a, b);
const prod = await computePool.multiply(a, b);
const quot = await computePool.divide(a, b);

// Generic element-wise
const result = await computePool.elementwise(a, b, 'add' | 'subtract' | 'multiply' | 'divide');

// Scalar operations
const scaled = await computePool.scale(data, 2.5);
```

#### Unary Operations
```typescript
// Math functions - ALL run in parallel
const absVals = await computePool.abs(data);
const sqrtVals = await computePool.sqrt(data);
const expVals = await computePool.exp(data);
const logVals = await computePool.log(data);
const sinVals = await computePool.sin(data);
const cosVals = await computePool.cos(data);
const tanVals = await computePool.tan(data);
const negVals = await computePool.negate(data);
const sqVals = await computePool.square(data);

// Generic unary
const result = await computePool.unary(data, 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square');
```

#### Matrix Operations
```typescript
// Matrix multiplication (row-major flat arrays)
const C = await computePool.matmul(A, aRows, aCols, B, bCols);

// Matrix-vector multiplication
const y = await computePool.matvec(matrix, rows, cols, vector);

// Transpose
const transposed = await computePool.transpose(data, rows, cols);

// Outer product
const outer = await computePool.outer(a, b);

// Dot product
const dot = await computePool.dot(a, b);
```

#### Generic Parallel Operations
```typescript
// Parallel map - function runs in workers
const mapped = await computePool.map(data, (x) => x * 2);

// Parallel reduce
const reduced = await computePool.reduce(data, (acc, x) => acc + x, 0);

// Parallel filter
const filtered = await computePool.filter(data, (x) => x > 0);

// Parallel find
const { found, value, index } = (await computePool.find(data, (x) => x === target)).result;

// Parallel sort (merge sort with k-way merge)
const sorted = await computePool.sort(data, (a, b) => a - b);
```

### Implementing New Worker Functions

When adding new parallel operations, follow this pattern:

#### 1. Add Worker Function (`packages/workerpool/src/worker.ts`)

```typescript
/**
 * Process a chunk of data
 * @param buffer - ArrayBuffer containing Float64Array data
 * @param start - Starting index in the buffer
 * @param length - Number of elements to process
 */
function myOperationChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number
): number {  // or ArrayBuffer for array results
  const data = new Float64Array(buffer);
  let result = 0;
  const end = start + length;

  for (let i = start; i < end; i++) {
    result += data[i];  // Your operation
  }

  return result;
}

// Register in workerMethods object at bottom of file
const workerMethods = {
  // ... existing methods
  myOperationChunk,
};
```

#### 2. Add Pool Method (`packages/workerpool/src/index.ts`)

```typescript
async myOperation(
  data: Float64Array,
  options?: TaskOptions
): Promise<ParallelResult<number>> {
  const start = performance.now();

  // Always check parallelization threshold
  if (!this.shouldParallelize(data.length, options)) {
    // Sequential fallback
    let result = 0;
    for (let i = 0; i < data.length; i++) {
      result += data[i];
    }
    return {
      result,
      duration: performance.now() - start,
      chunks: 1,
      parallelized: false,
      workersUsed: 0,
    };
  }

  // Parallel execution
  const chunks = this.chunkFloat64Array(data, options?.chunkSize);
  const stats = this.stats();

  const partialResults = await Promise.all(
    chunks.map((chunk) =>
      this.exec<number>('myOperationChunk', [chunk.buffer, 0, chunk.length])
    )
  );

  // Combine results
  const result = partialResults.reduce((a, b) => a + b, 0);

  return {
    result,
    duration: performance.now() - start,
    chunks: chunks.length,
    parallelized: true,
    workersUsed: Math.min(chunks.length, stats.totalWorkers),
  };
}
```

#### 3. Add ComputePool Wrapper (`parallel/src/ComputePool.ts`)

```typescript
async myOperation(data: Float64Array): Promise<ParallelResult<number>> {
  const result = await this.workerPool.myOperation(data);
  return toParallelResult(result);
}
```

### Zero-Copy Data Transfer

Use `Transfer` for large data to avoid copying:

```typescript
import { Transfer, transferFloat64, transferArrayBuffer } from '@mathts/workerpool';

// Transfer Float64Array (zero-copy)
const transfer = transferFloat64(largeArray);
await pool.exec('process', [transfer]);

// Transfer ArrayBuffer
const bufferTransfer = transferArrayBuffer(buffer);
await pool.exec('processBuffer', [bufferTransfer]);

// Manual Transfer wrapping
const manualTransfer = new Transfer(data, [data.buffer]);
```

### WASM Integration in Workers

Workers can load WASM modules for SIMD acceleration:

```typescript
// In worker.ts - load WASM module
let wasmModule: WebAssembly.Instance | null = null;

async function initWasm(): Promise<void> {
  if (wasmModule) return;

  const wasmBytes = await fetch('/mathts.wasm').then(r => r.arrayBuffer());
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  wasmModule = instance;
}

function matmulChunkWasm(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  aRows: number,
  aCols: number,
  bCols: number
): ArrayBuffer {
  if (wasmModule) {
    // Use WASM SIMD implementation
    const exports = wasmModule.exports as any;
    return exports.matmul(aBuffer, bBuffer, aRows, aCols, bCols);
  }

  // Fallback to JS
  return matmulChunkJS(aBuffer, bBuffer, aRows, aCols, bCols);
}
```

### Feature Detection

```typescript
import { canUseWasm, canUseSharedMemory, initWorkerWasm, getWasmFeatures } from '@mathts/workerpool';

// Synchronous checks (for configuration)
if (canUseWasm()) {
  console.log('WebAssembly available');
}

if (canUseSharedMemory()) {
  console.log('SharedArrayBuffer available - can use shared memory workers');
}

// Async detailed check
const features = await initWorkerWasm();
// { hasWebAssembly, hasSharedArrayBuffer, hasAtomics, hasWASMThreads }
```

#### Sprint Checklist

For each sprint, verify:

- [ ] New numeric types implement `Scalar` interface
- [ ] New types are registered in `MATHTS_TYPES`
- [ ] Type conversions are added to `MATHTS_CONVERSIONS`
- [ ] Type test functions (`isYourType()`) use `instanceof`
- [ ] Functions use `mathTyped()` for polymorphic dispatch
- [ ] ALL operations use `ComputePool` (parallel-first, not just large data)
- [ ] Independent operations use `Promise.all()` for concurrency
- [ ] Tests cover typed-function dispatch and conversions
- [ ] Tests verify parallel execution paths

### Core Type System

MathTS core types in `core/src/types/`:

| Type | File | Interface | Description |
|------|------|-----------|-------------|
| `Complex` | `complex.ts` | `IComplex` | Complex numbers with full arithmetic |
| `Fraction` | `fraction.ts` | `IFraction` | Exact rationals with bigint |
| `BigNumber` | `bignumber.ts` | `IBigNumber` | Arbitrary precision decimals |
| `Matrix` | (pending) | `IMatrix` | Dense/Sparse with backend selection |

### Type Conversion Hierarchy

```
string ──┬──> number ──┬──> Complex
         │             │
bigint ──┴──> Fraction ┴──> BigNumber
```

Conversions flow upward (number → Complex) automatically via typed-function.

### Backend Selection Strategy

**Parallel-first with backend optimization:**

| Backend | Use Case | Notes |
|---------|----------|-------|
| **Workers** | ALL operations | Default for everything - parallel first |
| JS | Scalar-only fallback | Only when workers unavailable |
| WASM | SIMD acceleration | Within workers for vectorized ops |
| GPU | WebGPU compute | Within workers for massive parallelism |

The worker pool is always used. WASM and GPU backends run **inside** workers for additional acceleration:

```
User Code → ComputePool (workers) → WASM/GPU Backend → Result
```

Never bypass workers for "small" operations - the overhead is minimal and consistency matters.

## Sprint Planning Files

Sprint JSON files are in `docs/planning/sprints/`:
- `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`
- Post-v1.0 sprints in `docs/planning/phases/`

Each sprint file contains tasks, dependencies, success criteria, and files to create/modify.
