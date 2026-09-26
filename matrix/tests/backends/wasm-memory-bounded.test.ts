/**
 * Repeated WASM decompositions keep the module's linear memory bounded.
 *
 * The AS binary uses the stub runtime, which never frees, and `__unpin` does nothing
 * under it. The input and output buffers are pooled (`AsAllocCache`), but the kernels
 * allocated their own scratch on every call, and LU's permutation buffer was not pooled:
 * 300 LU calls on a 64x64 matrix grew memory by 16 MiB (inverse 0.9 MiB, QR 0.4 MiB,
 * determinant 0.1 MiB). The kernels now work in caller-provided buffers.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { WASMBackend } from '../../src/backends/WASMBackend.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(fs.existsSync(asWasmPath), `build the AS binary: ${asWasmPath}`).toBe(true);
});

describe('WASM decompositions do not grow memory per call', () => {
  const n = 64;
  const rows: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? n + 1 : ((i * 7 + j * 3) % 11) / 11))
  );
  const a = DenseMatrix.fromArray(rows);
  const spd = DenseMatrix.fromArray(rows.map((r, i) => r.map((_v, j) => (i === j ? 2 * n : 0.5))));
  const ops: Array<[string, (b: WASMBackend) => unknown]> = [
    ['luDecomposition', (b) => b.luDecomposition(a)],
    ['qrDecomposition', (b) => b.qrDecomposition(a)],
    ['inverse', (b) => b.inverse(a)],
    ['determinantWasm', (b) => b.determinantWasm(a)],
    ['choleskyDecomposition', (b) => b.choleskyDecomposition(spd)],
    ['multiply', (b) => b.multiply(a, a)],
  ];

  for (const [name, op] of ops) {
    it(`${name}: no growth over 3,000 calls`, async () => {
      const backend = new WASMBackend();
      await backend.initialize();
      const mod = (backend as unknown as { wasmModule: { memory: WebAssembly.Memory } | null })
        .wasmModule;
      expect(mod, 'the AS module loaded').not.toBeNull();
      for (let i = 0; i < 5; i++) await op(backend); // let the pools fill
      const before = mod!.memory.buffer.byteLength;
      for (let i = 0; i < 3000; i++) await op(backend);
      expect(mod!.memory.buffer.byteLength - before).toBe(0);
    }, 120_000);
  }

  it('results are unchanged by the in-place kernels', async () => {
    const backend = new WASMBackend();
    await backend.initialize();
    const inv = await backend.inverse(a);
    expect(inv.singular).toBe(false);
    const identity = backend.multiply(a, inv.inverse);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) expect(identity.get(i, j)).toBeCloseTo(i === j ? 1 : 0, 10);
    }
    const lu = await backend.luDecomposition(a);
    expect(lu.singular).toBe(false);
    const qr = await backend.qrDecomposition(a);
    // A = Q^T R (the package's convention)
    const qtr = backend.multiply(backend.transpose(qr.q), qr.r);
    for (let i = 0; i < n; i += 7) {
      for (let j = 0; j < n; j += 5) expect(qtr.get(i, j)).toBeCloseTo(a.get(i, j), 9);
    }
    const det = await backend.determinantWasm(a);
    expect(Number.isFinite(det) && det !== 0).toBe(true);
  });
});
