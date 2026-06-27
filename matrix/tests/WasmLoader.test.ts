/**
 * Tests for matrix/src/backends/WasmLoader.ts
 *
 * WasmLoader is a singleton that manages loading of the WebAssembly matrix
 * module. A compiled `.wasm` artifact may be absent in this environment, so
 * tests that require an actual binary are guarded with try/catch or it.skip.
 * All structural, API-surface, and error-path tests run unconditionally.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WasmLoader, wasmLoader, initWasm } from '../src/backends/WasmLoader.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a fresh WasmLoader via getInstance(), then immediately reset it so
 * each test suite starts from a clean state.
 */
function freshLoader(): WasmLoader {
  const loader = WasmLoader.getInstance();
  loader.reset();
  return loader;
}

// ---------------------------------------------------------------------------
// Singleton pattern
// ---------------------------------------------------------------------------

describe('WasmLoader — singleton', () => {
  it('getInstance() always returns the same object', () => {
    const a = WasmLoader.getInstance();
    const b = WasmLoader.getInstance();
    expect(a).toBe(b);
  });

  it('the exported wasmLoader constant is the singleton instance', () => {
    const instance = WasmLoader.getInstance();
    expect(wasmLoader).toBe(instance);
  });
});

// ---------------------------------------------------------------------------
// Initial / default state (no WASM loaded)
// ---------------------------------------------------------------------------

