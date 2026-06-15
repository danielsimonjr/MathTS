/**
 * Tests for the WASM-dispatch branch of matrix/src/operations/eig-wasm.ts.
 *
 * The AssemblyScript artifact loaded by the matrix WasmLoader does not export
 * `eigsSymmetric`/`spectralRadius` (those live in the Rust crate, which is not
 * built here), and the WASM path only activates for SYMMETRIC matrices of size
 * >= 8. So in the normal environment eigWasm always takes the JS fallback.
 *
 * Here we inject a fake AS module (backed by a real WebAssembly.Memory) plus
 * spied allocator methods so the WASM branch executes end-to-end: allocate →
 * call export → re-read results from the (possibly grown) memory buffer → free.
 * The fake `eigsSymmetric` computes a genuine symmetric eigendecomposition via
 * the JS `eig`, so the marshalled answer is mathematically correct.
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
 * Install a fake AS WASM module and allocator on the shared wasmLoader.
 * Returns the memory + a ptr→{offset,length} table so the export reads/writes
 * the same backing store the loader hands out.
 */
function installFakeModule(opts: { failConverge?: boolean; throwInCall?: boolean } = {}) {
  const memory = new WebAssembly.Memory({ initial: 4 });
  let bump = 1024;
  const allocs = new Map<number, { offset: number; length: number }>();

  const allocateFloat64Array = vi.fn((data: number[] | Float64Array) => {
    const length = data.length;
    const offset = bump;
    bump += length * 8 + 8;
    const view = new Float64Array(memory.buffer, offset, length);
    view.set(data);
    allocs.set(offset, { offset, length });
    return { ptr: offset, dataPtr: offset, array: view, length, kind: 'as' as const };
  });
  const allocateFloat64ArrayEmpty = vi.fn((length: number) => {
    const offset = bump;
    bump += length * 8 + 8;
    allocs.set(offset, { offset, length });
    return {
      ptr: offset,
      dataPtr: offset,
      array: new Float64Array(memory.buffer, offset, length),
      length,
      kind: 'as' as const,
    };
  });

  const fakeModule = {
    memory,
    eigsSymmetric: (
      matrixPtr: number,
      n: number,
      _precision: number,
      eigenvaluesPtr: number,
      eigenvectorsPtr: number,
      _workPtr: number
    ): number => {
      if (opts.throwInCall) throw new Error('wasm trap');
      if (opts.failConverge) return -1;
      const flat = new Float64Array(memory.buffer, matrixPtr, n * n);
      const A: number[][] = [];
      for (let i = 0; i < n; i++) A.push(Array.from(flat.subarray(i * n, i * n + n)));
      const r = eig(A);
      const evals = new Float64Array(memory.buffer, eigenvaluesPtr, n);
      for (let i = 0; i < n; i++) evals[i] = r.values[i].re;
      if (eigenvectorsPtr !== 0) {
        const evecs = new Float64Array(memory.buffer, eigenvectorsPtr, n * n);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) evecs[i * n + j] = r.vectors[i]?.[j] ?? 0;
      }
      return 5; // iterations
    },
    spectralRadius: (
      matrixPtr: number,
      n: number,
      _workPtr: number,
      _maxIter: number,
      _tol: number
    ): number => {
      if (opts.throwInCall) throw new Error('wasm trap');
      const flat = new Float64Array(memory.buffer, matrixPtr, n * n);
      const A: number[][] = [];
      for (let i = 0; i < n; i++) A.push(Array.from(flat.subarray(i * n, i * n + n)));
      const r = eig(A);
      return Math.max(...r.values.map((v) => Math.abs(v.re)));
    },
  };

  vi.spyOn(wasmLoader, 'getModule').mockReturnValue(fakeModule as never);
  vi.spyOn(wasmLoader, 'allocateFloat64Array').mockImplementation(allocateFloat64Array as never);
  vi.spyOn(wasmLoader, 'allocateFloat64ArrayEmpty').mockImplementation(
    allocateFloat64ArrayEmpty as never
  );
  vi.spyOn(wasmLoader, 'free').mockImplementation(() => {});

  return { fakeModule, allocateFloat64Array, allocateFloat64ArrayEmpty };
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

  it('skips eigenvector marshalling when computeVectors=false (eigvalsWasm)', async () => {
    installFakeModule();
    const values = await eigvalsWasm(symmetric(8));
    expect(values).toHaveLength(8);
  });

  it('falls back to JS when the WASM call reports non-convergence (status < 0)', async () => {
    installFakeModule({ failConverge: true });
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
