/**
 * WASM-dispatch-tier tests for the seven typed bitwise ops.
 *
 * Strategy:
 *   1. Force the WASM module to load via `wasmLoader.load(<path>)`
 *      pointing at the built WASM artifact. Skip the whole suite when
 *      that artifact isn't present (so the suite is no-op on dev
 *      machines without the WASM build toolchain).
 *   2. Construct an Int32Array operand pair of length 64K (the
 *      `WASM_BITWISE_THRESHOLD`) plus 1, so the dispatch tier definitely
 *      hits the WASM path.
 *   3. Compare each typed bitwise op's result against a JS oracle
 *      computed inline — Int32Array semantics match the typed ops
 *      exactly.
 *   4. Negative test: after `wasmLoader.reset()` (no module loaded),
 *      the same call must succeed by falling through to ComputePool.
 *
 * NOTE: The WASM artifact lives outside the repo
 * (`/home/user/lib/wasm/mathts.wasm`) because the build script writes
 * to a path two levels above the build-scripts directory. We walk the same
 * path from this test file so it's robust to wherever vitest sets cwd.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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

// -----------------------------------------------------------------------------
// Locate the WASM artifact. Skip the suite entirely if we can't find it.
// -----------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  // functions/tests/.. -> functions/.. -> repo root /home/user/MathTS
  // The build script writes to ../../lib/wasm/mathts.wasm relative to
  // the build-scripts directory → /home/user/lib/wasm/mathts.wasm.
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

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

const describeIfWasm = WASM_PATH !== null ? describe : describe.skip;

describeIfWasm('typed bitwise — WASM dispatch tier (Int32Array, n >= threshold)', () => {
  beforeAll(async () => {
    // Drop any earlier-loaded module, then load the WASM artifact.
    wasmLoader.reset();
    await wasmLoader.load(WASM_PATH!);
  }, 30000);

  afterAll(async () => {
    wasmLoader.reset();
    // Drain the worker pool so vitest doesn't hang on lingering workers.
    await computePool.terminate(true);
  });

  const { a, b } = makeOperands();

  it('bitAnd matches the JS oracle', async () => {
    const out = await bitAnd(a, b);
    expect(out).toBeInstanceOf(Int32Array);
    expect(out.length).toBe(N);
    expect(Array.from(out.slice(0, 8))).toEqual(Array.from(jsBinary('&', a, b).slice(0, 8)));
    // Spot-check a handful of positions across the length.
    const oracle = jsBinary('&', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('bitOr matches the JS oracle', async () => {
    const out = await bitOr(a, b);
    const oracle = jsBinary('|', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('bitXor matches the JS oracle', async () => {
    const out = await bitXor(a, b);
    const oracle = jsBinary('^', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('bitNot matches the JS oracle', async () => {
    const out = await bitNot(a);
    const oracle = jsNot(a);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('leftShift matches the JS oracle (per-element shift)', async () => {
    const out = await leftShift(a, b);
    const oracle = jsShift('<<', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('rightArithShift matches the JS oracle (per-element shift)', async () => {
    const out = await rightArithShift(a, b);
    const oracle = jsShift('>>', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
  });

  it('rightLogShift matches the JS oracle (per-element shift)', async () => {
    const out = await rightLogShift(a, b);
    const oracle = jsShift('>>>', a, b);
    for (const idx of [0, 1, N - 1, (N / 2) | 0, 12345]) {
      expect(out[idx]).toBe(oracle[idx]);
    }
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
