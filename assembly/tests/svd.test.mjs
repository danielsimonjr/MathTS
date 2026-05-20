/**
 * Runtime tests for the AssemblyScript SVD (`matrix_svd`,
 * `matrix_singular_values`). Loads the compiled debug WASM via the
 * AssemblyScript loader and checks reconstruction `A = U diag(S) V^T`.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import loader from '@assemblyscript/loader';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '../build/mathts-debug.wasm');

if (!existsSync(wasmPath)) {
  console.error('SVD test: WASM not found. Run `npm run asbuild` first.');
  process.exit(1);
}

const { exports } = loader.instantiateSync(readFileSync(wasmPath), {
  env: {
    abort: (_m, _f, line, col) => {
      throw new Error(`AS abort at ${line}:${col}`);
    },
    trace: () => {},
    seed: () => Date.now(),
  },
});

// Allocate an AS Float64Array by reusing the exported `matrix_zeros`, then
// fill it through a LIVE memory view (`__getArrayView`, not the copying
// `__getFloat64Array`).
function makeArray(data) {
  const ptr = exports.matrix_zeros(1, data.length);
  exports.__pin(ptr);
  exports.__getArrayView(ptr).set(data);
  return ptr;
}

function svd(A, m, n) {
  const k = Math.min(m, n);
  const aptr = makeArray(A.flat());
  const rptr = exports.matrix_svd(aptr, m, n);
  exports.__pin(rptr);
  const packed = Array.from(exports.__getFloat64Array(rptr));
  exports.__unpin(rptr);
  exports.__unpin(aptr);
  return {
    U: packed.slice(0, m * k),
    S: packed.slice(m * k, m * k + k),
    V: packed.slice(m * k + k),
    k,
  };
}

function singularValues(A, m, n) {
  const aptr = makeArray(A.flat());
  const rptr = exports.matrix_singular_values(aptr, m, n);
  exports.__pin(rptr);
  const s = Array.from(exports.__getFloat64Array(rptr));
  exports.__unpin(rptr);
  exports.__unpin(aptr);
  return s;
}

function reconstruct(U, S, V, m, n, k) {
  const out = [];
  for (let i = 0; i < m; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < k; t++) acc += U[i * k + t] * S[t] * V[j * k + t];
      row.push(acc);
    }
    out.push(row);
  }
  return out;
}

function maxDiff(A, B) {
  let d = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      d = Math.max(d, Math.abs(A[i][j] - B[i][j]));
    }
  }
  return d;
}

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name} ${detail ?? ''}`);
  }
}

console.log('AssemblyScript SVD tests\n========================');

{
  const A = [[3, 0, 0], [0, 1, 0], [0, 0, 2]];
  const { U, S, V, k } = svd(A, 3, 3);
  check(
    '3x3 diagonal: singular values [3,2,1]',
    Math.abs(S[0] - 3) < 1e-10 &&
      Math.abs(S[1] - 2) < 1e-10 &&
      Math.abs(S[2] - 1) < 1e-10,
    `S=${S}`
  );
  check(
    '3x3 diagonal: reconstruction',
    maxDiff(A, reconstruct(U, S, V, 3, 3, k)) < 1e-10
  );
}
{
  const A = [[1, 2], [3, 4], [5, 6], [7, 8]];
  const { U, S, V, k } = svd(A, 4, 2);
  check('4x2 tall: singular values descending', S[0] >= S[1] && S[1] >= -1e-12);
  check(
    '4x2 tall: reconstruction',
    maxDiff(A, reconstruct(U, S, V, 4, 2, k)) < 1e-9
  );
}
{
  const A = [[1, 2, 3, 4], [5, 6, 7, 8]];
  const { U, S, V, k } = svd(A, 2, 4);
  check(
    '2x4 wide: reconstruction',
    maxDiff(A, reconstruct(U, S, V, 2, 4, k)) < 1e-9
  );
}
{
  const A = [[2, -1, 0], [4, 3, -2], [1, 1, 5], [0, 6, -3], [-1, 2, 1]];
  const { U, S, V, k } = svd(A, 5, 3);
  check(
    '5x3 general: reconstruction',
    maxDiff(A, reconstruct(U, S, V, 5, 3, k)) < 1e-9
  );
}
{
  const A = [[1, 2], [3, 4], [5, 6], [7, 8]];
  const sv = singularValues(A, 4, 2);
  const ref = svd(A, 4, 2).S;
  check(
    'singularValues matches svd',
    Math.abs(sv[0] - ref[0]) < 1e-10 && Math.abs(sv[1] - ref[1]) < 1e-10,
    `sv=${sv}`
  );
}

console.log('\n========================');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
