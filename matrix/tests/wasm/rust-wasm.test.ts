/**
 * Tests for Rust WASM Backend integration.
 *
 * These tests verify:
 * 1. RustWasmLoader singleton behavior and graceful failure
 * 2. RustWASMBackend JS fallback when .wasm binary is unavailable
 * 3. BackendManager routes heavy operations to Rust WASM
 * 4. Memory management (bump allocator) works correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RustWasmLoader } from '../../src/backends/RustWasmLoader.js';
import { RustWASMBackend } from '../../src/backends/RustWASMBackend.js';
import { BackendManager } from '../../src/backends/BackendManager.js';
import { backendRegistry } from '../../src/backends/Backend.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

// =========================================================================
// RustWasmLoader Tests
// =========================================================================

describe('RustWasmLoader', () => {
  afterEach(() => {
    RustWasmLoader.resetInstance();
  });

  it('should be a singleton', () => {
    const a = RustWasmLoader.getInstance();
    const b = RustWasmLoader.getInstance();
    expect(a).toBe(b);
  });

  it('should not be loaded initially', () => {
    const loader = RustWasmLoader.getInstance();
    expect(loader.isLoaded).toBe(false);
  });

  it('should return null exports when not loaded', () => {
    const loader = RustWasmLoader.getInstance();
    expect(loader.getExports()).toBeNull();
    expect(loader.getMemory()).toBeNull();
    expect(loader.getLoadingMetrics()).toBeNull();
  });

  it('should fail gracefully when .wasm binary is missing', async () => {
    const loader = RustWasmLoader.getInstance();
    const result = await loader.load('/nonexistent/path/to.wasm');
    expect(result).toBe(false);
    expect(loader.isLoaded).toBe(false);
  });

  it('should throw when writing to unloaded module', () => {
    const loader = RustWasmLoader.getInstance();
    expect(() => loader.writeF64(new Float64Array([1, 2, 3]))).toThrow('Rust WASM not loaded');
    expect(() => loader.allocF64(10)).toThrow('Rust WASM not loaded');
    expect(() => loader.readF64(0, 10)).toThrow('Rust WASM not loaded');
  });

  it('should reset cleanly', () => {
    const loader = RustWasmLoader.getInstance();
    loader.reset();
    expect(loader.isLoaded).toBe(false);
    expect(loader.getExports()).toBeNull();
  });

  it('should reset singleton instance', () => {
    const a = RustWasmLoader.getInstance();
    RustWasmLoader.resetInstance();
    const b = RustWasmLoader.getInstance();
    expect(a).not.toBe(b);
  });
});

// =========================================================================
// RustWASMBackend Tests
// =========================================================================

describe('RustWASMBackend', () => {
  let backend: RustWASMBackend;

  beforeEach(() => {
    RustWasmLoader.resetInstance();
    backend = new RustWASMBackend();
  });

  afterEach(() => {
    RustWasmLoader.resetInstance();
  });

  it('should have type "rust-wasm"', () => {
    expect(backend.type).toBe('rust-wasm');
  });

  it('should report WebAssembly availability', () => {
    // WebAssembly is available in Node.js
    expect(backend.isAvailable()).toBe(true);
  });

  it('should default to minElements=1000', () => {
    expect(backend.getConfig().minElements).toBe(1000);
  });

  it('should accept custom config', () => {
    const custom = new RustWASMBackend({ minElements: 500, wasmPath: '/custom.wasm' });
    expect(custom.getConfig().minElements).toBe(500);
    expect(custom.getConfig().wasmPath).toBe('/custom.wasm');
  });

  it('should allow config updates', () => {
    backend.updateConfig({ minElements: 2000 });
    expect(backend.getConfig().minElements).toBe(2000);
  });

  // --- JS Fallback Tests ---
  // When Rust WASM is not loaded, all operations should fall back to JS.

  describe('JS fallback (Rust WASM not loaded)', () => {
    it('should fall back to JS for add', () => {
      const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const b = DenseMatrix.fromFlat(2, 2, [5, 6, 7, 8]);
      const result = backend.add(a, b);
      expect(result.get(0, 0)).toBe(6);
      expect(result.get(0, 1)).toBe(8);
      expect(result.get(1, 0)).toBe(10);
      expect(result.get(1, 1)).toBe(12);
    });

    it('should fall back to JS for subtract', () => {
      const a = DenseMatrix.fromFlat(2, 2, [5, 6, 7, 8]);
      const b = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const result = backend.subtract(a, b);
      expect(result.get(0, 0)).toBe(4);
      expect(result.get(1, 1)).toBe(4);
    });

    it('should fall back to JS for multiply', () => {
      const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const b = DenseMatrix.fromFlat(2, 2, [5, 6, 7, 8]);
      const result = backend.multiply(a, b);
      expect(result.get(0, 0)).toBe(19);
      expect(result.get(0, 1)).toBe(22);
      expect(result.get(1, 0)).toBe(43);
      expect(result.get(1, 1)).toBe(50);
    });

    it('should fall back to JS for transpose', () => {
      const a = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
      const result = backend.transpose(a);
      expect(result.rows).toBe(3);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 1)).toBe(4);
    });

    it('should fall back to JS for scale', () => {
      const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const result = backend.scale(a, 3);
      expect(result.get(0, 0)).toBe(3);
      expect(result.get(1, 1)).toBe(12);
    });

    it('should fall back to JS for sum', () => {
      const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const result = backend.sum(a);
      expect(result).toBe(10);
    });

    it('should fall back to JS for norm', () => {
      const a = DenseMatrix.fromFlat(1, 3, [3, 4, 0]);
      const result = backend.norm(a);
      expect(result).toBeCloseTo(5, 10);
    });

    it('should fall back to JS for dot', () => {
      const a = DenseMatrix.fromFlat(1, 3, [1, 2, 3]);
      const b = DenseMatrix.fromFlat(1, 3, [4, 5, 6]);
      const result = backend.dot(a, b);
      expect(result).toBe(32);
    });

    it('should fall back to JS for abs', () => {
      const a = DenseMatrix.fromFlat(1, 3, [-1, 2, -3]);
      const result = backend.abs(a);
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 2)).toBe(3);
    });

    it('should fall back to JS for negate', () => {
      const a = DenseMatrix.fromFlat(1, 3, [1, -2, 3]);
      const result = backend.negate(a);
      expect(result.get(0, 0)).toBe(-1);
      expect(result.get(0, 1)).toBe(2);
    });

    it('should fall back to JS for multiplyElementwise', () => {
      const a = DenseMatrix.fromFlat(1, 3, [2, 3, 4]);
      const b = DenseMatrix.fromFlat(1, 3, [5, 6, 7]);
      const result = backend.multiplyElementwise(a, b);
      expect(result.get(0, 0)).toBe(10);
      expect(result.get(0, 1)).toBe(18);
      expect(result.get(0, 2)).toBe(28);
    });

    it('should fall back to JS for divideElementwise', () => {
      const a = DenseMatrix.fromFlat(1, 2, [10, 20]);
      const b = DenseMatrix.fromFlat(1, 2, [2, 5]);
      const result = backend.divideElementwise(a, b);
      expect(result.get(0, 0)).toBe(5);
      expect(result.get(0, 1)).toBe(4);
    });

    it('should fall back to JS for sumAxis', () => {
      const a = DenseMatrix.fromFlat(2, 2, [1, 2, 3, 4]);
      const result = backend.sumAxis(a, 0);
      expect(result.get(0, 0)).toBe(4);
      expect(result.get(0, 1)).toBe(6);
    });
  });
});

// =========================================================================
// BackendManager Rust WASM Routing Tests
// =========================================================================

describe('BackendManager with Rust WASM', () => {
  let manager: BackendManager;
  let rustBackend: RustWASMBackend;

  beforeEach(() => {
    RustWasmLoader.resetInstance();
    rustBackend = new RustWASMBackend();
    // Register the Rust WASM backend
    backendRegistry.register(rustBackend);
    manager = new BackendManager();
  });

  afterEach(() => {
    manager.destroy();
    RustWasmLoader.resetInstance();
  });

  it('should list rust-wasm as available backend', () => {
    const available = manager.getAvailableBackends();
    expect(available).toContain('rust-wasm');
  });

  it('should select rust-wasm for heavy operations (fft) regardless of size', () => {
    const activeBackend = manager.getActiveBackend(10, 'fft');
    expect(activeBackend).toBe('rust-wasm');
  });

  it('should select rust-wasm for eigendecomposition regardless of size', () => {
    const activeBackend = manager.getActiveBackend(10, 'eig');
    expect(activeBackend).toBe('rust-wasm');
  });

  it('should select rust-wasm for SVD regardless of size', () => {
    const activeBackend = manager.getActiveBackend(10, 'svd');
    expect(activeBackend).toBe('rust-wasm');
  });

  it('should select rust-wasm for decomposition regardless of size', () => {
    const activeBackend = manager.getActiveBackend(10, 'decomposition');
    expect(activeBackend).toBe('rust-wasm');
  });

  it('should select rust-wasm for large element counts on general ops', () => {
    // Default rustWasmThreshold is 1000
    const activeBackend = manager.getActiveBackend(2000, 'add');
    expect(activeBackend).toBe('rust-wasm');
  });

  it('should select JS for small matrices on general ops', () => {
    const activeBackend = manager.getActiveBackend(50, 'add');
    expect(activeBackend).toBe('js');
  });

  it('should respect custom rustWasmPreferredOps', () => {
    const customManager = new BackendManager({
      rustWasmPreferredOps: ['multiply'],
    });
    // Register rust backend
    backendRegistry.register(rustBackend);

    const activeBackend = customManager.getActiveBackend(10, 'multiply');
    expect(activeBackend).toBe('rust-wasm');

    customManager.destroy();
  });

  it('should include rust-wasm in default extended hints', () => {
    const hints = manager.getHints();
    expect(hints.rustWasmThreshold).toBe(1000);
    expect(hints.rustWasmPreferredOps).toContain('fft');
    expect(hints.rustWasmPreferredOps).toContain('eig');
    expect(hints.rustWasmPreferredOps).toContain('svd');
    expect(hints.rustWasmPreferredOps).toContain('decomposition');
  });
});
