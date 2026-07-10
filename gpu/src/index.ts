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
