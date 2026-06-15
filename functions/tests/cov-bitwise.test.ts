/**
 * Coverage supplement for functions/src/typed/bitwise.ts.
 *
 * Fills the branches the existing typed-bitwise suites miss:
 * the large-array (>= WASM_BITWISE_THRESHOLD) Int32Array dispatch path for
 * every op, the variadic non-integer error guards, and the BigNumber
 * NaN / Infinity validation errors.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
} from '../src/typed/bitwise.js';

const THRESHOLD = 64 * 1024; // WASM_BITWISE_THRESHOLD

describe('bitwise — large Int32Array dispatch (>= WASM threshold)', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });
  afterAll(async () => {
    await computePool.terminate();
  });

  const N = THRESHOLD + 16;
  const a = Int32Array.from({ length: N }, (_, i) => (i * 2654435761) | 0);
  const b = Int32Array.from({ length: N }, (_, i) => ((i + 7) * 40503) | 0);
  const sample = [0, 1, 100, N - 1];

  it('bitAnd large array matches JS oracle (no WASM module -> ComputePool)', async () => {
    const r = await (bitAnd(a, b) as Promise<Int32Array>);
    expect(r.length).toBe(N);
    for (const i of sample) expect(r[i]).toBe(a[i] & b[i]);
  });

  it('bitOr large array', async () => {
    const r = await (bitOr(a, b) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe((a[i] | b[i]) | 0);
  });

  it('bitXor large array', async () => {
    const r = await (bitXor(a, b) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe((a[i] ^ b[i]) | 0);
  });

  it('bitNot large array', async () => {
    const r = await (bitNot(a) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe(~a[i]);
  });

  it('leftShift large array', async () => {
    const shifts = Int32Array.from({ length: N }, (_, i) => i % 31);
    const r = await (leftShift(a, shifts) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe((a[i] << shifts[i]) | 0);
  });

  it('rightArithShift large array', async () => {
    const shifts = Int32Array.from({ length: N }, (_, i) => i % 31);
    const r = await (rightArithShift(a, shifts) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe(a[i] >> shifts[i]);
  });

  it('rightLogShift large array', async () => {
    const shifts = Int32Array.from({ length: N }, (_, i) => i % 31);
    const r = await (rightLogShift(a, shifts) as Promise<Int32Array>);
    for (const i of sample) expect(r[i]).toBe((a[i] >>> shifts[i]) | 0);
  });
});

describe('bitwise — variadic non-integer error guards', () => {
  it('each variadic op rejects a non-integer rest element', () => {
    expect(() => bitAnd(7, 7, 1.5)).toThrow(/Integers expected/);
    expect(() => bitOr(7, 7, 1.5)).toThrow(/Integers expected/);
    expect(() => bitXor(7, 7, 1.5)).toThrow(/Integers expected/);
    expect(() => leftShift(7, 1, 1.5)).toThrow(/Integers expected/);
    expect(() => rightArithShift(7, 1, 1.5)).toThrow(/Integers expected/);
    expect(() => rightLogShift(7, 1, 1.5)).toThrow(/Integers expected/);
  });

  it('variadic ops fold correctly across many integer args', () => {
    expect(bitAnd(0b1111, 0b1110, 0b1100, 0b1000)).toBe(0b1000);
    expect(bitOr(1, 2, 4, 8)).toBe(15);
    expect(bitXor(1, 2, 4, 8)).toBe(15);
    expect(leftShift(1, 1, 1, 1)).toBe(8);
    expect(rightArithShift(64, 1, 1, 1)).toBe(8);
    expect(rightLogShift(64, 1, 1, 1)).toBe(8);
  });
});

describe('bitwise — BigNumber validation errors', () => {
  const NaNbn = BigNumber.fromNumber(NaN);
  const Inf = BigNumber.fromNumber(Infinity);
  const half = BigNumber.fromNumber(0.5);
  const five = BigNumber.fromNumber(5);

  it('NaN BigNumber operands throw for binary + unary ops', () => {
    expect(() => bitAnd(NaNbn, five)).toThrow(/NaN not allowed/);
    expect(() => bitOr(NaNbn, five)).toThrow(/NaN not allowed/);
    expect(() => bitXor(NaNbn, five)).toThrow(/NaN not allowed/);
    expect(() => bitNot(NaNbn)).toThrow(/NaN not allowed/);
    expect(() => leftShift(NaNbn, five)).toThrow(/NaN not allowed/);
    expect(() => rightArithShift(NaNbn, five)).toThrow(/NaN not allowed/);
    expect(() => rightLogShift(NaNbn, five)).toThrow(/NaN not allowed/);
  });

  it('Infinity BigNumber operands throw', () => {
    expect(() => bitAnd(Inf, five)).toThrow(/Infinity not allowed/);
    expect(() => bitNot(Inf)).toThrow(/Infinity not allowed/);
    expect(() => leftShift(Inf, five)).toThrow(/Infinity not allowed/);
  });

  it('non-integer BigNumber operands throw', () => {
    expect(() => bitAnd(half, five)).toThrow(/Integers expected/);
    expect(() => bitNot(half)).toThrow(/Integers expected/);
  });

  it('negative BigNumber shift count throws', () => {
    const negOne = BigNumber.fromNumber(-1);
    expect(() => leftShift(five, negOne)).toThrow(/Negative shift count/);
    expect(() => rightArithShift(five, negOne)).toThrow(/Negative shift count/);
    expect(() => rightLogShift(five, negOne)).toThrow(/Negative shift count/);
  });

  it('valid BigNumber bit ops compute correctly', () => {
    expect((bitAnd(BigNumber.fromNumber(12), BigNumber.fromNumber(10)) as BigNumber).toNumber()).toBe(8);
    expect((rightLogShift(BigNumber.fromNumber(-8), BigNumber.fromNumber(1)) as BigNumber).toNumber()).toBe(
      (-8 >>> 1) | 0
    );
    expect((leftShift(BigNumber.fromNumber(1), BigNumber.fromNumber(4)) as BigNumber).toNumber()).toBe(16);
  });
});
