import { describe, expect, it } from 'vitest';
import * as mathjs from 'mathjs';
import * as mathts from '@danielsimonjr/mathts-functions';

const a = [
  [1, 2],
  [3, 4],
];
const b = [
  [2, 0],
  [1, 4],
];
const names = [
  'and',
  'or',
  'xor',
  'atan2',
  'gcd',
  'lcm',
  'bitAnd',
  'bitOr',
  'bitXor',
  'leftShift',
  'rightArithShift',
  'rightLogShift',
] as const;
type Binary = (
  x: unknown,
  y: unknown
) => { toArray(): unknown; size(): number[]; storage(): string };

describe('element-wise binary matrix operations (#1343)', () => {
  it.each(names)('applies %s element by element to boxed matrices', (name) => {
    const reference = mathjs[name] as Binary;
    const operation = mathts[name] as Binary;
    const expected = reference(mathjs.matrix(a), mathjs.matrix(b));
    const actual = operation(mathts.matrix(a), mathts.matrix(b));
    expect(actual.storage()).toBe(expected.storage());
    expect(actual.size()).toEqual(expected.size());
    expect(actual.toArray()).toEqual(expected.toArray());
  });
});
