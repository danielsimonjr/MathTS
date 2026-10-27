import { describe, it, expect, afterEach } from 'vitest';
import { create, all } from '../src/index.js';
import {
  config as barrelConfig,
  evaluate as barrelEvaluate,
} from '@danielsimonjr/mathts-functions';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';

afterEach(() => {
  barrelConfig({ number: 'number', matrix: 'Matrix' });
});

describe('create(all, config) instance isolation (#425)', () => {
  it('two instances keep distinct number settings without affecting the barrel', () => {
    const a = create(all, { number: 'BigNumber' });
    const b = create(all, { number: 'Fraction' });

    expect(a.config().number).toBe('BigNumber');
    expect(b.config().number).toBe('Fraction');
    expect(a.config().number).toBe('BigNumber');

    const barrel = barrelEvaluate('e ^ 2');
    expect(typeof barrel).toBe('number');
    expect(barrel).toBe(Math.E ** 2);
    expect(barrelConfig().number).toBe('number');

    type EvaluateFn = (expr: string) => unknown;
    const aVal = (a.evaluate as EvaluateFn)('e ^ 2');
    expect(aVal).toBeInstanceOf(BigNumber);
    expect(Math.abs(Number((aVal as BigNumber).valueOf()) - Math.E ** 2)).toBeLessThan(1e-12);

    const bHalf = (b.evaluate as EvaluateFn)('1/2');
    expect(bHalf).toBeInstanceOf(Fraction);
    expect((bHalf as Fraction).numerator).toBe(1n);
    expect((bHalf as Fraction).denominator).toBe(2n);

    const aAgain = (a.evaluate as EvaluateFn)('e ^ 2');
    expect(aAgain).toBeInstanceOf(BigNumber);
  });

  it('create(all) and create(all, {}) do not change barrel number', () => {
    const before = barrelConfig().number;
    create(all);
    create(all, {});
    expect(barrelConfig().number).toBe(before);
  });

  it('per-instance matrix config (GC12) without cross-instance or barrel leakage', () => {
    const a = create(all, { number: 'BigNumber' });
    const b = create(all, { number: 'Fraction' });

    type RangeFn = (start: number, end: number) => unknown;
    const isPlainArray = (x: unknown): boolean => Array.isArray(x);
    const isMatrixLike = (x: unknown): boolean =>
      !Array.isArray(x) && typeof (x as { toArray?: unknown })?.toArray === 'function';

    a.config({ matrix: 'Array' });
    expect(isPlainArray((a.range as RangeFn)(1, 4))).toBe(true);
    expect(isMatrixLike((b.range as RangeFn)(1, 4))).toBe(true);
    expect(barrelConfig().matrix).toBe('Matrix');
  });

  it('precision updates stay on the instance that set them', () => {
    const a = create(all, { number: 'BigNumber' });
    const b = create(all, { number: 'Fraction' });
    const barrelBefore = barrelConfig().precision;

    a.config({ precision: 128 });
    expect(a.config().precision).toBe(128);
    expect(b.config().precision).not.toBe(128);
    expect(barrelConfig().precision).toBe(barrelBefore);
  });
});
