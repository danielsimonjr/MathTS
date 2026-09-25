/**
 * Tests for the live AssemblyScript paths of matrix/src/backends/WASMBackend.ts.
 *
 * Passes an explicit `wasmPath` to the co-located AS binary the backend ships —
 * `matrix/dist/wasm/mathts-as.wasm`, which the build guarantees (matrix's
 * copy-wasm step fails the build when it is missing) — so this suite does not
 * depend on path resolution. (Default resolution is covered by
 * wasm-resolve.test.ts and, end to end, by wasm/decompositions-as.test.ts.)
 *
 * What actually runs on WASM (2026-07 WASM audit — CLAUDE.md "Matrix Backends"):
 * matmul (`matrix_multiply_simd_ptr`) and the dense LU/QR/Cholesky/inverse/
 * determinant decompositions. Element-wise ops, transpose and reductions were
 * measured slower on WASM and delegate to `jsBackend` even with the module
 * loaded; their tests say so and assert that NO AS export is invoked.
 *
 * Every WASM-tier test counts calls to its AS export (a writable clone of the
 * backend's module, see `countAsCalls`) and requires it to be > 0 — a silent JS
 * fallback would produce the same numbers. Tests stay `it.skipIf(!asAvailable)`,
 * but a non-skipping presence test fails when the binary is missing, so absence
 * is a failure rather than a silent skip.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { jsBackend } from '../../src/backends/JSBackend.js';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');
const asAvailable = fs.existsSync(asWasmPath);

/** The backend's private module slot (the AS instance exports, or null). */
type ModuleSlot = { wasmModule: Record<string, unknown> | null };

/**
 * Run `body` while counting calls to the named exports of `backend`'s AS
 * module. WebAssembly export namespaces are frozen, so (like functions'
 * `countExportCalls`) this swaps in a writable shallow clone that carries every
 * export by reference and wraps just the counted names, restoring the real
 * module afterwards. With no module loaded the counts stay 0.
 */
async function countAsCalls<T>(
  backend: WASMBackend,
  names: string[],
  body: () => T | Promise<T>
): Promise<{ result: T; counts: Record<string, number> }> {
  const slot = backend as unknown as ModuleSlot;
  const real = slot.wasmModule;
  const counts: Record<string, number> = {};
  for (const n of names) counts[n] = 0;
  if (!real) return { result: await body(), counts };
  const clone: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(real)) {
    const value = real[key];
    if (names.includes(key) && typeof value === 'function') {
      const fn = value as (...a: unknown[]) => unknown;
      clone[key] = (...args: unknown[]) => {
        counts[key]++;
        return fn(...args);
      };
    } else {
      clone[key] = value;
    }
  }
  slot.wasmModule = clone;
  try {
    return { result: await body(), counts };
  } finally {
    slot.wasmModule = real;
  }
}

/**
 * Run `body` with every function export of the loaded AS module counted and
 * require that none was invoked — the op stays on JS by design. Requires the
 * module to be loaded, otherwise "no AS call" would hold vacuously.
 */
async function expectJsOnly<T>(backend: WASMBackend, body: () => T): Promise<T> {
  const mod = (backend as unknown as ModuleSlot).wasmModule;
  expect(mod, 'AS module loaded (otherwise this check is vacuous)').not.toBeNull();
  const names = mod
    ? Object.getOwnPropertyNames(mod).filter((k) => typeof mod[k] === 'function')
    : [];
  const { result, counts } = await countAsCalls(backend, names, body);
  expect(
    names.filter((n) => counts[n] > 0),
    'AS exports invoked'
  ).toEqual([]);
  return result;
}

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

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(
    asAvailable,
    `AS wasm binary not found at ${asWasmPath}. The build guarantees it — run \`bun run build\` from the repo root.`
  ).toBe(true);
});

describe('WASMBackend — live AS matmul kernel', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    // minElements: 0 forces the WASM matmul path for every size once the module loads.
    wasm = createWASMBackend({ minElements: 0, wasmPath: asAvailable ? asWasmPath : '' });
    if (asAvailable) await wasm.initialize();
  });

  it.skipIf(!asAvailable)('loads the AS module and reports features', () => {
    expect(wasm.getFeatures()).not.toBeNull();
    expect(wasm.getConfig().minElements).toBe(0);
    const mod = (wasm as unknown as ModuleSlot).wasmModule;
    expect(mod, 'AS module loaded (not the JS fallback)').not.toBeNull();
    expect(typeof mod?.matrix_multiply_simd_ptr).toBe('function');
    expect(typeof mod?.__new).toBe('function'); // AS managed runtime
  });

  it.skipIf(!asAvailable)(
    'multiply executes matrix_multiply_simd_ptr and matches the JS backend',
    async () => {
      const a = rand(6, 5);
      const b = rand(5, 7);
      const { result, counts } = await countAsCalls(wasm, ['matrix_multiply_simd_ptr'], () =>
        wasm.multiply(a, b)
      );
      expect(counts.matrix_multiply_simd_ptr).toBeGreaterThan(0);
      expectClose(result, jsBackend.multiply(a, b));
    }
  );

  it.skipIf(!asAvailable)(
    'reuses pooled allocations across repeated multiplies (no OOM)',
    async () => {
      // Repeated same-size matmuls drive the AsAllocCache acquire/release reuse
      // path. (This used to loop `add`, which runs on JS and never touches the
      // cache; matmul is the element-count-gated op that allocates through it.)
      const a = rand(8, 8);
      const b = rand(8, 8);
      const { result, counts } = await countAsCalls(wasm, ['matrix_multiply_simd_ptr'], () => {
        for (let i = 0; i < 50; i++) wasm.multiply(a, b);
        return wasm.multiply(a, b);
      });
      expect(counts.matrix_multiply_simd_ptr).toBe(51);
      expectClose(result, jsBackend.multiply(a, b));
    }
  );
});

