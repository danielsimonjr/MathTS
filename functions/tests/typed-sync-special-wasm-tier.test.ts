/**
 * The synchronous special-function signatures still ask the WASM bridge first.
 *
 * The bridges are replaced by spies that return a sentinel array. The op must return that
 * same array, synchronously. erfc asks `elementwiseUnaryDispatch` at every size; the
 * others ask their `*Dispatch` bridge at or above WASM_SPECIAL_THRESHOLD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/wasm/elementwise/wasm-bridge.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/wasm/elementwise/wasm-bridge.js')>();
  return { ...orig, elementwiseUnaryDispatch: vi.fn(orig.elementwiseUnaryDispatch) };
});
vi.mock('../src/wasm/special/wasm-bridge.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/wasm/special/wasm-bridge.js')>();
  const names = [
    'lgammaDispatch',
    'besselJ0Dispatch',
    'besselJ1Dispatch',
    'besselY0Dispatch',
    'besselY1Dispatch',
    'besselJDispatch',
    'besselYDispatch',
    'ellipticKDispatch',
    'ellipticEDispatch',
    'airyAiDispatch',
    'airyBiDispatch',
  ] as const;
  const spies: Record<string, unknown> = {};
  for (const n of names) spies[n] = vi.fn(orig[n] as (...a: never[]) => unknown);
  return { ...orig, ...spies };
});

import { elementwiseUnaryDispatch } from '../src/wasm/elementwise/wasm-bridge.js';
import * as bridge from '../src/wasm/special/wasm-bridge.js';
import * as F from '../src/index.js';

type Fn = (...args: unknown[]) => unknown;

// [op, bridge export, leading scalar args]
const BRIDGED: Array<[string, keyof typeof bridge, number[]]> = [
  ['lgamma', 'lgammaDispatch', []],
  ['besselJ0', 'besselJ0Dispatch', []],
  ['besselJ1', 'besselJ1Dispatch', []],
  ['besselY0', 'besselY0Dispatch', []],
  ['besselY1', 'besselY1Dispatch', []],
  ['besselJ', 'besselJDispatch', [2]],
  ['besselY', 'besselYDispatch', [2]],
  ['ellipticK', 'ellipticKDispatch', []],
  ['ellipticE', 'ellipticEDispatch', []],
  ['airyAi', 'airyAiDispatch', []],
  ['airyBi', 'airyBiDispatch', []],
];

describe('erfc(Float64Array) asks elementwiseUnaryDispatch first', () => {
  const spy = vi.mocked(elementwiseUnaryDispatch);
  beforeEach(() => {
    spy.mockClear();
  });

  it('returns the WASM result when the bridge gives one', () => {
    const x = Float64Array.of(0.1, 0.2);
    const sentinel = Float64Array.of(7, 8);
    spy.mockReturnValueOnce(sentinel);
    expect((F as unknown as Record<string, Fn>).erfc(x)).toBe(sentinel);
    expect(spy).toHaveBeenCalledWith('erfc', x);
  });
});

describe.each(BRIDGED)('%s(Float64Array) asks %s first', (op, name, lead) => {
  const spy = vi.mocked(bridge[name] as unknown as Fn);
  beforeEach(() => {
    spy.mockClear();
  });

  it('returns the bridge result at WASM_SPECIAL_THRESHOLD, synchronously', () => {
    const x = new Float64Array(bridge.WASM_SPECIAL_THRESHOLD).fill(0.5);
    const sentinel = new Float64Array(bridge.WASM_SPECIAL_THRESHOLD).fill(42);
    spy.mockReturnValueOnce(sentinel);
    const out = (F as unknown as Record<string, Fn>)[op](...lead, x);
    expect(out === sentinel).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not ask the bridge below the threshold', () => {
    (F as unknown as Record<string, Fn>)[op](...lead, Float64Array.of(0.5, 0.25));
    expect(spy).not.toHaveBeenCalled();
  });
});
