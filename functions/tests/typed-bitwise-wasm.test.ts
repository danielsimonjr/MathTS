/**
 * WASM-dispatch-tier tests for the seven typed bitwise ops.
 *
 * Strategy:
 *   1. Load the AS binary (`AS_WASM_PATH` from ./helpers/wasm-spy — the
 *      co-located `dist/wasm/mathts-as.wasm`) via `wasmLoader.load()`.
 *   2. Construct an Int32Array operand pair of length 64K (the
 *      `WASM_BITWISE_THRESHOLD`) plus 1, so the typed function's
 *      `Int32Array` signature takes the WASM tier.
 *   3. Prove the typed op actually executed its AS `*_i32_array` kernel
 *      (`countExportCalls` > 0 — a silent ComputePool fallback would also
 *      produce the right answer) and bit-matches a JS oracle computed inline
 *      over the WHOLE array — Int32Array semantics match the typed ops exactly.
 *   4. Negative test: after `wasmLoader.reset()` (no module loaded),
 *      the same call must succeed by falling through to ComputePool.
 *
 * The bridge itself is covered by bitwise-as-wasm.test.ts; this suite is the one
 * that proves the PUBLIC typed functions route to it above threshold.
 *
 * The WASM block is gated on `AS_WASM_PATH` like the other AS suites, but the
 * build guarantees the binary, so a non-skipping presence test turns its
 * absence into a failure instead of a silent skip.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
} from '../src/typed/bitwise.js';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { WASM_BITWISE_THRESHOLD, resetBitwiseWasm } from '../src/wasm/bitwise/wasm-bridge.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE, countExportCalls } from './helpers/wasm-spy.js';

const N = WASM_BITWISE_THRESHOLD + 1;
const SHIFT_MASK = 31; // JS << / >> / >>> mask shift counts to low 5 bits

function makeOperands(): { a: Int32Array; b: Int32Array } {
  const a = new Int32Array(N);
  const b = new Int32Array(N);
  // Deterministic but varied content: cover positive, negative, zero,
  // and high-bit-set values across the whole length.
  for (let i = 0; i < N; i++) {
    a[i] = (i * 2654435761) | 0; // Knuth multiplicative hash, fits i32
    b[i] = ((i + 1) * 40503) | 0; // smaller multiplier for variety
  }
  return { a, b };
}

function jsBinary(op: '&' | '|' | '^', a: Int32Array, b: Int32Array): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    switch (op) {
      case '&':
        out[i] = a[i] & b[i];
        break;
      case '|':
        out[i] = a[i] | b[i];
        break;
      case '^':
        out[i] = a[i] ^ b[i];
        break;
    }
  }
  return out;
}

function jsShift(op: '<<' | '>>' | '>>>', a: Int32Array, b: Int32Array): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const s = b[i] & SHIFT_MASK;
    switch (op) {
      case '<<':
        out[i] = a[i] << s;
        break;
      case '>>':
        out[i] = a[i] >> s;
        break;
      case '>>>':
        out[i] = a[i] >>> s;
        break;
    }
  }
  return out;
}

function jsNot(a: Int32Array): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = ~a[i];
  return out;
}

/** Index of the first element where `out` and `oracle` differ (-1 when identical). */
function firstMismatch(out: Int32Array, oracle: Int32Array): number {
  if (out.length !== oracle.length) return Math.min(out.length, oracle.length);
  for (let i = 0; i < out.length; i++) if (out[i] !== oracle[i]) return i;
  return -1;
}

/**
 * Run a typed bitwise op and prove it executed the named AS kernel. The typed
 * `Int32Array` signatures are async, but the WASM tier runs synchronously before
 * their first `await` (only the ComputePool fallback awaits), so the call counter
 * observes it while `countExportCalls` has the module swapped in.
 */
