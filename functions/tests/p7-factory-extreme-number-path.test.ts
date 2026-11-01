/**
 * P7-3 pins: `factory_max` / `factory_min` number fast path and its fallbacks.
 *
 * Every expectation holds on the pre-change `reduceExtreme` as well: the reference walk below is
 * the pre-change algorithm written against the public `isNaN`, `larger` and `smaller`.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import {
  bignumber,
  factory_larger,
  factory_max,
  factory_min,
  factory_smaller,
  isNaN as mathIsNaN,
  matrix,
} from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createMax } from '../src/statistics/max.js';
import { createMin } from '../src/statistics/min.js';

type Reduce = (a: unknown) => unknown;
type Pick = 'max' | 'min';

const larger = factory_larger as (a: unknown, b: unknown) => unknown;
const smaller = factory_smaller as (a: unknown, b: unknown) => unknown;
const isNaNFn = mathIsNaN as (a: unknown) => unknown;

function flatten(value: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
  } else {
    out.push(value);
  }
  return out;
}

function reference(
  values: unknown,
  pick: Pick,
  compare: (a: unknown, b: unknown) => unknown = pick === 'max' ? larger : smaller
): unknown {
  let res: unknown;
  for (const value of flatten(values)) {
    if (isNaNFn(value)) res = value;
    else if (res === undefined || compare(value, res)) res = value;
  }
  return typeof res === 'string' ? Number(res) : res;
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b);
  return typeof a === typeof b && String(a) === String(b);
}

function outcome(fn: () => unknown): { threw: true } | { threw: false; value: unknown } {
  try {
    return { threw: false, value: fn() };
  } catch {
    return { threw: true };
  }
}

function seeded(n: number, seed: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push((s / 0xffffffff) * 2000 - 1000);
  }
  return out;
}

function withScope(overrides: Record<string, unknown>): Record<string, unknown> {
  return new Proxy(factoryScope, {
    get: (target, key) =>
      typeof key === 'string' && key in overrides ? overrides[key] : target[key as string],
    has: (target, key) => key in target,
  });
}

describe('P7-3 factory max/min number path', () => {
  const runs: [Pick, Reduce][] = [
    ['max', factory_max as Reduce],
    ['min', factory_min as Reduce],
  ];

  for (const [pick, run] of runs) {
    describe(`factory_${pick}`, () => {
      it('seeded arrays equal the pre-change walk', () => {
        for (const n of [1, 2, 3, 10, 1000, 10_000]) {
          const a = seeded(n, 0x7003003 + n);
          expect(same(run(a), reference(a, pick))).toBe(true);
        }
        const a = seeded(1000, 0x7003003 + 1000);
        const sorted = [...a].sort((x, y) => x - y);
        expect(run(a)).toBe(pick === 'max' ? sorted[999] : sorted[0]);
      });

      it('NaN at the start, middle and end returns that NaN', () => {
        for (const at of [0, 1, 2]) {
          const a = [1, 2, 3];
          a[at] = NaN;
          expect(Object.is(run(a), NaN)).toBe(true);
        }
        const big = seeded(10_000, 0x7003a01);
        big[7777] = NaN;
        expect(Object.is(run(big), NaN)).toBe(true);
      });

      it('a NaN followed by numbers stays NaN, as does a NaN that follows them', () => {
        expect(Object.is(run([NaN, 5, 1, 9]), NaN)).toBe(true);
        expect(Object.is(run([5, 1, 9, NaN, 3]), NaN)).toBe(true);
        expect(Object.is(run([NaN, NaN]), NaN)).toBe(true);
      });

      it('[-0, 0], [0, -0] and [-0] follow `larger` / `smaller`, not Math.max / Math.min', () => {
        expect(same(run([-0, 0]), reference([-0, 0], pick))).toBe(true);
        expect(same(run([0, -0]), reference([0, -0], pick))).toBe(true);
        expect(Object.is(run([-0]), -0)).toBe(true);
        // `larger` and `smaller` call -0 and 0 equal, so the first of the two stays.
        expect(Object.is(run([-0, 0]), -0)).toBe(true);
        expect(Object.is(run([0, -0]), 0)).toBe(true);
      });

      it('values within config.relTol are equal, so the first of them stays', () => {
        const eps = 1e-14;
        expect(Object.is(run([1, 1 + eps]), 1)).toBe(true);
        expect(Object.is(run([1 + eps, 1]), 1 + eps)).toBe(true);
        expect(Object.is(run([1 - eps, 1, 1 + eps]), 1 - eps)).toBe(true);
        const clear = pick === 'max' ? [1, 1 + 1e-6] : [1 + 1e-6, 1];
        expect(Object.is(run(clear), pick === 'max' ? 1 + 1e-6 : 1)).toBe(true);
      });

      it('Infinity and -Infinity', () => {
        expect(run([1, Infinity, -Infinity])).toBe(pick === 'max' ? Infinity : -Infinity);
        expect(run([Infinity, Infinity])).toBe(Infinity);
      });

      it('a Fraction last: the numbers before it are compared once, with the same result', () => {
        const a: unknown[] = new Array(200).fill(1);
        a[199] = new Fraction(3, 2);
        const result = run(a);
        expect(same(result, reference(a, pick))).toBe(true);
        expect(String(result)).toBe(pick === 'max' ? '3/2' : '1');
      });

      it('a Fraction in the middle of numbers', () => {
        const a: unknown[] = seeded(300, 0x7003b02);
        a[150] = new Fraction(1, 3);
        expect(same(run(a), reference(a, pick))).toBe(true);
      });

      it('a Fraction first keeps the whole array generic', () => {
        const a: unknown[] = seeded(50, 0x7003c03);
        a.unshift(new Fraction(1, 2));
        expect(same(run(a), reference(a, pick))).toBe(true);
      });

      it('BigNumber entries', () => {
        const a = [bignumber('1.5'), bignumber('-2.5'), bignumber('0.25')];
        expect(String(run(a))).toBe(pick === 'max' ? '1.5' : '-2.5');
        const mixed: unknown[] = [4, 9, bignumber('7')];
        expect(same(run(mixed), reference(mixed, pick))).toBe(true);
      });

      it('a numeric string is converted to a number, also after numbers', () => {
        expect(run(['40'])).toBe(40);
        expect(run([' 5 '])).toBe(5);
        expect(same(run([1, '2']), reference([1, '2'], pick))).toBe(true);
        expect(run([1, 2, '40'])).toBe(pick === 'max' ? 40 : 1);
        expect(() => run(['3', '12'])).toThrow(new RegExp(`Cannot calculate ${pick}`));
      });

      it('a 2-D array is flattened by the generic walk', () => {
        const rows = [seeded(100, 1), seeded(100, 2), seeded(100, 3)];
        expect(same(run(rows), reference(rows, pick))).toBe(true);
        const after: unknown[] = [4, [9, 2], 6];
        expect(same(run(after), reference(after, pick))).toBe(true);
      });

      it('a DenseMatrix', () => {
        const a = seeded(100, 0x7003d04);
        expect(same(run(matrix(a)), reference(a, pick))).toBe(true);
        const m = matrix([
          [1, 2],
          [3, 4],
        ]);
        expect(run(m)).toBe(pick === 'max' ? 4 : 1);
      });

      it('the empty array keeps its error', () => {
        expect(() => run([])).toThrow(`Cannot calculate ${pick} of an empty array`);
        expect(() => run([[]])).toThrow(`Cannot calculate ${pick} of an empty array`);
      });

      it('an Array subclass keeps the generic walk, and a hole is still an unexpected type', () => {
        class Sub<T> extends Array<T> {}
        const sub = Sub.from([5, 1, 9]);
        expect(same(run(sub), reference([...sub], pick))).toBe(true);
        const holey = new Array<number>(4);
        holey[0] = 3;
        holey[2] = 8;
        holey[3] = 1;
        expect(() => run(holey)).toThrow(/unexpected type of argument/);
      });

      it('random mixes of numbers, NaN, strings, Fractions and nested arrays', () => {
        let s = 0x7003e05;
        const next = () => {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          return s / 0xffffffff;
        };
        for (let round = 0; round < 200; round++) {
          const n = 1 + Math.floor(next() * 12);
          const values: unknown[] = [];
          for (let i = 0; i < n; i++) {
            const r = next();
            if (r < 0.05) values.push(NaN);
            else if (r < 0.1) values.push(String(Math.floor(next() * 100)));
            else if (r < 0.15) values.push(new Fraction(Math.floor(next() * 9) - 4, 3));
            else if (r < 0.2) values.push([Math.floor(next() * 50), Math.floor(next() * 50)]);
            else if (r < 0.25) values.push(next() < 0.5 ? -0 : 0);
            else values.push(Math.floor(next() * 40) - 20);
          }
          const got = outcome(() => run(values));
          const want = outcome(() => reference(values, pick));
          if (want.threw) expect(got.threw).toBe(true);
          else expect(got.threw === false && same(got.value, want.value)).toBe(true);
        }
      });
    });
  }

  describe('dependencies replaced through the factory scope', () => {
    const real: Record<Pick, (a: unknown, b: unknown) => unknown> = { max: larger, min: smaller };
    const make: Record<Pick, (scope: Record<string, unknown>) => Reduce> = {
      max: (scope) => createMax(scope as Parameters<typeof createMax>[0]) as Reduce,
      min: (scope) => createMin(scope as Parameters<typeof createMin>[0]) as Reduce,
    };
    const dep: Record<Pick, string> = { max: 'larger', min: 'smaller' };

    for (const pick of ['max', 'min'] as const) {
      it(`a plain-function ${dep[pick]} keeps ${pick} working on the generic path`, () => {
        const impl = real[pick];
        const run = make[pick](withScope({ [dep[pick]]: (a: unknown, b: unknown) => impl(a, b) }));
        const a = seeded(50, 0x7003f06);
        expect(same(run(a), reference(a, pick))).toBe(true);
        expect(Object.is(run([-0, 0]), -0)).toBe(true);
      });

      it(`a plain-function isNaN keeps ${pick} working on the generic path`, () => {
        const run = make[pick](withScope({ isNaN: (a: unknown) => isNaNFn(a) }));
        const a = seeded(50, 0x7003f07);
        a[20] = NaN;
        expect(Object.is(run(a), NaN)).toBe(true);
        expect(run([1, 2, 3])).toBe(pick === 'max' ? 3 : 1);
      });

      it(`${pick} calls a replaced ${dep[pick]} with the same arguments in the same order as the generic walk`, () => {
        const impl = real[pick];
        let trace: string[] = [];
        let numberCalls = 0;
        const record =
          (kind: string) =>
          (a: unknown, b: unknown): unknown => {
            trace.push(`${kind}(${String(a)},${String(b)})`);
            if (kind === 'nn') numberCalls++;
            return impl(a, b);
          };
        const counting = (factoryScope.typed as (name: string, sigs: object) => unknown)(
          dep[pick],
          { 'number, number': record('nn'), 'any, any': record('aa') }
        );
        const run = make[pick](withScope({ [dep[pick]]: counting }));

        for (const values of [
          [3, 8, 1, 9, 4],
          [3, 8, 1, bignumber('9'), 4],
          [3, 8, 1, new Fraction(9, 2), 4],
          [3, 8, [1, 9], 4],
          [3, 8, 1, '9', 4],
          [NaN, 8, 1, bignumber('9')],
          [3, 8, NaN, 1, bignumber('9')],
        ] as unknown[][]) {
          trace = [];
          numberCalls = 0;
          const result = run(values);
          const got = trace;
          trace = [];
          const want = reference(values, pick, counting as (a: unknown, b: unknown) => unknown);
          expect(got).toEqual(trace);
          expect(same(result, want)).toBe(true);
        }

        trace = [];
        numberCalls = 0;
        run([3, 8, 1, 9, 4]);
        expect(numberCalls).toBe(4);
      });

      it(`${pick} reports an error of a replaced ${dep[pick]} the way the generic walk does`, () => {
        const impl = real[pick];
        const throwing = (factoryScope.typed as (name: string, sigs: object) => unknown)(
          dep[pick],
          {
            'number, number': () => {
              throw new TypeError('Unexpected type of argument');
            },
            'any, any': (a: unknown, b: unknown) => impl(a, b),
          }
        );
        const run = make[pick](withScope({ [dep[pick]]: throwing }));
        expect(() => run([1, 2])).toThrow(
          new RegExp(`Cannot calculate ${pick}, unexpected type of argument`)
        );
      });
    }
  });
});
