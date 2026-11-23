import { describe, expect, it } from 'vitest';
import * as mathjs from 'mathjs';
import * as mathts from '@danielsimonjr/mathts-functions';
import { all, create } from '@danielsimonjr/mathts-compat';

type Callback = (...args: unknown[]) => unknown;
const map = mathts.map as (collection: unknown, callback: Callback) => unknown;
const mathMap = mathjs.map as (collection: unknown, callback: Callback) => unknown;

function plain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plain);
  const boxed = value as { toArray?: () => unknown } | null;
  return typeof boxed?.toArray === 'function' ? plain(boxed.toArray()) : value;
}

describe('collection callback argument handling (#1368, #1373)', () => {
  it.each(['format', 'permutations'] as const)(
    'maps %s like mathjs without passing the index',
    (name) => {
      const data = [5, 6, 7];
      const oracle = mathMap(data, mathjs[name] as Callback);
      expect(plain(map(data, mathts[name] as Callback))).toEqual(oracle);
      expect(plain(map(mathts.matrix(data), mathts[name] as Callback))).toEqual(oracle);
      expect(plain(create(all).evaluate(`map([5, 6, 7], ${name})`))).toEqual(oracle);
    }
  );

  it.each([
    'bitAnd',
    'bitOr',
    'bitXor',
    'leftShift',
    'rightArithShift',
    'rightLogShift',
    'gcd',
    'lcm',
  ] as const)('passes the index for %s as mathjs does', (name) => {
    const data = [5, 6, 7];
    const oracle = mathMap(data, mathjs[name] as Callback);
    expect(plain(map(data, mathts[name] as Callback))).toEqual(plain(oracle));
  });

  it('preserves explicit optional arguments and multiple input collections', () => {
    expect(mathts.format(3.14159, 3)).toBe('3.14');
    expect(mathts.permutations(5, 3)).toBe(60);
    const mapTwo = mathts.map as (a: number[], b: number[], callback: Callback) => unknown;
    expect(mapTwo([5, 6], [2, 3], mathts.permutations as Callback)).toEqual([20, 120]);
  });

  it('passes the index and matrix to a bound function with a rest parameter', () => {
    const data = mathts.matrix([5, 6]);
    const bound = ((_value: unknown, ...rest: unknown[]) => [rest[0], rest[1] === data]).bind(null);
    expect(plain(map(data, bound))).toEqual([
      [[0], true],
      [[1], true],
    ]);
  });
});
