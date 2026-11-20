import { describe, it, expect } from 'vitest';
import { expand, rationalize, simplify, variables } from '../src/index.js';

// #1177: rationalize / simplify differences from mathjs 15.2.0 (items 1-7).
// Expected texts are the mathjs 15.2.0 output unless a comment says otherwise.

// The typed functions return `unknown`: the tests read the printed text.
const simp = (input: string): string => String(simplify(input));
const rat = (input: string): string => String(rationalize(input));

describe('#1177 item 7: variables() does not read the exponent of a number literal as a name', () => {
  it('1e3*x has the one variable x', () => {
    expect(variables('1e3*x')).toEqual(['x']);
  });
  it('2.5E-3*y+1e+2 has the one variable y', () => {
    expect(variables('2.5E-3*y+1e+2')).toEqual(['y']);
  });
  it('2x keeps x', () => {
    expect(variables('2x')).toEqual(['x']);
  });
  it('a name that contains digits and an e stays one name', () => {
    expect(variables('x2e3')).toEqual(['x2e3']);
  });
  it('expand does not treat the exponent e3 as a variable', () => {
    expect(expand('sqrt(1e3)*(x+1)')).toBe('sqrt(1e3)*x + sqrt(1e3)');
  });
});

describe('#1177 items 3 and 6 (fixed on main, pinned here)', () => {
  it('item 3: complex(2,0)*x folds the real Complex to 2 * x', () => {
    expect(simp('complex(2,0)*x')).toBe('2 * x');
  });
  it('item 6: log(8,2)/3 is 1', () => {
    expect(simp('log(8,2)/3')).toBe('1');
  });
});

describe('#1177 item 4: a constant function of Fractions is not a 64-digit BigNumber', () => {
  it('factorial(5)/7 is the fraction 120 / 7', () => {
    expect(simp('factorial(5)/7')).toBe('120 / 7');
  });
  it('atan2(1,1)*x keeps a number, not a BigNumber', () => {
    expect(simp('atan2(1,1)*x')).toBe('0.7853981633974483 * x');
  });
  it('a BigNumber that the input holds is kept', () => {
    expect(simp('bignumber(2)*x')).toBe('2 * x');
  });
});

describe('#1177 item 5: a matrix literal folds into the function that takes it', () => {
  it('det([1,2;3,4])*x is -(2 * x)', () => {
    expect(simp('det([1,2;3,4])*x')).toBe('-(2 * x)');
  });
  it('det([1,2;3,4]) is -2', () => {
    expect(simp('det([1,2;3,4])')).toBe('-2');
  });
  it('size([1,2]) is [2] and size([[1,2],[3,4]]) is [2, 2]', () => {
    expect(simp('size([1,2])')).toBe('[2]');
    expect(simp('size([[1,2],[3,4]])')).toBe('[2, 2]');
  });
});

describe('#1177 item 2: rationalize of a polynomial with a fraction coefficient', () => {
  // The expected texts are the mathjs 15.2.0 results.
  it('(x+1)^2/3 does not throw "Operator / invalid"', () => {
    expect(rat('(x+1)^2/3')).toBe(
      '0.3333333333333333 * x ^ 2 + 0.6666666666666666 * x + 0.3333333333333333'
    );
  });
  it('x^2/3+1/3', () => {
    expect(rat('x^2/3+1/3')).toBe('0.3333333333333333 * x ^ 2 + 0.3333333333333333');
  });
  it('log(2)*x^2 + 1/3 keeps all digits of the constant', () => {
    expect(rat('log(2)*x^2 + 1/3')).toBe('0.6931471805599453 * x ^ 2 + 0.3333333333333333');
  });
  it('the polynomial cases that worked keep their text', () => {
    expect(rat('x^2*x^3-1')).toBe('x ^ 5 - 1');
    expect(rat('(x+1)^3')).toBe('x ^ 3 + 3 * x ^ 2 + 3 * x + 1');
  });
  it('(2/5+x)^2 has the mathjs digits', () => {
    expect(rat('(2/5+x)^2')).toBe('x ^ 2 + 0.8 * x + 0.16000000000000003');
  });
});

describe('#1177 item 1: rationalize of a power of a sum is read exactly', () => {
  // Exact ascending coefficients of (x^2 - x + 2/5)^4, from Python Fraction arithmetic.
  const exact = [16 / 625, -32 / 125, 152 / 125, -88 / 25, 169 / 25, -44 / 5, 38 / 5, -4, 1];

  it('(2/5+x*x - x)^4 has the exact coefficients and does not hang', () => {
    const detailed = rationalize('(2/5+x*x - x)^4', {}, true) as {
      coefficients: number[];
      variables: string[];
      expression: { toString(): string };
      denominator: unknown;
    };
    expect(detailed.variables).toEqual(['x']);
    expect(detailed.coefficients).toHaveLength(9);
    detailed.coefficients.forEach((c, i) => expect(c).toBeCloseTo(exact[i], 12));
    expect(detailed.denominator).toBeNull();
    expect(detailed.expression.toString()).toMatch(/^x \^ 8 - 4 \* x \^ 7 \+ 7\.6 \* x \^ 6/);
  });

  it('(1+x)^6 has exact integer coefficients', () => {
    expect(rat('(1+x)^6')).toBe(
      'x ^ 6 + 6 * x ^ 5 + 15 * x ^ 4 + 20 * x ^ 3 + 15 * x ^ 2 + 6 * x + 1'
    );
  });

  it('(1-x)^5 keeps the signs (it threw "Invalid ^ placing" after 30 s)', () => {
    expect(rat('(1-x)^5')).toBe('-x ^ 5 + 5 * x ^ 4 - 10 * x ^ 3 + 10 * x ^ 2 - 5 * x + 1');
  });

  it('(1+x)^3 keeps its text (the rule engine path)', () => {
    expect(rat('(1+x)^3')).toBe('x ^ 3 + 3 * x ^ 2 + 3 * x + 1');
  });
});
