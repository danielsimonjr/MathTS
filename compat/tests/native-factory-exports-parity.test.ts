import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

const { create, createSin, sinDependencies } = compat;

describe('native compatibility dependency bundles', () => {
  it('can create a minimal sine instance using only compat imports', () => {
    const upstreamBundle = Reflect.get(oracle, 'sinDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const math = create({ sinDependencies });
    const upstream = oracle.create({ sinDependencies: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(math).sort()).toEqual(Object.keys(upstream).sort());
    expect(createSin.dependencies).toEqual(['typed']);
    expect(math.sin(0.5)).toBe(upstream.sin(0.5));
    const upstreamSin = upstream.sin as (value: unknown) => unknown;
    expect(() => upstreamSin([0, 0.5])).toThrow(TypeError);
    expect(() => math.sin([0, 0.5])).toThrow(TypeError);
  });

  it('passes the selected instance configuration to inverse trig factories', () => {
    const upstreamBundle = Reflect.get(oracle, 'acosDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const expected = oracle.create({ acosDependencies: upstreamBundle } as typeof upstreamBundle);
    const actual = create({ acosDependencies: compat.acosDependencies });
    const { re, im } = expected.acos(2) as { re: number; im: number };
    expect(actual.acos(2)).toMatchObject({ re, im });

    const predictable = create(
      { acosDependencies: compat.acosDependencies },
      { predictable: true }
    );
    expect(predictable.acos(2)).toBeNaN();
  });

  it.each([
    ['acos', [0.5]],
    ['acosh', [2]],
    ['acot', [0.5]],
    ['acoth', [2]],
    ['acsc', [2]],
    ['acsch', [0.5]],
    ['asec', [2]],
    ['asech', [0.5]],
    ['asin', [0.5]],
    ['asinh', [0.5]],
    ['atan', [0.5]],
    ['atanh', [0.5]],
    ['cos', [0.5]],
    ['cosh', [0.5]],
    ['cot', [0.5]],
    ['coth', [0.5]],
    ['csc', [0.5]],
    ['csch', [0.5]],
    ['sec', [0.5]],
    ['sech', [0.5]],
    ['sin', [0.5]],
    ['sinh', [0.5]],
    ['tan', [0.5]],
    ['tanh', [0.5]],
    ['abs', [-3.5]],
    ['addScalar', [3, 4]],
    ['arg', [-2]],
    ['bitNot', [6]],
    ['clone', [3]],
    ['conj', [4]],
    ['cube', [3]],
    ['equalScalar', [2, 2]],
    ['erf', [0.5]],
    ['exp', [1]],
    ['expm1', [0.25]],
    ['im', [3]],
    ['isBounded', [2]],
    ['isNaN', [NaN]],
    ['isNegative', [-2]],
    ['isNumeric', [2]],
    ['isPositive', [2]],
    ['isPrime', [23]],
    ['lgamma', [2.5]],
    ['log10', [1000]],
    ['log2', [128]],
    ['multiplyScalar', [3, 4]],
    ['not', [true]],
    ['re', [7]],
    ['square', [7]],
    ['subtractScalar', [3, 4]],
  ] as const)('%s has a native dependency bundle matching MathJS', (name, args) => {
    const bundleName = name + 'Dependencies';
    const factoryName = 'create' + name[0].toUpperCase() + name.slice(1);
    const bundle = Reflect.get(compat, bundleName) as Record<string, unknown>;
    const upstreamBundle = Reflect.get(oracle, bundleName) as Parameters<typeof oracle.create>[0];
    const math = create({ [bundleName]: bundle });
    const upstream = oracle.create({ [bundleName]: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(bundle)).toEqual(Object.keys(upstreamBundle));
    expect(Object.keys(math).sort()).toEqual(Object.keys(upstream).sort());
    expect(Reflect.get(compat, factoryName).dependencies).toEqual(
      Reflect.get(oracle, factoryName).dependencies
    );

    const actualFn = Reflect.get(math, name) as (...values: unknown[]) => unknown;
    const upstreamFn = Reflect.get(upstream, name) as (...values: unknown[]) => unknown;
    const result = actualFn(...args);
    const expected = upstreamFn(...args);
    if (typeof result === 'number' && typeof expected === 'number' && Number.isFinite(expected)) {
      expect(result).toBeCloseTo(expected, 14);
    } else {
      expect(result).toEqual(expected);
    }
  });
});
