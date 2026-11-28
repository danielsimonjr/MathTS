import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, create } from '../src/index.js';

function valueShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(valueShape);
  }
  if (typeof value === 'object' && value !== null && 're' in value && 'im' in value) {
    const complex = value as { re: number; im: number; valueOf(): { re: number; im: number } };
    return complex.valueOf();
  }
  return value;
}

describe('challenge #1828: remaining typed set ops still disagree with mathjs', () => {
  const math = create(all);

  it('setDifference leftover Complex/number order matches compareNatural', () => {
    const actual = math.setDifference([1, math.complex(2, 2), 3], [1]);
    const expected = oracle.setDifference([1, oracle.complex(2, 2), 3], [1]);
    expect(valueShape(actual)).toEqual(valueShape(expected));
  });
});
