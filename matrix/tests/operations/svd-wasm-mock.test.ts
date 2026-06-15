/**
 * Tests for the WASM-dispatch branch of matrix/src/operations/svd-wasm.ts.
 *
 * The Rust WASM artifact (lib/wasm/mathts.wasm) is not built in this
 * environment, so the real RustWasmLoader.load() returns false and svdWasm
 * takes the JS fallback (covered by svd-wasm.test.ts). To exercise the
 * WASM-dispatch path (loader.load → getExports → marshalling → status check →
 * read-back), we inject a fake loader whose `svd` export computes a genuine
 * thin SVD (delegating to the JS svd) and writes it into a JS-backed "linear
 * memory". This drives the otherwise-unreachable WASM branch and asserts the
 * marshalled result is mathematically correct (A = U·S·Vᵀ).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { RustWasmLoader } from '../../src/backends/RustWasmLoader.js';
import { svd } from '../../src/operations/svd.js';

/**
 * A fake Rust WASM loader backed by a ptr→Float64Array store. `svd` computes
 * the thin SVD via the JS implementation and copies the factors into the
 * caller-provided output pointers, mimicking the real Rust export's contract.
 */
function makeFakeLoader(opts: { failStatus?: boolean; throwInSvd?: boolean } = {}) {
  const store = new Map<number, Float64Array>();
  let nextPtr = 1;

  return {
    isLoaded: false,
    load: vi.fn(async () => true),
    resetAllocator: vi.fn(),
    writeF64: vi.fn((data: Float64Array) => {
      const ptr = nextPtr++;
      store.set(ptr, new Float64Array(data));
      return ptr;
    }),
    allocF64: vi.fn((len: number) => {
      const ptr = nextPtr++;
      store.set(ptr, new Float64Array(len));
      return ptr;
    }),
    readF64: vi.fn((ptr: number, len: number) => {
      const arr = store.get(ptr)!;
      return new Float64Array(arr.subarray(0, len));
    }),
    getExports: vi.fn(() => ({
      svdWorkSize: (_m: number, _n: number) => 16,
      svd: (
        aPtr: number,
        m: number,
        n: number,
        uPtr: number,
        sPtr: number,
        vPtr: number,
        _workPtr: number
      ): number => {
        if (opts.throwInSvd) throw new Error('marshalling failure');
        if (opts.failStatus) return -1;
        const flat = store.get(aPtr)!;
        const A: number[][] = [];
        for (let i = 0; i < m; i++) {
          A.push(Array.from(flat.subarray(i * n, i * n + n)));
        }
        const k = Math.min(m, n);
        const full = svd(A);
        const uOut = store.get(uPtr)!;
        const sOut = store.get(sPtr)!;
        const vOut = store.get(vPtr)!;
        for (let i = 0; i < m; i++) for (let t = 0; t < k; t++) uOut[i * k + t] = full.U[i][t];
        for (let t = 0; t < k; t++) sOut[t] = full.S[t];
        for (let i = 0; i < n; i++) for (let t = 0; t < k; t++) vOut[i * k + t] = full.V[i][t];
        return 0;
      },
    })),
  };
}

function reconstruct(U: number[][], S: number[], V: number[][], m: number, n: number, k: number) {
  const out: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < k; t++) acc += U[i][t] * S[t] * V[j][t];
      row.push(acc);
    }
    out.push(row);
  }
  return out;
}

describe('svdWasm — WASM-dispatch branch (mocked loader)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drives the WASM path and reconstructs A = U·S·Vᵀ', async () => {
    const fake = makeFakeLoader();
    vi.spyOn(RustWasmLoader, 'getInstance').mockReturnValue(fake as never);
    // Re-import to pick up the spied loader inside svdWasm's module scope.
    const { svdWasm } = await import('../../src/operations/svd-wasm.js');

    const A = [
      [2, -1, 0],
      [4, 3, -2],
      [1, 1, 5],
      [0, 6, -3],
    ];
    const m = A.length;
    const n = A[0].length;
    const k = Math.min(m, n);
    const r = await svdWasm(A);

    expect(fake.getExports).toHaveBeenCalled();
    expect(fake.writeF64).toHaveBeenCalled();
    expect(r.U.length).toBe(m);
    expect(r.U[0].length).toBe(k);
    expect(r.S.length).toBe(k);
    expect(r.V.length).toBe(n);

    const recon = reconstruct(r.U, r.S, r.V, m, n, k);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) expect(recon[i][j]).toBeCloseTo(A[i][j], 6);
  });

  it('falls back to JS when the WASM svd returns a negative status', async () => {
    const fake = makeFakeLoader({ failStatus: true });
    vi.spyOn(RustWasmLoader, 'getInstance').mockReturnValue(fake as never);
    const { svdWasm } = await import('../../src/operations/svd-wasm.js');

    const A = [
      [3, 0],
      [0, 2],
    ];
    const r = await svdWasm(A);
    // JS fallback still yields a valid thin SVD.
    expect(r.S.length).toBe(2);
    expect(r.S[0]).toBeCloseTo(3, 6);
    expect(r.S[1]).toBeCloseTo(2, 6);
  });

  it('falls back to JS when the WASM svd throws during marshalling', async () => {
    const fake = makeFakeLoader({ throwInSvd: true });
    vi.spyOn(RustWasmLoader, 'getInstance').mockReturnValue(fake as never);
    const { svdWasm } = await import('../../src/operations/svd-wasm.js');

    const A = [
      [5, 0],
      [0, 4],
    ];
    const r = await svdWasm(A);
    expect(r.S[0]).toBeCloseTo(5, 6);
    expect(r.S[1]).toBeCloseTo(4, 6);
  });

  it('uses the already-loaded loader (isLoaded short-circuits load())', async () => {
    const fake = makeFakeLoader();
    fake.isLoaded = true;
    vi.spyOn(RustWasmLoader, 'getInstance').mockReturnValue(fake as never);
    const { svdWasm } = await import('../../src/operations/svd-wasm.js');

    await svdWasm([
      [1, 0],
      [0, 1],
    ]);
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.getExports).toHaveBeenCalled();
  });
});
