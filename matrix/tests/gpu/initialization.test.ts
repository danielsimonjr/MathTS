/**
 * GPU Initialization Tests
 *
 * Tests for WebGPU detection, context creation, and backend initialization.
 * Note: Many tests are skipped in Node.js environment as WebGPU requires a browser.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  hasWebGPU,
  isBrowser,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
  type GPUCapabilities,
} from '../../src/backends/gpu/detect.js';
import {
  GPUContext,
  getGlobalGPUContext,
  destroyGlobalGPU,
} from '../../src/backends/gpu/GPUContext.js';
import { BUILTIN_SHADERS } from '../../src/backends/gpu/ShaderManager.js';
import {
  GPUBackend,
  getGlobalGPUBackend,
  destroyGlobalGPUBackend,
} from '../../src/backends/GPUBackend.js';

describe('GPU Detection', () => {
  describe('hasWebGPU', () => {
    it('should return false in Node.js environment', () => {
      // Node.js doesn't have navigator.gpu
      expect(hasWebGPU()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('should return false in Node.js environment', () => {
      expect(isBrowser()).toBe(false);
    });
  });

  describe('detectGPUCapabilities', () => {
    it('should return unsupported capabilities in Node.js', async () => {
      const capabilities = await detectGPUCapabilities();

      expect(capabilities.supported).toBe(false);
      expect(capabilities.adapterInfo).toBeNull();
      expect(capabilities.maxBufferSize).toBe(0);
    });
  });

  describe('isGPUSuitableForMatrixOps', () => {
    it('should return false for unsupported GPU', () => {
      const unsupportedCapabilities: GPUCapabilities = {
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

      expect(isGPUSuitableForMatrixOps(unsupportedCapabilities)).toBe(false);
    });

    it('should return false for insufficient buffer size', () => {
      const lowBufferCapabilities: GPUCapabilities = {
        supported: true,
        adapterInfo: { vendor: 'test', architecture: '', device: '', description: '' },
        maxBufferSize: 64 * 1024 * 1024, // 64MB - below 256MB default
        maxWorkgroupSize: [256, 256, 64],
        maxStorageBufferBindingSize: 128 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 1024,
        maxComputeWorkgroupsPerDimension: 65535,
        isFallbackAdapter: false,
        features: [],
      };

      expect(isGPUSuitableForMatrixOps(lowBufferCapabilities)).toBe(false);
    });

    it('should return true for suitable GPU', () => {
      const suitableCapabilities: GPUCapabilities = {
        supported: true,
        adapterInfo: { vendor: 'test', architecture: '', device: '', description: '' },
        maxBufferSize: 512 * 1024 * 1024, // 512MB
        maxWorkgroupSize: [256, 256, 64],
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 1024,
        maxComputeWorkgroupsPerDimension: 65535,
        isFallbackAdapter: false,
        features: [],
      };

      expect(isGPUSuitableForMatrixOps(suitableCapabilities)).toBe(true);
    });
  });

  describe('getRecommendedWorkgroupSize', () => {
    it('should return [1,1,1] for unsupported GPU', () => {
      const unsupported: GPUCapabilities = {
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

      expect(getRecommendedWorkgroupSize(unsupported)).toEqual([1, 1, 1]);
    });

    it('should return [16,16,1] for typical GPU', () => {
      const typical: GPUCapabilities = {
        supported: true,
        adapterInfo: null,
        maxBufferSize: 512 * 1024 * 1024,
        maxWorkgroupSize: [256, 256, 64],
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 1024,
        maxComputeWorkgroupsPerDimension: 65535,
        isFallbackAdapter: false,
        features: [],
      };

      expect(getRecommendedWorkgroupSize(typical)).toEqual([16, 16, 1]);
    });

    it('should respect max invocations limit', () => {
      const limited: GPUCapabilities = {
        supported: true,
        adapterInfo: null,
        maxBufferSize: 512 * 1024 * 1024,
        maxWorkgroupSize: [256, 256, 64],
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 128, // Limited to 128 threads
        maxComputeWorkgroupsPerDimension: 65535,
        isFallbackAdapter: false,
        features: [],
      };

      const size = getRecommendedWorkgroupSize(limited);
      expect(size[0] * size[1] * size[2]).toBeLessThanOrEqual(128);
    });
  });

  describe('getMaxMatrixSize', () => {
    it('should return 0 for unsupported GPU', () => {
      const unsupported: GPUCapabilities = {
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

      expect(getMaxMatrixSize(unsupported)).toBe(0);
    });

    it('should calculate correct max matrix size', () => {
      const capabilities: GPUCapabilities = {
        supported: true,
        adapterInfo: null,
        maxBufferSize: 256 * 1024 * 1024, // 256MB
        maxWorkgroupSize: [256, 256, 64],
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 1024,
        maxComputeWorkgroupsPerDimension: 65535,
        isFallbackAdapter: false,
        features: [],
      };

      // 256MB / 4 bytes = 64M elements, sqrt(64M) = 8192
      const maxSize = getMaxMatrixSize(capabilities);
      expect(maxSize).toBe(8192);
    });
  });
});

describe('GPU Context', () => {
  afterEach(() => {
    destroyGlobalGPU();
  });

  describe('GPUContext class', () => {
    it('should start uninitialized', () => {
      const context = new GPUContext();
      expect(context.status).toBe('uninitialized');
      expect(context.isReady).toBe(false);
    });

    it('should throw when getting device before initialization', () => {
      const context = new GPUContext();
      expect(() => context.getDevice()).toThrow('GPUContext not initialized');
    });

    it('should fail initialization in Node.js', async () => {
      const context = new GPUContext();
      const success = await context.initialize();

      expect(success).toBe(false);
      expect(context.status).toBe('error');
      expect(context.lastError).toBeDefined();
    });
  });

  describe('Global GPU Context', () => {
    it('should return same instance', () => {
      const ctx1 = getGlobalGPUContext();
      const ctx2 = getGlobalGPUContext();

      expect(ctx1).toBe(ctx2);
    });

    it('should be destroyable', () => {
      const ctx1 = getGlobalGPUContext();
      destroyGlobalGPU();
      const ctx2 = getGlobalGPUContext();

      expect(ctx1).not.toBe(ctx2);
    });
  });
});

describe('Shader Manager', () => {
  describe('BUILTIN_SHADERS', () => {
    it('should have matrix add shader', () => {
      expect(BUILTIN_SHADERS.matrixAdd).toBeDefined();
      expect(BUILTIN_SHADERS.matrixAdd).toContain('@compute');
    });

    it('should have matmul shader', () => {
      expect(BUILTIN_SHADERS.matmul).toBeDefined();
      expect(BUILTIN_SHADERS.matmul).toContain('@compute');
    });

    it('should have transpose shader', () => {
      expect(BUILTIN_SHADERS.transpose).toBeDefined();
      expect(BUILTIN_SHADERS.transpose).toContain('@compute');
    });

    it('should have sum reduction shader', () => {
      expect(BUILTIN_SHADERS.sumReduce).toBeDefined();
      expect(BUILTIN_SHADERS.sumReduce).toContain('workgroupBarrier');
    });
  });
});

describe('GPU Backend', () => {
  afterEach(() => {
    destroyGlobalGPUBackend();
  });

  describe('GPUBackend class', () => {
    it('should start uninitialized', () => {
      const backend = new GPUBackend();
      expect(backend.status).toBe('uninitialized');
      expect(backend.isReady).toBe(false);
    });

    it('should fail initialization in Node.js', async () => {
      const backend = new GPUBackend();
      const success = await backend.initialize();

      expect(success).toBe(false);
      expect(backend.status).toBe('unsupported');
    });

    it('should not use GPU when not ready', () => {
      const backend = new GPUBackend();
      expect(backend.shouldUseGPU(1000, 1000)).toBe(false);
    });

    it('should throw when getting context before initialization', () => {
      const backend = new GPUBackend();
      expect(() => backend.getContext()).toThrow('GPUBackend not initialized');
    });
  });

  describe('Global GPU Backend', () => {
    it('should return same instance', () => {
      const b1 = getGlobalGPUBackend();
      const b2 = getGlobalGPUBackend();

      expect(b1).toBe(b2);
    });

    it('should be destroyable', () => {
      const b1 = getGlobalGPUBackend();
      destroyGlobalGPUBackend();
      const b2 = getGlobalGPUBackend();

      expect(b1).not.toBe(b2);
    });
  });

  describe('Backend statistics', () => {
    it('should provide stats', () => {
      const backend = new GPUBackend();
      const stats = backend.getStats();

      expect(stats.status).toBe('uninitialized');
      expect(stats.capabilities).toBeNull();
      expect(stats.bufferPool).toBeNull();
      expect(stats.shaders).toBeNull();
    });
  });
});

describe('Workgroup calculations', () => {
  it('should calculate workgroups correctly', () => {
    const backend = new GPUBackend();

    // Access private method through type assertion for testing
    const calculateWorkgroups = (
      backend as unknown as {
        calculateWorkgroups: (m: number, n: number) => [number, number, number];
      }
    ).calculateWorkgroups.bind(backend);

    // Default workgroup size is [16, 16, 1]
    expect(calculateWorkgroups(32, 32)).toEqual([2, 2, 1]);
    expect(calculateWorkgroups(17, 17)).toEqual([2, 2, 1]); // ceil(17/16) = 2
    expect(calculateWorkgroups(256, 128)).toEqual([8, 16, 1]);
  });
});
