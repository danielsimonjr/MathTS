/**
 * Tests for the live AssemblyScript paths of matrix/src/backends/WASMBackend.ts.
 *
 * The existing wasm/operations.test.ts and wasm/decompositions-as.test.ts call
 * createWASMBackend().initialize(), which resolves the artifact at
 * lib/wasm/mathts-as.wasm — absent here — so the module silently falls back to
 * JS and the WASM-export bodies never run. This file instead passes an explicit
 * wasmPath to the freshly built AS artifact (assembly/build/mathts.wasm) so the
 * managed-runtime allocation cache, the matrix/array kernels, and the
 * decomposition kernels all execute against real WASM. Every kernel is
 * cross-checked against the JSBackend / known mathematical identities.
 *
 * Guarded on the artifact existing so the suite degrades to a no-op without it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { jsBackend } from '../../src/backends/JSBackend.js';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../../assembly/build/mathts.wasm');
const asAvailable = fs.existsSync(asWasmPath);

function rand(rows: number, cols: number): DenseMatrix {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) row.push(Math.random() * 10 - 5);
    data.push(row);
  }
  return new DenseMatrix(rows, cols, data);
}

function expectClose(a: DenseMatrix, b: DenseMatrix, digits = 7): void {
  expect(a.rows).toBe(b.rows);
  expect(a.cols).toBe(b.cols);
  for (let i = 0; i < a.rows; i++)
    for (let j = 0; j < a.cols; j++) expect(a.get(i, j)).toBeCloseTo(b.get(i, j), digits);
}

describe('WASMBackend — live AS kernels', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    // minElements: 0 forces the WASM path for every size once the module loads.
    wasm = createWASMBackend({ minElements: 0, wasmPath: asAvailable ? asWasmPath : '' });
    if (asAvailable) await wasm.initialize();
  });

  it.runIf(asAvailable)('loads the AS module and reports features', () => {
    expect(wasm.getFeatures()).not.toBeNull();
    expect(wasm.getConfig().minElements).toBe(0);
  });

  it.runIf(asAvailable)('add matches the JS backend', () => {
    const a = rand(8, 8);
    const b = rand(8, 8);
    expectClose(wasm.add(a, b), jsBackend.add(a, b));
  });

  it.runIf(asAvailable)('subtract matches the JS backend', () => {
    const a = rand(8, 8);
    const b = rand(8, 8);
    expectClose(wasm.subtract(a, b), jsBackend.subtract(a, b));
  });

  it.runIf(asAvailable)('multiplyElementwise matches the JS backend', () => {
    const a = rand(6, 6);
    const b = rand(6, 6);
    expectClose(wasm.multiplyElementwise(a, b), jsBackend.multiplyElementwise(a, b));
  });

  it.runIf(asAvailable)('divideElementwise matches the JS backend', () => {
    const a = rand(6, 6);
    const b = new DenseMatrix(
      6,
      6,
      Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => Math.random() + 1))
    );
    expectClose(wasm.divideElementwise(a, b), jsBackend.divideElementwise(a, b));
  });

  it.runIf(asAvailable)('scale matches the JS backend', () => {
    const a = rand(8, 8);
    expectClose(wasm.scale(a, 2.5), jsBackend.scale(a, 2.5));
  });

  it.runIf(asAvailable)('abs matches the JS backend', () => {
    const a = rand(8, 8);
    expectClose(wasm.abs(a), jsBackend.abs(a));
  });

  it.runIf(asAvailable)('negate matches the JS backend', () => {
    const a = rand(8, 8);
    expectClose(wasm.negate(a), jsBackend.negate(a));
  });

  it.runIf(asAvailable)('multiply matches the JS backend', () => {
    const a = rand(6, 5);
    const b = rand(5, 7);
    expectClose(wasm.multiply(a, b), jsBackend.multiply(a, b));
  });

  it.runIf(asAvailable)('transpose matches the JS backend', () => {
    const a = rand(4, 7);
    expectClose(wasm.transpose(a), jsBackend.transpose(a));
  });

  it.runIf(asAvailable)('sum / norm / dot match the JS backend', () => {
    const a = rand(8, 8);
    expect(wasm.sum(a)).toBeCloseTo(jsBackend.sum(a) as number, 6);
    expect(wasm.norm(a)).toBeCloseTo(jsBackend.norm(a), 6);
    const v1 = rand(1, 16);
    const v2 = rand(1, 16);
    expect(wasm.dot(v1, v2)).toBeCloseTo(jsBackend.dot(v1, v2) as number, 6);
  });

  it.runIf(asAvailable)('sumAxis delegates to the JS backend', () => {
    const a = rand(5, 6);
    expectClose(wasm.sumAxis(a, 0), jsBackend.sumAxis(a, 0));
    expectClose(wasm.sumAxis(a, 1), jsBackend.sumAxis(a, 1));
  });

  it.runIf(asAvailable)('reuses pooled allocations across repeated ops (no OOM)', () => {
    // Repeated same-size ops drive the AsAllocCache acquire/release reuse path.
    const a = rand(8, 8);
    const b = rand(8, 8);
    for (let i = 0; i < 50; i++) wasm.add(a, b);
    expectClose(wasm.add(a, b), jsBackend.add(a, b));
  });
});

describe('WASMBackend — live AS decompositions', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    wasm = createWASMBackend({ minElements: 0, wasmPath: asAvailable ? asWasmPath : '' });
    if (asAvailable) await wasm.initialize();
  });

  it.runIf(asAvailable)('LU decomposition reconstructs P·A via L·U', async () => {
    const A = new DenseMatrix(3, 3, [
      [4, 3, 2],
      [2, 1, 3],
      [3, 2, 5],
    ]);
    const { lu, perm, singular } = await wasm.luDecomposition(A);
    expect(singular).toBe(false);
    expect(perm.length).toBe(3);
    // Split combined LU into L (unit lower) and U (upper) and verify L·U == P·A.
    const n = 3;
    const d = lu.toFloat64Array();
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const U: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i > j) L[i][j] = d[i * n + j];
        else U[i][j] = d[i * n + j];
        if (i === j) L[i][j] = 1;
      }
    const PA: number[][] = [];
    for (let i = 0; i < n; i++) PA.push(A.toArray()[perm[i]]);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += L[i][k] * U[k][j];
        expect(s).toBeCloseTo(PA[i][j], 6);
      }
  });

  it.runIf(asAvailable)('LU flags a singular matrix', async () => {
    const A = new DenseMatrix(2, 2, [
      [1, 2],
      [2, 4],
    ]);
    const { singular } = await wasm.luDecomposition(A);
    expect(singular).toBe(true);
  });

  it.runIf(asAvailable)('QR decomposition reconstructs A via Qᵀ·R (tall, m >= n)', async () => {
    // The backend documents `q` as Qᵀ (transforms accumulate as Qᵀ), so the
    // reconstruction identity is A = Qᵀ·R for both the WASM and JS paths.
    const A = new DenseMatrix(4, 3, [
      [1, 2, 0],
      [0, 1, 1],
      [1, 0, 1],
      [2, 1, 0],
    ]);
    const { q, r } = await wasm.qrDecomposition(A);
    expectClose(q.transpose().multiply(r), A, 5);
  });

  it.runIf(asAvailable)('QR falls back to JS for a wide matrix (m < n)', async () => {
    // The JS Householder fallback returns Q = Hₖ…H₁ and R = Hₖ…H₁·A, so the
    // reconstruction identity is A = Qᵀ·R (Q is orthogonal ⇒ Q⁻¹ = Qᵀ).
    const A = new DenseMatrix(2, 4, [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { q, r } = await wasm.qrDecomposition(A);
    expectClose(q.transpose().multiply(r), A, 5);
  });

  it.runIf(asAvailable)('inverse satisfies A·A⁻¹ = I', async () => {
    const A = new DenseMatrix(3, 3, [
      [2, 0, 1],
      [1, 3, 2],
      [0, 1, 1],
    ]);
    const { inverse, singular } = await wasm.inverse(A);
    expect(singular).toBe(false);
    const I = A.multiply(inverse);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(I.get(i, j)).toBeCloseTo(i === j ? 1 : 0, 6);
  });

  it.runIf(asAvailable)('inverse flags a singular matrix', async () => {
    const A = new DenseMatrix(2, 2, [
      [1, 1],
      [1, 1],
    ]);
    const { singular } = await wasm.inverse(A);
    expect(singular).toBe(true);
  });

  it.runIf(asAvailable)('determinant matches the cofactor value', async () => {
    const A = new DenseMatrix(3, 3, [
      [6, 1, 1],
      [4, -2, 5],
      [2, 8, 7],
    ]);
    const det = await wasm.determinantWasm(A);
    expect(det).toBeCloseTo(-306, 4);
  });

  it.runIf(asAvailable)('Cholesky reconstructs an SPD matrix as L·Lᵀ', async () => {
    const A = new DenseMatrix(3, 3, [
      [4, 2, -2],
      [2, 10, 2],
      [-2, 2, 5],
    ]);
    const { l, positiveDefinite } = await wasm.choleskyDecomposition(A);
    expect(positiveDefinite).toBe(true);
    const LLt = l.multiply(l.transpose());
    expectClose(LLt, A, 5);
  });

  it.runIf(asAvailable)('Cholesky flags a non-positive-definite matrix', async () => {
    const A = new DenseMatrix(2, 2, [
      [1, 2],
      [2, 1],
    ]);
    const { positiveDefinite } = await wasm.choleskyDecomposition(A);
    expect(positiveDefinite).toBe(false);
  });
});

describe('WASMBackend — JS fallback paths (no module / sub-threshold)', () => {
  it('falls back to JS for every op when the module is not loaded', () => {
    // No initialize() → wasmModule stays null → shouldUseWasm() is false.
    const backend = new WASMBackend({ minElements: 0 });
    const a = rand(3, 3);
    const b = rand(3, 3);
    expectClose(backend.add(a, b), jsBackend.add(a, b));
    expectClose(backend.subtract(a, b), jsBackend.subtract(a, b));
    expectClose(backend.multiply(a, b), jsBackend.multiply(a, b));
    expectClose(backend.transpose(a), jsBackend.transpose(a));
    expect(backend.sum(a)).toBeCloseTo(jsBackend.sum(a) as number, 9);
    expect(backend.norm(a)).toBeCloseTo(jsBackend.norm(a), 9);
  });

  it('falls back to JS decompositions when the module is not loaded', async () => {
    const backend = new WASMBackend();
    const A = new DenseMatrix(3, 3, [
      [4, 3, 2],
      [2, 1, 3],
      [3, 2, 5],
    ]);
    const lu = await backend.luDecomposition(A);
    expect(lu.singular).toBe(false);
    const qr = await backend.qrDecomposition(A);
    // JS Householder fallback convention: A = Qᵀ·R.
    expectClose(qr.q.transpose().multiply(qr.r), A, 5);
    const inv = await backend.inverse(A);
    expect(inv.singular).toBe(false);
    const det = await backend.determinantWasm(A);
    expect(Number.isFinite(det)).toBe(true);
    const spd = new DenseMatrix(2, 2, [
      [2, 0],
      [0, 3],
    ]);
    const chol = await backend.choleskyDecomposition(spd);
    expect(chol.positiveDefinite).toBe(true);
  });

  it('throws on non-square decomposition inputs', async () => {
    const backend = new WASMBackend();
    const wide = new DenseMatrix(2, 3, [
      [1, 2, 3],
      [4, 5, 6],
    ]);
    await expect(backend.luDecomposition(wide)).rejects.toThrow('square');
    await expect(backend.inverse(wide)).rejects.toThrow('square');
    await expect(backend.determinantWasm(wide)).rejects.toThrow('square');
    await expect(backend.choleskyDecomposition(wide)).rejects.toThrow('square');
  });

  it('updateConfig / getConfig round-trips', () => {
    const backend = new WASMBackend();
    backend.updateConfig({ minElements: 42 });
    expect(backend.getConfig().minElements).toBe(42);
  });

  it('isAvailable reflects WebAssembly support', () => {
    expect(new WASMBackend().isAvailable()).toBe(typeof WebAssembly !== 'undefined');
  });
});
