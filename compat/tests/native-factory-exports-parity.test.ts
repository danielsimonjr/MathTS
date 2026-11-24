import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { create, createSin, sinDependencies } from '../src/index.js';

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
});
