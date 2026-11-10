/**
 * The synchronous trigonometry signatures still ask the WASM tier first.
 *
 * The bridge is replaced by a spy. When the spy returns an array, the op must return that
 * same array. When the spy returns null, the op must compute the JS result.
 * Under the shipped policy the bridge returns null for tan, cot, csc and atan; the call is kept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/wasm/elementwise/wasm-bridge.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/wasm/elementwise/wasm-bridge.js')>();
  return { ...orig, elementwiseUnaryDispatch: vi.fn(orig.elementwiseUnaryDispatch) };
});

import { elementwiseUnaryDispatch } from '../src/wasm/elementwise/wasm-bridge.js';
import { sin, cos, tan, csc, sec, cot, atan, atanh } from '../src/index.js';

type Fn = (a: Float64Array) => unknown;
const spy = vi.mocked(elementwiseUnaryDispatch);

const OPS: Array<[string, Fn, (x: number) => number]> = [
  ['sin', sin as Fn, Math.sin],
  ['cos', cos as Fn, Math.cos],
  ['tan', tan as Fn, Math.tan],
  ['csc', csc as Fn, (x) => 1 / Math.sin(x)],
  ['sec', sec as Fn, (x) => 1 / Math.cos(x)],
  ['cot', cot as Fn, (x) => 1 / Math.tan(x)],
  ['atan', atan as Fn, Math.atan],
  ['atanh', atanh as Fn, Math.atanh],
];

describe.each(OPS)('%s(Float64Array) asks the WASM tier first', (name, f, js) => {
  beforeEach(() => {
    spy.mockClear();
  });

  it('returns the WASM result when the bridge gives one', () => {
    const input = Float64Array.of(0.1, 0.2, 0.3);
    const sentinel = Float64Array.of(42, 43, 44);
    spy.mockReturnValueOnce(sentinel);
    expect(f(input)).toBe(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(name, input);
  });

  it('computes in JS, synchronously, when the bridge gives null', () => {
    const input = Float64Array.of(0.5, -0.25, 0.75);
    spy.mockReturnValueOnce(null);
    const out = f(input);
    expect(out).not.toBeInstanceOf(Promise);
    expect(Array.from(out as Float64Array)).toEqual(Array.from(input, js));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
