/**
 * The synchronous bitwise signatures still ask the WASM tier first, at or above
 * WASM_BITWISE_THRESHOLD and only when the lengths match.
 *
 * The bridges are replaced by spies. Under the shipped policy the bridge returns null
 * (WASM measured 2.4-3.3x slower); the call is kept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/wasm/bitwise/wasm-bridge.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/wasm/bitwise/wasm-bridge.js')>();
  return {
    ...orig,
    runBinaryBitwiseWasm: vi.fn(orig.runBinaryBitwiseWasm),
    runUnaryBitwiseWasm: vi.fn(orig.runUnaryBitwiseWasm),
  };
});

import {
  runBinaryBitwiseWasm,
  runUnaryBitwiseWasm,
  WASM_BITWISE_THRESHOLD,
} from '../src/wasm/bitwise/wasm-bridge.js';
import {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
} from '../src/index.js';

const binSpy = vi.mocked(runBinaryBitwiseWasm);
const unSpy = vi.mocked(runUnaryBitwiseWasm);

type B32 = (a: Int32Array, b: Int32Array) => unknown;
const BIN: Array<[string, B32]> = [
  ['bitAnd', bitAnd as B32],
  ['bitOr', bitOr as B32],
  ['bitXor', bitXor as B32],
  ['leftShift', leftShift as B32],
  ['rightArithShift', rightArithShift as B32],
  ['rightLogShift', rightLogShift as B32],
];

describe('bitwise asks the WASM tier first at or above WASM_BITWISE_THRESHOLD', () => {
  beforeEach(() => {
    binSpy.mockClear();
    unSpy.mockClear();
  });

  it('the threshold is 65 536 elements', () => {
    expect(WASM_BITWISE_THRESHOLD).toBe(65_536);
  });

  it.each(BIN)('%s returns the WASM result when the bridge gives one', (name, f) => {
    const a = new Int32Array(WASM_BITWISE_THRESHOLD).fill(6);
    const b = new Int32Array(WASM_BITWISE_THRESHOLD).fill(3);
    const sentinel = new Int32Array(WASM_BITWISE_THRESHOLD).fill(99);
    binSpy.mockReturnValueOnce(sentinel);
    expect(f(a, b) === sentinel).toBe(true);
    const call = binSpy.mock.calls[0];
    expect(call[0]).toBe(name);
    expect(call[1] === a && call[2] === b).toBe(true);
  });

  it.each(BIN)('%s computes in JS when the bridge gives null', (_name, f) => {
    const a = new Int32Array(WASM_BITWISE_THRESHOLD).fill(6);
    const b = new Int32Array(WASM_BITWISE_THRESHOLD).fill(3);
    binSpy.mockReturnValueOnce(null);
    const out = f(a, b);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBeInstanceOf(Int32Array);
    expect(binSpy).toHaveBeenCalledTimes(1);
  });

  it.each(BIN)('%s does not ask the bridge below the threshold', (_name, f) => {
    f(Int32Array.of(1, 2), Int32Array.of(1, 2));
    expect(binSpy).not.toHaveBeenCalled();
  });

  it.each(BIN)('%s checks the lengths before it asks the bridge', (_name, f) => {
    const a = new Int32Array(WASM_BITWISE_THRESHOLD);
    const b = new Int32Array(WASM_BITWISE_THRESHOLD + 1);
    expect(() => f(a, b)).toThrow(RangeError);
    expect(binSpy).not.toHaveBeenCalled();
  });

  it('bitNot returns the WASM result when the bridge gives one', () => {
    const a = new Int32Array(WASM_BITWISE_THRESHOLD).fill(6);
    const sentinel = new Int32Array(WASM_BITWISE_THRESHOLD).fill(99);
    unSpy.mockReturnValueOnce(sentinel);
    expect(bitNot(a) === sentinel).toBe(true);
    expect(unSpy.mock.calls[0][0]).toBe('bitNot');
    expect(unSpy.mock.calls[0][1] === a).toBe(true);
  });

  it('bitNot computes in JS when the bridge gives null', () => {
    const a = new Int32Array(WASM_BITWISE_THRESHOLD).fill(6);
    unSpy.mockReturnValueOnce(null);
    const out = bitNot(a) as Int32Array;
    expect(out).not.toBeInstanceOf(Promise);
    expect(out[0]).toBe(-7);
  });
});
