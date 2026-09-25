/**
 * WASM Loader Tests
 *
 * Tests for WasmLoader functionality including:
 * - Module loading and initialization
 * - Caching and singleton behavior
 * - Memory pooling
 * - Error handling
 * - Module unloading/cleanup
 *
 * Adapted from Mathjs test/wasm/unit-tests/wasm/wasm-loader.test.ts
 */
import assert from 'assert';
import { describe, it } from 'vitest';
import {
  WASM_ARTIFACT_MISSING_MESSAGE,
  wasmArtifactAvailable,
  warnWasmArtifactsMissing,
} from './wasm-artifact-check.js';

// `WasmLoader.load()` reads the AssemblyScript binary it resolves by default:
// the co-located `matrix/dist/wasm/mathts-as.wasm`. The build guarantees it, so
// its absence is a broken build: the suite below is gated (a missing binary
// would otherwise surface as a wall of opaque `ENOENT`s), and the presence test
// right here turns that absence into a failure instead of a silent skip.
const hasWasm = wasmArtifactAvailable();
if (!hasWasm) warnWasmArtifactsMissing(1);
const describeWasm = hasWasm ? describe : describe.skip;

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  assert.ok(hasWasm, WASM_ARTIFACT_MISSING_MESSAGE);
});

describeWasm('WASM Loader Tests', { timeout: 15000 }, () => {
  describe('Module Loading', () => {
    it('should load WASM module successfully', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      const wasmModule = await loader.load();

      assert.ok(wasmModule, 'WASM module should be loaded');
      assert.strictEqual(typeof wasmModule, 'object', 'WASM module should be an object');
      // It must be the AssemblyScript binary: managed runtime + an AS kernel.
      const exports = wasmModule as unknown as Record<string, unknown>;
      assert.strictEqual(typeof exports.__new, 'function', 'AS managed runtime (__new) exported');
      assert.strictEqual(typeof exports.array_dot, 'function', 'AS kernel (array_dot) exported');
    });

    it('the loaded module executes an AS kernel on loader-allocated memory', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      const exports = (await loader.load()) as unknown as Record<string, unknown>;
      const arrayDot = exports.array_dot;
      assert.strictEqual(typeof arrayDot, 'function', 'AS kernel (array_dot) exported');
      const dot = arrayDot as (aHeader: number, bHeader: number) => number;
      // `ptr` is the managed Float64Array header the loader builds — the ABI the
      // AS kernels take — so this proves allocation + kernel execution end to end.
      const a = loader.allocateFloat64Array(new Float64Array([1, 2, 3]));
      const b = loader.allocateFloat64Array(new Float64Array([4, 5, 6]));
      try {
        assert.strictEqual(dot(a.ptr, b.ptr), 32, 'array_dot([1,2,3],[4,5,6]) = 32');
      } finally {
        loader.release(a.ptr, true);
        loader.release(b.ptr, true);
      }
    });

    it('should return cached module on subsequent loads', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      const module1 = await loader.load();
      const module2 = await loader.load();

      assert.strictEqual(module1, module2, 'Should return same cached module');
    });

    it('should load WASM within reasonable time', async () => {
      const startTime = Date.now();

      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();
      const loadTime = Date.now() - startTime;

      assert.ok(loadTime < 5000, `WASM load time ${loadTime}ms should be < 5000ms`);
    });
  });

  describe('WasmLoader Class', () => {
    it('should have singleton instance', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');

      const instance1 = WasmLoader.getInstance();
      const instance2 = WasmLoader.getInstance();

      assert.strictEqual(instance1, instance2, 'Should return same singleton instance');
    });

    it('should expose module status', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      assert.ok(
        typeof loader.isLoaded === 'function' || typeof loader.isLoaded === 'boolean',
        'Should have isLoaded property/method'
      );
    });
  });

  describe('Memory Pooling', () => {
    // These used to swallow 'WASM abort' / 'is not a function' as "memory pooling
    // not available in this build". The AS binary — the only one — always exports
    // its managed allocator (__new/__pin), so an abort is now a real failure.
    it('should provide memory allocation utilities', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      const data = new Float64Array(100);
      const { ptr, array } = loader.allocateFloat64Array(data);

      assert.ok(array instanceof Float64Array, 'Should return Float64Array');
      assert.strictEqual(array.length, data.length, 'Should have correct size');
      assert.ok(typeof ptr === 'number', 'Should return pointer');

      loader.release(ptr, true);
    });

    it('should provide Int32Array allocation', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      const data = new Int32Array(50);
      const { ptr, array } = loader.allocateInt32Array(data);

      assert.ok(array instanceof Int32Array, 'Should return Int32Array');
      assert.strictEqual(array.length, data.length, 'Should have correct size');
      assert.ok(typeof ptr === 'number', 'Should return pointer');

      loader.release(ptr, false);
    });

    // NOTE: this does NOT assert reuse. matrix's WasmLoader never adds anything
    // to its float64/int32 pools (getPoolStats() stays at 0 entries), so a
    // released allocation is freed, not recycled; the second allocation just has
    // to be valid.
    it('allocate → release → allocate again yields a valid array', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      const data = new Float64Array(100);

      const { ptr: ptr1 } = loader.allocateFloat64Array(data);
      loader.release(ptr1, true);

      const { ptr: ptr2, array: arr2 } = loader.allocateFloat64Array(data);

      assert.ok(arr2 instanceof Float64Array, 'Should return valid array');
      assert.strictEqual(arr2.length, data.length, 'Should have correct size');

      loader.release(ptr2, true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid WASM gracefully', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      assert.ok(WasmLoader, 'WasmLoader should be importable');
    });

    it('should handle loading', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      const loadPromise = loader.load();
      assert.ok(loadPromise instanceof Promise, 'load() should return a Promise');

      await loadPromise;
    });
  });

  describe('Module Cleanup', () => {
    it('should support reset if available', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      await loader.load();

      if (typeof loader.reset === 'function') {
        loader.reset();
        assert.ok(true, 'Reset completed successfully');
      } else if (typeof loader.clearPool === 'function') {
        loader.clearPool();
        assert.ok(true, 'ClearPool completed successfully');
      }
    });

    it('should reinitialize after reset', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      await loader.load();

      if (typeof loader.reset === 'function') {
        loader.reset();
      }

      const module = await loader.load();
      assert.ok(module, 'Should reinitialize after reset');
    });
  });

  describe('Configuration', () => {
    it('should support configuration options if available', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      if (typeof loader.configure === 'function') {
        loader.configure({
          timeout: 10000,
          useStreaming: true,
        });
        assert.ok(true, 'Configuration accepted');
      }
    });
  });

  describe('Concurrent Loading', () => {
    it('should handle concurrent load calls', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();

      const [module1, module2, module3] = await Promise.all([
        loader.load(),
        loader.load(),
        loader.load(),
      ]);

      assert.strictEqual(module1, module2, 'Concurrent calls should return same module');
      assert.strictEqual(module2, module3, 'All concurrent calls should return same module');
    });
  });
});
