# MathTS: Building Plan

## TypeScript Mathematics Library with WASM/WebGPU/WebWorkers Optimization

**Version**: 1.0.0  
**Author**: Daniel Simon Jr. (@danielsimonjr)  
**Date**: December 2025  
**Status**: Architecture & Planning Phase

---

## Executive Summary

MathTS is a ground-up TypeScript rewrite of mathjs, leveraging pre-built TypeScript conversions of `typed-function` and `workerpool` as foundational building blocks. The architecture enables progressive optimization through WASM (AssemblyScript), WebGPU compute shaders, and WebWorker parallelization.

### Key Differentiators from mathjs

| Aspect            | mathjs                   | MathTS                         |
| ----------------- | ------------------------ | ------------------------------ |
| Language          | JavaScript + .d.ts       | Native TypeScript              |
| Type Dispatch     | Runtime (typed-function) | Hybrid: TS overloads + runtime |
| Parallelization   | None                     | WebWorkers via workerpool      |
| SIMD Acceleration | None                     | WASM with SIMD intrinsics      |
| GPU Compute       | None                     | WebGPU for large matrices      |
| Tree-shaking      | Limited                  | Full ESM support               |
| Bundle Size       | ~180KB min               | Target: <50KB core             |

---

## Part 1: Foundation Building Blocks

### 1.1 typed-function-ts (COMPLETE)

Your TypeScript port located at `github.com/danielsimonjr/typed-function` (develop branch).

**Architecture**:

```
src/
├── core/
│   ├── type-registry.ts       # Type definitions and test functions
│   ├── signature-parser.ts    # Parse "number, string" → structured form
│   ├── signature-compiler.ts  # Compile signatures to dispatch tree
│   ├── signature-comparator.ts # Ordering and preference logic
│   ├── conversion-manager.ts  # Type conversion chains
│   ├── reference-resolver.ts  # referTo/referToSelf handling
│   ├── error-factory.ts       # Informative error generation
│   └── types.ts               # Core TypeScript interfaces
├── dispatch/
│   └── [dispatch logic]
├── wasm/
│   ├── assembly/              # AssemblyScript source
│   ├── bindings.ts            # JS ↔ WASM bridge
│   ├── loader.ts              # WASM module loading
│   ├── type-masks.ts          # Bitfield type checking
│   └── fallback.ts            # Graceful JS fallback
├── utils/
└── index.ts
```

**Key Capabilities for MathTS**:

- Type registration with custom test functions
- Signature parsing and compilation
- Runtime type dispatch with compile-time type safety
- Automatic type conversions
- WASM-accelerated type checking (via type-masks.ts)

**Integration Pattern**:

```typescript
import { createTyped, TypedFunction } from '@danielsimonjr/mathts-typed-function';

// Create MathTS-specific typed instance
const typed = createTyped({
  types: [
    { name: 'number', test: (x): x is number => typeof x === 'number' },
    { name: 'Matrix', test: (x): x is Matrix => x instanceof Matrix },
    { name: 'Complex', test: (x): x is Complex => x instanceof Complex },
    // ... MathTS types
  ],
  conversions: [
    { from: 'number', to: 'Complex', convert: (n) => new Complex(n, 0) },
    { from: 'Array', to: 'Matrix', convert: (a) => Matrix.from(a) },
  ],
});
```

---

### 1.2 workerpool-ts (IN PROGRESS)

Your TypeScript port at `github.com/danielsimonjr/workerpool` (master branch).

**Architecture**:

```
src/
├── Pool.js → Pool.ts          # Worker pool management
├── WorkerHandler.js           # Individual worker lifecycle
├── Promise.js                 # Custom promise with cancel/timeout
├── wasm/
│   ├── WasmBridge.ts          # WASM ↔ JS communication
│   ├── WasmLoader.ts          # Dynamic WASM loading
│   ├── WasmTaskQueue.ts       # WASM-backed task queue
│   ├── feature-detection.ts   # Runtime capability detection
│   └── index.ts
├── queues.js                  # Queue strategy factory
└── types/                     # TypeScript interfaces

assembly/
├── ring-buffer.ts             # Lock-free circular buffer
├── priority-queue.ts          # Binary heap priority queue
├── task-slots.ts              # Task slot management
├── memory.ts                  # Shared memory utilities
└── index.ts
```

**Key Capabilities for MathTS**:

- Multiple queue strategies (FIFO, LIFO, Priority, WASM)
- Lock-free WASM queues with 24.5x performance improvement
- Worker lifecycle management
- Task cancellation and timeout
- Cross-platform (Node.js worker_threads, Browser WebWorkers)

**Integration Pattern**:

```typescript
import { pool, WorkerPool } from '@danielsimonjr/mathts-workerpool';

// Create compute pool for matrix operations
const computePool = pool({
  minWorkers: 2,
  maxWorkers: navigator.hardwareConcurrency || 4,
  workerType: 'auto',
  queueStrategy: 'wasm', // Use WASM-accelerated queue
});

// Offload matrix multiplication
const result = await computePool.exec('matmul', [matrixA, matrixB], {
  transfer: [matrixA.buffer, matrixB.buffer], // Zero-copy transfer
});
```

---

## Part 2: MathTS Core Architecture

### 2.1 Package Structure

