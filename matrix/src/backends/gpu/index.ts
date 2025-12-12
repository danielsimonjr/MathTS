/**
 * GPU Backend Exports
 *
 * WebGPU infrastructure for accelerated matrix operations.
 */

// Detection utilities
export {
  hasWebGPU,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUAdapterInfo,
  type GPUCapabilities,
} from './detect.js';

// GPU Context
export {
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  type GPUContextOptions,
  type GPUContextStatus,
  type DeviceLostEvent,
} from './GPUContext.js';

// Buffer Pool
export {
  BufferPool,
  type BufferPoolOptions,
} from './BufferPool.js';

// Shader Manager
export {
  ShaderManager,
  BUILTIN_SHADERS,
  type ShaderSource,
  type PipelineConfig,
} from './ShaderManager.js';
