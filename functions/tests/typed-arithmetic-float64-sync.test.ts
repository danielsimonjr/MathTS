/**
 * Issue #384: every Float64Array signature of the typed arithmetic functions is synchronous.
 *
 * The functions return a Float64Array (element-wise) or a number (reduction), never a Promise.
 * The tests compare each result element by element with Object.is, so NaN and -0 count.
 * The worker-pool path stays available through ComputePool and parallelMap.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { pairwiseDot } from '@danielsimonjr/mathts-core';
import {
  add,
  subtract,
  multiply,
  divide,
  unaryMinus,
  abs,
  sign,
  sqrt,
  square,
  cube,
  cbrt,
  exp,
  log,
  log10,
  log2,
  log1p,
  expm1,
  round,
  floor,
  ceil,
  fix,
  norm,
  sinh,
  cosh,
  tanh,
  min,
  max,
  dot,
} from '../src/index.js';

type Fn = (...args: unknown[]) => unknown;
const F = (...xs: number[]): Float64Array => Float64Array.of(...xs);

/** Assert a synchronous Float64Array result whose elements are Object.is-equal to `expected`. */
function expectF64(out: unknown, expected: number[]): void {
  expect(out).not.toBeInstanceOf(Promise);
  expect(out).toBeInstanceOf(Float64Array);
  const arr = out as Float64Array;
  expect(arr.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Object.is(arr[i], expected[i]), `index ${i}: ${arr[i]} vs ${expected[i]}`).toBe(true);
  }
}

describe('binary element-wise ops are synchronous', () => {
  it('subtract(F64, F64) is the #384 case', () => {
    expectF64(subtract(F(1, 2), F(1, 1)), [0, 1]);
  });
  it('add', () => expectF64(add(F(1, 2, 3), F(1, 1, 1)), [2, 3, 4]));
  it('multiply pair, array*scalar, scalar*array', () => {
    expectF64(multiply(F(1, 2, 3), F(2, 2, 2)), [2, 4, 6]);
    expectF64(multiply(F(1, 2), 3), [3, 6]);
    expectF64(multiply(3, F(1, 2)), [3, 6]);
    expectF64(multiply(F(-1, 0), 0), [-0, 0]);
  });
  it('divide', () => expectF64(divide(F(2, 4), F(2, 2)), [1, 2]));

  it('keeps operand order', () => {
    expectF64(subtract(F(5), F(2)), [3]);
    expectF64(divide(F(8), F(2)), [4]);
    expectF64(add(F(-0), F(-0)), [-0]);
    expectF64(subtract(F(0), F(0)), [0]);
  });

  it('throws RangeError on a length mismatch, for each operand shorter', () => {
    const fns: Fn[] = [add as Fn, subtract as Fn, multiply as Fn, divide as Fn];
    for (const f of fns) {
      expect(() => f(F(1, 2), F(1, 2, 3))).toThrow(
        new RangeError('Dimension mismatch (2 != 3) in element-wise operation')
      );
      expect(() => f(F(1, 2, 3), F(1, 2))).toThrow(
        new RangeError('Dimension mismatch (3 != 2) in element-wise operation')
      );
    }
  });

  it('does not mutate the inputs and returns a fresh array', () => {
    const a = F(5, 6);
    const b = F(1, 2);
    for (const out of [
      subtract(a, b),
      add(a, b),
      multiply(a, b),
      divide(a, b),
      multiply(a, 2),
      multiply(2, a),
    ]) {
      expect(out).not.toBe(a);
      expect(out).not.toBe(b);
    }
    expect(Array.from(a)).toEqual([5, 6]);
    expect(Array.from(b)).toEqual([1, 2]);
  });

  it('variadic add folds Float64Arrays', () => {
    expectF64(add(F(1), F(2), F(3)), [6]);
  });

  it('empty arrays give empty arrays', () => {
    expectF64(add(F(), F()), []);
    expectF64(multiply(F(), 2), []);
  });
});

// Unary ops: explicit pins of exact values, then an Object.is check against the
// `number` signature on an input that holds NaN, -0, +-Infinity and fractions.
const UNARY: Array<[string, Fn, number[], number[], ((x: number) => number)?]> = [
  ['unaryMinus', unaryMinus as Fn, [1, -2, 0], [-1, 2, -0]],
  ['abs', abs as Fn, [-3, 2, -0], [3, 2, 0]],
  ['sign', sign as Fn, [-3, 2, -0, 0], [-1, 1, -0, 0]],
  // sqrt of a negative element is NaN (the old worker kernel was Math.sqrt); the scalar
  // `number` signature returns a Complex there, so the mixed check uses Math.sqrt.
  ['sqrt', sqrt as Fn, [4, 9, -0, -4], [2, 3, -0, NaN], Math.sqrt],
  ['square', square as Fn, [-3, 2], [9, 4]],
  ['cube', cube as Fn, [-2, 3], [-8, 27]],
  ['cbrt', cbrt as Fn, [27, -8], [3, -2]],
  ['exp', exp as Fn, [0], [1]],
  ['log', log as Fn, [1], [0]],
  ['log10', log10 as Fn, [100, 1000], [2, 3]],
  ['log2', log2 as Fn, [8, 1024], [3, 10]],
  ['log1p', log1p as Fn, [0, -0], [0, -0]],
  ['expm1', expm1 as Fn, [0, -0], [0, -0]],
  // round(-0.4) is -0 (Math.round keeps the sign); round(2.5) is 3, round(-2.5) is -2.
  ['round', round as Fn, [-0.4, 2.5, -2.5, 1.4], [-0, 3, -2, 1]],
  ['floor', floor as Fn, [-1.5, 1.5], [-2, 1]],
  ['ceil', ceil as Fn, [-1.5, 1.5, -0.5], [-1, 2, -0]],
  ['fix', fix as Fn, [-1.7, 1.7, -0.2], [-1, 1, -0]],
  ['sinh', sinh as Fn, [0, -0], [0, -0]],
  ['cosh', cosh as Fn, [0], [1]],
  ['tanh', tanh as Fn, [0, -0, Infinity], [0, -0, 1]],
];

