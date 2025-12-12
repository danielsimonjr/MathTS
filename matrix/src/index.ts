/**
 * @mathts/matrix
 *
 * Matrix operations for MathTS with pluggable backends
 * (JS, WASM, WebGPU) and typed-function polymorphic dispatch.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Sequential typed-operations.ts for DenseMatrix class operations
 * - parallel-matrix.ts for worker pool-based Float64Array operations
 *
 * For Float64Array-based parallel matrix operations, use @mathts/parallel
 * directly or import from './parallel-matrix.js'.
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Backends
export * from './backends/index.js';

// Typed operations (polymorphic functions using mathTyped)
export * from './typed-operations.js';

// Parallel matrix operations using @mathts/parallel
// Note: Uses Float64Array flat row-major format
export * from './parallel-matrix.js';
