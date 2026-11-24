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
    ['acos', 0.5],
    ['acosh', 2],
    ['acot', 0.5],
    ['acoth', 2],
    ['acsc', 2],
    ['acsch', 0.5],
    ['asec', 2],
    ['asech', 0.5],
    ['asin', 0.5],
    ['asinh', 0.5],
    ['atan', 0.5],
    ['atanh', 0.5],
    ['cos', 0.5],
    ['cosh', 0.5],
    ['cot', 0.5],
    ['coth', 0.5],
    ['csc', 0.5],
    ['csch', 0.5],
    ['sec', 0.5],
    ['sech', 0.5],
    ['sin', 0.5],
    ['sinh', 0.5],
    ['tan', 0.5],
    ['tanh', 0.5],
  ])('%s has a native factory and dependency bundle matching MathJS', (name, value) => {
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
    expect(Reflect.get(math, name)(value)).toBeCloseTo(Reflect.get(upstream, name)(value), 14);
  });
});