```
mathts/
├── packages/
│   ├── typed-function/              # Your TS port (symlink or npm workspace)
│   └── workerpool/                  # Your TS port (symlink or npm workspace)
│
├── core/                            # @danielsimonjr/mathts-core
│   ├── src/
│   │   ├── types/                   # Fundamental type definitions
│   │   │   ├── interfaces.ts
│   │   │   ├── number.ts
│   │   │   ├── complex.ts
│   │   │   ├── fraction.ts
│   │   │   ├── bigint.ts
│   │   │   ├── bignumber.ts
│   │   │   └── index.ts
│   │   ├── config/          		 # Configuration management
│   │   ├── typed/           		 # typed-function integration
│   │   │   ├── mathts-typed.ts    	 # Pre-configured typed instance
│   │   │   └── type-definitions.ts
│   │   ├── factory/         		 # Function factory pattern
│   │   │   ├── factory.ts
│   │   │   └── dependencies.ts
│   │   └── index.ts
│   └── package.json
│
├── matrix/                  		 # @danielsimonjr/mathts-matrix
│   ├── src/
│   │   ├── types/
│   │   │   ├── Matrix.ts            # Abstract base
│   │   │   ├── DenseMatrix.ts       # Row-major dense
│   │   │   ├── SparseMatrix.ts      # CSR/CSC sparse
│   │   │   ├── ImmutableMatrix.ts
│   │   │   └── index.ts
│   │   ├── backends/
│   │   │   ├── Backend.ts           # Backend interface
│   │   │   ├── JSBackend.ts         # Pure TypeScript
│   │   │   ├── WASMBackend.ts       # AssemblyScript WASM
│   │   │   ├── GPUBackend.ts        # WebGPU compute
│   │   │   └── index.ts
│   │   ├── operations/
│   │   │   ├── arithmetic.ts        # add, subtract, multiply
│   │   │   ├── transform.ts         # transpose, reshape
│   │   │   ├── decomposition.ts     # LU, QR, SVD
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── assembly/                    # AssemblyScript source
│   │   ├── matmul.ts
│   │   ├── elementwise.ts
│   │   ├── transpose.ts
│   │   └── index.ts
│   ├── gpu/                         # WebGPU shaders
│   │   ├── shaders/
│   │   │   ├── matmul.wgsl
│   │   │   ├── elementwise.wgsl
│   │   │   └── reduce.wgsl
│   │   └── GPUContext.ts
│   └── package.json
│
├── functions/               # @danielsimonjr/mathts-functions
│   ├── src/
│   │   ├── arithmetic/      # add, subtract, multiply, divide...
│   │   ├── algebra/         # simplify, derivative, solve...
│   │   ├── trigonometry/    # sin, cos, tan, atan2...
│   │   ├── statistics/      # mean, std, variance...
│   │   ├── probability/     # factorial, permutations...
│   │   ├── matrix/          # det, inv, eigs, svd...
│   │   ├── complex/         # re, im, arg, conj...
│   │   ├── bitwise/         # and, or, xor, not...
│   │   ├── logical/         # and, or, not, xor...
│   │   ├── relational/      # equal, larger, smaller...
│   │   ├── special/         # gamma, beta, erf...
│   │   ├── signal/          # fft, ifft, conv...
│   │   ├── geometry/        # distance, intersect...
│   │   ├── combinatorics/   # bellNumbers, stirling...
│   │   ├── string/          # format, print...
│   │   ├── unit/            # Unit operations
│   │   └── index.ts
│   └── package.json
│
├── expression/              # @danielsimonjr/mathts-expression
│   ├── src/
│   │   ├── parser/          # Expression parser
│   │   ├── evaluator/       # Expression evaluation
│   │   ├── compiler/        # Expression compilation
│   │   └── index.ts
│   └── package.json
│
├── parallel/                # @danielsimonjr/mathts-parallel
│   ├── src/
│   │   ├── ComputePool.ts   # workerpool integration
│   │   ├── strategies/      # Parallelization strategies
│   │   │   ├── chunk.ts     # Chunk-based parallelism
│   │   │   ├── pipeline.ts  # Pipeline parallelism
│   │   │   └── map-reduce.ts
│   │   ├── workers/         # Worker implementations
│   │   │   ├── matrix.worker.ts
│   │   │   ├── fft.worker.ts
│   │   │   └── compute.worker.ts
│   │   └── index.ts
│   └── package.json
│
│                  # @mathts/mathts (main package)
├── src/
│   ├── create.ts        # Factory function
│   ├── instance.ts      # Default instance
│   └── index.ts         # Public API
├── package.json
│
├── tools/
│   ├── benchmark/               # Performance benchmarks
│   ├── codegen/                 # Code generation scripts
│   └── migrate/                 # mathjs migration tools
│
├── docs/
│   ├── api/                     # API documentation
│   ├── architecture/            # Architecture docs
│   └── migration/               # Migration guide from mathjs
│
├── package.json                 # Workspace root
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

### 2.2 Core Type System

```typescript
// packages/core/src/types/interfaces.ts

/**
 * Base interface for all MathTS numeric types
 */
export interface MathTSValue {
  readonly type: string;
  valueOf(): number | bigint;
  toString(): string;
  toJSON(): unknown;
}

/**
 * Scalar types that support arithmetic
 */
export interface Scalar extends MathTSValue {
  add(other: Scalar): Scalar;
  subtract(other: Scalar): Scalar;
  multiply(other: Scalar): Scalar;
  divide(other: Scalar): Scalar;
  negate(): Scalar;
  abs(): Scalar;
}

/**
 * Matrix interface with backend abstraction
 */
export interface IMatrix<T = number> extends MathTSValue {
  readonly rows: number;
  readonly cols: number;
  readonly size: readonly [number, number];
  readonly length: number;
  readonly backend: MatrixBackend;

  // Element access
  get(row: number, col: number): T;
  set(row: number, col: number, value: T): void;

  // Views (no copy)
  row(index: number): IMatrix<T>;
  column(index: number): IMatrix<T>;
  slice(rowStart: number, rowEnd: number, colStart: number, colEnd: number): IMatrix<T>;

  // Transformations
  transpose(): IMatrix<T>;
  reshape(rows: number, cols: number): IMatrix<T>;
  flatten(): T[];

  // Arithmetic (dispatches to backend)
  add(other: IMatrix<T> | T): IMatrix<T>;
  subtract(other: IMatrix<T> | T): IMatrix<T>;
  multiply(other: IMatrix<T> | T): IMatrix<T>;

  // Data access
  toArray(): T[][];
  toBuffer(): ArrayBuffer;
  clone(): IMatrix<T>;
}

/**
 * Backend interface for matrix operations
 */
export interface MatrixBackend {
  readonly name: 'js' | 'wasm' | 'gpu';
  readonly isAvailable: boolean;

  // Core operations
  matmul(a: Float64Array, b: Float64Array, m: number, n: number, k: number): Float64Array;
  transpose(data: Float64Array, rows: number, cols: number): Float64Array;
  add(a: Float64Array, b: Float64Array): Float64Array;
  subtract(a: Float64Array, b: Float64Array): Float64Array;
  scale(data: Float64Array, scalar: number): Float64Array;

  // Advanced operations
  lu(data: Float64Array, n: number): { L: Float64Array; U: Float64Array; P: Int32Array };
  qr(data: Float64Array, m: number, n: number): { Q: Float64Array; R: Float64Array };
  svd(
    data: Float64Array,
    m: number,
    n: number
  ): { U: Float64Array; S: Float64Array; V: Float64Array };
  eig(data: Float64Array, n: number): { values: Float64Array; vectors: Float64Array };
}

/**
 * Complex number type
 */
export interface IComplex extends Scalar {
  readonly re: number;
  readonly im: number;

  conjugate(): IComplex;
  arg(): number;
  abs(): number;
  sqrt(): IComplex;
  exp(): IComplex;
  log(): IComplex;
}
```

---

### 2.3 Backend Selection Strategy

```typescript
// packages/matrix/src/backends/index.ts

import { MatrixBackend } from './Backend';
import { JSBackend } from './JSBackend';
import { WASMBackend } from './WASMBackend';
import { GPUBackend } from './GPUBackend';

export interface BackendConfig {
  preferred: 'auto' | 'js' | 'wasm' | 'gpu';
  thresholds: {
    wasmMinElements: number; // Min elements to use WASM (default: 1000)
    gpuMinElements: number; // Min elements to use GPU (default: 100000)
  };
  fallback: boolean; // Fallback to JS if preferred unavailable
}

const defaultConfig: BackendConfig = {
  preferred: 'auto',
  thresholds: {
    wasmMinElements: 1000,
    gpuMinElements: 100000,
  },
  fallback: true,
};

