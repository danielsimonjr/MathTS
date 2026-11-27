import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  createCompatExpm,
  createCompatGammaBigNumberGuard,
  createCompatVarargsStatistics,
  tooFewArgumentsError,
  withBigIntStatisticsStrings,
  withComplexOrderingGuard,
  withFixedArity,
  withInvalidNumericStringGuard,
  withMaxArity,
  withRawSingleValue,
  withReductionDim0ScalarReturn,
  withSingleNumericStringGuard,
  withStatisticsEmptyCollectionThrow,
  withStatisticsMultiCollectionGuard,
} from '../../src/mathjs-parity-g02.js';

const echo = (...args: unknown[]): unknown => args;
const first = (...args: unknown[]): unknown => args[0];

describe('G02 adapter primitives (extra branch coverage)', () => {
  it('arity helpers throw mathjs-shaped errors', () => {
    const maxOne = withMaxArity('demo', 1, first);
    expect(maxOne(3)).toBe(3);
    expect(() => maxOne(1, 2)).toThrow(/Too many arguments/);
    const exactlyTwo = withFixedArity('two', 2, echo);
    expect(() => exactlyTwo(1)).toThrow(tooFewArgumentsError('two', 1).message);
  });

  it('numeric string and bigint statistic guards', () => {
    const guarded = withInvalidNumericStringGuard(first);
    expect(() => guarded('not-a-number')).toThrow(/not a valid number/);
    expect(() => guarded('1', 'x')).toThrow(/Cannot convert/);
    const emptyMax = withStatisticsEmptyCollectionThrow('max', first);
    expect(() => emptyMax([])).toThrow(/empty array/);
    const multi = withStatisticsMultiCollectionGuard(first);
    expect(() => multi([1], [2])).toThrow(/Scalar values expected/);
    const bigintMax = withBigIntStatisticsStrings(first, () => 'bigint', (...xs) =>
      xs.reduce((a, b) => (a as bigint) + BigInt(String(b)), 0n)
    );
    expect(bigintMax('2', '3')).toBe(5n);
    const singleNum = withSingleNumericStringGuard(first);
    expect(() => singleNum('not-a-number')).toThrow();
  });

  it('reduction and ordering guards keep mathjs shapes', () => {
    const instance = create(all);
    const reduce = withReductionDim0ScalarReturn(() =>
      instance.matrix([9])
    );
    const vec = instance.matrix([1, 2, 3]);
    expect(reduce(vec, 0)).toBe(9);
    const raw = withRawSingleValue(first);
    expect(raw(2n)).toBe(2n);
    const order = withComplexOrderingGuard('min', first);
    expect(() => order(new Complex(1, 2), 3)).toThrow(/Cannot calculate min/);
  });

  it('expm, gamma guard, and statistics factory wrappers', () => {
    const instance = create(all);
    const expm = createCompatExpm(instance.expm.bind(instance), instance.matrix.bind(instance));
    const out = expm(instance.matrix([
      [0, 0],
      [0, 0],
    ]) as unknown) as { isMatrix?: boolean };
    expect(out.isMatrix).toBe(true);
    const gamma = createCompatGammaBigNumberGuard(instance.gamma.bind(instance), (v) =>
      instance.bignumber(v as number)
    );
    expect(gamma(instance.bignumber(2))).toBeDefined();
    const stat = createCompatVarargsStatistics((...args: unknown[]) => args.length);
    expect(stat(instance.matrix([1, 2]))).toBe(1);
    expect(stat([1, 2, 3])).toBe(1);
  });

  it('mad on fractions exercises index compare wiring indirectly', () => {
    const instance = create(all);
    const mad = instance.mad(
      instance.fraction(1, 2) as unknown as number,
      instance.fraction(1, 4) as unknown as number,
      instance.fraction(1, 8) as unknown as number
    );
    expect(typeof mad === 'number' || instance.isFraction(mad)).toBe(true);
  });
});

describe('BigNumber range includeEnd append path (#1785)', () => {
  it('appends the stop when includeEnd omits it', () => {
    const bn = create(all, { number: 'BigNumber' });
    const r = bn.range(bn.bignumber(0), bn.bignumber(2), true) as { toArray(): unknown[] };
    const last = r.toArray()[r.toArray().length - 1];
    expect(bn.equal(last, bn.bignumber(2))).toBe(true);
  });
});