describe('WASMBackend — AS module loaded: element-wise / transpose / reduction ops stay on JS by design', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    wasm = createWASMBackend({ minElements: 0, wasmPath: asAvailable ? asWasmPath : '' });
    if (asAvailable) await wasm.initialize();
  });

  it.skipIf(!asAvailable)('add stays on JS and matches the JS backend', async () => {
    const a = rand(8, 8);
    const b = rand(8, 8);
    expectClose(await expectJsOnly(wasm, () => wasm.add(a, b)), jsBackend.add(a, b));
  });

  it.skipIf(!asAvailable)('subtract stays on JS and matches the JS backend', async () => {
    const a = rand(8, 8);
    const b = rand(8, 8);
    expectClose(await expectJsOnly(wasm, () => wasm.subtract(a, b)), jsBackend.subtract(a, b));
  });

  it.skipIf(!asAvailable)(
    'multiplyElementwise stays on JS and matches the JS backend',
    async () => {
      const a = rand(6, 6);
      const b = rand(6, 6);
      expectClose(
        await expectJsOnly(wasm, () => wasm.multiplyElementwise(a, b)),
        jsBackend.multiplyElementwise(a, b)
      );
    }
  );

  it.skipIf(!asAvailable)('divideElementwise stays on JS and matches the JS backend', async () => {
    const a = rand(6, 6);
    const b = new DenseMatrix(
      6,
      6,
      Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => Math.random() + 1))
    );
    expectClose(
      await expectJsOnly(wasm, () => wasm.divideElementwise(a, b)),
      jsBackend.divideElementwise(a, b)
    );
  });

  it.skipIf(!asAvailable)('scale stays on JS and matches the JS backend', async () => {
    const a = rand(8, 8);
    expectClose(await expectJsOnly(wasm, () => wasm.scale(a, 2.5)), jsBackend.scale(a, 2.5));
  });

  it.skipIf(!asAvailable)('abs stays on JS and matches the JS backend', async () => {
    const a = rand(8, 8);
    expectClose(await expectJsOnly(wasm, () => wasm.abs(a)), jsBackend.abs(a));
  });

  it.skipIf(!asAvailable)('negate stays on JS and matches the JS backend', async () => {
    const a = rand(8, 8);
    expectClose(await expectJsOnly(wasm, () => wasm.negate(a)), jsBackend.negate(a));
  });

  it.skipIf(!asAvailable)('transpose stays on JS and matches the JS backend', async () => {
    const a = rand(4, 7);
    expectClose(await expectJsOnly(wasm, () => wasm.transpose(a)), jsBackend.transpose(a));
  });

  it.skipIf(!asAvailable)('sum / norm / dot stay on JS and match the JS backend', async () => {
    const a = rand(8, 8);
    expect(await expectJsOnly(wasm, () => wasm.sum(a))).toBeCloseTo(jsBackend.sum(a) as number, 6);
    expect(await expectJsOnly(wasm, () => wasm.norm(a))).toBeCloseTo(jsBackend.norm(a), 6);
    const v1 = rand(1, 16);
    const v2 = rand(1, 16);
    expect(await expectJsOnly(wasm, () => wasm.dot(v1, v2))).toBeCloseTo(
      jsBackend.dot(v1, v2) as number,
      6
    );
  });

  it.skipIf(!asAvailable)('sumAxis delegates to the JS backend', async () => {
    const a = rand(5, 6);
    expectClose(await expectJsOnly(wasm, () => wasm.sumAxis(a, 0)), jsBackend.sumAxis(a, 0));
    expectClose(await expectJsOnly(wasm, () => wasm.sumAxis(a, 1)), jsBackend.sumAxis(a, 1));
  });
});

