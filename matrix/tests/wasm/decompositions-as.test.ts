/**
 * AssemblyScript WASM Decomposition Kernels
 *
 * End-to-end tests for the five AS decomposition exports added in
 * `assembly/src/algebra/decomposition.ts`:
 *   - matrix_lu_decompose
 *   - matrix_qr_decompose
 *   - matrix_cholesky
 *   - matrix_inverse
 *   - matrix_determinant
 *
 * The suite instantiates a `WASMBackend` and calls `initialize()` with NO
 * explicit path, so it also covers the backend's default package-relative
 * resolution (`resolvePackagedWasm` → `matrix/dist/wasm/mathts-as.wasm`, the
 * co-located copy the build guarantees). It drives the dispatch path that
 * calls each export and checks the result against an analytic oracle or a JS
 * reference computation. (Decompositions are not element-count gated —
 * `minElements: 0` only matters for matmul — so tiny matrices reach the AS
 * kernels.)
 *
 * If `initialize()` fails to load the AS binary, the backend silently
 * falls back to JS — each decomposition method sees `mod === null` and
 * routes to the JS implementation, which produces the same numerical result.
 * So correctness alone proves nothing about the WASM path: every test also
 * counts calls to its AS export (via a writable clone of the backend's module,
 * see `countAsCalls`) and requires it to be > 0, and a dedicated test fails
 * loudly when the AS module did not load.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { createWASMBackend, type WASMBackend } from '../../src/backends/WASMBackend.js';

const TOL = 1e-9;

function matrixClose(a: DenseMatrix, b: DenseMatrix, tol = TOL): void {
  expect(a.rows).toBe(b.rows);
  expect(a.cols).toBe(b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      expect(Math.abs(a.get(i, j) - b.get(i, j))).toBeLessThan(tol);
    }
  }
}

/**
 * Multiply two dense matrices on the JS side. Used as a ground-truth
 * reconstruction oracle for LU, QR, and Cholesky — we never want to
 * use the WASM `matrix_multiply` here because then a regression in
 * either kernel could mask a regression in the decomposition.
 */
function jsMatMul(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
  expect(a.cols).toBe(b.rows);
  const out: number[][] = [];
  for (let i = 0; i < a.rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < b.cols; j++) {
      let s = 0;
      for (let k = 0; k < a.cols; k++) s += a.get(i, k) * b.get(k, j);
      row.push(s);
    }
    out.push(row);
  }
  return new DenseMatrix(a.rows, b.cols, out);
}

/** Apply a row permutation to a matrix on the JS side. */
function applyPermutation(a: DenseMatrix, perm: Int32Array): DenseMatrix {
  const rows: number[][] = [];
  for (let i = 0; i < a.rows; i++) {
    const src = perm[i];
    const row: number[] = [];
    for (let j = 0; j < a.cols; j++) row.push(a.get(src, j));
    rows.push(row);
  }
  return new DenseMatrix(a.rows, a.cols, rows);
}

/** The backend's private module slot (the AS instance exports, or null). */
type ModuleSlot = { wasmModule: Record<string, unknown> | null };

/** The five AS decomposition exports this suite covers. */
const DECOMPOSITION_EXPORTS = [
  'matrix_lu_decompose',
  'matrix_qr_decompose',
  'matrix_cholesky',
  'matrix_inverse',
  'matrix_determinant',
];

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
  body: () => Promise<T>
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

