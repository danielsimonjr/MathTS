/**
 * WASM Utilities Index
 * @packageDocumentation
 */

export {
  detectWasmFeatures,
  isWasmAvailable,
  isSharedMemoryAvailable,
  isAtomicsAvailable,
  clearFeatureCache,
  getCachedFeatures,
} from './detect.js';

export type { WasmFeatures } from './detect.js';
