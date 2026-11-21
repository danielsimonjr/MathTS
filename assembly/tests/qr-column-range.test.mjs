/**
 * The Householder norm of `matrix_qr_decompose` for a column outside the range where the squares
 * of its entries stay finite and above zero.
 *
 * The kernel is a public export of the package and `matrix` calls it only after it has scaled the
 * input into range (#1123), so a direct caller is the one who sees the raw behaviour. A column
 * above about 1.34e154 has squares that overflow: the norm was Infinity, the reflector was zero,
 * and the result was finite and wrong (a column of three 1e200 gave R[0][0] = -1e200, and the
 * true value is -sqrt(3) * 1e200). A column below about 1.5e-162 has squares that underflow (#1172).
 *
 * Plain asserts, no framework: the test runs with `node` and with `bun`.
 */
import assert from 'node:assert/strict';
import * as release from '../build/mathts.js';
import * as debug from '../build/mathts-debug.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}\n     ${String(error?.message ?? error)}`);
  }
}

/** QR of a row-major m x n matrix: `{ Q, R }` as row-major Float64Arrays (the kernel returns Q^T). */
function qr(glue, A, m, n) {
  const q = new Float64Array(m * m);
  const r = new Float64Array(m * n);
  const status = glue.matrix_qr_decompose(Float64Array.from(A), m, n, q, r);
  assert.equal(status, 0);
  return { q, r };
}

const CASES = [
  ['three 1e200', [1e200, 1e200, 1e200], 3, 1, -Math.sqrt(3) * 1e200],
  [
    'three 1e154 (squares overflow, norm is finite)',
    [1e154, 1e154, 1e154],
    3,
    1,
    -Math.sqrt(3) * 1e154,
  ],
  ['1e300 column and a unit column', [1e300, 1, 1e300, 2], 2, 2, -Math.sqrt(2) * 1e300],
  ['three 1e-200 (squares underflow)', [1e-200, 1e-200, 1e-200], 3, 1, -Math.sqrt(3) * 1e-200],
  ['ordinary', [1, 2, 3, 4, 5, 6], 3, 2, -Math.sqrt(35)],
];

for (const [label, glue] of [
  ['release', release],
  ['debug', debug],
]) {
  for (const [name, A, m, n, r00] of CASES) {
    test(`${label}: ${name}: R[0][0] is the norm of the first column, below it is zero, Q is orthogonal`, () => {
      const { q, r } = qr(glue, A, m, n);
      assert.ok(Math.abs(r[0] / r00 - 1) < 4e-16, `R[0][0] = ${r[0]}, want ${r00}`);
      for (let i = 1; i < m; i++) assert.equal(r[i * n], 0);
      // The kernel returns Q^T: A = Q^T R. The error is read against the largest entry of A.
      const maxA = Math.max(...A.map(Math.abs));
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < m; k++) sum += q[k * m + i] * r[k * n + j];
          assert.ok(Math.abs(sum - A[i * n + j]) <= 1e-14 * maxA, `Q^T R [${i}][${j}] = ${sum}`);
        }
      }
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          let sum = 0;
          for (let k = 0; k < m; k++) sum += q[i * m + k] * q[j * m + k];
          assert.ok(Math.abs(sum - (i === j ? 1 : 0)) <= 1e-14);
        }
      }
    });
  }

  test(`${label}: a column with an infinite entry keeps the plain path and carries the infinity`, () => {
    const { r } = qr(glue, [Infinity, 1, 1, 1], 2, 2);
    assert.ok(!Number.isFinite(r[0]) || Number.isNaN(r[0]));
  });
}

console.log(`\nqr-column-range: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
