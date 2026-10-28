/**
 * Issue #473 / M7 — oracle for AssemblyScript typed-array header layout
 * (`allocHeader` in WASMBackend, `makeAs` in WasmLoader) before consolidation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmLoader } from '../../src/backends/WasmLoader.js';
import { createWASMBackend } from '../../src/backends/WASMBackend.js';
import {
  AS_ID_ARRAY_BUFFER,
  AS_ID_FLOAT64_ARRAY,
  AS_ID_INT32_ARRAY,
} from '../../src/backends/wasm/as-typed-array.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');
const asGluePath = path.resolve(here, '../../../assembly/build/mathts.js');

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(fs.existsSync(asWasmPath), `build the AS binary: ${asWasmPath}`).toBe(true);
});

it('shared AS class ids match assembly/build/mathts.js lowering (Int32Array is 6, not 4)', () => {
  expect(fs.existsSync(asGluePath), `build the AS glue: ${asGluePath}`).toBe(true);
  const glue = fs.readFileSync(asGluePath, 'utf8');
  const f64 = glue.match(/__lowerTypedArray\(Float64Array, (\d+),/);
  const i32 = glue.match(/__lowerTypedArray\(Int32Array, (\d+),/);
  expect(f64, 'Float64Array lowering present in glue').not.toBeNull();
  expect(i32, 'Int32Array lowering present in glue').not.toBeNull();
  expect(Number(f64![1])).toBe(5);
  expect(Number(i32![1])).toBe(6);
  expect(glue).not.toMatch(/__lowerTypedArray\(Int32Array, 4,/);
  expect(AS_ID_ARRAY_BUFFER).toBe(1);
  expect(AS_ID_FLOAT64_ARRAY).toBe(Number(f64![1]));
  expect(AS_ID_INT32_ARRAY).toBe(Number(i32![1]));
});

/** Independent read of the 12-byte AS header: [dataStart, dataStart, byteLength] LE u32. */
function readAsHeader(
  buffer: ArrayBuffer,
  headerPtr: number
): { dataStart0: number; dataStart1: number; byteLength: number } {
  const dv = new DataView(buffer);
  return {
    dataStart0: dv.getUint32(headerPtr + 0, true),
    dataStart1: dv.getUint32(headerPtr + 4, true),
    byteLength: dv.getUint32(headerPtr + 8, true),
  };
}

/** AS stub runtime stores the class id at payload-8 (`~lib/rt/stub/__new` in mathts.wat). */
function readAsRtId(buffer: ArrayBuffer, headerPtr: number): number {
  return new DataView(buffer).getUint32(headerPtr - 8, true);
}

describe('M7 — WasmLoader makeAs header bytes', () => {
  let loader: WasmLoader;

  beforeAll(async () => {
    loader = WasmLoader.getInstance();
    loader.reset();
    await loader.load(asWasmPath);
  });

  afterAll(() => {
    loader.reset();
  });

  it('Float64Array: header is [bufferPtr, bufferPtr, length<<3]', () => {
    loader.clearPool();
    const length = 9;
    const alloc = loader.allocateFloat64ArrayEmpty(length);
    const mem = loader.getModule()!.memory.buffer;
    const h = readAsHeader(mem, alloc.ptr);
    expect(h.byteLength).toBe(length * 8);
    expect(h.dataStart0).toBe(alloc.dataPtr);
    expect(h.dataStart1).toBe(alloc.dataPtr);
    expect(readAsRtId(mem, alloc.ptr)).toBe(AS_ID_FLOAT64_ARRAY);
    loader.release(alloc.ptr, true);
  });

  it('Int32Array: header is [bufferPtr, bufferPtr, length<<2]', () => {
    loader.clearPool();
    const length = 13;
    const alloc = loader.allocateInt32ArrayEmpty(length);
    const mem = loader.getModule()!.memory.buffer;
    const h = readAsHeader(mem, alloc.ptr);
    expect(h.byteLength).toBe(length * 4);
    expect(h.dataStart0).toBe(alloc.dataPtr);
    expect(h.dataStart1).toBe(alloc.dataPtr);
    expect(readAsRtId(mem, alloc.ptr)).toBe(AS_ID_INT32_ARRAY);
    loader.release(alloc.ptr, false);
  });
});

describe('M7 — WASMBackend allocHeader header bytes', () => {
  let backend: ReturnType<typeof createWASMBackend>;

  beforeAll(async () => {
    backend = createWASMBackend({ wasmPath: asWasmPath, minElements: 1 });
    await backend.initialize();
  });

  it('Float64 and Int32 caches write the same header layout', () => {
    type Priv = {
      wasmModule: { memory: WebAssembly.Memory };
      allocCache: {
        acquire: (
          m: unknown,
          len: number
        ) => {
          headerPtr: number;
          bufferPtr: number;
          length: number;
        };
        release: (a: { headerPtr: number; bufferPtr: number; length: number }) => void;
      };
      int32Cache: {
        acquire: (
          m: unknown,
          len: number
        ) => {
          headerPtr: number;
          bufferPtr: number;
          length: number;
        };
        release: (a: { headerPtr: number; bufferPtr: number; length: number }) => void;
      };
    };
    const priv = backend as unknown as Priv;
    const mem = priv.wasmModule.memory.buffer;

    const nF = 8;
    const f64 = priv.allocCache.acquire(priv.wasmModule, nF);
    const hf = readAsHeader(mem, f64.headerPtr);
    expect(hf.byteLength).toBe(nF << 3);
    expect(hf.dataStart0).toBe(f64.bufferPtr);
    expect(hf.dataStart1).toBe(f64.bufferPtr);
    expect(readAsRtId(mem, f64.headerPtr)).toBe(AS_ID_FLOAT64_ARRAY);

    const nI = 6;
    const i32 = priv.int32Cache.acquire(priv.wasmModule, nI);
    const hi = readAsHeader(mem, i32.headerPtr);
    expect(hi.byteLength).toBe(nI << 2);
    expect(hi.dataStart0).toBe(i32.bufferPtr);
    expect(hi.dataStart1).toBe(i32.bufferPtr);
    expect(readAsRtId(mem, i32.headerPtr)).toBe(AS_ID_INT32_ARRAY);

    priv.allocCache.release(f64);
    priv.int32Cache.release(i32);
  });
});
