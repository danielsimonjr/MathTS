/**
 * @mathts/matrix
 *
 * Matrix operations for MathTS with pluggable backends
 * (JS, WASM, WebGPU) and typed-function polymorphic dispatch.
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Backends
export * from './backends/index.js';

// Typed operations (polymorphic functions using mathTyped)
export * from './typed-operations.js';

// Note: parallel-matrix.ts exists but is not exported by default
// due to TypeScript module resolution complexity with @mathts/parallel.
// Import directly if needed: import { ... } from '@mathts/matrix/parallel-matrix'
