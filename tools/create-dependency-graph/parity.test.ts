/**
 * Unit tests for the Rust→AS WASM-parity guard (--check-wasm-parity).
 *
 * Run with:  npx tsx --test tools/create-dependency-graph/parity.test.ts
 *
 * `computeParity` is tested against in-memory fixtures (no real .wasm needed).
 * `collectConsumedRustKernels` is tested against the *real* seven bridges under
 * functions/src/wasm/ (the eval undercounted them as six — bitwise was missed),
 * with a hand-built rust-export set so the test does not depend on a built .wasm.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { join } from 'node:path';
import {
  buildRenameMap,
  collectConsumedRustKernels,
  computeParity,
} from './create-dependency-graph';

const REPO_ROOT = join(__dirname, '..', '..');
const WASM_SRC_DIR = join(REPO_ROOT, 'functions', 'src', 'wasm');

// The 18 unary elementwise ops with a Rust `simd_<op>_array` kernel.
const ELEMENTWISE_OPS = [
  'abs',
  'sin',
  'cos',
  'tan',
  'exp',
  'log',
  'atan',
  'sinh',
  'tanh',
  'atanh',
  'expm1',
  'log1p',
  'log2',
  'log10',
  'sec',
  'csc',
  'cot',
  'erfc',
];

test('computeParity: direct match, rename match, and gap', () => {
  const consumed = new Set(['a', 'b', 'c', 'x_src']);
  const asExports = new Set(['a', 'b', 'x_dst']);
  const renameMap = { x_src: 'x_dst', q_src: 'q_dst' };

  const r = computeParity(consumed, asExports, renameMap);

  assert.deepEqual(r.covered, ['a', 'b', 'x_src']); // sorted
  assert.deepEqual(r.gap, ['c']);
  assert.deepEqual(r.renamed, { x_src: 'x_dst' }); // only rename-matched entries
});

test('computeParity: a name covered both directly and by rename is NOT counted as renamed', () => {
  const consumed = new Set(['k']);
  const asExports = new Set(['k', 'k_alias']);
  const renameMap = { k: 'k_alias' };

  const r = computeParity(consumed, asExports, renameMap);

  assert.deepEqual(r.covered, ['k']);
  assert.deepEqual(r.gap, []);
  assert.deepEqual(r.renamed, {}); // direct hit wins; not a rename
});

// Bitwise camelCase Rust kernel names (functions/src/wasm/bitwise/wasm-bridge.ts).
const BITWISE_RUST = [
  'bitAndArray',
  'bitOrArray',
  'bitXorArray',
  'bitNotArray',
  'leftShiftArrayPerElement',
  'rightArithShiftArrayPerElement',
  'rightLogShiftArrayPerElement',
];

test('collectConsumedRustKernels: extracts 7 real bridges, expands simd, excludes _as and op-array pollution', () => {
  // Hand-built rust export set mirroring the *real* binary: it includes the
  // bare op scalar exports ('abs','exp','log',…) that the Rust module genuinely
  // exports. Those appear only inside the WASM_ELEMENTWISE_OPS array (op names,
  // not kernel calls) and must NOT be counted, even though they pass the
  // intersection-with-rust filter. Also includes a decoy referenced by no bridge.
  const rustExports = new Set<string>([
    // special (6 bessel: j0,j1,j,y0,y1,y — integer-order jn/yn only probed as _as)
    'bessel_j0_f64',
    'bessel_j1_f64',
    'bessel_j_f64',
    'bessel_y0_f64',
    'bessel_y1_f64',
    'bessel_y_f64',
    'airy_ai_f64',
    'airy_bi_f64',
    'carlson_rc_f64',
    'carlson_rd_f64',
    'carlson_rf_f64',
    'carlson_rj_f64',
    'elliptic_e_f64',
    'elliptic_e_incomplete_f64',
    'elliptic_f_incomplete_f64',
    'elliptic_k_f64',
    'elliptic_pi_incomplete_f64',
    'lgamma_f64',
    // poly
    'poly_mul_f64',
    'poly_div_mod_f64',
    'poly_resultant_f64',
    'poly_discriminant_f64',
    'poly_fit_f64',
    'cheb_fit_f64',
    'legendre_fit_f64',
    // signal
    'apply_window_f64',
    'welch_psd_f64',
    'bartlett_psd_f64',
    'goertzel_f64',
    'chirp_z_transform_f64',
    // sort
    'sort_f64',
    'argsort_f64',
    'rank_f64',
    // interpolation
    'divided_difference_f64',
    'tridiag_solve_f64',
    // bitwise (7 — the 7th bridge the eval missed)
    ...BITWISE_RUST,
    // elementwise simd_<op>_array kernels
    ...ELEMENTWISE_OPS.map((op) => `simd_${op}_array`),
    // bare op scalar exports that the real Rust module DOES export (pollution risk)
    'abs',
    'exp',
    'log',
    'log2',
    'log10',
    'log1p',
    'expm1',
    'erfc',
    // decoy: a real rust export that no bridge calls
    'unreferenced_kernel_f64',
  ]);

  const consumed = collectConsumedRustKernels(WASM_SRC_DIR, rustExports);

  // Static literals across the bridges.
  assert.ok(consumed.has('bessel_j0_f64'));
  assert.ok(consumed.has('bessel_j_f64'));
  assert.ok(consumed.has('carlson_rj_f64'));
  assert.ok(consumed.has('poly_fit_f64'), 'plain-string fit kernel');
  assert.ok(consumed.has('cheb_fit_f64'));
  assert.ok(consumed.has('tridiag_solve_f64'));

  // 7th bridge: bitwise camelCase kernels.
  for (const name of BITWISE_RUST) assert.ok(consumed.has(name), `bitwise ${name}`);

  // simd_${op}_array expansion over WASM_ELEMENTWISE_OPS.
  for (const op of ELEMENTWISE_OPS) {
    assert.ok(consumed.has(`simd_${op}_array`), `expanded simd_${op}_array`);
  }

  // Bare op-name literals ('abs','exp','log',…) must NOT pollute even though the
  // real Rust binary exports them — they are op names in the array, not kernel calls.
  for (const bare of [
    'abs',
    'exp',
    'log',
    'log2',
    'log10',
    'log1p',
    'expm1',
    'erfc',
    'sin',
    'cos',
  ]) {
    assert.ok(!consumed.has(bare), `bare op excluded: ${bare}`);
  }

  // `_as` probe names are AS probes, never Rust kernels.
  for (const name of consumed) {
    assert.ok(!name.endsWith('_as'), `excluded _as name: ${name}`);
  }
  assert.ok(!consumed.has('bessel_jn_f64'), 'integer-order only referenced as _as probe');

  // A rust export referenced by no bridge is excluded.
  assert.ok(!consumed.has('unreferenced_kernel_f64'));

  // 35 literal kernels + 18 simd + 7 bitwise = 60 grounded consumed kernels.
  assert.equal(consumed.size, 60);
});

test('buildRenameMap: covers simd→array, poly, and bitwise renames', () => {
  const map = buildRenameMap(ELEMENTWISE_OPS);
  // elementwise convention
  assert.equal(map['simd_sin_array'], 'array_sin');
  assert.equal(map['simd_erfc_array'], 'array_erfc');
  // poly
  assert.equal(map['poly_resultant_f64'], 'resultant');
  assert.equal(map['poly_discriminant_f64'], 'discriminant');
  // bitwise (rust camelCase → AS *_i32_array)
  assert.equal(map['bitAndArray'], 'bitAnd_i32_array');
  assert.equal(map['leftShiftArrayPerElement'], 'leftShift_i32_array');
  assert.equal(map['rightLogShiftArrayPerElement'], 'rightLogShift_i32_array');
});
