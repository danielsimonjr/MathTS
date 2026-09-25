/**
 * Behavioural tests for the AssemblyScript allocation pool in
 * matrix/src/backends/WasmLoader.ts.
 *
 * The binary is built with `--runtime stub`: a bump allocator whose `__unpin`
 * and `__collect` reclaim nothing. Recycling released blocks is therefore the
 * ONLY thing that keeps WASM linear memory bounded, and these tests pin that
 * down. (The pool used to be write-only: allocations were never recorded, so
 * nothing was ever reused and every allocate/free cycle grew memory for good.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmLoader } from '../../src/backends/WasmLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');

/** `byteLength` field of an AS typed-array header (the length kernels see). */
function headerByteLength(loader: WasmLoader, headerPtr: number): number {
  const module = loader.getModule();
  if (!module) throw new Error('module not loaded');
  return new DataView(module.memory.buffer).getUint32(headerPtr + 8, true);
}

function memoryBytes(loader: WasmLoader): number {
  const module = loader.getModule();
  if (!module) throw new Error('module not loaded');
  return module.memory.buffer.byteLength;
}

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(
    fs.existsSync(asWasmPath),
    `AS wasm not found at ${asWasmPath}; run \`bun run build\` from the repo root`
  ).toBe(true);
});

describe('WasmLoader — AS allocation pool recycles released blocks', () => {
  let loader: WasmLoader;

  beforeAll(async () => {
    loader = WasmLoader.getInstance();
    loader.reset();
    await loader.load(asWasmPath);
  });

  afterAll(() => {
    loader.reset();
  });

  it('release() makes the block available to the next same-size allocation', () => {
    loader.clearPool();
    const first = loader.allocateFloat64Array([1, 2, 3, 4]);
    loader.release(first.ptr, true);
    const second = loader.allocateFloat64Array([9, 8, 7, 6]);
    expect(second.ptr).toBe(first.ptr);
    expect(second.dataPtr).toBe(first.dataPtr);
    expect(Array.from(second.array)).toEqual([9, 8, 7, 6]);
    loader.release(second.ptr, true);
  });

  it('free() also recycles a pooled block (the stub runtime cannot reclaim it)', () => {
    loader.clearPool();
    const first = loader.allocateInt32Array([1, 2, 3]);
    loader.free(first.ptr);
    const second = loader.allocateInt32ArrayEmpty(3);
    expect(second.ptr).toBe(first.ptr);
    loader.free(second.ptr);
  });

  it('release() finds the pool itself when the isFloat64 hint is wrong', () => {
    loader.clearPool();
    const a = loader.allocateInt32Array([5, 6]);
    loader.release(a.ptr, true); // wrong hint: this is an Int32Array
    expect(loader.getPoolStats().int32.inUse).toBe(0);
    const b = loader.allocateInt32Array([7, 8]);
    expect(b.ptr).toBe(a.ptr);
    loader.release(b.ptr, false);
  });

  it('an *Empty allocation is zeroed even when it reuses a dirty block', () => {
    loader.clearPool();
    const dirtyF = loader.allocateFloat64Array([7, 7, 7, 7]);
    loader.release(dirtyF.ptr, true);
    const f = loader.allocateFloat64ArrayEmpty(4);
    expect(f.ptr).toBe(dirtyF.ptr);
    expect(Array.from(f.array)).toEqual([0, 0, 0, 0]);
    loader.release(f.ptr, true);

    const dirtyI = loader.allocateInt32Array([5, 5, 5]);
    loader.release(dirtyI.ptr, false);
    const i32 = loader.allocateInt32ArrayEmpty(3);
    expect(i32.ptr).toBe(dirtyI.ptr);
    expect(Array.from(i32.array)).toEqual([0, 0, 0]);
    loader.release(i32.ptr, false);
  });

  it('a live block is never handed out twice', () => {
    loader.clearPool();
    const a = loader.allocateFloat64ArrayEmpty(16);
    const b = loader.allocateFloat64ArrayEmpty(16);
    expect(b.ptr).not.toBe(a.ptr);
    expect(b.dataPtr).not.toBe(a.dataPtr);
    loader.release(a.ptr, true);
    loader.release(b.ptr, true);
  });

  it('reusing a larger block rewrites the header byteLength to the requested size', () => {
    loader.clearPool();
    const big = loader.allocateFloat64ArrayEmpty(100);
    expect(headerByteLength(loader, big.ptr)).toBe(800);
    loader.release(big.ptr, true);
    // 60 elements fit the 100-element block (within the pool's 2x waste bound).
    const small = loader.allocateFloat64ArrayEmpty(60);
    expect(small.ptr).toBe(big.ptr);
    expect(small.length).toBe(60);
    expect(small.array.length).toBe(60);
    // A kernel reads its length from the header; a stale 800 would make it
    // process 40 elements the caller never wrote.
    expect(headerByteLength(loader, small.ptr)).toBe(480);
    loader.release(small.ptr, true);
  });

  it('getPoolStats counts tracked blocks and the ones in use', () => {
    loader.clearPool();
    const a = loader.allocateFloat64ArrayEmpty(8);
    const b = loader.allocateInt32ArrayEmpty(8);
    let stats = loader.getPoolStats();
    expect(stats.float64).toEqual({ total: 1, inUse: 1, totalBytes: 64 });
    expect(stats.int32).toEqual({ total: 1, inUse: 1, totalBytes: 32 });
    loader.release(a.ptr, true);
    loader.release(b.ptr, false);
    stats = loader.getPoolStats();
    expect(stats.float64.inUse).toBe(0);
    expect(stats.int32.inUse).toBe(0);
  });

  it('allocate/release cycles keep linear memory bounded', () => {
    loader.clearPool();
    const data = new Float64Array(1024).fill(1); // 8 KiB per block
    // Warm up so the pool holds the working set, then measure.
    for (let i = 0; i < 10; i++) {
      const x = loader.allocateFloat64Array(data);
      const y = loader.allocateFloat64ArrayEmpty(1024);
      loader.release(x.ptr, true);
      loader.release(y.ptr, true);
    }
    const before = memoryBytes(loader);
    for (let i = 0; i < 5000; i++) {
      const x = loader.allocateFloat64Array(data);
      const y = loader.allocateFloat64ArrayEmpty(1024);
      loader.release(x.ptr, true);
      loader.release(y.ptr, true);
    }
    // Unpooled, these 10,000 blocks would need ~80 MiB of fresh memory.
    expect(memoryBytes(loader)).toBe(before);
  });

  it('allocate/free cycles keep linear memory bounded too (fft-wasm uses free)', () => {
    loader.clearPool();
    const data = new Float64Array(2048).fill(2);
    const warm = loader.allocateFloat64Array(data);
    loader.free(warm.ptr);
    const before = memoryBytes(loader);
    for (let i = 0; i < 5000; i++) {
      const x = loader.allocateFloat64Array(data);
      loader.free(x.ptr);
    }
    expect(memoryBytes(loader)).toBe(before);
  });

  it('blocks above the pool threshold are not pooled', () => {
    loader.clearPool();
    const huge = loader.allocateFloat64ArrayEmpty((2 * 1024 * 1024) / 8); // 2 MiB > 1 MiB cap
    expect(loader.getPoolStats().float64.total).toBe(0);
    loader.free(huge.ptr);
  });
});