async function runOnAs(kernel: string, call: () => unknown): Promise<Int32Array> {
  const { result, counts } = countExportCalls([kernel], call);
  const out = await result;
  expect(
    counts[kernel],
    `${kernel}: AS kernel invoked (not the ComputePool fallback)`
  ).toBeGreaterThan(0);
  expect(out).toBeInstanceOf(Int32Array);
  if (!(out instanceof Int32Array)) throw new Error(`${kernel}: expected an Int32Array result`);
  return out;
}

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describeIfAS('typed bitwise — AS WASM dispatch tier (Int32Array, n >= threshold)', () => {
  beforeAll(async () => {
    // Drop any earlier-loaded module, then load the AS binary.
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30000);

  afterAll(async () => {
    wasmLoader.reset();
    // Drain the worker pool so vitest doesn't hang on lingering workers.
    await computePool.terminate(true);
  });

  const { a, b } = makeOperands();

  it('bitAnd executes bitAnd_i32_array and matches the JS oracle', async () => {
    const out = await runOnAs('bitAnd_i32_array', () => bitAnd(a, b));
    expect(out.length).toBe(N);
    expect(Array.from(out.slice(0, 8))).toEqual(Array.from(jsBinary('&', a, b).slice(0, 8)));
    // Spot-check a handful of positions across the length, then the whole array.
    const oracle = jsBinary('&', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('bitOr executes bitOr_i32_array and matches the JS oracle', async () => {
    const out = await runOnAs('bitOr_i32_array', () => bitOr(a, b));
    const oracle = jsBinary('|', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('bitXor executes bitXor_i32_array and matches the JS oracle', async () => {
    const out = await runOnAs('bitXor_i32_array', () => bitXor(a, b));
    const oracle = jsBinary('^', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('bitNot executes bitNot_i32_array and matches the JS oracle', async () => {
    const out = await runOnAs('bitNot_i32_array', () => bitNot(a));
    const oracle = jsNot(a);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('leftShift executes leftShift_i32_array and matches the JS oracle (per-element shift)', async () => {
    const out = await runOnAs('leftShift_i32_array', () => leftShift(a, b));
    const oracle = jsShift('<<', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('rightArithShift executes rightArithShift_i32_array and matches the JS oracle (per-element shift)', async () => {
    const out = await runOnAs('rightArithShift_i32_array', () => rightArithShift(a, b));
    const oracle = jsShift('>>', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });

  it('rightLogShift executes rightLogShift_i32_array and matches the JS oracle (per-element shift)', async () => {
    const out = await runOnAs('rightLogShift_i32_array', () => rightLogShift(a, b));
    const oracle = jsShift('>>>', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
    expect(firstMismatch(out, oracle)).toBe(-1);
  });
});

// -----------------------------------------------------------------------------
// Negative test — the WASM tier MUST be safely optional. With no module
// loaded, the dispatch must fall through to ComputePool and produce the
// same answer. We run this unconditionally (no WASM artifact needed).
// -----------------------------------------------------------------------------

describe('typed bitwise — WASM fallback when module not loaded', () => {
  beforeAll(() => {
    resetBitwiseWasm(); // stable wrapper around wasmLoader.reset()
  });

  afterAll(async () => {
    await computePool.terminate(true);
  });

  it('bitAnd falls through to ComputePool when wasmLoader has no module', async () => {
    // Use a much smaller array so the test runs quickly via the in-process
    // ComputePool path — this proves the WASM-null path doesn't throw,
    // which is the actual contract under test.
    const a = Int32Array.from([0xff00, 0x0ff0, 0x00ff, 0x1234]);
    const b = Int32Array.from([0xf0f0, 0x0f0f, 0xaaaa, 0x4321]);
    const out = await bitAnd(a, b);
    expect(Array.from(out)).toEqual([
      0xff00 & 0xf0f0,
      0x0ff0 & 0x0f0f,
      0x00ff & 0xaaaa,
      0x1234 & 0x4321,
    ]);
  });

  it('large-input bitOr without loaded module also reaches ComputePool successfully', async () => {
    // Exceed the WASM threshold to confirm runBinaryBitwiseWasm() returns
    // null (no module) and the typed function still produces a correct
    // result via ComputePool.
    const len = WASM_BITWISE_THRESHOLD + 32;
    const a = new Int32Array(len);
    const b = new Int32Array(len);
    for (let i = 0; i < len; i++) {
      a[i] = i | 0;
      b[i] = (i ^ 0xdeadbeef) | 0;
    }
    const out = await bitOr(a, b);
    expect(out).toBeInstanceOf(Int32Array);
    expect(out.length).toBe(len);
    // Verify the first and last elements match the oracle.
    expect(out[0]).toBe(0 | (0 ^ 0xdeadbeef));
    expect(out[len - 1]).toBe((len - 1) | (((len - 1) ^ 0xdeadbeef) | 0));
  });
});