class BackendManager {
  private jsBackend: JSBackend;
  private wasmBackend: WASMBackend | null = null;
  private gpuBackend: GPUBackend | null = null;
  private config: BackendConfig;

  constructor(config: Partial<BackendConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.jsBackend = new JSBackend();
  }

  async initialize(): Promise<void> {
    // Attempt WASM initialization
    try {
      this.wasmBackend = new WASMBackend();
      await this.wasmBackend.initialize();
    } catch (e) {
      console.warn('WASM backend unavailable:', e);
      this.wasmBackend = null;
    }

    // Attempt GPU initialization
    try {
      if ('gpu' in navigator) {
        this.gpuBackend = new GPUBackend();
        await this.gpuBackend.initialize();
      }
    } catch (e) {
      console.warn('GPU backend unavailable:', e);
      this.gpuBackend = null;
    }
  }

  /**
   * Select optimal backend based on operation and data size
   */
  select(operation: string, elementCount: number): MatrixBackend {
    const { preferred, thresholds, fallback } = this.config;

    if (preferred === 'js') {
      return this.jsBackend;
    }

    if (
      preferred === 'gpu' ||
      (preferred === 'auto' && elementCount >= thresholds.gpuMinElements)
    ) {
      if (this.gpuBackend?.isAvailable) {
        return this.gpuBackend;
      }
      if (!fallback) throw new Error('GPU backend unavailable');
    }

    if (
      preferred === 'wasm' ||
      (preferred === 'auto' && elementCount >= thresholds.wasmMinElements)
    ) {
      if (this.wasmBackend?.isAvailable) {
        return this.wasmBackend;
      }
      if (!fallback) throw new Error('WASM backend unavailable');
    }

    return this.jsBackend;
  }

  get js(): JSBackend {
    return this.jsBackend;
  }
  get wasm(): WASMBackend | null {
    return this.wasmBackend;
  }
  get gpu(): GPUBackend | null {
    return this.gpuBackend;
  }
}

export const backends = new BackendManager();
```

---

### 2.4 Parallel Execution Integration

```typescript
// packages/parallel/src/ComputePool.ts

import { pool, Pool, WorkerPool } from '@danielsimonjr/mathts-workerpool';
import { IMatrix } from '@danielsimonjr/mathts-core';

export interface ParallelConfig {
  enabled: boolean;
  minWorkers: number;
  maxWorkers: number;
  thresholdElements: number; // Min elements before parallelizing
  chunkSize: number; // Elements per chunk
}

const defaultConfig: ParallelConfig = {
  enabled: true,
  minWorkers: 1,
  maxWorkers: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
  thresholdElements: 50000,
  chunkSize: 10000,
};

export class ComputePool {
  private pool: Pool | null = null;
  private config: ParallelConfig;

  constructor(config: Partial<ParallelConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    this.pool = pool({
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      workerType: 'auto',
    });
  }

  /**
   * Determine if operation should be parallelized
   */
  shouldParallelize(elementCount: number): boolean {
    return (
      this.config.enabled && this.pool !== null && elementCount >= this.config.thresholdElements
    );
  }

  /**
   * Parallel matrix multiplication
   */
  async matmul(a: IMatrix, b: IMatrix): Promise<IMatrix> {
    if (!this.shouldParallelize(a.rows * b.cols)) {
      // Fall back to synchronous
      return a.multiply(b);
    }

    // Chunk rows of A for parallel processing
    const chunks = this.chunkRows(a, this.config.chunkSize);

    const results = await Promise.all(
      chunks.map((chunk, i) =>
        this.pool!.exec(
          'matmulChunk',
          [chunk.toBuffer(), b.toBuffer(), chunk.rows, chunk.cols, b.cols],
          {
            transfer: [chunk.toBuffer(), b.toBuffer()],
          }
        )
      )
    );

    // Combine results
    return this.combineRows(results);
  }

  /**
   * Parallel element-wise operation
   */
  async elementwise(
    a: IMatrix,
    b: IMatrix,
    op: 'add' | 'subtract' | 'multiply' | 'divide'
  ): Promise<IMatrix> {
    if (!this.shouldParallelize(a.length)) {
      // Fall back to synchronous
      switch (op) {
        case 'add':
          return a.add(b);
        case 'subtract':
          return a.subtract(b);
        case 'multiply':
          return a.multiply(b);
        case 'divide':
          return a.divide(b);
      }
    }

    const chunks = this.chunkData(a, b, this.config.chunkSize);

    const results = await Promise.all(
      chunks.map(([chunkA, chunkB]) =>
        this.pool!.exec('elementwiseOp', [chunkA, chunkB, op], {
          transfer: [chunkA, chunkB],
        })
      )
    );

    return this.combineData(results, a.rows, a.cols);
  }

  /**
   * Parallel map operation
   */
  async map<T, R>(data: T[], fn: (item: T) => R): Promise<R[]> {
    if (!this.shouldParallelize(data.length)) {
      return data.map(fn);
    }

    const chunks = this.chunkArray(data, this.config.chunkSize);

    const results = await Promise.all(chunks.map((chunk) => this.pool!.exec(fn, [chunk])));

    return results.flat();
  }

  async terminate(): Promise<void> {
    if (this.pool) {
      await this.pool.terminate();
      this.pool = null;
    }
  }

  // Helper methods
  private chunkRows(matrix: IMatrix, chunkSize: number): IMatrix[] {
    /* ... */
  }
  private chunkData(a: IMatrix, b: IMatrix, chunkSize: number): [ArrayBuffer, ArrayBuffer][] {
    /* ... */
  }
  private chunkArray<T>(arr: T[], chunkSize: number): T[][] {
    /* ... */
  }
  private combineRows(results: ArrayBuffer[]): IMatrix {
    /* ... */
  }
  private combineData(results: ArrayBuffer[], rows: number, cols: number): IMatrix {
    /* ... */
  }
}

