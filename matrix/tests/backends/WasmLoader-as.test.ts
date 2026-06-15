/**
 * Tests for the live-load + allocation paths of matrix/src/backends/WasmLoader.ts.
 *
 * The structural / error-path tests live in tests/WasmLoader.test.ts. This
 * file loads the actual AssemblyScript artifact (assembly/build/mathts.wasm,
 * built by `npm run build:wasm`) so the otherwise-dead AS allocation code runs:
 *   - loadNodeWasm() + SHA-384 integrity verification
 *   - detectAllocatorKind() → 'as' (the __new export is present)
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
import * as os from 'node:os';
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

  it.runIf(asAvailable)('detects the AssemblyScript allocator kind', () => {
    expect(loader.isLoaded()).toBe(true);
    expect(loader.getAllocatorKind()).toBe('as');
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
    expect(alloc.kind).toBe('as');
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

  it.runIf(asAvailable)('resetRustAllocator is a no-op on the AS path', () => {
    expect(() => loader.resetRustAllocator()).not.toThrow();
  });
});

/**
 * A hand-assembled minimal WASM module that exports `memory` (1 page) and an
 * immutable i32 global `__heap_base` (= 65536) but NO managed runtime (`__new`
 * absent). Loading it forces the loader down the Rust allocator path:
 * detectAllocatorKind() → 'rust', the RustBumpAllocator, and the rust branches
 * of allocate/free/release/clearPool/collect/resetRustAllocator.
 */
const MINIMAL_RUST_LIKE_WASM = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 6, 8, 1, 127, 0, 65, 128, 128, 4, 11, 7, 24, 2, 6,
  109, 101, 109, 111, 114, 121, 2, 0, 11, 95, 95, 104, 101, 97, 112, 95, 98, 97, 115, 101, 3, 0,
]);

describe('WasmLoader — Rust allocator path (minimal no-runtime module)', () => {
  let dir = '';
  let wasmPath = '';
  let loader: WasmLoader;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathts-rustlike-'));
    wasmPath = path.join(dir, 'minimal.wasm');
    fs.writeFileSync(wasmPath, MINIMAL_RUST_LIKE_WASM);
    loader = WasmLoader.getInstance();
    loader.reset();
    await loader.load(wasmPath); // no sibling manifest → soft-warn, loads anyway
  });

  afterAll(() => {
    loader.reset();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('detects the Rust (flat-memory) allocator kind', () => {
    expect(loader.getAllocatorKind()).toBe('rust');
  });

  it('allocateFloat64Array uses the bump allocator and copies data', () => {
    const a = loader.allocateFloat64Array([1, 2, 3, 4]);
    expect(a.kind).toBe('rust');
    expect(a.ptr).toBe(a.dataPtr); // flat ptr == data ptr on the Rust path
    expect(Array.from(a.array)).toEqual([1, 2, 3, 4]);
  });

  it('allocateFloat64ArrayEmpty / allocateInt32Array / Empty on the Rust path', () => {
    const e = loader.allocateFloat64ArrayEmpty(4);
    expect(e.kind).toBe('rust');
    const i = loader.allocateInt32Array([5, 6, 7]);
    expect(Array.from(i.array)).toEqual([5, 6, 7]);
    const ie = loader.allocateInt32ArrayEmpty(2);
    expect(ie.length).toBe(2);
  });

  it('grows memory when an allocation exceeds the current buffer', () => {
    // One page = 64 KiB. Request >1 page of f64 to force memory.grow().
    const big = loader.allocateFloat64ArrayEmpty(20000); // 160 KB > 64 KB
    expect(big.array.length).toBe(20000);
  });

  it('free / release are no-ops on the Rust path (do not throw)', () => {
    const a = loader.allocateFloat64Array([1, 2]);
    expect(() => loader.free(a.ptr)).not.toThrow();
    expect(() => loader.release(a.ptr, true)).not.toThrow();
  });

  it('resetRustAllocator and clearPool reset the bump allocator', () => {
    expect(() => loader.resetRustAllocator()).not.toThrow();
    expect(() => loader.clearPool()).not.toThrow();
    // After reset, a new allocation reuses low offsets again.
    const a = loader.allocateFloat64Array([9]);
    expect(a.array[0]).toBe(9);
  });

  it('collect() is a no-op on the Rust path', () => {
    expect(() => loader.collect()).not.toThrow();
  });

  it('getPoolStats reports zeroed pools on the Rust path', () => {
    const stats = loader.getPoolStats();
    expect(stats.float64.total).toBe(0);
    expect(stats.int32.total).toBe(0);
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
