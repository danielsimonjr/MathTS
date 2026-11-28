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

describe('mathjs 15.3.0 set factory parity (#1793)', () => {
  const math = create(all);

  it('setDistinct returns distinct multiset elements in compareNatural order', () => {
    const input = [1, 2, math.complex(3, 3), 2, math.complex(3, 3)];
    const expected = oracle.setDistinct([1, 2, oracle.complex(3, 3), 2, oracle.complex(3, 3)]);
    expect(valueShape(math.setDistinct(input))).toEqual(valueShape(expected));
  });

  it('setIntersect preserves mixed Complex and number elements', () => {
    const left = [1, math.complex(2, 2), math.complex(3, 3)];
    const right = [math.complex(3, 3), 1];
    const expected = oracle.setIntersect(
      [1, oracle.complex(2, 2), oracle.complex(3, 3)],
      [oracle.complex(3, 3), 1]
    );
    expect(valueShape(math.setIntersect(left, right))).toEqual(valueShape(expected));
  });

  it('setCartesian pairs mixed Complex scalars in compareNatural order', () => {
    const expected = oracle.setCartesian([1, oracle.complex(2, 3)], [3]);
    expect(valueShape(math.setCartesian([1, math.complex(2, 3)], [3]))).toEqual(
      valueShape(expected)
    );
  });

  it('setPowerset orders mixed Complex subsets like mathjs', () => {
    const expected = oracle.setPowerset([1, oracle.complex(2, 2)]);
    expect(valueShape(math.setPowerset([1, math.complex(2, 2)]))).toEqual(valueShape(expected));
  });
});
