/**
 * Matrix Backend Exports
 * @packageDocumentation
 */

export { BackendRegistry, backendRegistry, DEFAULT_BACKEND_HINTS } from './Backend.js';

export type { MatrixBackend, BackendType, BackendHints } from './Backend.js';

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
  GPUMatrixBackend,
  gpuMatrixBackend,
  createGPUMatrixBackend,
  type GPUMatrixBackendConfig,
} from './GPUMatrixBackend.js';

export {
  GPUBackend,
  getGlobalGPUBackend,
  initializeGlobalGPUBackend,
  destroyGlobalGPUBackend,
  type GPUBackendOptions,
  type GPUBackendStatus,
} from './GPUBackend.js';

export {
  RustWASMBackend,
  rustWasmBackend,
  createRustWASMBackend,
  type RustWASMBackendConfig,
} from './RustWASMBackend.js';

export {
  RustWasmLoader,
  rustWasmLoader,
  initRustWasm,
  type RustWasmExports,
  type RustLoadingMetrics,
} from './RustWasmLoader.js';

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

// GPU utilities
export {
  hasWebGPU,
  detectGPUCapabilities,
  getRecommendedWorkgroupSize,
  GPUContext,
  getGlobalGPUContext,
  destroyGlobalGPU,
  BufferPool,
  ShaderManager,
  BUILTIN_SHADERS,
  BatchExecutor,
  SyncManager,
  createSyncManager,
} from './gpu/index.js';

export type { GPUCapabilities, GPUContextOptions, SyncStrategy, SyncConfig } from './gpu/index.js';

// Register JS backend by default
import { backendRegistry } from './Backend.js';
import { jsBackend } from './JSBackend.js';

backendRegistry.register(jsBackend);
