/**
 * Rust→AS migration Phase 3b — bitwise bridge on the AS binary.
 *
 * Proves the Int32 bitwise kernels execute on the AS managed `*_i32_array`
 * kernels (call-counter > 0) and bit-match the JS reference op. Before the fix
 * the bridge passed JS Int32Array refs straight to the managed export (coerced
 * to a 0 header → garbage); now it marshals through the managed ABI.
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  runBinaryBitwiseWasm,
  runUnaryBitwiseWasm,
  WASM_BITWISE_THRESHOLD,
} from '../src/wasm/bitwise/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls } from './helpers/wasm-spy.js';

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;
const N = WASM_BITWISE_THRESHOLD; // 65536

function rng(seed: number): Int32Array {
  let s = seed >>> 0;
  const out = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    s = (s + 0x6d2b79f5) | 0;
    out[i] = Math.imul(s ^ (s >>> 15), 1 | s) | 0;
  }
  return out;
}

function eq(a: Int32Array, b: Int32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

describeIfAS('bitwise bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('binary ops execute the AS kernel and bit-match JS', () => {
    const a = rng(7);
    const b = rng(99);
    const shift = new Int32Array(N);
    for (let i = 0; i < N; i++) shift[i] = (((b[i] % 32) + 32) % 32) | 0;

    const cases: [
      string,
      Parameters<typeof runBinaryBitwiseWasm>[0],
      Int32Array,
      (x: number, y: number) => number,
    ][] = [
      ['bitAnd_i32_array', 'bitAnd', b, (x, y) => x & y],
      ['bitOr_i32_array', 'bitOr', b, (x, y) => x | y],
      ['bitXor_i32_array', 'bitXor', b, (x, y) => x ^ y],
      ['leftShift_i32_array', 'leftShift', shift, (x, y) => x << y],
      ['rightArithShift_i32_array', 'rightArithShift', shift, (x, y) => x >> y],
      ['rightLogShift_i32_array', 'rightLogShift', shift, (x, y) => x >>> y],
    ];
    for (const [name, op, operand, f] of cases) {
      const { result, counts } = countExportCalls([name], () =>
        runBinaryBitwiseWasm(op, a, operand)
      );
      expect(result, `${op}: not null`).not.toBeNull();
      expect(counts[name], `${op}: AS kernel invoked`).toBeGreaterThan(0);
      const ref = new Int32Array(N);
      for (let i = 0; i < N; i++) ref[i] = f(a[i], operand[i]) | 0;
      expect(eq(result!, ref), `${op}: AS vs JS`).toBe(true);
    }
  });

  it('bitNot executes the AS kernel and bit-matches JS', () => {
    const a = rng(13);
    const { result, counts } = countExportCalls(['bitNot_i32_array'], () =>
      runUnaryBitwiseWasm('bitNot', a)
    );
    expect(result).not.toBeNull();
    expect(counts.bitNot_i32_array).toBeGreaterThan(0);
    const ref = new Int32Array(N);
    for (let i = 0; i < N; i++) ref[i] = ~a[i];
    expect(eq(result!, ref)).toBe(true);
  });
});
