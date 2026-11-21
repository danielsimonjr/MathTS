/**
 * A call with a BigNumber and a number reaches the 'BigNumber, BigNumber' signature, as in
 * mathjs (the number converts to a BigNumber).
 *
 * typed-function ranks the conversions of a call by their position in the conversion table, so
 * the order of `MATHTS_CONVERSIONS` decides the signature. With `number to Complex` before
 * `number to BigNumber`, the parse path (the mathjs-port factories) reached 'Complex, number':
 * `nthRoot(bignumber(8), 3)` threw the Complex error, and `round`, `ceil`, `floor` and `fix` of
 * the same call returned a Complex. The oracle is mathjs of the devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
interface Instance {
  bignumber: Fn;
  typeOf: Fn;
  parse: (e: string) => { evaluate: (scope: Record<string, unknown>) => unknown };
}
const ours = create(all) as unknown as Instance;
const oracle = mathjs.create(mathjs.all) as unknown as Instance;

const ROWS: Array<[string, string, number]> = [
  ['nthRoot', '8', 3],
  ['round', '8.567', 1],
  ['ceil', '8.123', 2],
  ['floor', '8.567', 2],
  ['fix', '-8.567', 1],
];

describe('(BigNumber, number) reaches the BigNumber signature on the parse path', () => {
  it.each(ROWS)('%s(bignumber(%s), %s) is a BigNumber equal to mathjs', (fn, x, n) => {
    const expr = `${fn}(a, b)`;
    const got = ours.parse(expr).evaluate({ a: ours.bignumber(x), b: n });
    const want = oracle.parse(expr).evaluate({ a: oracle.bignumber(x), b: n });
    expect(oracle.typeOf(want)).toBe('BigNumber');
    expect(ours.typeOf(got)).toBe('BigNumber');
    expect(String(got)).toBe(String(want));
  });

  it.each(ROWS.filter(([fn]) => fn !== 'nthRoot'))(
    '%s(%s, bignumber(2)) (number first) is a BigNumber equal to mathjs',
    (fn, x) => {
      const expr = `${fn}(a, b)`;
      const got = ours.parse(expr).evaluate({ a: Number(x), b: ours.bignumber(2) });
      const want = oracle.parse(expr).evaluate({ a: Number(x), b: oracle.bignumber(2) });
      expect(oracle.typeOf(want)).toBe('BigNumber');
      expect(ours.typeOf(got)).toBe('BigNumber');
      expect(String(got)).toBe(String(want));
    }
  );
});

describe('#1097 nthRoot of a negative BigNumber with an even root, parse path', () => {
  const thrownMessage = (i: Instance, a: unknown): string | undefined => {
    try {
      i.parse('nthRoot(a, b)').evaluate({ a, b: 2 });
    } catch (e) {
      return (e as Error).message;
    }
    return undefined;
  };
  it('throws the mathjs text, not the Complex error', () => {
    const want = thrownMessage(oracle, oracle.bignumber(-8));
    expect(want).toBe('Root must be odd when a is negative.');
    expect(thrownMessage(ours, ours.bignumber(-8))).toBe(want);
  });
});
