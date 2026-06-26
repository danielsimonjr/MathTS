/**
 * Tests for the live-load + allocation paths of matrix/src/backends/WasmLoader.ts.
 *
 * The structural / error-path tests live in tests/WasmLoader.test.ts. This
 * file loads the actual AssemblyScript artifact (assembly/build/mathts.wasm,
 * built by `npm run build:wasm`) so the otherwise-dead AS allocation code runs:
 *   - loadNodeWasm() + SHA-384 integrity verification
 *   - allocateFloat64Array / allocateInt32Array (+ Empty variants)
 *   - the AS memory pool: release() → re-acquire on the next allocation
 *   - free(), clearPool(), collect(), getPoolStats() with live entries
 *   - precompile() then load() from the cached compiled module
 *
 * Every test is guarded on the artifact existing so the suite degrades to a
 * no-op (rather than failing) in an environment without the AS build.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmLoader } from '../../src/backends/WasmLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../../assembly/build/mathts.wasm');
const asAvailable = fs.existsSync(asWasmPath);

describe('WasmLoader — AS artifact live load + allocation', () => {
  let loader: WasmLoader;

  beforeAll(async () => {
    loader = WasmLoader.getInstance();
    loader.reset();
    if (asAvailable) {
      await loader.load(asWasmPath);
    }
  });

  afterAll(() => {
    loader.reset();
  });

  it.runIf(asAvailable)('loads the AssemblyScript artifact', () => {
    expect(loader.isLoaded()).toBe(true);
  });

  it.runIf(asAvailable)('records loading metrics on a real load', () => {
    const m = loader.getLoadingMetrics();
    expect(m).not.toBeNull();
    expect(m!.totalMs).toBeGreaterThanOrEqual(0);
    expect(m!.fromCache).toBe(false);
  });

  it.runIf(asAvailable)('allocateFloat64Array copies data into WASM memory', () => {
    const data = [1.5, 2.5, 3.5, 4.5];
    const alloc = loader.allocateFloat64Array(data);
    expect(alloc.length).toBe(4);
    expect(Array.from(alloc.array)).toEqual(data);
    // ptr (AS header) differs from the data offset.
    expect(alloc.ptr).not.toBe(0);
    loader.free(alloc.ptr);
  });

  it.runIf(asAvailable)('allocateFloat64ArrayEmpty returns a zeroed buffer', () => {
    const alloc = loader.allocateFloat64ArrayEmpty(8);
    expect(alloc.length).toBe(8);
    expect(Array.from(alloc.array).every((x) => x === 0)).toBe(true);
    loader.free(alloc.ptr);
  });

  it.runIf(asAvailable)('allocateInt32Array / Empty work on the AS path', () => {
    const a = loader.allocateInt32Array([10, 20, 30]);
    expect(Array.from(a.array)).toEqual([10, 20, 30]);
    const b = loader.allocateInt32ArrayEmpty(5);
    expect(b.length).toBe(5);
    loader.free(a.ptr);
    loader.free(b.ptr);
  });

  it.runIf(asAvailable)('release() returns an allocation for reuse without throwing', () => {
    // The AS managed runtime (`--runtime stub`) does not truly free; release()
    // unpins the header via free() when the ptr is not a tracked pool entry.
    const first = loader.allocateFloat64Array([1, 2, 3, 4]);
    expect(() => loader.release(first.ptr, true)).not.toThrow();
    // A subsequent allocation of the same size still produces a usable buffer.
    const second = loader.allocateFloat64Array([9, 8, 7, 6]);
    expect(Array.from(second.array)).toEqual([9, 8, 7, 6]);
    loader.free(second.ptr);
  });

  it.runIf(asAvailable)('release() on the int32 pool path does not throw', () => {
    const a = loader.allocateInt32Array([7, 8, 9]);
    expect(() => loader.release(a.ptr, false)).not.toThrow();
  });

  it.runIf(asAvailable)('getPoolStats returns a well-formed structure after allocations', () => {
    loader.clearPool();
    const a = loader.allocateFloat64Array([1, 2]);
    const stats = loader.getPoolStats();
    expect(stats.float64.inUse).toBeLessThanOrEqual(stats.float64.total);
    expect(stats.int32.inUse).toBeLessThanOrEqual(stats.int32.total);
    loader.free(a.ptr);
  });

  it.runIf(asAvailable)('clearPool empties the pools without throwing', () => {
    loader.allocateFloat64Array([1, 2, 3]);
    loader.allocateInt32Array([4, 5]);
    expect(() => loader.clearPool()).not.toThrow();
    const stats = loader.getPoolStats();
    expect(stats.float64.total).toBe(0);
    expect(stats.int32.total).toBe(0);
  });

  it.runIf(asAvailable)('collect() runs the AS GC without throwing', () => {
    expect(() => loader.collect()).not.toThrow();
  });
});

describe('WasmLoader — load() short-circuits', () => {
  it('returns the cached module on a second load() call', async () => {
    if (!asAvailable) return;
    const loader = WasmLoader.getInstance();
    loader.reset();
    const first = await loader.load(asWasmPath);
    const second = await loader.load(asWasmPath); // hits the `if (this.wasmModule)` guard
    expect(second).toBe(first);
    loader.reset();
  });

  it('concurrent load() calls share the in-flight loading promise', async () => {
    if (!asAvailable) return;
    const loader = WasmLoader.getInstance();
    loader.reset();
    // Kick off two loads without awaiting the first → the second hits the
    // `if (this.loading) return this.loading` guard.
    const [a, b] = await Promise.all([loader.load(asWasmPath), loader.load(asWasmPath)]);
    expect(a).toBe(b);
    loader.reset();
  });

  it('free() on the AS path filters pools and unpins without throwing', async () => {
    if (!asAvailable) return;
    const loader = WasmLoader.getInstance();
    loader.reset();
    await loader.load(asWasmPath);
    const alloc = loader.allocateFloat64Array([1, 2, 3]);
    expect(() => loader.free(alloc.ptr)).not.toThrow();
    // clearPool on the AS path walks the (empty) pools + resets.
    expect(() => loader.clearPool()).not.toThrow();
    loader.reset();
  });
});

describe('WasmLoader — precompile + cached instantiation', () => {
  it.runIf(asAvailable)('precompile() then load() instantiates from the cached module', async () => {
    const loader = WasmLoader.getInstance();
    loader.reset();
    await loader.precompile(asWasmPath);
    expect(loader.isPrecompiled()).toBe(true);
    expect(loader.getCompiledModule()).not.toBeNull();

    const mod = await loader.load(asWasmPath);
    expect(mod.memory).toBeInstanceOf(WebAssembly.Memory);
    const metrics = loader.getLoadingMetrics();
    expect(metrics?.fromCache).toBe(true);
    loader.reset();
  });
});