const MIXED = [NaN, -0, 0, 0.5, -0.5, 1.5, -2.5, 3, -7.25, Infinity, -Infinity, 1e-300, 42];

describe.each(UNARY)('%s(Float64Array) is synchronous', (_name, f, input, expected, ref) => {
  it('pins exact values', () => expectF64(f(F(...input)), expected));

  it('matches the number signature element by element (NaN, -0, Infinity)', () => {
    expectF64(
      f(F(...MIXED)),
      MIXED.map((x) => (ref ? ref(x) : (f(x) as number)))
    );
  });

  it('does not mutate the input, returns a fresh array, keeps empty empty', () => {
    const a = F(...MIXED);
    const out = f(a);
    expect(out).not.toBe(a);
    for (let i = 0; i < MIXED.length; i++) expect(Object.is(a[i], MIXED[i])).toBe(true);
    expectF64(f(F()), []);
  });
});

describe('reductions return a number synchronously', () => {
  it('norm is the scaled Euclidean norm', () => {
    const out = norm(F(3, 4));
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toBe(5);
    // squaring first would overflow to Infinity
    expect(norm(F(3e200, 4e200))).toBeCloseTo(5e200, -190);
    expect(norm(F())).toBe(0);
  });

  it('min and max', () => {
    expect(min(F(3, -1, 2))).toBe(-1);
    expect(max(F(3, -1, 2))).toBe(3);
    expect(min(F(3, -1, 2))).not.toBeInstanceOf(Promise);
    expect(max(F(3, -1, 2))).not.toBeInstanceOf(Promise);
    expect(Object.is(min(F(0, -0)), 0)).toBe(true);
    // Empty input gives the identity of the comparison.
    expect(min(F())).toBe(Infinity);
    expect(max(F())).toBe(-Infinity);
  });

  it('min and max skip NaN (the pre-change sequential loop behaviour)', () => {
    // The loop compares with `<` / `>`, and a comparison with NaN is false, so NaN never
    // becomes the running value. This is the behaviour of the 'never'-gated path that ran
    // before #384 and stays the same here; the plain-Array path uses Math.min and gives NaN.
    expect(min(F(NaN, 2, 1))).toBe(1);
    expect(max(F(1, NaN, 2))).toBe(2);
    expect(min(F(NaN))).toBe(Infinity);
  });

  it('dot is pairwise, not a naive left-to-right sum', () => {
    expect(dot(F(1, 2, 3), F(4, 5, 6))).toBe(32);
    expect(dot(F(1, 2, 3), F(4, 5, 6))).not.toBeInstanceOf(Promise);
    // 256 terms: 1e16 then 127 ones, then -1e16 then 127 ones. A naive left-to-right loop
    // loses every 1 that follows 1e16 and gives 127. The pairwise kernel (8 partial sums per
    // block of 128) keeps a different set of ones, so the two results differ.
    const a = new Float64Array(256).fill(1);
    a[0] = 1e16;
    a[128] = -1e16;
    const b = new Float64Array(256).fill(1);
    let naive = 0;
    for (let i = 0; i < a.length; i++) naive += a[i] * b[i];
    expect(naive).toBe(127);
    expect(dot(a, b)).toBe(pairwiseDot(a, b));
    expect(dot(a, b)).not.toBe(naive);
    expect(dot(a, b)).toBe(dot(Array.from(a), Array.from(b)));
    expect(() => dot(F(1, 2), F(1))).toThrow();
  });
});

// The 14 ops that dispatched to workers at >= 50 000 elements before #384: the sync
// result must equal the worker kernel result on the same input.
describe('ops that went to workers above 50k equal the worker kernel', () => {
  beforeAll(async () => {
    await computePool.initialize();
  });
  afterAll(async () => {
    await computePool.terminate();
  });

  const N = 60_000;
  const data = new Float64Array(N);
  for (let i = 0; i < N; i++) data[i] = ((i * 7919) % 10007) / 1000 + 0.001;

  const KERNELS: Array<[string, Fn, string]> = [
    ['sign', sign as Fn, '(x) => Math.sign(x)'],
    ['cube', cube as Fn, '(x) => x * x * x'],
    ['cbrt', cbrt as Fn, '(x) => Math.cbrt(x)'],
    ['log10', log10 as Fn, '(x) => Math.log10(x)'],
    ['log2', log2 as Fn, '(x) => Math.log2(x)'],
    ['log1p', log1p as Fn, '(x) => Math.log1p(x)'],
    ['expm1', expm1 as Fn, '(x) => Math.expm1(x)'],
    ['round', round as Fn, '(x) => Math.round(x)'],
    ['floor', floor as Fn, '(x) => Math.floor(x)'],
    ['ceil', ceil as Fn, '(x) => Math.ceil(x)'],
    ['fix', fix as Fn, '(x) => Math.trunc(x)'],
    ['sinh', sinh as Fn, '(x) => Math.sinh(x)'],
    ['cosh', cosh as Fn, '(x) => Math.cosh(x)'],
    ['tanh', tanh as Fn, '(x) => Math.tanh(x)'],
  ];

  it.each(KERNELS)('%s', async (_name, f, src) => {
    const ref = (await computePool.applyKernel(data, src)).result;
    expectF64(f(data), Array.from(ref));
  });
});
