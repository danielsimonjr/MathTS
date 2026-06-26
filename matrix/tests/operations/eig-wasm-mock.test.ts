/**
 * Tests for the WASM-dispatch branch of matrix/src/operations/eig-wasm.ts.
 *
 * In an environment without the AssemblyScript binary the matrix WasmLoader's
 * getModule() is null and the WASM path only activates for SYMMETRIC matrices
 * of size >= 8, so eigWasm normally takes the JS fallback. Here we install a
 * fake AS module exposing `matrix_eig_symmetric` / `matrix_spectral_radius`
 * (the Phase 7b ABI: a single packed Float64Array return decoded via the
 * loader's `readReturnedFloat64Array`) so the WASM branch executes end-to-end:
 * allocate → call export → decode packed [eigenvalues | eigenvectors] → free.
 * The fake exports compute a genuine symmetric eigendecomposition via the JS
 * `eig`, so the marshalled answer is mathematically correct.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { wasmLoader } from '../../src/backends/WasmLoader.js';
import { eigWasm, eigvalsWasm, spectralRadiusWasm } from '../../src/operations/eig-wasm.js';
import { eig } from '../../src/operations/eig.js';

/** Build a symmetric n×n matrix (n>=8) with known structure. */
function symmetric(n: number): number[][] {
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    A[i][i] = i + 1;
    if (i + 1 < n) {
      A[i][i + 1] = 0.5;
      A[i + 1][i] = 0.5;
    }
  }
  return A;
}

/**
 * Install a fake AS WASM module + spied loader hooks. `matrix_eig_symmetric`
 * returns a sentinel ptr keyed to a packed [eigenvalues(n) | eigenvectors(n*n)]
 * Float64Array (eigenvectors as COLUMNS, matching the real AS kernel);
 * `readReturnedFloat64Array` looks it back up.
 */
function installFakeModule(opts: { throwInCall?: boolean; shortResult?: boolean } = {}) {
  const inputs = new Map<number, Float64Array>();
  const packedByPtr = new Map<number, Float64Array>();
  let nextPtr = 8;

  const allocateFloat64Array = vi.fn((data: number[] | Float64Array) => {
    const arr = data instanceof Float64Array ? new Float64Array(data) : new Float64Array(data);
    const ptr = nextPtr++;
    inputs.set(ptr, arr);
    return { ptr, dataPtr: ptr, array: arr, length: arr.length, kind: 'as' as const };
  });

  const packEig = (aPtr: number, n: number): number => {
    const flat = inputs.get(aPtr)!;
    const A: number[][] = [];
    for (let i = 0; i < n; i++) A.push(Array.from(flat.subarray(i * n, i * n + n)));
    const r = eig(A);
    const packed = new Float64Array(n + n * n);
    for (let j = 0; j < n; j++) {
      packed[j] = r.values[j].re;
      // Store eigenvector j as a COLUMN: component i at packed[n + i*n + j].
      for (let i = 0; i < n; i++) packed[n + i * n + j] = r.vectors[j]?.[i] ?? 0;
    }
    const ptr = nextPtr++;
    packedByPtr.set(ptr, opts.shortResult ? packed.subarray(0, 1) : packed);
    return ptr;
  };

  const fakeModule = {
    memory: new WebAssembly.Memory({ initial: 1 }),
    matrix_eig_symmetric: (aPtr: number, n: number): number => {
      if (opts.throwInCall) throw new Error('wasm trap');
      return packEig(aPtr, n);
    },
    matrix_spectral_radius: (aPtr: number, n: number): number => {
      if (opts.throwInCall) throw new Error('wasm trap');
      const flat = inputs.get(aPtr)!;
      const A: number[][] = [];
      for (let i = 0; i < n; i++) A.push(Array.from(flat.subarray(i * n, i * n + n)));
      const r = eig(A);
      return Math.max(...r.values.map((v) => Math.abs(v.re)));
    },
  };

  vi.spyOn(wasmLoader, 'getModule').mockReturnValue(fakeModule as never);
  vi.spyOn(wasmLoader, 'allocateFloat64Array').mockImplementation(allocateFloat64Array as never);
  vi.spyOn(wasmLoader, 'readReturnedFloat64Array').mockImplementation(
    ((ptr: number) => packedByPtr.get(ptr)!) as never
  );
  vi.spyOn(wasmLoader, 'free').mockImplementation(() => {});
  vi.spyOn(wasmLoader, 'resetRustAllocator').mockImplementation(() => {});

  return { fakeModule, allocateFloat64Array };
}

describe('eigWasm — WASM-dispatch branch (mocked AS module)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the WASM path for a symmetric 8×8 matrix and returns correct eigenvalues', async () => {
    const mocks = installFakeModule();
    const A = symmetric(8);
    const result = await eigWasm(A);

    expect(mocks.allocateFloat64Array).toHaveBeenCalled();
    expect(result.values).toHaveLength(8);
    expect(result.isSymmetric).toBe(true);
    // Sum of eigenvalues == trace.
    const trace = A.reduce((s, row, i) => s + row[i], 0);
    const sum = result.values.reduce((s, v) => s + v.re, 0);
    expect(sum).toBeCloseTo(trace, 4);
    // Eigenvectors were marshalled back (n×n).
    expect(result.vectors).toHaveLength(8);
    expect(result.vectors[0]).toHaveLength(8);
  });

  it('each (value, vector) pair satisfies A·v ≈ λ·v', async () => {
    installFakeModule();
    const A = symmetric(8);
    const { values, vectors } = await eigWasm(A);
    const n = A.length;
    for (let k = 0; k < n; k++) {
      const v = vectors[k];
      const lambda = values[k].re;
      for (let i = 0; i < n; i++) {
        let av = 0;
        for (let j = 0; j < n; j++) av += A[i][j] * v[j];
        const scale = Math.max(1, Math.abs(av), Math.abs(lambda * v[i]));
        expect(Math.abs(av - lambda * v[i]) / scale).toBeLessThan(1e-4);
      }
    }
  });

  it('skips eigenvector marshalling when computeVectors=false (eigvalsWasm)', async () => {
    installFakeModule();
    const values = await eigvalsWasm(symmetric(8));
    expect(values).toHaveLength(8);
  });

  it('falls back to JS when the packed result is malformed (too short)', async () => {
    installFakeModule({ shortResult: true });
    const A = symmetric(8);
    const result = await eigWasm(A);
    // JS fallback path still returns a full result.
    expect(result.values).toHaveLength(8);
  });

  it('falls back to JS when the WASM call throws', async () => {
    installFakeModule({ throwInCall: true });
    const result = await eigWasm(symmetric(8));
    expect(result.values).toHaveLength(8);
  });

  it('spectralRadiusWasm uses the WASM path for a symmetric 8×8 matrix', async () => {
    installFakeModule();
    const A = symmetric(8);
    const radius = await spectralRadiusWasm(A);
    const r = eig(A);
    const expected = Math.max(...r.values.map((v) => Math.abs(v.re)));
    expect(radius).toBeCloseTo(expected, 6);
  });

  it('spectralRadiusWasm falls back to JS power iteration when WASM throws', async () => {
    installFakeModule({ throwInCall: true });
    const radius = await spectralRadiusWasm(symmetric(8));
    expect(radius).toBeGreaterThan(0);
  });
});
