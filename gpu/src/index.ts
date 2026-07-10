/**
 * @danielsimonjr/mathts-gpu — shared WebGPU foundation for MathTS.
 * @packageDocumentation
 */

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

export {
  GPUContext,
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  type GPUContextOptions,
  type GPUContextStatus,
  type DeviceLostEvent,
} from './GPUContext.js';

export { getGpuDevice, resetGpuDevice } from './device.js';
