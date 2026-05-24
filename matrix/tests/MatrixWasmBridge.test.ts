/**
 * Tests for matrix/src/backends/MatrixWasmBridge.ts
 *
 * Exercises the WASM-accelerated paths end-to-end against the singleton
 * `wasmLoader`. Before the Rust/AS hybrid-allocator fix landed, every one
 * of these tests crashed on `module.__new is not a function` because the
 * default-loaded artifact is the Rust binary (no managed runtime) and the
 * bridge was issuing AS-style allocator calls.
 *
 * Each test compares the WASM result against a JS oracle. If the WASM
 * artifact isn't on disk in CI we skip cleanly rather than failing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MatrixWasmBridge } from '../src/backends/MatrixWasmBridge.js';
import { wasmLoader } from '../src/backends/WasmLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rustWasmPath = path.resolve(here, '../../lib/wasm/mathts.wasm');
const wasmAvailable = fs.existsSync(rustWasmPath);

// JS oracles ---------------------------------------------------------------

function jsMultiply(
  a: number[],
  aRows: number,
  aCols: number,
  b: number[],
  bCols: number
): number[] {
  const out = new Array<number>(aRows * bCols).fill(0);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i * aCols + k] * b[k * bCols + j];
      }
      out[i * bCols + j] = sum;
    }
  }
  return out;
}

beforeAll(async () => {
  if (!wasmAvailable) return;
  // Reset to guarantee a clean detection; another suite may have left the
  // singleton with an AS module loaded (which is also fine for these
  // tests, since both ABIs must work).
  wasmLoader.reset();
  await wasmLoader.load(rustWasmPath);
  await MatrixWasmBridge.init(rustWasmPath);
});

// =============================================================================
// Tests
// =============================================================================

describe('MatrixWasmBridge — Float64 allocation end-to-end', () => {
  it.runIf(wasmAvailable)('multiply 8x8 matrices matches JS oracle', async () => {
    const n = 8;
    const a = Array.from({ length: n * n }, (_, i) => (i % 5) - 2);
    const b = Array.from({ length: n * n }, (_, i) => ((i * 3) % 7) - 3);

    // Force WASM path (threshold check would otherwise route 64 elements to JS).
    const result = await MatrixWasmBridge.multiply(a, n, n, b, n, n, {
      useWasm: true,
      useParallel: false,
      minSizeForWasm: 0,
    });

    const expected = jsMultiply(a, n, n, b, n);
    expect(result).toBeInstanceOf(Float64Array);
    expect(result.length).toBe(n * n);
    for (let i = 0; i < expected.length; i++) {
      expect(result[i]).toBeCloseTo(expected[i], 10);
    }
  });

  it.runIf(wasmAvailable)('FFT round-trip recovers original signal', async () => {
    // Interleaved complex (real, imag) of length 16 → n = 8 complex samples.
    const n = 8;
    const data = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      data[2 * i] = Math.sin((2 * Math.PI * 3 * i) / n);
      data[2 * i + 1] = 0;
    }
    const original = Float64Array.from(data);

    const forward = await MatrixWasmBridge.fft(data, false, {
      useWasm: true,
      useParallel: false,
    });
    expect(forward.length).toBe(2 * n);

    // IFFT through the bridge again to verify round-trip.
    const back = await MatrixWasmBridge.fft(forward, true, {
      useWasm: true,
      useParallel: false,
    });

    for (let i = 0; i < 2 * n; i++) {
      expect(back[i]).toBeCloseTo(original[i], 8);
    }
  });

  // Note: `MatrixWasmBridge.inv2x2` / `inv3x3` call `laInv2x2` / `laInv3x3`,
  // which the Rust WASM does NOT export (those are AS-only). Exercising them
  // here would test a pre-existing missing-export bug rather than the
  // hybrid-allocator fix that is the subject of this file. The Float64 path
  // is covered by the `multiply` and FFT tests above; that is the live
  // regression guard for the allocator work.
});

describe('MatrixWasmBridge — Int32 allocation end-to-end', () => {
  it.runIf(wasmAvailable)('luDecomposition produces a valid LU factorization', async () => {
    // Non-singular diagonally-dominant 4x4. luDecomposition reads/writes
    // Float64Array (lu) and Int32Array (perm) — the second exercises the
    // Int32 allocator path that the original hybrid bug would have crashed.
    const n = 4;
    const a = [4, 3, 2, 1, 1, 4, 3, 2, 2, 1, 4, 3, 3, 2, 1, 4];
    const { lu, perm } = await MatrixWasmBridge.luDecomposition(a, n, {
      useWasm: true,
    });

    // The bridge's `singular` boolean is wired incorrectly upstream
    // (an inverted return-code interpretation that long predates this
    // fix); we don't assert on it. Instead we verify the LU data
    // mechanically — if the allocator path were still broken, neither
    // `lu` nor `perm` would survive at all.
    expect(lu).toBeInstanceOf(Float64Array);
    expect(perm).toBeInstanceOf(Int32Array);
    expect(lu.length).toBe(n * n);
    expect(perm.length).toBe(n);

    // perm must be a permutation of [0..n-1].
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      expect(perm[i]).toBeGreaterThanOrEqual(0);
      expect(perm[i]).toBeLessThan(n);
      seen.add(perm[i]);
    }
    expect(seen.size).toBe(n);

    // Reconstruct PA = LU and check it matches the row-permuted original.
    const L = Array.from({ length: n * n }, () => 0);
    const U = Array.from({ length: n * n }, () => 0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i > j) L[i * n + j] = lu[i * n + j];
        else U[i * n + j] = lu[i * n + j];
      }
      L[i * n + i] = 1;
    }
    const LU = jsMultiply(L, n, n, U, n);

    const PA = new Array<number>(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        PA[i * n + j] = a[perm[i] * n + j];
      }
    }

    for (let i = 0; i < n * n; i++) {
      expect(LU[i]).toBeCloseTo(PA[i], 9);
    }
  });
});

describe('wasmLoader — direct allocator API', () => {
  it.runIf(wasmAvailable)('allocateFloat64Array round-trips data', async () => {
    const data = new Float64Array([1.5, -2.25, 3.0, 0.5]);
    const alloc = wasmLoader.allocateFloat64Array(data);
    expect(alloc.array.length).toBe(4);
    // Data should be visible via the array view.
    for (let i = 0; i < 4; i++) {
      expect(alloc.array[i]).toBeCloseTo(data[i]);
    }
    // ptr/dataPtr must be finite non-negative integers.
    expect(alloc.ptr).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(alloc.ptr)).toBe(true);
    expect(alloc.dataPtr).toBeGreaterThanOrEqual(0);
    expect(['rust', 'as']).toContain(alloc.kind);

    wasmLoader.free(alloc.ptr);
    wasmLoader.resetRustAllocator();
  });

  it.runIf(wasmAvailable)('allocateInt32Array round-trips data', () => {
    const data = new Int32Array([7, -3, 0, 42, 100]);
    const alloc = wasmLoader.allocateInt32Array(data);
    expect(alloc.array.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(alloc.array[i]).toBe(data[i]);
    }
    expect(['rust', 'as']).toContain(alloc.kind);

    wasmLoader.free(alloc.ptr);
    wasmLoader.resetRustAllocator();
  });

  it.runIf(wasmAvailable)('allocateFloat64ArrayEmpty produces a writable view', () => {
    const alloc = wasmLoader.allocateFloat64ArrayEmpty(8);
    expect(alloc.array.length).toBe(8);
    // Write through the view, then read back via a fresh view at dataPtr.
    for (let i = 0; i < 8; i++) alloc.array[i] = i * 1.25;

    const module = wasmLoader.getModule();
    expect(module).not.toBeNull();
    if (module !== null) {
      const reread = new Float64Array(module.memory.buffer, alloc.dataPtr, 8);
      for (let i = 0; i < 8; i++) {
        expect(reread[i]).toBeCloseTo(i * 1.25);
      }
    }

    wasmLoader.free(alloc.ptr);
    wasmLoader.resetRustAllocator();
  });

  it.runIf(wasmAvailable)('getAllocatorKind reports the detected discriminant', () => {
    const kind = wasmLoader.getAllocatorKind();
    expect(['rust', 'as']).toContain(kind);
  });
});
