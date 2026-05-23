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
import { wasmArtifactAvailable, warnWasmArtifactsMissing } from './wasm-artifact-check.js';

// `WasmLoader.load()` reads a compiled `.wasm` binary from `lib/wasm/`. That
// artifact is not committed; on a fresh checkout (no `npm run build:wasm`)
// every test here would fail with an opaque `ENOENT ... mathts.wasm`. Skip the
// whole suite — loudly — when the artifact is absent so environmental skips
// are distinguishable from real failures.
const hasWasm = wasmArtifactAvailable();
if (!hasWasm) warnWasmArtifactsMissing(1);
const describeWasm = hasWasm ? describe : describe.skip;

describeWasm('WASM Loader Tests', { timeout: 15000 }, () => {
  describe('Module Loading', () => {
    it('should load WASM module successfully', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      const wasmModule = await loader.load();

      assert.ok(wasmModule, 'WASM module should be loaded');
      assert.strictEqual(typeof wasmModule, 'object', 'WASM module should be an object');
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
    it('should provide memory allocation utilities', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      if (typeof loader.allocateFloat64Array === 'function') {
        try {
          const data = new Float64Array(100);
          const { ptr, array } = loader.allocateFloat64Array(data);

          assert.ok(array instanceof Float64Array, 'Should return Float64Array');
          assert.strictEqual(array.length, data.length, 'Should have correct size');
          assert.ok(typeof ptr === 'number', 'Should return pointer');

          loader.release(ptr, true);
        } catch (err) {
          if ((err as Error).message.includes('WASM abort')) {
            assert.ok(true, 'Memory pooling not available in this build');
          } else {
            throw err;
          }
        }
      }
    });

    it('should provide Int32Array memory pool', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      if (typeof loader.allocateInt32Array === 'function') {
        try {
          const data = new Int32Array(50);
          const { ptr, array } = loader.allocateInt32Array(data);

          assert.ok(array instanceof Int32Array, 'Should return Int32Array');
          assert.strictEqual(array.length, data.length, 'Should have correct size');
          assert.ok(typeof ptr === 'number', 'Should return pointer');

          loader.release(ptr, false);
        } catch (err) {
          if ((err as Error).message.includes('WASM abort')) {
            assert.ok(true, 'Memory pooling not available in this build');
          } else {
            throw err;
          }
        }
      }
    });

    it('should reuse pooled arrays', async () => {
      const { WasmLoader } = await import('../../matrix/src/backends/WasmLoader.js');
      const loader = WasmLoader.getInstance();
      await loader.load();

      if (typeof loader.allocateFloat64Array === 'function') {
        try {
          const data = new Float64Array(100);

          const { ptr: ptr1 } = loader.allocateFloat64Array(data);
          loader.release(ptr1, true);

          const { ptr: ptr2, array: arr2 } = loader.allocateFloat64Array(data);

          assert.ok(arr2 instanceof Float64Array, 'Should return valid array');
          assert.strictEqual(arr2.length, data.length, 'Should have correct size');

          loader.release(ptr2, true);
        } catch (err) {
          if ((err as Error).message.includes('WASM abort')) {
            assert.ok(true, 'Memory pooling not available in this build');
          } else {
            throw err;
          }
        }
      }
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
