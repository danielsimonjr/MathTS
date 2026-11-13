/**
 * @danielsimonjr/mathts-gpu — shared WebGPU foundation for MathTS.
 * @packageDocumentation
 */

export {
  hasWebGPU,
  hasWebGPUSurface,
  resetWebGPUAvailabilityCache,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  enableGpuUnavailableWarnings,
  disableGpuUnavailableWarnings,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUAdapterInfo,
  type GPUCapabilities,
} from './detect.js';

export {
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  initializeGlobalGPUWithReason,
  destroyGlobalGPU,
  type GPUContextOptions,
  type GPUContextStatus,
  type GlobalGPUInitResult,
  type DeviceLostEvent,
} from './GPUContext.js';

export type {
  GPUAdapter,
  GPUBindGroup,
  GPUBindGroupEntry,
  GPUBindGroupLayout,
  GPUBuffer,
  GPUBufferUsageFlags,
  GPUCommandBuffer,
  GPUCommandEncoder,
  GPUComputePipeline,
  GPUDevice,
  GPUDeviceLostReason,
  GPUFeatureName,
  GPUPipelineLayout,
  GPUQueue,
  GPURequestAdapterOptions,
  GPUShaderModule,
  OpaqueGpuHandle,
} from './webgpu-types.js';

export { getGpuDevice, resetGpuDevice } from './device.js';

export { enableGpu, disableGpu, isGpuEnabled, GPU_MIN_ELEMENTS } from './flag.js';

export { BufferPool, type BufferPoolOptions } from './BufferPool.js';

export { ShaderManager, type ShaderSource, type PipelineConfig } from './ShaderManager.js';

// One serialization queue for ALL GPU dispatches (the error scope is a per-device stack).
export { serializeGpu } from './serialize.js';
