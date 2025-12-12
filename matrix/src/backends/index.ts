/**
 * Matrix Backend Exports
 * @packageDocumentation
 */

export {
  BackendRegistry,
  backendRegistry,
  DEFAULT_BACKEND_HINTS,
} from './Backend.js';

export type {
  MatrixBackend,
  BackendType,
  BackendHints,
} from './Backend.js';

export { JSBackend, jsBackend } from './JSBackend.js';

export {
  ParallelBackend,
  parallelBackend,
  createParallelBackend,
  type ParallelBackendConfig,
} from './ParallelBackend.js';

export {
  WASMBackend,
  wasmBackend,
  createWASMBackend,
  type WASMBackendConfig,
} from './WASMBackend.js';

export {
  BackendManager,
  backendManager,
  createBackendManager,
  DEFAULT_EXTENDED_HINTS,
  type ExtendedBackendHints,
  type OperationType,
} from './BackendManager.js';

// WASM utilities
export {
  detectWasmFeatures,
  isWasmAvailable,
  isSharedMemoryAvailable,
  isAtomicsAvailable,
  clearFeatureCache,
  getCachedFeatures,
} from './wasm/index.js';

export type { WasmFeatures } from './wasm/index.js';

// Register JS backend by default
import { backendRegistry } from './Backend.js';
import { jsBackend } from './JSBackend.js';

backendRegistry.register(jsBackend);