export const computePool = new ComputePool();
```

---

## Part 3: Migration Phases

### Phase 1: Core Foundation (Sprints 1-4)

**Goal**: Establish core type system, typed-function integration, and basic Matrix implementation.

#### Sprint 1: Project Setup & Core Types (Week 1)

| Task                                         | Files                                   | Est. Hours | Dependencies |
| -------------------------------------------- | --------------------------------------- | ---------- | ------------ |
| 1.1 Initialize monorepo with pnpm workspaces | `package.json`, `pnpm-workspace.yaml`   | 2          | None         |
| 1.2 Configure TypeScript, Vitest, ESLint     | `tsconfig.json`, `vitest.config.ts`     | 2          | 1.1          |
| 1.3 Link typed-function-ts package           | `packages/typed-function/`              | 1          | 1.1          |
| 1.4 Link workerpool-ts package               | `packages/workerpool/`                  | 1          | 1.1          |
| 1.5 Create core package structure            | `packages/core/`                        | 2          | 1.1          |
| 1.6 Implement base interfaces                | `packages/core/src/types/interfaces.ts` | 4          | 1.5          |
| 1.7 Implement number type                    | `packages/core/src/types/number.ts`     | 2          | 1.6          |
| 1.8 Write core type tests                    | `packages/core/test/`                   | 4          | 1.6, 1.7     |

**Deliverables**:

- Working monorepo with linked dependencies
- Core type interfaces defined
- Basic number type with tests

---

#### Sprint 2: Complex & Fraction Types (Week 2)

| Task                                   | Files                                  | Est. Hours | Dependencies |
| -------------------------------------- | -------------------------------------- | ---------- | ------------ |
| 2.1 Implement Complex class            | `packages/core/src/types/complex.ts`   | 6          | Sprint 1     |
| 2.2 Complex arithmetic operations      | Same                                   | 4          | 2.1          |
| 2.3 Complex transcendental functions   | Same                                   | 4          | 2.2          |
| 2.4 Implement Fraction class           | `packages/core/src/types/fraction.ts`  | 4          | Sprint 1     |
| 2.5 Fraction arithmetic with GCD       | Same                                   | 3          | 2.4          |
| 2.6 BigNumber integration (decimal.js) | `packages/core/src/types/bignumber.ts` | 3          | Sprint 1     |
| 2.7 Write comprehensive tests          | `packages/core/test/types/`            | 6          | 2.1-2.6      |

**Deliverables**:

- Complex number type with full arithmetic
- Fraction type with exact rational arithmetic
- BigNumber integration

---

#### Sprint 3: typed-function Integration (Week 3)

| Task                             | Files                                         | Est. Hours | Dependencies |
| -------------------------------- | --------------------------------------------- | ---------- | ------------ |
| 3.1 Create MathTS typed instance | `packages/core/src/typed/mathts-typed.ts`     | 4          | Sprint 2     |
| 3.2 Register core types          | `packages/core/src/typed/type-definitions.ts` | 4          | 3.1          |
| 3.3 Define type conversions      | Same                                          | 4          | 3.2          |
| 3.4 Implement factory pattern    | `packages/core/src/factory/factory.ts`        | 6          | 3.1          |
| 3.5 Dependency injection system  | `packages/core/src/factory/dependencies.ts`   | 4          | 3.4          |
| 3.6 Test typed dispatch          | `packages/core/test/typed/`                   | 6          | 3.1-3.5      |

**Deliverables**:

- Configured typed-function instance with MathTS types
- Factory pattern for function creation
- Type conversion chains working

---

#### Sprint 4: Basic Matrix Implementation (Week 4)

| Task                                            | Files                                       | Est. Hours | Dependencies |
| ----------------------------------------------- | ------------------------------------------- | ---------- | ------------ |
| 4.1 Create matrix package                       | `packages/matrix/`                          | 2          | Sprint 3     |
| 4.2 Implement Matrix base class                 | `packages/matrix/src/types/Matrix.ts`       | 4          | 4.1          |
| 4.3 Implement DenseMatrix                       | `packages/matrix/src/types/DenseMatrix.ts`  | 8          | 4.2          |
| 4.4 Matrix indexing and slicing                 | Same                                        | 4          | 4.3          |
| 4.5 Implement JSBackend                         | `packages/matrix/src/backends/JSBackend.ts` | 6          | 4.3          |
| 4.6 Basic operations (add, multiply, transpose) | Same                                        | 6          | 4.5          |
| 4.7 Matrix tests                                | `packages/matrix/test/`                     | 6          | 4.3-4.6      |

**Deliverables**:

- DenseMatrix with TypeScript backend
- Basic matrix operations working
- Element access, slicing, views

---

### Phase 2: WASM Acceleration (Sprints 5-8)

**Goal**: Implement AssemblyScript WASM backend for matrix operations.

#### Sprint 5: WASM Infrastructure (Week 5)

| Task                           | Files                                         | Est. Hours | Dependencies |
| ------------------------------ | --------------------------------------------- | ---------- | ------------ |
| 5.1 Configure AssemblyScript   | `packages/matrix/assembly/`, `asconfig.json`  | 2          | Phase 1      |
| 5.2 Memory management module   | `packages/matrix/assembly/memory.ts`          | 4          | 5.1          |
| 5.3 WASM loader and bridge     | `packages/matrix/src/backends/wasm/loader.ts` | 4          | 5.1          |
| 5.4 Feature detection          | `packages/matrix/src/backends/wasm/detect.ts` | 2          | 5.3          |
| 5.5 WASMBackend class skeleton | `packages/matrix/src/backends/WASMBackend.ts` | 4          | 5.3, 5.4     |
| 5.6 Fallback mechanism         | Same                                          | 3          | 5.5          |
| 5.7 WASM loading tests         | `packages/matrix/test/wasm/`                  | 4          | 5.5          |

**Deliverables**:

- AssemblyScript compilation pipeline
- WASM loader with feature detection
- Fallback to JS when WASM unavailable

---

#### Sprint 6: WASM Matrix Operations (Week 6)

| Task                               | Files                                         | Est. Hours | Dependencies |
| ---------------------------------- | --------------------------------------------- | ---------- | ------------ |
| 6.1 Element-wise operations (WASM) | `packages/matrix/assembly/elementwise.ts`     | 6          | Sprint 5     |
| 6.2 Matrix transpose (WASM)        | `packages/matrix/assembly/transpose.ts`       | 4          | Sprint 5     |
| 6.3 Matrix multiplication (WASM)   | `packages/matrix/assembly/matmul.ts`          | 8          | Sprint 5     |
| 6.4 SIMD optimizations             | Same files                                    | 6          | 6.1-6.3      |
| 6.5 Bind WASM to Backend           | `packages/matrix/src/backends/WASMBackend.ts` | 4          | 6.1-6.4      |
| 6.6 Performance benchmarks         | `tools/benchmark/wasm/`                       | 4          | 6.5          |
| 6.7 WASM operation tests           | `packages/matrix/test/wasm/`                  | 4          | 6.5          |

**Deliverables**:

- WASM implementations of core matrix ops
- SIMD-accelerated paths
- Benchmarks showing speedup over JS

---

#### Sprint 7: Advanced WASM Operations (Week 7)

| Task                        | Files                                         | Est. Hours | Dependencies |
| --------------------------- | --------------------------------------------- | ---------- | ------------ |
| 7.1 LU decomposition (WASM) | `packages/matrix/assembly/lu.ts`              | 6          | Sprint 6     |
| 7.2 QR decomposition (WASM) | `packages/matrix/assembly/qr.ts`              | 6          | Sprint 6     |
| 7.3 Matrix inversion (WASM) | `packages/matrix/assembly/inv.ts`             | 4          | 7.1          |
| 7.4 Determinant (WASM)      | `packages/matrix/assembly/det.ts`             | 3          | 7.1          |
| 7.5 Bind to WASMBackend     | `packages/matrix/src/backends/WASMBackend.ts` | 4          | 7.1-7.4      |
| 7.6 Accuracy tests vs JS    | `packages/matrix/test/wasm/accuracy.test.ts`  | 4          | 7.5          |

**Deliverables**:

- WASM LU and QR decomposition
- Matrix inversion and determinant
- Numerical accuracy validation

---

#### Sprint 8: Backend Manager & Sparse Matrices (Week 8)

| Task                              | Files                                       | Est. Hours | Dependencies |
| --------------------------------- | ------------------------------------------- | ---------- | ------------ |
| 8.1 BackendManager implementation | `packages/matrix/src/backends/index.ts`     | 4          | Sprint 7     |
| 8.2 Auto-selection logic          | Same                                        | 4          | 8.1          |
| 8.3 SparseMatrix (CSR format)     | `packages/matrix/src/types/SparseMatrix.ts` | 8          | Sprint 7     |
| 8.4 Sparse operations (JS)        | Same                                        | 6          | 8.3          |
| 8.5 Sparse ↔ Dense conversion     | Same                                        | 3          | 8.3, 8.4     |
| 8.6 Sparse tests                  | `packages/matrix/test/sparse/`              | 4          | 8.3-8.5      |

**Deliverables**:

- Backend auto-selection based on size
- SparseMatrix with CSR format
- Sparse-dense interoperability

---

### Phase 3: Parallel Execution (Sprints 9-12)

**Goal**: Integrate workerpool for CPU parallelism.

#### Sprint 9: Parallel Infrastructure (Week 9)

| Task                              | Files                                            | Est. Hours | Dependencies |
| --------------------------------- | ------------------------------------------------ | ---------- | ------------ |
| 9.1 Create parallel package       | `packages/parallel/`                             | 2          | Phase 2      |
| 9.2 ComputePool class             | `packages/parallel/src/ComputePool.ts`           | 6          | 9.1          |
| 9.3 Worker lifecycle management   | Same                                             | 4          | 9.2          |
| 9.4 Task chunking strategies      | `packages/parallel/src/strategies/chunk.ts`      | 4          | 9.2          |
| 9.5 Matrix worker implementation  | `packages/parallel/src/workers/matrix.worker.ts` | 6          | 9.4          |
| 9.6 Transferable object handling  | Same                                             | 4          | 9.5          |
| 9.7 Parallel infrastructure tests | `packages/parallel/test/`                        | 4          | 9.2-9.6      |

**Deliverables**:

- ComputePool with worker management
- Task chunking for large matrices
- Zero-copy data transfer

---

#### Sprint 10: Parallel Matrix Operations (Week 10)

| Task                                  | Files                                             | Est. Hours | Dependencies |
| ------------------------------------- | ------------------------------------------------- | ---------- | ------------ |
| 10.1 Parallel matmul                  | `packages/parallel/src/operations/matmul.ts`      | 6          | Sprint 9     |
| 10.2 Parallel element-wise ops        | `packages/parallel/src/operations/elementwise.ts` | 4          | Sprint 9     |
| 10.3 Parallel reduce (sum, max, etc.) | `packages/parallel/src/operations/reduce.ts`      | 4          | Sprint 9     |
| 10.4 Parallel map                     | `packages/parallel/src/operations/map.ts`         | 3          | Sprint 9     |
| 10.5 Threshold-based dispatch         | `packages/parallel/src/strategies/threshold.ts`   | 4          | 10.1-10.4    |
| 10.6 Parallel operation benchmarks    | `tools/benchmark/parallel/`                       | 4          | 10.1-10.4    |
| 10.7 Parallel tests                   | `packages/parallel/test/operations/`              | 4          | 10.1-10.4    |

**Deliverables**:

- Parallel matrix multiplication
- Parallel element-wise operations
- Benchmarks showing parallel speedup

---

#### Sprint 11: FFT and Signal Processing (Week 11)

| Task                             | Files                                     | Est. Hours | Dependencies |
| -------------------------------- | ----------------------------------------- | ---------- | ------------ |
| 11.1 FFT implementation (JS)     | `packages/functions/src/signal/fft.ts`    | 6          | Sprint 10    |
| 11.2 FFT WASM acceleration       | `packages/matrix/assembly/fft.ts`         | 6          | 11.1         |
| 11.3 Parallel FFT (large arrays) | `packages/parallel/src/operations/fft.ts` | 4          | 11.2         |
| 11.4 IFFT implementation         | `packages/functions/src/signal/ifft.ts`   | 3          | 11.1         |
| 11.5 Convolution                 | `packages/functions/src/signal/conv.ts`   | 4          | 11.1         |
| 11.6 Signal processing tests     | `packages/functions/test/signal/`         | 4          | 11.1-11.5    |

**Deliverables**:

- FFT with WASM acceleration
- Parallel FFT for large arrays
- Convolution and related ops

---

#### Sprint 12: eigendecomposition & SVD (Week 12)

| Task                                 | Files                                     | Est. Hours | Dependencies |
| ------------------------------------ | ----------------------------------------- | ---------- | ------------ |
| 12.1 Eigenvalue solver (JS)          | `packages/matrix/src/operations/eig.ts`   | 8          | Sprint 11    |
| 12.2 Eigenvector computation         | Same                                      | 4          | 12.1         |
| 12.3 SVD implementation (JS)         | `packages/matrix/src/operations/svd.ts`   | 8          | Sprint 11    |
| 12.4 WASM acceleration for eig/svd   | `packages/matrix/assembly/eig.ts`         | 8          | 12.1-12.3    |
| 12.5 Parallel eig for large matrices | `packages/parallel/src/operations/eig.ts` | 4          | 12.4         |
| 12.6 Numerical accuracy tests        | `packages/matrix/test/decomposition/`     | 4          | 12.1-12.5    |

**Deliverables**:

- Eigenvalue decomposition
- SVD with WASM acceleration
- Parallel paths for large matrices

---

### Phase 4: WebGPU Acceleration (Sprints 13-16)

**Goal**: Add WebGPU compute shaders for massive matrices.

#### Sprint 13: WebGPU Infrastructure (Week 13)

| Task                             | Files                                               | Est. Hours | Dependencies |
| -------------------------------- | --------------------------------------------------- | ---------- | ------------ |
| 13.1 WebGPU detection            | `packages/matrix/src/backends/gpu/detect.ts`        | 2          | Phase 3      |
| 13.2 GPUContext class            | `packages/matrix/src/backends/gpu/GPUContext.ts`    | 6          | 13.1         |
| 13.3 Buffer management           | `packages/matrix/src/backends/gpu/BufferPool.ts`    | 4          | 13.2         |
| 13.4 Shader compilation pipeline | `packages/matrix/src/backends/gpu/ShaderManager.ts` | 4          | 13.2         |
| 13.5 GPUBackend skeleton         | `packages/matrix/src/backends/GPUBackend.ts`        | 4          | 13.2-13.4    |
| 13.6 GPU initialization tests    | `packages/matrix/test/gpu/`                         | 4          | 13.5         |

**Deliverables**:

- WebGPU context management
- Buffer pool for GPU memory
- Shader compilation infrastructure

---

#### Sprint 14: GPU Matrix Operations (Week 14)

| Task                            | Files                                          | Est. Hours | Dependencies |
| ------------------------------- | ---------------------------------------------- | ---------- | ------------ |
| 14.1 Element-wise shader        | `packages/matrix/gpu/shaders/elementwise.wgsl` | 4          | Sprint 13    |
| 14.2 Matmul shader (naive)      | `packages/matrix/gpu/shaders/matmul.wgsl`      | 6          | Sprint 13    |
| 14.3 Matmul shader (tiled)      | Same                                           | 6          | 14.2         |
| 14.4 Reduce shader              | `packages/matrix/gpu/shaders/reduce.wgsl`      | 4          | Sprint 13    |
| 14.5 Bind shaders to GPUBackend | `packages/matrix/src/backends/GPUBackend.ts`   | 4          | 14.1-14.4    |
| 14.6 GPU operation benchmarks   | `tools/benchmark/gpu/`                         | 4          | 14.5         |
| 14.7 GPU accuracy tests         | `packages/matrix/test/gpu/`                    | 4          | 14.5         |

**Deliverables**:

- WGSL compute shaders for matrix ops
- Tiled matmul for cache efficiency
- GPU acceleration benchmarks

---

#### Sprint 15: GPU Advanced Operations (Week 15)

| Task                         | Files                                               | Est. Hours | Dependencies |
| ---------------------------- | --------------------------------------------------- | ---------- | ------------ |
| 15.1 Transpose shader        | `packages/matrix/gpu/shaders/transpose.wgsl`        | 3          | Sprint 14    |
| 15.2 LU decomposition shader | `packages/matrix/gpu/shaders/lu.wgsl`               | 6          | Sprint 14    |
| 15.3 Batch operations        | `packages/matrix/src/backends/gpu/BatchExecutor.ts` | 4          | Sprint 14    |
| 15.4 Async pipeline          | Same                                                | 4          | 15.3         |
| 15.5 GPU ↔ CPU sync strategy | `packages/matrix/src/backends/gpu/Sync.ts`          | 4          | 15.3         |
| 15.6 Integration tests       | `packages/matrix/test/gpu/integration.test.ts`      | 4          | 15.1-15.5    |

**Deliverables**:

- Advanced GPU operations
- Batch execution for multiple ops
- Efficient CPU-GPU synchronization

---

#### Sprint 16: Unified Backend Selection (Week 16)

| Task                               | Files                                   | Est. Hours | Dependencies |
| ---------------------------------- | --------------------------------------- | ---------- | ------------ |
| 16.1 Update BackendManager for GPU | `packages/matrix/src/backends/index.ts` | 4          | Sprint 15    |
| 16.2 Adaptive threshold tuning     | Same                                    | 4          | 16.1         |
| 16.3 Backend preference API        | Same                                    | 3          | 16.2         |
| 16.4 End-to-end benchmarks         | `tools/benchmark/e2e/`                  | 4          | 16.1-16.3    |
| 16.5 Documentation                 | `docs/backends.md`                      | 4          | 16.1-16.3    |
| 16.6 Performance guide             | `docs/performance.md`                   | 3          | 16.4         |

**Deliverables**:

- Three-tier backend selection (JS → WASM → GPU)
- Adaptive thresholds based on runtime profiling
- Complete backend documentation

---

### Phase 5: Function Library (Sprints 17-24)

**Goal**: Port mathjs functions with optimization integration.

#### Sprint 17-18: Arithmetic Functions (Weeks 17-18)

| Function Group                  | Files             | Priority | Est. Hours |
| ------------------------------- | ----------------- | -------- | ---------- |
| add, subtract, multiply, divide | `arithmetic/*.ts` | P0       | 12         |
| pow, sqrt, cbrt, exp, log       | Same              | P0       | 12         |
| abs, sign, ceil, floor, round   | Same              | P1       | 6          |
| gcd, lcm, mod, xgcd             | Same              | P1       | 6          |
| dotMultiply, dotDivide, dotPow  | Same              | P1       | 6          |

---

#### Sprint 19-20: Matrix Functions (Weeks 19-20)

| Function Group                    | Files         | Priority | Est. Hours |
| --------------------------------- | ------------- | -------- | ---------- |
| det, inv, transpose, trace        | `matrix/*.ts` | P0       | 16         |
| eigs, svd, lu, qr                 | Same          | P0       | 20         |
| concat, reshape, flatten, squeeze | Same          | P1       | 8          |
| diag, identity, ones, zeros       | Same          | P1       | 6          |
| dot, cross, kron                  | Same          | P1       | 8          |

---

#### Sprint 21-22: Statistical & Special Functions (Weeks 21-22)

| Function Group              | Files                | Priority | Est. Hours |
| --------------------------- | -------------------- | -------- | ---------- |
| mean, median, std, variance | `statistics/*.ts`    | P0       | 10         |
| min, max, sum, prod         | Same                 | P0       | 6          |
| factorial, gamma, beta      | `special/*.ts`       | P1       | 8          |
| erf, erfc                   | Same                 | P1       | 4          |
| combinations, permutations  | `combinatorics/*.ts` | P1       | 4          |

---

#### Sprint 23-24: Trigonometry & Expression (Weeks 23-24)

| Function Group       | Files                       | Priority | Est. Hours |
| -------------------- | --------------------------- | -------- | ---------- |
| sin, cos, tan, atan2 | `trigonometry/*.ts`         | P0       | 8          |
| sinh, cosh, tanh     | Same                        | P0       | 4          |
| asin, acos, atan     | Same                        | P0       | 4          |
| Expression parser    | `expression/parser/*.ts`    | P2       | 20         |
| Expression evaluator | `expression/evaluator/*.ts` | P2       | 16         |

---

### Phase 6: Integration & Polish (Sprints 25-28)

#### Sprint 25: Main Package Assembly

| Task                       | Files                             | Est. Hours |
| -------------------------- | --------------------------------- | ---------- |
| Create mathts main package | `packages/mathts/`                | 4          |
| Instance factory (create)  | `packages/mathts/src/create.ts`   | 4          |
| Default instance           | `packages/mathts/src/instance.ts` | 2          |
| Public API exports         | `packages/mathts/src/index.ts`    | 3          |
| Integration tests          | `packages/mathts/test/`           | 8          |

---

#### Sprint 26: mathjs Compatibility Layer

| Task                       | Files                        | Est. Hours |
| -------------------------- | ---------------------------- | ---------- |
| API compatibility analysis | `docs/migration/api-diff.md` | 4          |
| Compatibility shim         | `packages/compat/`           | 8          |
| Migration guide            | `docs/migration/guide.md`    | 6          |
| Example migrations         | `docs/migration/examples/`   | 4          |

---

#### Sprint 27: Documentation & Examples

| Task                  | Files                     | Est. Hours |
| --------------------- | ------------------------- | ---------- |
| API documentation     | `docs/api/`               | 12         |
| Getting started guide | `docs/getting-started.md` | 4          |
| Advanced usage guide  | `docs/advanced.md`        | 6          |
| Example projects      | `examples/`               | 8          |

---

#### Sprint 28: Release Preparation

| Task                         | Files                         | Est. Hours |
| ---------------------------- | ----------------------------- | ---------- |
| CI/CD pipeline               | `.github/workflows/`          | 6          |
| npm publishing setup         | Package configs               | 4          |
| Bundle size optimization     | Rollup/esbuild config         | 6          |
| Performance regression tests | `tools/benchmark/regression/` | 6          |
| v1.0.0 release               |                               | 4          |

---

## Part 4: Architecture Diagrams

### 4.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Application                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        @mathts/mathts                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      create() / math                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ @danielsimonjr/mathts-core  │      │ @danielsimonjr/mathts-matrix  │      │@danielsimonjr/mathts-functions│
│               │      │                 │      │                 │
│ • Types       │      │ • DenseMatrix   │      │ • arithmetic    │
│ • Config      │      │ • SparseMatrix  │      │ • algebra       │
│ • Factory     │      │ • Backends      │      │ • statistics    │
│ • Typed       │◄─────┤ • Operations    │◄─────┤ • trigonometry  │
└───────┬───────┘      └────────┬────────┘      └─────────────────┘
        │                       │
        ▼                       ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Backend Selection Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  JSBackend  │  │ WASMBackend │  │  GPUBackend │                │
│  │  (default)  │  │ (>1K elem)  │  │ (>100K elem)│                │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘                │
└──────────────────────────┼────────────────┼───────────────────────┘
                           │                │
                           ▼                ▼
              ┌────────────────────┐  ┌────────────────────┐
              │   AssemblyScript   │  │   WebGPU WGSL      │
              │   WASM Modules     │  │   Compute Shaders  │
              │   (SIMD enabled)   │  │   (tiled matmul)   │
              └────────────────────┘  └────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        @danielsimonjr/mathts-parallel                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                      ComputePool                            │    │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │    │
│  │   │ Worker1 │  │ Worker2 │  │ Worker3 │  │ WorkerN │       │    │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │    │
│  └────────┼────────────┼────────────┼────────────┼────────────┘    │
│           └────────────┴────────────┴────────────┘                 │
│                    workerpool (WASM queues)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 typed-function Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    typed-function-ts Integration                    │
└─────────────────────────────────────────────────────────────────────┘

mathts/core/typed/mathts-typed.ts
┌─────────────────────────────────────────────────────────────────────┐
│  import { createTyped } from '@danielsimonjr/mathts-typed-function';              │
│                                                                     │
│  export const typed = createTyped({                                 │
│    types: [                                                         │
│      { name: 'number', test: isNumber },                           │
│      { name: 'Complex', test: isComplex },                         │
│      { name: 'Matrix', test: isMatrix },                           │
│      { name: 'DenseMatrix', test: isDenseMatrix },                 │
│      { name: 'SparseMatrix', test: isSparseMatrix },               │
│      { name: 'Fraction', test: isFraction },                       │
│      { name: 'BigNumber', test: isBigNumber },                     │
│      { name: 'Unit', test: isUnit },                               │
│    ],                                                               │
│    conversions: [                                                   │
│      { from: 'number', to: 'Complex', convert: numToComplex },     │
│      { from: 'Array', to: 'Matrix', convert: arrayToMatrix },      │
│      { from: 'Matrix', to: 'Array', convert: matrixToArray },      │
│    ]                                                                │
│  });                                                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  // Function definition using typed                                 │
│  export const add = typed('add', {                                  │
│    'number, number': (a, b) => a + b,                              │
│    'Complex, Complex': (a, b) => a.add(b),                         │
│    'Matrix, Matrix': (a, b) => backends.select('add', a.length)    │
│                                        .add(a.data, b.data),       │
│    'Matrix, number': (a, b) => a.map(x => x + b),                  │
│  });                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow for Large Matrix Operation

```
┌──────────────────────────────────────────────────────────────────────┐
│                    matmul(A, B) Execution Flow                       │
│                    A: 10000x1000, B: 1000x10000                      │
└──────────────────────────────────────────────────────────────────────┘

1. User Call
   math.multiply(A, B)
        │
        ▼
2. typed-function Dispatch
   typed('multiply')
   Matches: 'Matrix, Matrix'
        │
        ▼
3. Backend Selection
   BackendManager.select('matmul', 100_000_000)
   → elementCount >= gpuThreshold
   → Select GPUBackend
        │
        ▼
4. Parallel Check
   ComputePool.shouldParallelize(100_000_000)
   → Yes, chunk into 4 parts
        │
        ├─────────────────────────────────────────┐
        ▼                                         ▼
5a. Worker 1                              5b. Worker 2
    GPUBackend.matmul(A[0:2500], B)           GPUBackend.matmul(A[2500:5000], B)
        │                                         │
        ▼                                         ▼
6a. GPU Compute Shader                    6b. GPU Compute Shader
    matmul.wgsl (tiled)                       matmul.wgsl (tiled)
        │                                         │
        └────────────────┬────────────────────────┘
                         ▼
7. Result Combination
   combineRows([result1, result2, result3, result4])
        │
        ▼
8. Return DenseMatrix
   new DenseMatrix(combinedData, [10000, 10000])
```

---

## Part 5: Performance Targets

| Operation   | Size        | JS Baseline | WASM Target | GPU Target | Parallel Target   |
| ----------- | ----------- | ----------- | ----------- | ---------- | ----------------- |
| matmul      | 100x100     | 15ms        | 3ms         | N/A        | N/A               |
| matmul      | 1000x1000   | 1500ms      | 150ms       | 50ms       | 100ms (4 workers) |
| matmul      | 5000x5000   | N/A         | 8s          | 500ms      | 2s (8 workers)    |
| elementwise | 1M elements | 50ms        | 5ms         | 2ms        | 15ms              |
| FFT         | 1M points   | 500ms       | 50ms        | 20ms       | 80ms              |
| SVD         | 1000x1000   | 30s         | 5s          | 2s         | 8s                |

---

## Part 6: Dependencies

### Production Dependencies

```json
{
  "@danielsimonjr/mathts-typed-function": "workspace:*",
  "@danielsimonjr/mathts-workerpool": "workspace:*",
  "decimal.js": "^10.4.3",
  "fraction.js": "^4.3.7"
}
```

### Development Dependencies

```json
{
  "assemblyscript": "^0.27.22",
  "typescript": "^5.3.0",
  "vitest": "^1.0.0",
  "rollup": "^4.0.0",
  "esbuild": "^0.19.0",
  "@rollup/plugin-typescript": "^11.0.0",
  "@rollup/plugin-wasm": "^6.0.0"
}
```

---

## Part 7: Success Criteria

### Phase 1 (Core Foundation)

- [ ] All mathjs scalar types ported to TypeScript
- [ ] typed-function integration working with MathTS types
- [ ] DenseMatrix with JS backend passing 200+ tests

### Phase 2 (WASM)

- [ ] WASM backend 5-10x faster than JS for matrices >1000 elements
- [ ] Automatic fallback to JS when WASM unavailable
- [ ] LU, QR decomposition with numerical accuracy matching mathjs

### Phase 3 (Parallel)

- [ ] Parallel matmul 3-4x faster than sequential for >50K elements
- [ ] Zero-copy transfer via transferable objects
- [ ] ComputePool with graceful worker failure handling

### Phase 4 (GPU)

- [ ] GPU matmul 10-50x faster than WASM for >100K elements
- [ ] Automatic GPU detection and fallback
- [ ] Batched execution for multiple operations

### Phase 5 (Functions)

- [ ] 80%+ of mathjs functions ported
- [ ] All P0 functions with WASM/GPU acceleration paths
- [ ] API compatibility with mathjs for common use cases

### Phase 6 (Release)

- [ ] Bundle size <50KB for core (tree-shaken)
- [ ] Full TypeScript type coverage
- [ ] Published to npm as @mathts/\*

---

## Part 8: Risk Mitigation

| Risk                                    | Probability | Impact | Mitigation                                   |
| --------------------------------------- | ----------- | ------ | -------------------------------------------- |
| WebGPU not available in target browsers | Medium      | High   | Three-tier fallback: GPU → WASM → JS         |
| WASM SIMD not available                 | Low         | Medium | Feature detection, non-SIMD WASM fallback    |
| Worker overhead exceeds benefit         | Medium      | Medium | Adaptive thresholds, benchmark-driven tuning |
| Numerical accuracy drift                | Low         | High   | Extensive accuracy tests vs mathjs/NumPy     |
| Bundle size bloat                       | Medium      | Medium | Tree-shaking, lazy loading, code splitting   |

---

## Appendix A: File Mapping (mathjs → MathTS)

| mathjs File                       | MathTS File                                 | Notes                   |
| --------------------------------- | ------------------------------------------- | ----------------------- |
| `src/type/matrix/DenseMatrix.js`  | `packages/matrix/src/types/DenseMatrix.ts`  | Add backend abstraction |
| `src/type/matrix/SparseMatrix.js` | `packages/matrix/src/types/SparseMatrix.ts` | CSR format              |
| `src/type/complex/Complex.js`     | `packages/core/src/types/complex.ts`        | Full rewrite            |
| `src/function/arithmetic/add.js`  | `packages/functions/src/arithmetic/add.ts`  | typed integration       |
| `src/function/matrix/multiply.js` | `packages/functions/src/matrix/multiply.ts` | Backend dispatch        |
| `src/core/create.js`              | `packages/mathts/src/create.ts`             | Factory pattern         |

---

## Appendix B: WASM Module ABI

```typescript
// packages/matrix/assembly/index.ts

// Memory layout for matrix operations
// All matrices stored in row-major order as Float64Array
// First 8 bytes: rows (i32) + cols (i32)
// Remaining bytes: data (f64[])

export function matmul(
  aPtr: usize,
  aRows: i32,
  aCols: i32,
  bPtr: usize,
  bRows: i32,
  bCols: i32,
  outPtr: usize
): void;

export function transpose(inPtr: usize, rows: i32, cols: i32, outPtr: usize): void;

export function elementwise_add(aPtr: usize, bPtr: usize, len: i32, outPtr: usize): void;

export function lu_decompose(inPtr: usize, n: i32, lPtr: usize, uPtr: usize, pPtr: usize): i32; // returns 0 on success, -1 on singular matrix
```

---

## Appendix C: WebGPU Shader Template

```wgsl
// packages/matrix/gpu/shaders/matmul.wgsl

struct Dimensions {
  M: u32,
  N: u32,
  K: u32,
}

@group(0) @binding(0) var<uniform> dims: Dimensions;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> result: array<f32>;

const TILE_SIZE: u32 = 16;

var<workgroup> tileA: array<array<f32, TILE_SIZE>, TILE_SIZE>;
var<workgroup> tileB: array<array<f32, TILE_SIZE>, TILE_SIZE>;

@compute @workgroup_size(TILE_SIZE, TILE_SIZE)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = global_id.y;
  let col = global_id.x;

  var sum: f32 = 0.0;
  let numTiles = (dims.K + TILE_SIZE - 1) / TILE_SIZE;

  for (var t: u32 = 0; t < numTiles; t++) {
    // Load tile of A
    let aRow = row;
    let aCol = t * TILE_SIZE + local_id.x;
    if (aRow < dims.M && aCol < dims.K) {
      tileA[local_id.y][local_id.x] = a[aRow * dims.K + aCol];
    } else {
      tileA[local_id.y][local_id.x] = 0.0;
    }

    // Load tile of B
    let bRow = t * TILE_SIZE + local_id.y;
    let bCol = col;
    if (bRow < dims.K && bCol < dims.N) {
      tileB[local_id.y][local_id.x] = b[bRow * dims.N + bCol];
    } else {
      tileB[local_id.y][local_id.x] = 0.0;
    }

    workgroupBarrier();

    // Compute partial dot product
    for (var k: u32 = 0; k < TILE_SIZE; k++) {
      sum += tileA[local_id.y][k] * tileB[k][local_id.x];
    }

    workgroupBarrier();
  }

  if (row < dims.M && col < dims.N) {
    result[row * dims.N + col] = sum;
  }
}
```

---

## WASM Build Pipeline

The following npm scripts are defined (or should be added) for the AssemblyScript WASM backend:

### `npm run build:wasm`

Compiles the AssemblyScript WASM workspace at `assembly/` via `asc`.

```bash
# Equivalent command
asc assembly/src/index.ts --target release --outFile lib/wasm/mathjs.wasm
```

Output: `lib/wasm/mathjs.wasm` (669 KB release build, 826 exports)

### `npm run bench:wasm` _(historical — since removed)_

> This script and the `tools/benchmark/wasm/` suite were removed in the Rust
> scrub and no longer exist. Retained here as a record of the original plan.

Ran the benchmark comparing AssemblyScript WASM vs JavaScript for a standard suite of operations:

```bash
# Equivalent
npx ts-node test/benchmark/wasm.bench.ts
```

**Benchmark suite coverage**:

- Matrix multiply: 10×10, 50×50, 100×100, 200×200, 500×500
- Dot product: 100, 500, 1000, 5000 elements
- Determinant: 10×10, 50×50, 100×100
- FFT: 256, 1024, 4096, 16384 points
- Statistical ops (mean, std, variance): 1000, 10000 elements

**Sample output** (200×200 matmul):

```
backend    time(ms)  speedup
---------  --------  -------
js         20.0      1.0x
wasm       2.7       7.4x
```

---

## Next Steps

1. **Immediate**: Review this plan and confirm architecture decisions
2. **Week 1**: Begin Sprint 1 - Project setup and core types
3. **Ongoing**: Track progress in GitHub Projects board
4. **Milestone 1**: Phase 1 complete (4 weeks) - Core foundation working
5. **Milestone 2**: Phase 2 complete (8 weeks) - WASM acceleration proven
6. **Milestone 3**: Phase 4 complete (16 weeks) - Full acceleration stack
7. **Release**: v1.0.0 (28 weeks) - Production ready

---

_This document serves as the canonical reference for MathTS development. Update as architecture evolves._