describe('WasmLoader — initial state after reset()', () => {
  let loader: WasmLoader;

  beforeEach(() => {
    loader = freshLoader();
  });

  it('isLoaded() returns false before any load call', () => {
    expect(loader.isLoaded()).toBe(false);
  });

  it('isPrecompiled() returns false before any precompile call', () => {
    expect(loader.isPrecompiled()).toBe(false);
  });

  it('getModule() returns null before loading', () => {
    expect(loader.getModule()).toBeNull();
  });

  it('getCompiledModule() returns null before precompile', () => {
    expect(loader.getCompiledModule()).toBeNull();
  });

  it('getLoadingMetrics() returns null before a successful load', () => {
    expect(loader.getLoadingMetrics()).toBeNull();
  });

  it('getPoolStats() returns zero counts when no allocations have been made', () => {
    const stats = loader.getPoolStats();
    expect(stats.float64.total).toBe(0);
    expect(stats.float64.inUse).toBe(0);
    expect(stats.float64.totalBytes).toBe(0);
    expect(stats.int32.total).toBe(0);
    expect(stats.int32.inUse).toBe(0);
    expect(stats.int32.totalBytes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

describe('WasmLoader — public API surface', () => {
  it('has a load() method', () => {
    expect(typeof WasmLoader.prototype.load).toBe('function');
  });

  it('has a precompile() method', () => {
    expect(typeof WasmLoader.prototype.precompile).toBe('function');
  });

  it('has an isLoaded() method', () => {
    expect(typeof WasmLoader.prototype.isLoaded).toBe('function');
  });

  it('has an isPrecompiled() method', () => {
    expect(typeof WasmLoader.prototype.isPrecompiled).toBe('function');
  });

  it('has a getModule() method', () => {
    expect(typeof WasmLoader.prototype.getModule).toBe('function');
  });

  it('has a getCompiledModule() method', () => {
    expect(typeof WasmLoader.prototype.getCompiledModule).toBe('function');
  });

  it('has a getLoadingMetrics() method', () => {
    expect(typeof WasmLoader.prototype.getLoadingMetrics).toBe('function');
  });

  it('has an allocateFloat64Array() method', () => {
    expect(typeof WasmLoader.prototype.allocateFloat64Array).toBe('function');
  });

  it('has an allocateFloat64ArrayEmpty() method', () => {
    expect(typeof WasmLoader.prototype.allocateFloat64ArrayEmpty).toBe('function');
  });

  it('has an allocateInt32Array() method', () => {
    expect(typeof WasmLoader.prototype.allocateInt32Array).toBe('function');
  });

  it('has an allocateInt32ArrayEmpty() method', () => {
    expect(typeof WasmLoader.prototype.allocateInt32ArrayEmpty).toBe('function');
  });

  it('has a release() method', () => {
    expect(typeof WasmLoader.prototype.release).toBe('function');
  });

  it('has a free() method', () => {
    expect(typeof WasmLoader.prototype.free).toBe('function');
  });

  it('has a clearPool() method', () => {
    expect(typeof WasmLoader.prototype.clearPool).toBe('function');
  });

  it('has a getPoolStats() method', () => {
    expect(typeof WasmLoader.prototype.getPoolStats).toBe('function');
  });

  it('has a collect() method', () => {
    expect(typeof WasmLoader.prototype.collect).toBe('function');
  });

  it('has a reset() method', () => {
    expect(typeof WasmLoader.prototype.reset).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// WasmModule interface — shape of expected exports
// ---------------------------------------------------------------------------

describe('WasmModule interface — expected export shape', () => {
  // We try to load the AssemblyScript artifact at assembly/build/mathts.wasm.
  // If the file is missing (CI without a built artifact) the test skips
  // dynamically rather than failing.
  //
  // The `WasmModule` interface in WasmLoader was authored against the legacy
  // WASM build, which uses camelCase exports like `multiplyDense`. The AS artifact
  // uses suffixed snake_case (`add_f64`, `sub_f64`, …) and does NOT export
  // `multiplyDense`. So we only assert the things both backends provide:
  // a working WebAssembly.Memory instance and a non-empty function table.

  it('loads the AS WASM artifact and exposes WebAssembly.Memory', async () => {
    // Walk up from this test file to find the .wasm — vitest's cwd may vary.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(here, '../../assembly/build/mathts.wasm');
    if (!fs.existsSync(wasmPath)) {
      // Artifact not built in this environment.
      return;
    }

    const loader = freshLoader();
    const mod = (await loader.load(wasmPath)) as unknown as Record<string, unknown> & {
      memory: WebAssembly.Memory;
    };

    expect(mod.memory).toBeInstanceOf(WebAssembly.Memory);

    const fnNames = Object.keys(mod).filter(
      (k) => typeof (mod as Record<string, unknown>)[k] === 'function'
    );
    expect(fnNames.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error paths — allocate before load
// ---------------------------------------------------------------------------

describe('WasmLoader — error handling before load', () => {
  let loader: WasmLoader;

  beforeEach(() => {
    loader = freshLoader();
  });

  it('allocateFloat64Array() throws "WASM module not loaded" when not loaded', () => {
    expect(() => loader.allocateFloat64Array([1, 2, 3])).toThrow('WASM module not loaded');
  });

  it('allocateFloat64ArrayEmpty() throws "WASM module not loaded" when not loaded', () => {
    expect(() => loader.allocateFloat64ArrayEmpty(4)).toThrow('WASM module not loaded');
  });

  it('allocateInt32Array() throws "WASM module not loaded" when not loaded', () => {
    expect(() => loader.allocateInt32Array([1, 2, 3])).toThrow('WASM module not loaded');
  });

  it('allocateInt32ArrayEmpty() throws "WASM module not loaded" when not loaded', () => {
    expect(() => loader.allocateInt32ArrayEmpty(4)).toThrow('WASM module not loaded');
  });

  it('free() is a no-op (does not throw) when module is not loaded', () => {
    expect(() => loader.free(0)).not.toThrow();
  });

  it('clearPool() is a no-op (does not throw) when module is not loaded', () => {
    expect(() => loader.clearPool()).not.toThrow();
  });

  it('collect() is a no-op (does not throw) when module is not loaded', () => {
    expect(() => loader.collect()).not.toThrow();
  });

  it('release() is a no-op (does not throw) when module is not loaded', () => {
    // release() calls free() which guards on wasmModule being null
    expect(() => loader.release(0)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// load() with a missing artifact — graceful rejection
// ---------------------------------------------------------------------------

describe('WasmLoader — load() with missing WASM artifact', () => {
  let loader: WasmLoader;

  beforeEach(() => {
    loader = freshLoader();
  });

  it('rejects with an error when given a non-existent path', async () => {
    await expect(loader.load('/nonexistent/path/to/missing.wasm')).rejects.toThrow();
  });

  it('isLoaded() remains false after a failed load', async () => {
    try {
      await loader.load('/nonexistent/path/to/missing.wasm');
    } catch {
      // expected
    }
    expect(loader.isLoaded()).toBe(false);
  });

  it('getModule() remains null after a failed load', async () => {
    try {
      await loader.load('/nonexistent/path/to/missing.wasm');
    } catch {
      // expected
    }
    expect(loader.getModule()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reset() clears all state
// ---------------------------------------------------------------------------

describe('WasmLoader — reset()', () => {
  let loader: WasmLoader;

  beforeEach(() => {
    loader = freshLoader();
  });

  it('resets isLoaded() to false', () => {
    loader.reset();
    expect(loader.isLoaded()).toBe(false);
  });

  it('resets getModule() to null', () => {
    loader.reset();
    expect(loader.getModule()).toBeNull();
  });

  it('resets getCompiledModule() to null', () => {
    loader.reset();
    expect(loader.getCompiledModule()).toBeNull();
  });

  it('resets getLoadingMetrics() to null', () => {
    loader.reset();
    expect(loader.getLoadingMetrics()).toBeNull();
  });

  it('reset() is idempotent — calling twice does not throw', () => {
    expect(() => {
      loader.reset();
      loader.reset();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// LoadingMetrics shape
// ---------------------------------------------------------------------------

describe('LoadingMetrics — interface shape', () => {
  it('metrics returned after a successful load have the expected keys', async () => {
    // This test is conditional: if no .wasm is present it is skipped gracefully.
    const loader = freshLoader();
    try {
      await loader.load();
    } catch {
      // No artifact — skip metric shape check.
      return;
    }

    const metrics = loader.getLoadingMetrics();
    expect(metrics).not.toBeNull();
    if (metrics === null) return; // type-narrowing guard

    expect(typeof metrics.fileReadMs).toBe('number');
    expect(typeof metrics.compileMs).toBe('number');
    expect(typeof metrics.instantiateMs).toBe('number');
    expect(typeof metrics.totalMs).toBe('number');
    expect(typeof metrics.fromCache).toBe('boolean');
    expect(metrics.totalMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// getPoolStats() — structural assertions (no WASM needed)
// ---------------------------------------------------------------------------

describe('WasmLoader — getPoolStats() structure', () => {
  let loader: WasmLoader;

  beforeEach(() => {
    loader = freshLoader();
  });

  it('returns an object with float64 and int32 sub-objects', () => {
    const stats = loader.getPoolStats();
    expect(stats).toHaveProperty('float64');
    expect(stats).toHaveProperty('int32');
  });

  it('float64 pool has total, inUse, totalBytes fields of type number', () => {
    const { float64 } = loader.getPoolStats();
    expect(typeof float64.total).toBe('number');
    expect(typeof float64.inUse).toBe('number');
    expect(typeof float64.totalBytes).toBe('number');
  });

  it('int32 pool has total, inUse, totalBytes fields of type number', () => {
    const { int32 } = loader.getPoolStats();
    expect(typeof int32.total).toBe('number');
    expect(typeof int32.inUse).toBe('number');
    expect(typeof int32.totalBytes).toBe('number');
  });

  it('inUse never exceeds total for either pool', () => {
    const stats = loader.getPoolStats();
    expect(stats.float64.inUse).toBeLessThanOrEqual(stats.float64.total);
    expect(stats.int32.inUse).toBeLessThanOrEqual(stats.int32.total);
  });
});

// ---------------------------------------------------------------------------
// initWasm() convenience export
// ---------------------------------------------------------------------------

describe('initWasm() module-level convenience function', () => {
  it('is exported and is a function', () => {
    expect(typeof initWasm).toBe('function');
  });

  it('returns a Promise', () => {
    // We call with a bad path so it rejects, but we only care it returns a Promise
    const result = initWasm('/nonexistent/path.wasm');
    expect(result).toBeInstanceOf(Promise);
    // Swallow the rejection to avoid unhandled-promise-rejection noise
    result.catch(() => {});
  });
});
