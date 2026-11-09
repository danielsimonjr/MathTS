/**
 * Issue #384: the synchronous Float64Array ops still ask the WASM tier first.
 *
 * The bridge is replaced by a spy. When the spy returns an array, the op must return that
 * same array. When the spy returns null, the op must compute the JS result.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/wasm/elementwise/wasm-bridge.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/wasm/elementwise/wasm-bridge.js')>();
  return { ...orig, elementwiseUnaryDispatch: vi.fn(orig.elementwiseUnaryDispatch) };
});

import { elementwiseUnaryDispatch } from '../src/wasm/elementwise/wasm-bridge.js';
import { abs, exp, log, log10, log2, log1p, expm1, sinh, tanh } from '../src/index.js';

type Fn = (a: Float64Array) => unknown;
const spy = vi.mocked(elementwiseUnaryDispatch);

const OPS: Array<[string, Fn, (x: number) => number]> = [
  ['abs', abs as Fn, Math.abs],
  ['exp', exp as Fn, Math.exp],
  ['log', log as Fn, Math.log],
  ['log10', log10 as Fn, Math.log10],
  ['log2', log2 as Fn, Math.log2],
  ['log1p', log1p as Fn, Math.log1p],
  ['expm1', expm1 as Fn, Math.expm1],
  ['sinh', sinh as Fn, Math.sinh],
  ['tanh', tanh as Fn, Math.tanh],
];

describe.each(OPS)('%s(Float64Array) asks the WASM tier first', (name, f, js) => {
  beforeEach(() => {
    spy.mockClear();
  });

  it('returns the WASM result when the bridge gives one', () => {
    const input = Float64Array.of(1, 2, 3);
    const sentinel = Float64Array.of(42, 43, 44);
    spy.mockReturnValueOnce(sentinel);
    expect(f(input)).toBe(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(name, input);
  });

  it('computes in JS, synchronously, when the bridge gives null', () => {
    const input = Float64Array.of(0.5, 2, 3);
    spy.mockReturnValueOnce(null);
    const out = f(input);
    expect(out).not.toBeInstanceOf(Promise);
    expect(Array.from(out as Float64Array)).toEqual(Array.from(input, js));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
