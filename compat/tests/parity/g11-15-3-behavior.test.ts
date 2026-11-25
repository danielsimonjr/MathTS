import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Differential tests for the four mathjs 15.3.0 behavior changes (#1563, #1564, #1565,
 * #1566), run against the mathjs 15.3.0 oracle (the compat devDependency). Every case
 * compares `typeOf` plus `format(value, { precision: 14 })`, or the thrown error name and
 * message prefix, with the oracle.
 */

type Instance = ReturnType<typeof createCompat>;

const CASES: [string, (L: Instance & typeof mathjs.MathJsInstance) => unknown][] = [
  ['#1563 multinomial(2, 3)', (L) => L.multinomial(2, 3)],
  ['#1563 multinomial([2, 0, 1])', (L) => L.multinomial([2, 0, 1])],
  ['#1563 multinomial(2)', (L) => L.multinomial(2)],
  ['#1563 multinomial([])', (L) => L.multinomial([])],
  [
    '#1563 multinomial([[1, 2], [3, 4]])',
    (L) =>
      L.multinomial([
        [1, 2],
        [3, 4],
      ]),
  ],
  [
    '#1563 multinomial([bignumber(2), bignumber(3)])',
    (L) => L.multinomial([L.bignumber(2), L.bignumber(3)]),
  ],
  ['#1564 catalan(30n)', (L) => L.catalan(30n)],
  ['#1564 catalan(40n)', (L) => L.catalan(40n)],
  ['#1564 catalan(30)', (L) => L.catalan(30)],
  ['#1565 dotPow(sparse([[0, 1]]), 0)', (L) => L.dotPow(L.sparse([[0, 1]]), 0)],
  ['#1565 dotDivide(sparse([[0, 1]]), 0)', (L) => L.dotDivide(L.sparse([[0, 1]]), 0)],
  ['#1565 divide(sparse([[0, 1]]), 0)', (L) => L.divide(L.sparse([[0, 1]]), 0)],
  [
    '#1565 control: dotPow(sparse([[0, 1]]), 1) stays sparse',
    (L) => L.dotPow(L.sparse([[0, 1]]), 1),
  ],
  [
    '#1565 control: dotMultiply(sparse([[0, 1]]), 2) stays sparse',
    (L) => L.dotMultiply(L.sparse([[0, 1]]), 2),
  ],
  ['#1566 add(-(2n ** 1100n), 0.5)', (L) => L.add(-(2n ** 1100n), 0.5)],
  ['#1566 add(2n ** 1100n, 0.5)', (L) => L.add(2n ** 1100n, 0.5)],
  ['#1566 add(2n ** 60n, 0.5)', (L) => L.add(2n ** 60n, 0.5)],
  ['#1566 control: add(2n ** 40n, 0.5) stays in range', (L) => L.add(2n ** 40n, 0.5)],
];

function show(
  L: { typeOf(v: unknown): string; format(v: unknown, o: object): string },
  v: unknown
) {
  return L.typeOf(v) + ' ' + L.format(v, { precision: 14 });
}

describe('mathjs 15.3.0 behavior parity (G11)', () => {
  for (const [label, run] of CASES) {
    it(label, () => {
      const oracle = mathjs.create(mathjs.all, {});
      const compat = createCompat(compatAll, {});
      const both = [oracle, compat] as const;
      const outcomes = both.map((L) => {
        try {
          return { value: show(L as never, run(L as never)) };
        } catch (e) {
          return {
            error: (e as Error).name,
            message: (e as Error).message.split(':')[0],
          };
        }
      });
      expect(outcomes[1]).toEqual(outcomes[0]);
    });
  }

  it('#1564 catalan(30n) is the exact bigint 3814986502092304n', () => {
    const compat = createCompat(compatAll, {});
    expect(compat.catalan(30n)).toBe(3814986502092304n);
    expect(compat.catalan(40n)).toBe(2622127042276492108820n);
  });

  it('#1566 out-of-range bigint conversion names the boundary in the message', () => {
    const compat = createCompat(compatAll, {});
    const readPin = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { devDependencies: Record<string, string> };
    expect(readPin.devDependencies.mathjs).toBe('15.3.0');
    expect(() => compat.add(2n ** 53n, 0.5)).toThrow(
      /Cannot implicitly convert bigint to number: value exceeds the max safe integer value/
    );
    expect(() => compat.add(-(2n ** 53n), 0.5)).toThrow(
      /Cannot implicitly convert bigint to number: value is below the min safe integer value/
    );
  });
});
