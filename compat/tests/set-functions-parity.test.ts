import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, create, setDifference, setSymDifference, setUnion } from '../src/index.js';

function unwrap(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && 'valueOf' in value) {
    const boxed = value as { valueOf(): unknown };
    return boxed.valueOf();
  }
  return value;
}

function valueShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(valueShape);
  }
  if (typeof value === 'object' && value !== null && 're' in value && 'im' in value) {
    return String(value);
  }
  if (typeof value === 'object' && value !== null && 's' in value && 'n' in value && 'd' in value) {
    const fraction = value as { s: number; n: number | bigint; d: number | bigint };
    return { s: fraction.s, n: String(fraction.n), d: String(fraction.d) };
  }
  if (typeof value === 'object' && value !== null && 'toFixed' in value) {
    return String(value);
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

  it('setDifference orders leftover Complex before numbers', () => {
    const actual = math.setDifference([1, math.complex(2, 2), 3], [1]);
    const expected = oracle.setDifference([1, oracle.complex(2, 2), 3], [1]);
    expect(valueShape(actual)).toEqual(['2 + 2i', 3]);
    expect(valueShape(setDifference([1, math.complex(2, 2), 3], [1]))).toEqual(
      valueShape(expected)
    );
  });

  it('setDifference orders leftover Fraction and BigNumber like mathjs', () => {
    const fractionActual = math.setDifference([1, math.fraction(2, 3), 3], [1]);
    const fractionExpected = oracle.setDifference([1, oracle.fraction(2, 3), 3], [1]);
    expect(valueShape(fractionActual)).toEqual(valueShape(fractionExpected));
    const bigActual = math.setDifference([1, math.bignumber(2), 3], [1]);
    const bigExpected = oracle.setDifference([1, oracle.bignumber(2), 3], [1]);
    expect(valueShape(bigActual)).toEqual(valueShape(bigExpected));
  });

  it('setUnion places the mixed intersection last', () => {
    const actual = math.setUnion([1, math.complex(2, 2), 3], [1]);
    const expected = oracle.setUnion([1, oracle.complex(2, 2), 3], [1]);
    expect(valueShape(actual)).toEqual(['2 + 2i', 3, 1]);
    expect(valueShape(actual)).toEqual(valueShape(expected));
    expect(valueShape(setUnion([1, math.complex(2, 2), 3], [1]))).toEqual(valueShape(expected));
    const fractionActual = math.setUnion([1, math.fraction(2, 3), 3], [1]);
    expect(valueShape(fractionActual)).toEqual(
      valueShape(oracle.setUnion([1, oracle.fraction(2, 3), 3], [1]))
    );
    const bigActual = math.setUnion([1, math.bignumber(2), 3], [1]);
    expect(valueShape(bigActual)).toEqual(
      valueShape(oracle.setUnion([1, oracle.bignumber(2), 3], [1]))
    );
  });

  it('setSymDifference orders leftover Complex, Fraction, and BigNumber', () => {
    const actual = math.setSymDifference([1, math.complex(2, 2), 3], [1]);
    const expected = oracle.setSymDifference([1, oracle.complex(2, 2), 3], [1]);
    expect(valueShape(actual)).toEqual(['2 + 2i', 3]);
    expect(valueShape(actual)).toEqual(valueShape(expected));
    expect(valueShape(setSymDifference([1, math.complex(2, 2), 3], [1]))).toEqual(
      valueShape(expected)
    );
    expect(valueShape(math.setSymDifference([1, math.fraction(2, 3), 3], [1]))).toEqual(
      valueShape(oracle.setSymDifference([1, oracle.fraction(2, 3), 3], [1]))
    );
    expect(valueShape(math.setSymDifference([1, math.bignumber(2), 3], [1]))).toEqual(
      valueShape(oracle.setSymDifference([1, oracle.bignumber(2), 3], [1]))
    );
  });

  it('evaluate and DenseMatrix set ops keep compareNatural order', () => {
    const expression = 'setDifference([1, complex(2, 2), 3], [1])';
    const evaluated = math.evaluate(expression);
    const fromMatrix = math
      .setDifference(math.matrix([1, math.complex(2, 2), 3]), math.matrix([1]))
      .valueOf();
    const expected = oracle.setDifference([1, oracle.complex(2, 2), 3], [1]);
    expect(valueShape(unwrap(evaluated))).toEqual(valueShape(expected));
    expect(valueShape(fromMatrix)).toEqual(valueShape(expected));
    expect(valueShape(unwrap(math.evaluate('setUnion([1, complex(2, 2), 3], [1])')))).toEqual(
      valueShape(oracle.setUnion([1, oracle.complex(2, 2), 3], [1]))
    );
    expect(
      valueShape(unwrap(math.evaluate('setSymDifference([1, complex(2, 2), 3], [1])')))
    ).toEqual(valueShape(oracle.setSymDifference([1, oracle.complex(2, 2), 3], [1])));
  });
});
