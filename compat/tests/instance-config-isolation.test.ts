import { describe, it, expect, afterEach } from 'vitest';
import { create, all } from '../src/index.js';
import {
  config as barrelConfig,
  evaluate as barrelEvaluate,
  sin as barrelSin,
  divide as barrelDivide,
  Interval,
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

  it('resolves constants at the active precision in evaluated and compiled expressions', () => {
    const math = create(all, { number: 'BigNumber', precision: 32 });
    expect(String(math.evaluate('pi'))).toBe('3.1415926535897932384626433832795');
    const compiled = math.compile('pi');
    expect(String(compiled.evaluate())).toBe('3.1415926535897932384626433832795');
    math.config({ precision: 20 });
    expect(String(math.evaluate('pi'))).toBe('3.1415926535897932385');
    expect(String(compiled.evaluate())).toBe('3.1415926535897932385');
    math.config({ precision: 80 });
    expect(String(compiled.evaluate())).toBe(BigNumber.piAt(80).toString());
    expect(math.evaluate('pi', { pi: 3 })).toBe(3);
    math.import({ pi: 3 }, { override: true });
    expect(math.evaluate('pi')).toBe(3);
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
    const short = create(all, { number: 'BigNumber', precision: 7 });
    a.config({ precision: 20 });
    const saved = BigNumber.precision;
    expect(String(a.evaluate('1/3'))).toBe('0.33333333333333333333');
    expect(String(short.compile('1/3').evaluate())).toBe('0.3333333');
    expect(String(a.compile('e^2').evaluate())).toBe('7.3890560989306502274');
    expect(() => short.evaluate('missingVariable')).toThrow();
    expect(BigNumber.precision).toBe(saved);
  });

  it('wrapped methods keep typed-function metadata and constructability', () => {
    const math = create(all);
    type TypedFn = { name: string; length: number; signatures?: unknown };

    // Independent oracle: the unwrapped functions-barrel `sin` / `divide`.
    expect((math.sin as TypedFn).name).toBe((barrelSin as TypedFn).name);
    expect((math.sin as TypedFn).length).toBe((barrelSin as TypedFn).length);
    expect((math.sin as TypedFn).signatures).toBe((barrelSin as TypedFn).signatures);
    expect((math.divide as TypedFn).signatures).toBe((barrelDivide as TypedFn).signatures);

    const Ctor = math.Interval as typeof Interval;
    const iv = new Ctor(0, 1);
    expect(iv).toBeInstanceOf(Interval);
    expect(iv.lo).toBe(0);
    expect(iv.hi).toBe(1);
  });

  it('chain looks up wrapped methods (post-wrap) without leaking barrel config', () => {
    const a = create(all, { number: 'Fraction' });
    expect(a.chain(3).add(4).done()).toBe(7);
    type EvaluateFn = (expr: string) => unknown;
    expect((a.evaluate as EvaluateFn)('1/2')).toBeInstanceOf(Fraction);
    expect(typeof barrelEvaluate('1/2')).toBe('number');
  });
});
