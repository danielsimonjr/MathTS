import { describe, it, expect } from 'vitest';
import {
  hasWebGPU,
  isBrowser,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUCapabilities,
} from '../src/detect.js';

const NO_CAPS: GPUCapabilities = {
  supported: false,
  adapterInfo: null,
  maxBufferSize: 0,
  maxWorkgroupSize: [0, 0, 0],
  maxStorageBufferBindingSize: 0,
  maxComputeInvocationsPerWorkgroup: 0,
  maxComputeWorkgroupsPerDimension: 0,
  isFallbackAdapter: false,
  features: [],
};

describe('detect (headless Node)', () => {
  it('reports no WebGPU and no browser', () => {
    expect(hasWebGPU()).toBe(false);
    expect(isBrowser()).toBe(false);
  });

  it('detectGPUCapabilities resolves unsupported without throwing', async () => {
    const caps = await detectGPUCapabilities();
    expect(caps.supported).toBe(false);
  });

  it('isGPUSuitableForMatrixOps is false for unsupported caps', () => {
    expect(isGPUSuitableForMatrixOps(NO_CAPS)).toBe(false);
  });

  it('getRecommendedWorkgroupSize returns [1,1,1] for unsupported caps', () => {
    expect(getRecommendedWorkgroupSize(NO_CAPS)).toEqual([1, 1, 1]);
  });

  it('getMaxMatrixSize returns 0 for unsupported caps', () => {
    expect(getMaxMatrixSize(NO_CAPS)).toBe(0);
  });
});
