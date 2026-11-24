import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, create, setUnion } from '../src/index.js';

describe('MathJS setUnion order in compat', () => {
  const math = create(all);

  it.each([
    [
      [9, 2, 8],
      [2, 1],
    ],
    [
      [4, 1, 1],
      [1, 2],
    ],
    [[4, 1, 3], []],
  ])('matches array order and multiplicity for %j and %j', (left, right) => {
    const expected = oracle.setUnion(left, right);
    expect(setUnion(left, right)).toEqual(expected);
    expect(math.setUnion(left, right)).toEqual(expected);
  });

  it('matches matrix results in direct, interpreted, and compiled calls', () => {
    const expected = oracle.setUnion(oracle.matrix([1, 2]), oracle.matrix([2, 3])).valueOf();
    expect(math.setUnion(math.matrix([1, 2]), math.matrix([2, 3])).valueOf()).toEqual(expected);
    const expression = 'setUnion([1, 2], [2, 3])';
    expect((math.evaluate(expression) as { valueOf(): unknown }).valueOf()).toEqual(expected);
    expect((math.compile(expression).evaluate() as { valueOf(): unknown }).valueOf()).toEqual(
      expected
    );
  });
});
