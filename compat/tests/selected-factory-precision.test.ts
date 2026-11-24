import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { BigNumber, create, sinDependencies } from '../src/index.js';

describe('precision in selected compatibility factory bundles', () => {
  it('uses each instance’s configured precision and restores the caller’s decimal context', () => {
    const savedPrecision = BigNumber.precision;
    const upstreamBundle = Reflect.get(oracle, 'sinDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const upstreamFactories = { sinDependencies: upstreamBundle } as typeof upstreamBundle;

    const options = { number: 'BigNumber', precision: 21 } as const;
    const actual = create({ sinDependencies }, options);
    const expected = oracle.create(upstreamFactories, options);
    const otherOptions = { number: 'BigNumber', precision: 34 } as const;
    const other = create({ sinDependencies }, otherOptions);
    const otherExpected = oracle.create(upstreamFactories, otherOptions);
    const argument = '0.5';

    const result = () => String(actual.sin(new actual.BigNumber(argument)));
    const ExpectedBigNumber = Reflect.get(expected, 'BigNumber');
    const OtherExpectedBigNumber = Reflect.get(otherExpected, 'BigNumber');
    const reference = () => String(expected.sin(new ExpectedBigNumber(argument)));
    const second = () => String(other.sin(new other.BigNumber(argument)));
    const secondReference = () => String(otherExpected.sin(new OtherExpectedBigNumber(argument)));
    expect(result()).toBe(reference());
    expect(second()).toBe(secondReference());
    expect(result()).toBe(reference());

    actual.config({ precision: 19 });
    expected.config({ precision: 19 });
    expect(result()).toBe(reference());
    expect(second()).toBe(secondReference());
    const invalidSin = actual.sin as (value: unknown) => unknown;
    expect(() => invalidSin(Symbol('not numeric'))).toThrow(TypeError);
    expect(BigNumber.precision).toBe(savedPrecision);
  });
});
