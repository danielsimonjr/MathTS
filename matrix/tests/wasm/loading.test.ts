/**
 * WASM Loading and Feature Detection Tests
 *
 * Tests for WASM infrastructure including feature detection,
 * backend availability, and fallback behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectWasmFeatures,
  isWasmAvailable,
  isSharedMemoryAvailable,
  isAtomicsAvailable,
  clearFeatureCache,
  getCachedFeatures,
  WASMBackend,
  wasmBackend,
  createWASMBackend,
} from '../../src/backends/index.js';

describe('WASM Feature Detection', () => {
  beforeEach(() => {
    clearFeatureCache();
  });

  it('should detect basic WebAssembly support', () => {
    const available = isWasmAvailable();
    expect(typeof available).toBe('boolean');
    // Node.js should have WebAssembly support
    expect(available).toBe(true);
  });

  it('should detect SharedArrayBuffer availability', () => {
    const available = isSharedMemoryAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should detect Atomics availability', () => {
    const available = isAtomicsAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should detect WASM features asynchronously', async () => {
    const features = await detectWasmFeatures();

    expect(features).toBeDefined();
    expect(typeof features.webAssembly).toBe('boolean');
    expect(typeof features.simd).toBe('boolean');
    expect(typeof features.sharedMemory).toBe('boolean');
    expect(typeof features.atomics).toBe('boolean');
    expect(typeof features.threads).toBe('boolean');
    expect(typeof features.bulkMemory).toBe('boolean');
    expect(typeof features.referenceTypes).toBe('boolean');
    expect(typeof features.exceptions).toBe('boolean');
    expect(typeof features.tailCall).toBe('boolean');
  });

  it('should cache feature detection results', async () => {
    // First call should set cache
    expect(getCachedFeatures()).toBeNull();
    const features1 = await detectWasmFeatures();
    expect(getCachedFeatures()).not.toBeNull();

    // Second call should return cached result
    const features2 = await detectWasmFeatures();
    expect(features1).toBe(features2);

    // Clear cache
    clearFeatureCache();
    expect(getCachedFeatures()).toBeNull();
  });

  it('should report webAssembly as true if available', async () => {
    if (isWasmAvailable()) {
      const features = await detectWasmFeatures();
      expect(features.webAssembly).toBe(true);
    }
  });

  it('should have threads=true only when both sharedMemory and atomics are available', async () => {
    const features = await detectWasmFeatures();
    if (features.threads) {
      expect(features.sharedMemory).toBe(true);
      expect(features.atomics).toBe(true);
    }
  });
});

describe('WASMBackend', () => {
  it('should be available when WebAssembly is available', () => {
    const backend = new WASMBackend();
    expect(backend.isAvailable()).toBe(isWasmAvailable());
  });

  it('should have type "wasm"', () => {
    const backend = new WASMBackend();
    expect(backend.type).toBe('wasm');
  });

  it('should use default configuration', () => {
    const backend = new WASMBackend();
    const config = backend.getConfig();

    expect(config.minElements).toBe(100);
    expect(config.wasmPath).toBe('');
    expect(config.useSIMD).toBe(true);
  });

  it('should allow custom configuration', () => {
    const backend = createWASMBackend({
      minElements: 500,
      useSIMD: false,
    });

    const config = backend.getConfig();
    expect(config.minElements).toBe(500);
    expect(config.useSIMD).toBe(false);
  });

  it('should allow updating configuration', () => {
    const backend = new WASMBackend();
    backend.updateConfig({ minElements: 1000 });

    const config = backend.getConfig();
    expect(config.minElements).toBe(1000);
  });

  it('should provide a global wasmBackend instance', () => {
    expect(wasmBackend).toBeDefined();
    expect(wasmBackend).toBeInstanceOf(WASMBackend);
    expect(wasmBackend.type).toBe('wasm');
  });
});

describe('WASMBackend Fallback', () => {
  it('should fall back to JSBackend for small matrices', async () => {
    const backend = createWASMBackend({ minElements: 1000 });
    await backend.initialize().catch(() => {
      // Ignore initialization errors - we're testing fallback
    });

    // This import is needed to get DenseMatrix
    const { DenseMatrix } = await import('../../src/types/DenseMatrix.js');

    // Small matrix (4 elements < 1000 threshold)
    const a = new DenseMatrix(2, 2, [
      [1, 2],
      [3, 4],
    ]);
    const b = new DenseMatrix(2, 2, [
      [5, 6],
      [7, 8],
    ]);

    // Should use JS backend due to size
    const result = backend.add(a, b);
    expect(result.get(0, 0)).toBe(6);
    expect(result.get(0, 1)).toBe(8);
    expect(result.get(1, 0)).toBe(10);
    expect(result.get(1, 1)).toBe(12);
  });

  it('should handle initialization gracefully', async () => {
    const backend = new WASMBackend();

    // Initialize should not throw even if WASM file not found
    // (it should warn and fall back to JS)
    await expect(backend.initialize()).resolves.not.toThrow();
  });
});

describe('WASMBackend Features', () => {
  it('should return null features before initialization', () => {
    const backend = new WASMBackend();
    expect(backend.getFeatures()).toBeNull();
  });

  it('should detect features after initialization', async () => {
    const backend = new WASMBackend();
    await backend.initialize().catch(() => {});

    const features = backend.getFeatures();
    // Features should be detected even if WASM module loading failed
    if (isWasmAvailable()) {
      expect(features).not.toBeNull();
      expect(features?.webAssembly).toBe(true);
    }
  });
});