describe('WASMBackend — live AS decompositions', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    wasm = createWASMBackend({ minElements: 0, wasmPath: asAvailable ? asWasmPath : '' });
    if (asAvailable) await wasm.initialize();
  });

  it.skipIf(!asAvailable)(
    'LU decomposition executes matrix_lu_decompose and reconstructs P·A via L·U',
    async () => {
      const A = new DenseMatrix(3, 3, [
        [4, 3, 2],
        [2, 1, 3],
        [3, 2, 5],
      ]);
      const { result, counts } = await countAsCalls(wasm, ['matrix_lu_decompose'], () =>
        wasm.luDecomposition(A)
      );
      expect(counts.matrix_lu_decompose).toBeGreaterThan(0);
      const { lu, perm, singular } = result;
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
    }
  );

  it.skipIf(!asAvailable)('LU flags a singular matrix (via matrix_lu_decompose)', async () => {
    const A = new DenseMatrix(2, 2, [
      [1, 2],
      [2, 4],
    ]);
    const { result, counts } = await countAsCalls(wasm, ['matrix_lu_decompose'], () =>
      wasm.luDecomposition(A)
    );
    expect(counts.matrix_lu_decompose).toBeGreaterThan(0);
    expect(result.singular).toBe(true);
  });

  it.skipIf(!asAvailable)(
    'QR decomposition executes matrix_qr_decompose and reconstructs A via Qᵀ·R (tall, m >= n)',
    async () => {
      // The backend documents `q` as Qᵀ (transforms accumulate as Qᵀ), so the
      // reconstruction identity is A = Qᵀ·R for both the WASM and JS paths.
      const A = new DenseMatrix(4, 3, [
        [1, 2, 0],
        [0, 1, 1],
        [1, 0, 1],
        [2, 1, 0],
      ]);
      const { result, counts } = await countAsCalls(wasm, ['matrix_qr_decompose'], () =>
        wasm.qrDecomposition(A)
      );
      expect(counts.matrix_qr_decompose).toBeGreaterThan(0);
      const { q, r } = result;
      expectClose(q.transpose().multiply(r), A, 5);
    }
  );

  it.skipIf(!asAvailable)('QR falls back to JS for a wide matrix (m < n)', async () => {
    // The JS Householder fallback returns Q = Hₖ…H₁ and R = Hₖ…H₁·A, so the
    // reconstruction identity is A = Qᵀ·R (Q is orthogonal ⇒ Q⁻¹ = Qᵀ).
    const A = new DenseMatrix(2, 4, [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { result, counts } = await countAsCalls(wasm, ['matrix_qr_decompose'], () =>
      wasm.qrDecomposition(A)
    );
    // The AS Householder QR assumes m >= n, so a wide matrix is JS by design.
    expect(counts.matrix_qr_decompose).toBe(0);
    const { q, r } = result;
    expectClose(q.transpose().multiply(r), A, 5);
  });

  it.skipIf(!asAvailable)('inverse executes matrix_inverse and satisfies A·A⁻¹ = I', async () => {
    const A = new DenseMatrix(3, 3, [
      [2, 0, 1],
      [1, 3, 2],
      [0, 1, 1],
    ]);
    const { result, counts } = await countAsCalls(wasm, ['matrix_inverse'], () => wasm.inverse(A));
    expect(counts.matrix_inverse).toBeGreaterThan(0);
    const { inverse, singular } = result;
    expect(singular).toBe(false);
    const I = A.multiply(inverse);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(I.get(i, j)).toBeCloseTo(i === j ? 1 : 0, 6);
  });

  it.skipIf(!asAvailable)('inverse flags a singular matrix (via matrix_inverse)', async () => {
    const A = new DenseMatrix(2, 2, [
      [1, 1],
      [1, 1],
    ]);
    const { result, counts } = await countAsCalls(wasm, ['matrix_inverse'], () => wasm.inverse(A));
    expect(counts.matrix_inverse).toBeGreaterThan(0);
    expect(result.singular).toBe(true);
  });

  it.skipIf(!asAvailable)(
    'determinant executes matrix_determinant and matches the cofactor value',
    async () => {
      const A = new DenseMatrix(3, 3, [
        [6, 1, 1],
        [4, -2, 5],
        [2, 8, 7],
      ]);
      const { result: det, counts } = await countAsCalls(wasm, ['matrix_determinant'], () =>
        wasm.determinantWasm(A)
      );
      expect(counts.matrix_determinant).toBeGreaterThan(0);
      expect(det).toBeCloseTo(-306, 4);
    }
  );

  it.skipIf(!asAvailable)(
    'Cholesky executes matrix_cholesky and reconstructs an SPD matrix as L·Lᵀ',
    async () => {
      const A = new DenseMatrix(3, 3, [
        [4, 2, -2],
        [2, 10, 2],
        [-2, 2, 5],
      ]);
      const { result, counts } = await countAsCalls(wasm, ['matrix_cholesky'], () =>
        wasm.choleskyDecomposition(A)
      );
      expect(counts.matrix_cholesky).toBeGreaterThan(0);
      const { l, positiveDefinite } = result;
      expect(positiveDefinite).toBe(true);
      const LLt = l.multiply(l.transpose());
      expectClose(LLt, A, 5);
    }
  );

  it.skipIf(!asAvailable)(
    'Cholesky flags a non-positive-definite matrix (via matrix_cholesky)',
    async () => {
      const A = new DenseMatrix(2, 2, [
        [1, 2],
        [2, 1],
      ]);
      const { result, counts } = await countAsCalls(wasm, ['matrix_cholesky'], () =>
        wasm.choleskyDecomposition(A)
      );
      expect(counts.matrix_cholesky).toBeGreaterThan(0);
      expect(result.positiveDefinite).toBe(false);
    }
  );
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
