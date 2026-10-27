/**
 * Sprint 2R clone-merge batch 4 (G54–G56, G59, G60) — independent oracles.
 * Pins AS allocation headers, WasmLoader pool reuse, and parallel dense-pair errors
 * before deduplicating WASMBackend / WasmLoader / parallel-matrix helpers.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { WasmLoader } from '../src/backends/WasmLoader.js';
import { createWASMBackend } from '../src/backends/WASMBackend.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../dist/wasm/mathts-as.wasm');
const wasmLoaderSrc = path.resolve(here, '../src/backends/WasmLoader.ts');
const wasmBackendSrc = path.resolve(here, '../src/backends/WASMBackend.ts');

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(fs.existsSync(asWasmPath), `build the AS binary: ${asWasmPath}`).toBe(true);
});

function readHeaderWords(
  buffer: ArrayBuffer,
  headerPtr: number
): { word0: number; word1: number; byteLength: number } {
  const dv = new DataView(buffer);
  return {
    word0: dv.getUint32(headerPtr + 0, true),
    word1: dv.getUint32(headerPtr + 4, true),
    byteLength: dv.getUint32(headerPtr + 8, true),
  };
}

describe('S2R batch4 — AS Int32 type ids stay file-local', () => {
  it('Float64 is 5 in both files; Int32 is 4 in WasmLoader and 6 in WASMBackend', () => {
    const loaderSrc = fs.readFileSync(wasmLoaderSrc, 'utf8');
    const backendSrc = fs.readFileSync(wasmBackendSrc, 'utf8');
    expect(loaderSrc).toMatch(/const AS_ID_FLOAT64_ARRAY = 5;/);
    expect(backendSrc).toMatch(/const AS_ID_FLOAT64_ARRAY = 5;/);
    expect(loaderSrc).toMatch(/const AS_ID_INT32_ARRAY = 4;/);
    expect(backendSrc).toMatch(/const AS_ID_INT32_ARRAY = 6;/);
    expect(loaderSrc).not.toMatch(/\ballocHeader\b/);
    expect(backendSrc).not.toMatch(/\ballocateAs\b/);
  });
});

describe('S2R batch4 — WasmLoader AS headers (G55/G56 oracle)', () => {
  let loader: WasmLoader;

  beforeAll(async () => {
    loader = WasmLoader.getInstance();
    loader.reset();
    await loader.load(asWasmPath);
  });

  afterAll(() => {
    if (loader) loader.reset();
  });

  it('Float64 header byteLength is n<<3 with [buf,buf,nbytes]', () => {
    loader.clearPool();
    const n = 7;
    const alloc = loader.allocateFloat64ArrayEmpty(n);
    const module = loader.getModule()!;
    const h = readHeaderWords(module.memory.buffer, alloc.ptr);
    expect(h.byteLength).toBe(n << 3);
    expect(h.word0).toBe(alloc.dataPtr);
    expect(h.word1).toBe(alloc.dataPtr);
    loader.release(alloc.ptr, true);
  });

  it('Int32 header byteLength is n<<2 with [buf,buf,nbytes]', () => {
    loader.clearPool();
    const n = 11;
    const alloc = loader.allocateInt32ArrayEmpty(n);
    const module = loader.getModule()!;
    const h = readHeaderWords(module.memory.buffer, alloc.ptr);
    expect(h.byteLength).toBe(n << 2);
    expect(h.word0).toBe(alloc.dataPtr);
    expect(h.word1).toBe(alloc.dataPtr);
    loader.release(alloc.ptr, false);
  });

  it('second same-size alloc reuses dataPtr after release; larger length does not reuse a short block', () => {
    loader.clearPool();
    const small = loader.allocateFloat64ArrayEmpty(4);
    const smallDataPtr = small.dataPtr;
    loader.release(small.ptr, true);

    const again = loader.allocateFloat64ArrayEmpty(4);
    expect(again.dataPtr).toBe(smallDataPtr);

    const larger = loader.allocateFloat64ArrayEmpty(8);
    expect(larger.dataPtr).not.toBe(smallDataPtr);

    loader.release(again.ptr, true);
    loader.release(larger.ptr, true);
  });

  it('recycle of a larger-enough block rewrites header byteLength to the request', () => {
    loader.clearPool();
    const big = loader.allocateFloat64ArrayEmpty(8);
    const module = loader.getModule()!;
    expect(readHeaderWords(module.memory.buffer, big.ptr).byteLength).toBe(8 << 3);
    loader.release(big.ptr, true);
    // 4 f64s = 32 bytes; the 64-byte block is within the 2x waste bound.
    const small = loader.allocateFloat64ArrayEmpty(4);
    expect(small.dataPtr).toBe(big.dataPtr);
    expect(readHeaderWords(module.memory.buffer, small.ptr).byteLength).toBe(4 << 3);
    loader.release(small.ptr, true);
  });

  it('fresh block is the requested length and is not tracked above the 1 MiB pool cap', () => {
    loader.clearPool();
    const n = (2 * 1024 * 1024) / 8; // 2 MiB > 1 MiB cap
    const first = loader.allocateFloat64ArrayEmpty(n);
    expect(first.length).toBe(n);
    expect(loader.getPoolStats().float64.total).toBe(0);
    const firstDataPtr = first.dataPtr;
    loader.release(first.ptr, true);
    const second = loader.allocateFloat64ArrayEmpty(n);
    expect(second.dataPtr).not.toBe(firstDataPtr);
    loader.release(second.ptr, true);
  });
});

describe('S2R batch4 — WASMBackend AS headers (G54 oracle)', () => {
  let backend: ReturnType<typeof createWASMBackend>;

  beforeAll(async () => {
    backend = createWASMBackend({ wasmPath: asWasmPath, minElements: 1 });
    await backend.initialize();
  });

  it('pooled f64 and fresh i32 headers match n<<3 / n<<2 layout', () => {
    type BackendPriv = {
      wasmModule: {
        memory: WebAssembly.Memory;
      };
      allocCache: {
        acquire: (
          m: unknown,
          len: number
        ) => { headerPtr: number; bufferPtr: number; length: number };
        release: (alloc: { headerPtr: number; bufferPtr: number; length: number }) => void;
      };
      int32Cache: {
        acquire: (
          m: unknown,
          len: number
        ) => { headerPtr: number; bufferPtr: number; length: number };
        release: (alloc: { headerPtr: number; bufferPtr: number; length: number }) => void;
      };
    };
    const priv = backend as unknown as BackendPriv;
    const mod = priv.wasmModule;
    expect(mod).toBeTruthy();

    const nF = 6;
    const f64 = priv.allocCache.acquire(mod, nF);
    const hf = readHeaderWords(mod.memory.buffer, f64.headerPtr);
    expect(hf.byteLength).toBe(nF << 3);
    expect(hf.word0).toBe(f64.bufferPtr);
    expect(hf.word1).toBe(f64.bufferPtr);

    const nI = 5;
    const i32 = priv.int32Cache.acquire(mod, nI);
    const hi = readHeaderWords(mod.memory.buffer, i32.headerPtr);
    expect(hi.byteLength).toBe(nI << 2);
    expect(hi.word0).toBe(i32.bufferPtr);
    expect(hi.word1).toBe(i32.bufferPtr);

    priv.allocCache.release(f64);
    priv.int32Cache.release(i32);
  });
});

vi.mock('@danielsimonjr/mathts-parallel', () => ({
  computePool: {
    initialize: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockImplementation(async (a: Float64Array, b: Float64Array) => {
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) result[i] = a[i] + b[i];
      return { result, timeMs: 0 };
    }),
    subtract: vi.fn().mockImplementation(async (a: Float64Array, b: Float64Array) => {
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) result[i] = a[i] - b[i];
      return { result, timeMs: 0 };
    }),
    multiply: vi.fn().mockImplementation(async (a: Float64Array, b: Float64Array) => {
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) result[i] = a[i] * b[i];
      return { result, timeMs: 0 };
    }),
    divide: vi.fn().mockImplementation(async (a: Float64Array, b: Float64Array) => {
      const result = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) result[i] = a[i] / b[i];
      return { result, timeMs: 0 };
    }),
  },
}));

const { parallelMatrixAdd, parallelMatrixSubtract, parallelDotMultiply, parallelMatrixDivide } =
  await import('../src/parallel-matrix.js');

describe('S2R batch4 — dense pair ops (G59/G60 oracle)', () => {
  it('2×2 add and subtract match hand sums', async () => {
    const a = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    const b = DenseMatrix.fromArray([
      [10, 20],
      [30, 40],
    ]);
    const sum = (await parallelMatrixAdd(a, b)) as DenseMatrix;
    expect(sum.toFlatArray()).toEqual([11, 22, 33, 44]);
    const diff = (await parallelMatrixSubtract(a, b)) as DenseMatrix;
    expect(diff.toFlatArray()).toEqual([-9, -18, -27, -36]);
  });

  it('add/sub dimension mismatch includes both shapes', async () => {
    const m1 = DenseMatrix.fromArray([[1, 2]]);
    const m2 = DenseMatrix.fromArray([[1], [2]]);
    await expect(parallelMatrixAdd(m1, m2)).rejects.toThrow(
      'Matrix dimensions must match: 1×2 vs 2×1'
    );
    await expect(parallelMatrixSubtract(m1, m2)).rejects.toThrow(
      'Matrix dimensions must match: 1×2 vs 2×1'
    );
  });

  it('hadamard and divide on 1×2 match hand product/quotient', async () => {
    const a = DenseMatrix.fromArray([[2, 4]]);
    const b = DenseMatrix.fromArray([[2, 2]]);
    const prod = (await parallelDotMultiply(a, b)) as DenseMatrix;
    expect(prod.toFlatArray()).toEqual([4, 8]);
    const quot = (await parallelMatrixDivide(a, b)) as DenseMatrix;
    expect(quot.toFlatArray()).toEqual([1, 2]);
  });

  it('multiply/divide mismatch messages stay element-wise specific (no shapes)', async () => {
    const m1 = DenseMatrix.fromArray([[1, 2]]);
    const m2 = DenseMatrix.fromArray([[1], [2]]);
    await expect(parallelDotMultiply(m1, m2)).rejects.toThrow(
      'Matrix dimensions must match for element-wise multiply'
    );
    await expect(parallelMatrixDivide(m1, m2)).rejects.toThrow(
      'Matrix dimensions must match for element-wise divide'
    );
  });
});
