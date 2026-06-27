/**
 * Unit tests for the Rust→AS WASM-parity guard (--check-wasm-parity).
 *
 * Run with:  npx tsx --test tools/create-dependency-graph/parity.test.ts
 *
 * All extraction is tested against in-memory / temp fixtures (no real .wasm, and
 * no dependency on the live bridges). NOTE: the Rust→AS migration is complete, so
 * the production bridges no longer consume Rust kernels — `collectConsumedRustKernels`
 * returns ∅ against them now. This guard is retained as a hermetic unit test of the
 * extraction logic (and a regression check should the extractor ever be reused).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  buildRenameMap,
  collectConsumedRustKernels,
  computeParity,
} from './create-dependency-graph';

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

test('collectConsumedRustKernels: static literals + simd expansion; excludes _as, op-array pollution, non-exports', () => {
  // Hermetic fixture bridge-tree (the live bridges no longer consume Rust). Each
  // <bridge>/wasm-bridge.ts mirrors the extraction-relevant shapes.
  const dir = mkdtempSync(join(tmpdir(), 'parity-fixture-'));
  try {
    const bridge = (name: string, src: string): void => {
      mkdirSync(join(dir, name), { recursive: true });
      writeFileSync(join(dir, name, 'wasm-bridge.ts'), src);
    };
    // special: static kernel literals + an `_as` probe + a prose/provenance comment.
    bridge(
      'special',
      [
        '// mirrors wasm-rust/crates/.../bessel.rs (provenance prose — ignored)',
        "const a = wasm['bessel_j_f64'];",
        "const b = wasm['bessel_j0_f64'];",
        "const probe = wasm['bessel_jn_f64_as'];",
      ].join('\n')
    );
    // elementwise: the op-name array (must NOT pollute) + the dynamic simd expansion.
    bridge(
      'elementwise',
      'export const WASM_ELEMENTWISE_OPS = [' +
        ELEMENTWISE_OPS.map((o) => `'${o}'`).join(', ') +
        "] as const;\nconst fn = wasm[`simd_${op}_array`];\n"
    );
    // bitwise: camelCase kernel names (the 7th bridge the eval originally missed).
    bridge('bitwise', BITWISE_RUST.map((n) => `wasm['${n}'];`).join('\n'));

    const rustExports = new Set<string>([
      'bessel_j_f64',
      'bessel_j0_f64',
      ...ELEMENTWISE_OPS.map((op) => `simd_${op}_array`),
      ...BITWISE_RUST,
      // bare op scalar exports the real Rust binary also exports (pollution risk):
      // they appear only inside WASM_ELEMENTWISE_OPS, so must NOT be counted.
      ...ELEMENTWISE_OPS,
      // decoy: a real rust export referenced by no bridge.
      'unreferenced_kernel_f64',
    ]);

    const consumed = collectConsumedRustKernels(dir, rustExports);

    // Static literals.
    assert.ok(consumed.has('bessel_j_f64'));
    assert.ok(consumed.has('bessel_j0_f64'));
    // 7th bridge: bitwise camelCase kernels.
    for (const name of BITWISE_RUST) assert.ok(consumed.has(name), `bitwise ${name}`);
    // simd_${op}_array expansion over WASM_ELEMENTWISE_OPS.
    for (const op of ELEMENTWISE_OPS) {
      assert.ok(consumed.has(`simd_${op}_array`), `expanded simd_${op}_array`);
    }
    // Bare op-name literals must NOT pollute even though Rust exports them.
    for (const bare of ELEMENTWISE_OPS) assert.ok(!consumed.has(bare), `bare op excluded: ${bare}`);
    // `_as` probe names are never Rust kernels.
    for (const name of consumed) assert.ok(!name.endsWith('_as'), `excluded _as name: ${name}`);
    assert.ok(!consumed.has('bessel_jn_f64'), 'integer-order only referenced as _as probe');
    // A rust export referenced by no bridge is excluded.
    assert.ok(!consumed.has('unreferenced_kernel_f64'));
    // 2 special literals + 18 simd + 7 bitwise = 27.
    assert.equal(consumed.size, 27);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildRenameMap: covers simd→array, poly, and bitwise renames', () => {
  const map = buildRenameMap(ELEMENTWISE_OPS);
  // elementwise convention (Phase 2: pointer-ABI AS kernels `array_<op>_ptr`)
  assert.equal(map['simd_sin_array'], 'array_sin_ptr');
  assert.equal(map['simd_erfc_array'], 'array_erfc_ptr');
  // poly
  assert.equal(map['poly_resultant_f64'], 'resultant');
  assert.equal(map['poly_discriminant_f64'], 'discriminant');
  // bitwise (rust camelCase → AS *_i32_array)
  assert.equal(map['bitAndArray'], 'bitAnd_i32_array');
  assert.equal(map['leftShiftArrayPerElement'], 'leftShift_i32_array');
  assert.equal(map['rightLogShiftArrayPerElement'], 'rightLogShift_i32_array');
});
