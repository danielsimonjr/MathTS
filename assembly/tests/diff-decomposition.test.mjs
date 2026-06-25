/**
 * Differential test: the 5 dense decompositions vs numpy + reconstruction.
 *
 * Tests the RELEASE wasm (build/mathts.wasm) via the raw AssemblyScript
 * loader — the ESM bindings cannot return output-parameter results (they
 * lower the out-arrays into wasm and release them without lifting the written
 * values back; see COVERAGE_AUDIT.md). Goldens: golden/decomposition.golden.json.
 *
 * Unique outputs are checked against numpy (determinant, inverse). Non-unique
 * factorizations (LU/QR/Cholesky) are checked by reconstruction, the correct
 * method for outputs that differ by pivoting / sign convention.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';
import { createReport } from './_diff-harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts.wasm');
const golden = JSON.parse(
  readFileSync(path.join(here, 'golden', 'decomposition.golden.json'), 'utf-8')
);

const { exports } = loader.instantiateSync(readFileSync(wasmPath), {
  env: { abort: (_m, _f, l, c) => { throw new Error(`AS abort ${l}:${c}`); },
         trace: () => {}, seed: () => 0 },
});

// --- raw-loader array helpers (live views; pin before read, unpin after) ----
function f64(data) {
  const ptr = exports.matrix_zeros(1, data.length);
  exports.__pin(ptr);
  exports.__getArrayView(ptr).set(data);
  return ptr;
}
const i32 = (len) => { const p = exports.__newArray(6, new Array(len).fill(0)); exports.__pin(p); return p; };
const readF = (ptr) => Array.from(exports.__getFloat64Array(ptr));
const readI = (ptr) => Array.from(exports.__getInt32Array(ptr));

// --- tiny dense linear algebra in JS for reconstruction checks -------------
const at = (M, r, c, cols) => M[r * cols + c];
function matmul(A, ar, ac, B, br, bc) {
  const out = new Array(ar * bc).fill(0);
  for (let i = 0; i < ar; i++)
    for (let k = 0; k < ac; k++)
      for (let j = 0; j < bc; j++) out[i * bc + j] += A[i * ac + k] * B[k * bc + j];
  return out;
}
const maxAbsDiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

const report = createReport(
  'mathts-wasm decompositions vs numpy + reconstruction (RELEASE binary)',
  golden.target_abs,
  golden.hard_fail_abs
);

for (const mat of golden.matrices) {
  const { name, rows, cols, A, checks } = mat;

  if (checks.includes('det')) {
    const a = f64(A), work = f64(new Array(rows * rows).fill(0));
    const det = exports.matrix_determinant(a, rows, work);
    report.add(`det(${name})`, det, mat.det);
    exports.__unpin(a); exports.__unpin(work);
  }

  if (checks.includes('inverse')) {
    const a = f64(A), res = f64(new Array(rows * rows).fill(0)),
          work = f64(new Array(rows * rows).fill(0));
    const status = exports.matrix_inverse(a, rows, res, work);
    const inv = readF(res);
    if (status !== 0) report.addScore(`inverse(${name}) [status ${status}]`, Infinity);
    else {
      report.addScore(`inverse(${name}) vs numpy`, maxAbsDiff(inv, mat.inverse));
      // also A * A^-1 = I
      const prod = matmul(A, rows, rows, inv, rows, rows);
      const I = Array.from({ length: rows * rows }, (_, k) => (Math.floor(k / rows) === k % rows ? 1 : 0));
      report.addScore(`inverse(${name}) A*Ainv=I`, maxAbsDiff(prod, I));
    }
    exports.__unpin(a); exports.__unpin(res); exports.__unpin(work);
  }

  if (checks.includes('lu')) {
    const a = f64(A), l = f64(new Array(rows * rows).fill(0)),
          u = f64(new Array(rows * rows).fill(0)), perm = i32(rows);
    const status = exports.matrix_lu_decompose(a, rows, l, u, perm);
    if (status !== 0) report.addScore(`LU(${name}) [status ${status}]`, Infinity);
    else {
      const L = readF(l), U = readF(u), P = readI(perm);
      // P*A: row i of permuted A is row P[i] of A.
      const PA = [];
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < rows; j++) PA.push(at(A, P[i], j, rows));
      const LU = matmul(L, rows, rows, U, rows, rows);
      report.addScore(`LU(${name}) P*A=L*U`, maxAbsDiff(PA, LU));
    }
    exports.__unpin(a); exports.__unpin(l); exports.__unpin(u); exports.__unpin(perm);
  }

  if (checks.includes('qr')) {
    const a = f64(A), q = f64(new Array(rows * rows).fill(0)),
          r = f64(new Array(rows * cols).fill(0));
    const status = exports.matrix_qr_decompose(a, rows, cols, q, r);
    if (status !== 0) report.addScore(`QR(${name}) [status ${status}]`, Infinity);
    else {
      const Q = readF(q), R = readF(r);
      // NOTE: this build returns Q in the TRANSPOSED convention — the valid
      // reconstruction is A = Q^T * R, not A = Q * R (verified to ~1e-15).
      // This contradicts the source doc ("orthogonal Q", A=Q*R) and numpy/
      // scipy. Tracked as an API/doc finding in COVERAGE_AUDIT.md; the
      // factorization itself is numerically correct under its convention.
      const Qt = []; for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) Qt.push(Q[j * rows + i]);
      const QtR = matmul(Qt, rows, rows, R, rows, cols);
      report.addScore(`QR(${name}) A=Q^T*R`, maxAbsDiff(QtR, A));
      // orthogonality: Q^T Q = I (m x m)
      const QtQ = matmul(Qt, rows, rows, Q, rows, rows);
      const I = Array.from({ length: rows * rows }, (_, k) => (Math.floor(k / rows) === k % rows ? 1 : 0));
      report.addScore(`QR(${name}) QtQ=I`, maxAbsDiff(QtQ, I));
    }
    exports.__unpin(a); exports.__unpin(q); exports.__unpin(r);
  }

  if (checks.includes('chol')) {
    const a = f64(A), l = f64(new Array(rows * rows).fill(0));
    const status = exports.matrix_cholesky(a, rows, l);
    if (status !== 0) report.addScore(`Cholesky(${name}) [status ${status}]`, Infinity);
    else {
      const L = readF(l);
      const Lt = []; for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) Lt.push(L[j * rows + i]);
      const LLt = matmul(L, rows, rows, Lt, rows, rows);
      report.addScore(`Cholesky(${name}) L*Lt=A`, maxAbsDiff(LLt, A));
    }
    exports.__unpin(a); exports.__unpin(l);
  }
}

process.exit(report.finish() ? 0 : 1);