describe('AS WASM decomposition kernels', () => {
  let backend: WASMBackend;

  beforeAll(async () => {
    backend = createWASMBackend({ minElements: 0 });
    // Default resolution — no wasmPath — so this also proves the backend finds
    // the co-located matrix/dist/wasm/mathts-as.wasm on its own.
    await backend.initialize();
  });

  it('initialize() loaded the AS module with all five decomposition exports', () => {
    const mod = (backend as unknown as ModuleSlot).wasmModule;
    expect(
      mod,
      'WASMBackend.initialize() fell back to JS: the AS binary did not load. The build ' +
        'guarantees matrix/dist/wasm/mathts-as.wasm — run `bun run build` from the repo root.'
    ).not.toBeNull();
    for (const name of DECOMPOSITION_EXPORTS) {
      expect(typeof mod?.[name], `${name} exported by the AS binary`).toBe('function');
    }
  });

  it('matrix_lu_decompose reconstructs P*A = L*U', async () => {
    const data = [
      [4, 3, 1, 2],
      [6, 3, 4, 5],
      [2, 9, 7, 1],
      [3, 1, 5, 8],
    ];
    const A = new DenseMatrix(4, 4, data);
    const { result, counts } = await countAsCalls(backend, ['matrix_lu_decompose'], () =>
      backend.luDecomposition(A)
    );
    expect(counts.matrix_lu_decompose).toBeGreaterThan(0);
    const { lu, perm, singular } = result;
    expect(singular).toBe(false);

    // The WASMBackend's contract is the same combined LU form the JS
    // path uses: L below the diagonal (unit-diagonal implied), U on
    // and above. Split, rebuild, and reconstruct.
    const n = 4;
    const Ldata: number[][] = [];
    const Udata: number[][] = [];
    for (let i = 0; i < n; i++) {
      const lrow: number[] = [];
      const urow: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i > j) {
          lrow.push(lu.get(i, j));
          urow.push(0);
        } else if (i === j) {
          lrow.push(1);
          urow.push(lu.get(i, j));
        } else {
          lrow.push(0);
          urow.push(lu.get(i, j));
        }
      }
      Ldata.push(lrow);
      Udata.push(urow);
    }
    const L = new DenseMatrix(n, n, Ldata);
    const U = new DenseMatrix(n, n, Udata);
    const PA = applyPermutation(A, perm);
    const LU = jsMatMul(L, U);
    matrixClose(LU, PA);
  });

  it('matrix_qr_decompose yields orthogonal Q with Q*R = A', async () => {
    const data = [
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ];
    const A = new DenseMatrix(3, 3, data);
    const { result, counts } = await countAsCalls(backend, ['matrix_qr_decompose'], () =>
      backend.qrDecomposition(A)
    );
    expect(counts.matrix_qr_decompose).toBeGreaterThan(0);
    const { q, r } = result;

    // The backend's QR API documents that `q` is actually `Q^T` (the
    // Householder reflectors applied to the identity from the left
    // accumulate as Q^T, matching the legacy JS reference and the
    // AssemblyScript binary). So `Q^T * R = A`, and transposing `q` gives us Q.
    const qtData: number[][] = [];
    for (let i = 0; i < q.cols; i++) {
      const row: number[] = [];
      for (let j = 0; j < q.rows; j++) row.push(q.get(j, i));
      qtData.push(row);
    }
    const QT = new DenseMatrix(q.cols, q.rows, qtData);

    // Q^T * R should recover A.
    const reconstructed = jsMatMul(QT, r);
    matrixClose(reconstructed, A);

    // q * q^T should be the identity (q is orthogonal regardless of
    // whether we treat it as Q or Q^T — orthogonality is symmetric).
    const QQT = jsMatMul(q, QT);
    for (let i = 0; i < QQT.rows; i++) {
      for (let j = 0; j < QQT.cols; j++) {
        const expected = i === j ? 1 : 0;
        expect(Math.abs(QQT.get(i, j) - expected)).toBeLessThan(TOL);
      }
    }

    // R should be upper-triangular (below-diagonal entries near zero).
    for (let i = 0; i < r.rows; i++) {
      for (let j = 0; j < i && j < r.cols; j++) {
        expect(Math.abs(r.get(i, j))).toBeLessThan(TOL);
      }
    }
  });

  it('matrix_cholesky factors a 2x2 SPD matrix to the known closed-form result', async () => {
    // A = [[4, 2], [2, 3]] is SPD; the unique Cholesky factor is
    // L = [[2, 0], [1, sqrt(2)]]. Verify the kernel hits the exact
    // closed-form values within 1e-9.
    const A = new DenseMatrix(2, 2, [
      [4, 2],
      [2, 3],
    ]);
    const { result, counts } = await countAsCalls(backend, ['matrix_cholesky'], () =>
      backend.choleskyDecomposition(A)
    );
    expect(counts.matrix_cholesky).toBeGreaterThan(0);
    const { l, positiveDefinite } = result;
    expect(positiveDefinite).toBe(true);

    expect(Math.abs(l.get(0, 0) - 2)).toBeLessThan(TOL);
    expect(Math.abs(l.get(0, 1) - 0)).toBeLessThan(TOL);
    expect(Math.abs(l.get(1, 0) - 1)).toBeLessThan(TOL);
    expect(Math.abs(l.get(1, 1) - Math.sqrt(2))).toBeLessThan(TOL);

    // Round-trip: L * L^T should recover A.
    const ltData: number[][] = [];
    for (let i = 0; i < l.cols; i++) {
      const row: number[] = [];
      for (let j = 0; j < l.rows; j++) row.push(l.get(j, i));
      ltData.push(row);
    }
    const LT = new DenseMatrix(l.cols, l.rows, ltData);
    const recon = jsMatMul(l, LT);
    matrixClose(recon, A);
  });

  it('matrix_inverse computes A^-1 such that A * A^-1 = I (3x3)', async () => {
    const A = new DenseMatrix(3, 3, [
      [1, 2, 3],
      [0, 1, 4],
      [5, 6, 0],
    ]);
    const { result, counts } = await countAsCalls(backend, ['matrix_inverse'], () =>
      backend.inverse(A)
    );
    expect(counts.matrix_inverse).toBeGreaterThan(0);
    const { inverse, singular } = result;
    expect(singular).toBe(false);

    const I = jsMatMul(A, inverse);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1 : 0;
        expect(Math.abs(I.get(i, j) - expected)).toBeLessThan(TOL);
      }
    }
  });

  it('matrix_determinant returns the integer-known determinant of a 3x3', async () => {
    // det of [[1,2,3],[0,1,4],[5,6,0]] = 1*(0 - 24) - 2*(0 - 20) + 3*(0 - 5)
    //                                  = -24 + 40 - 15 = 1.
    const A = new DenseMatrix(3, 3, [
      [1, 2, 3],
      [0, 1, 4],
      [5, 6, 0],
    ]);
    const { result: det, counts } = await countAsCalls(backend, ['matrix_determinant'], () =>
      backend.determinantWasm(A)
    );
    expect(counts.matrix_determinant).toBeGreaterThan(0);
    expect(Math.abs(det - 1)).toBeLessThan(TOL);
  });
});
