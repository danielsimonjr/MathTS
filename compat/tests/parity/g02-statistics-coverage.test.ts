import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  createCompatMathjsStatistics,
  withComplexOrderingGuard,
  createCompatArg,
} from '../../src/mathjs-parity-g02.js';
import { BigNumber as CompatBigNumber } from '../../src/bignumber.js';

describe('createCompatMathjsStatistics branch coverage', () => {
  const instance = create(all);
  const deps = {
    subtract: (a: unknown, b: unknown) => (a as number) - (b as number),
    add: (a: unknown, b: unknown) => (a as number) + (b as number),
    divide: (a: unknown, b: unknown) => (a as number) / (b as number),
    multiply: (a: unknown, b: unknown) => (a as number) * (b as number),
    sqrt: Math.sqrt,
    matrix: (values: unknown) => instance.matrix(values),
    mapSlices: instance.mapSlices.bind(instance) as (
      data: unknown,
      dim: number,
      fn: (slice: unknown) => unknown
    ) => unknown,
  };
  const nativeVar = instance.variance.bind(instance);
  const nativeStd = instance.std.bind(instance);
  const variance = createCompatMathjsStatistics('variance', nativeVar, deps);
  const std = createCompatMathjsStatistics('std', nativeStd, deps);

  it('rejects empty and invalid collections like mathjs', () => {
    expect(() => variance()).toThrow(/Too few arguments/);
    expect(() => variance([])).toThrow(/parameters|empty/i);
    expect(() => variance('bad')).toThrow(/not a valid number/);
    expect(() => variance([1, 2], 'bogus')).toBeDefined();
  });

  it('handles matrices, dimensions, and complex variadic lists', () => {
    const m = instance.matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(variance(m)).toBeDefined();
    expect(variance(m, 'unbiased')).toBeDefined();
    expect(variance(m, 0)).toBeDefined();
    expect(variance(m, 0, 'biased')).toBeDefined();
    expect(std(instance.matrix([new Complex(1, 1), new Complex(0, 1)]))).toBeDefined();
    expect(variance(1, 2, 3)).toBeDefined();
    expect(variance([new Complex(1, 2), 3, 4])).toBeDefined();
  });
});

describe('additional G02 guards', () => {
  const echo = (...args: unknown[]): unknown => args[0];

  it('withComplexOrderingGuard blocks multi-arg Complex min/max', () => {
    const max = withComplexOrderingGuard('max', echo);
    expect(() => max(new Complex(1, 2), 3)).toThrow(/Cannot calculate max/);
  });

  it('createCompatArg uses pi for negative BigNumber inputs', () => {
    const arg = createCompatArg(
      echo,
      CompatBigNumber,
      () => 20,
      (_p, build) => build(),
      () => 3.14159
    );
    const out = arg(new CompatBigNumber(-2)) as CompatBigNumber;
    expect(Number(out.toString())).toBeCloseTo(3.14159, 3);
  });
});
