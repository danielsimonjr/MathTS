/**
 * GPU Backend Exports
 *
 * WebGPU infrastructure for accelerated matrix operations. The generic
 * foundation now lives in @danielsimonjr/mathts-gpu and is re-exported here
 * so matrix's public surface is unchanged. Matrix-domain kernels and the
 * (unextracted) batch/sync helpers stay local.
 */

// Shared foundation (re-exported from the gpu leaf for back-compat)
export {
  hasWebGPU,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  getGpuDevice,
  resetGpuDevice,
  BufferPool,
  ShaderManager,
  type GPUAdapterInfo,
  type GPUCapabilities,
  type GPUContextOptions,
  type GPUContextStatus,
  type DeviceLostEvent,
  type BufferPoolOptions,
  type ShaderSource,
  type PipelineConfig,
} from '@danielsimonjr/mathts-gpu';

// Matrix-domain kernels (stay in matrix)
export { BUILTIN_SHADERS, registerBuiltinShaders } from './builtin-shaders.js';

// Batch Executor (not extracted — YAGNI)
export {
  BatchExecutor,
  type BatchOperation,
  type BatchOperationType,
  type BatchResult,
  type BatchOptions,
} from './BatchExecutor.js';

// Synchronization (not extracted — YAGNI)
export {
  SyncManager,
  createSyncManager,
  type SyncStrategy,
  type TransferDirection,
  type TransferRequest,
  type TransferResult,
  type SyncConfig,
} from './Sync.js';
