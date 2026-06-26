/**
 * Tests for the WASM-dispatch branch of matrix/src/operations/svd-wasm.ts.
 *
 * In an environment without the AssemblyScript binary, the real loader's
 * getModule() is null and svdWasm takes the JS fallback (covered by
 * svd-wasm.test.ts). To exercise the WASM-dispatch path (getModule probe →
 * matrix_svd presence check → marshalling → readReturnedFloat64Array →
 * factor reconstruction) deterministically, we install a fake AS module on
 * the shared wasmLoader whose `matrix_svd` export computes a genuine thin SVD
 * (delegating to the JS svd) and returns it via the loader's
 * `readReturnedFloat64Array` decode hook.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { wasmLoader } from '../../src/backends/WasmLoader.js';
import { svd } from '../../src/operations/svd.js';

/**
 * Install a fake AS module + spied loader hooks. `matrix_svd` packs the JS
 * thin SVD as [ U(m*k) | S(k) | V(n*k) ] keyed by a returned sentinel ptr;
 * `readReturnedFloat64Array` looks the packed result back up.
 */
function installFakeSvd(opts: { throwInSvd?: boolean; shortResult?: boolean } = {}) {
  const inputs = new Map<number, Float64Array>();
  const packedByPtr = new Map<number, Float64Array>();
  let nextPtr = 8;

  const allocateFloat64Array = vi.fn((data: number[] | Float64Array) => {
    const arr = data instanceof Float64Array ? new Float64Array(data) : new Float64Array(data);
    const ptr = nextPtr++;
    inputs.set(ptr, arr);
    return { ptr, dataPtr: ptr, array: arr, length: arr.length, kind: 'as' as const };
  });

  const fakeModule = {
    memory: new WebAssembly.Memory({ initial: 1 }),
    matrix_svd: (aPtr: number, m: number, n: number): number => {
      if (opts.throwInSvd) throw new Error('marshalling failure');
      const flat = inputs.get(aPtr)!;
      const A: number[][] = [];
      for (let i = 0; i < m; i++) A.push(Array.from(flat.subarray(i * n, i * n + n)));
      const k = Math.min(m, n);
      const full = svd(A);
      const packed = new Float64Array(m * k + k + n * k);
      for (let i = 0; i < m; i++) for (let t = 0; t < k; t++) packed[i * k + t] = full.U[i][t];
      for (let t = 0; t < k; t++) packed[m * k + t] = full.S[t];
      for (let i = 0; i < n; i++)
        for (let t = 0; t < k; t++) packed[m * k + k + i * k + t] = full.V[i][t];
      const ptr = nextPtr++;
      packedByPtr.set(ptr, opts.shortResult ? packed.subarray(0, 1) : packed);
      return ptr;
    },
  };

  vi.spyOn(wasmLoader, 'getModule').mockReturnValue(fakeModule as never);
  vi.spyOn(wasmLoader, 'allocateFloat64Array').mockImplementation(allocateFloat64Array as never);
  vi.spyOn(wasmLoader, 'readReturnedFloat64Array').mockImplementation(
    ((ptr: number) => packedByPtr.get(ptr)!) as never
  );
  vi.spyOn(wasmLoader, 'free').mockImplementation(() => {});

  return { fakeModule, allocateFloat64Array };
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

describe('svdWasm — WASM-dispatch branch (mocked AS module)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drives the WASM path and reconstructs A = U·S·Vᵀ', async () => {
    const mocks = installFakeSvd();
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

    expect(mocks.allocateFloat64Array).toHaveBeenCalled();
    expect(r.U.length).toBe(m);
    expect(r.U[0].length).toBe(k);
    expect(r.S.length).toBe(k);
    expect(r.V.length).toBe(n);

    const recon = reconstruct(r.U, r.S, r.V, m, n, k);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) expect(recon[i][j]).toBeCloseTo(A[i][j], 6);
  });

  it('falls back to JS when the WASM svd throws during marshalling', async () => {
    installFakeSvd({ throwInSvd: true });
    const { svdWasm } = await import('../../src/operations/svd-wasm.js');

    const A = [
      [5, 0],
      [0, 4],
    ];
    const r = await svdWasm(A);
    expect(r.S[0]).toBeCloseTo(5, 6);
    expect(r.S[1]).toBeCloseTo(4, 6);
  });

  it('falls back to JS when the WASM svd returns a truncated packed array', async () => {
    installFakeSvd({ shortResult: true });
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
});
