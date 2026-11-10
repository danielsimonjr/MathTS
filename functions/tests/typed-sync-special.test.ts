/**
 * The typed special-function Float64Array signatures are synchronous.
 *
 * Each op returns a new Float64Array, never a Promise, and each element equals the number
 * signature (Object.is, so NaN and -0 count). The tests use one input below
 * WASM_SPECIAL_THRESHOLD (the JS loop) and one above it (the bridge path, which runs JS
 * under the shipped policy). For worker threads, use parallelMap.
 */
import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';
import { WASM_SPECIAL_THRESHOLD } from '../src/wasm/special/wasm-bridge.js';

type Fn = (...args: unknown[]) => unknown;
const fn = (name: string): Fn => (F as unknown as Record<string, Fn>)[name];

function same(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`index ${i}: got ${actual[i]}, expected ${expected[i]}`);
    }
  }
}

// [name, leading scalar args, trailing scalar args, sample values in the domain]
type Case = [string, number[], number[], number[]];
const POS = [0.25, 0.5, 1, 2.5, 7, 15];
const SIGNED = [NaN, -0, 0, -0.75, 0.3, 0.9, 2, -3];
const UNIT = [0.05, 0.3, 0.5, 0.7, 0.95];

const CASES: Case[] = [
  ['erfc', [], [], SIGNED],
  ['erfi', [], [], SIGNED],
  ['lgamma', [], [], [NaN, -2.5, 0.5, 1, 3.5, 10]],
  ['beta', [], [3], POS],
  ['gammainc', [2], [], POS],
  ['gammaincp', [2], [], POS],
  ['betainc', [2, 3], [], UNIT],
  ['digamma', [], [], [NaN, -2.5, 0.5, 1, 3.5, 10]],
  ['besselJ0', [], [], SIGNED],
  ['besselJ1', [], [], SIGNED],
  ['besselY0', [], [], POS],
  ['besselY1', [], [], POS],
  ['besselJ', [3], [], SIGNED],
  ['besselY', [2], [], POS],
  ['besselI', [2], [], SIGNED],
  ['besselK', [1], [], POS],
  ['ellipticK', [], [], [NaN, -0, 0, 0.2, 0.5, 0.9]],
  ['ellipticE', [], [], [NaN, -0, 0, 0.2, 0.5, 0.9]],
  ['chebyshevT', [4], [], SIGNED],
  ['hermiteH', [3], [], SIGNED],
  ['laguerreL', [3], [], SIGNED],
  ['legendreP', [5], [], SIGNED],
  ['lambertW', [], [], [NaN, -0.2, -0, 0, 1, 10]],
  ['cosIntegral', [], [], POS],
  ['sinIntegral', [], [], SIGNED],
  ['logIntegral', [], [], [0.5, 2, 3, 10]],
  ['expIntegralEi', [], [], [-2, -0.5, 0.5, 2, 5]],
  ['fresnelC', [], [], SIGNED],
  ['fresnelS', [], [], SIGNED],
  ['airyAi', [], [], SIGNED],
  ['airyBi', [], [], SIGNED],
];

function tile(values: number[], n: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = values[i % values.length];
  return a;
}

describe.each(CASES)('%s(Float64Array) is synchronous', (name, lead, trail, values) => {
  const f = fn(name);
  const scalar = (v: number): number => f(...lead, v, ...trail) as number;

  it.each([
    ['below the WASM threshold', values.length],
    ['at the WASM threshold', WASM_SPECIAL_THRESHOLD],
  ])('equals the number signature %s', (_label, n) => {
    const x = tile(values, n as number);
    const copy = x.slice();
    const out = f(...lead, x, ...trail);
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBeInstanceOf(Float64Array);
    expect(out).not.toBe(x);
    same(out as Float64Array, Array.from(x, scalar));
    same(x, copy);
  });

  it('returns an empty array for an empty input', () => {
    const out = f(...lead, new Float64Array(0), ...trail);
    expect(out).not.toBeInstanceOf(Promise);
    expect((out as Float64Array).length).toBe(0);
  });
});

describe('special: values that pin the kernel', () => {
  it('erfc(0) is 1 and erfi(-0) is +0, as the number signature gives', () => {
    same(fn('erfc')(Float64Array.of(0)) as Float64Array, [1]);
    same(fn('erfi')(Float64Array.of(-0)) as Float64Array, [0]);
    expect(Object.is(fn('erfi')(-0), 0)).toBe(true);
  });

  it('besselJ0(0) is 1 and besselJ1(0) is 0', () => {
    same(fn('besselJ0')(Float64Array.of(0)) as Float64Array, [1]);
    same(fn('besselJ1')(Float64Array.of(0)) as Float64Array, [0]);
  });

  it('chebyshevT(4, x) = 8x^4 - 8x^2 + 1 at x = 0.5 gives -0.5', () => {
    same(fn('chebyshevT')(4, Float64Array.of(0.5)) as Float64Array, [-0.5]);
  });
});
