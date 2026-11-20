/**
 * #966: follow-ups of the `solve` and `solveExact` work (items 1 to 10 of the issue).
 *
 * Each test pins one reported input.
 */

import { describe, it, expect } from 'vitest';
import { solve, solveExact, integrate, expand } from '../src/index.js';
import { coefficientTexts } from '../src/cas/render-polynomial.js';

describe('#966 item 1: a polynomial that is identically zero is an identity, whatever its power', () => {
  it('solve((x-x)^1000000000) is an identity, not a degree error', () => {
    expect(() => solve('(x-x)^1000000000', 'x')).toThrow(/is an identity/);
  });

  it('solve((x-x+1)^1000000000 - 1) is an identity', () => {
    expect(() => solve('(x-x+1)^1000000000-1', 'x')).toThrow(/is an identity/);
  });

  it('expand((x-x)^1000000000) is 0', () => {
    expect(expand('(x-x)^1000000000')).toBe('0');
  });

  it('a power of a real polynomial above the limit is still a degree error', () => {
    expect(() => solve('(x+1)^1000000000', 'x')).toThrow(/degree above 1000/);
  });
});

describe('#966 item 2: an identity of non-polynomial terms is reported as an identity', () => {
  it('sin(x)-sin(x)', () => {
    expect(() => solve('sin(x)-sin(x)', 'x')).toThrow(/is an identity/);
  });

  it('cos(x)^2 - cos(x)^2', () => {
    expect(() => solve('cos(x)^2 - cos(x)^2', 'x')).toThrow(/is an identity/);
  });

  it('sin(x) is still a periodic equation, not an identity', () => {
    expect(() => solve('sin(x)', 'x')).toThrow(/period/);
    expect(() => solve('sin(x)', 'x')).not.toThrow(/is an identity/);
  });

  it('an equation with no closed form is still reported as such', () => {
    expect(() => solve('sin(x) - x', 'x')).toThrow(/no closed-form solution/);
  });
});

describe('#966 item 3: the numeric scan finds an even-multiplicity root between grid points', () => {
  it('(x-1)^2 on [-3,3]', () => {
    expect(solve('(x-1)^2', 'x', { numeric: true, range: [-3, 3] })).toEqual([1]);
  });

  it('(x-1)^2 on [-1,3] (regression)', () => {
    expect(solve('(x-1)^2', 'x', { numeric: true, range: [-1, 3] })).toEqual([1]);
  });

  it('(x-0.123456)^2 on [-3,3] has one root', () => {
    const roots = solve('(x-0.123456)^2', 'x', { numeric: true, range: [-3, 3] }) as number[];
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeCloseTo(0.123456, 12);
  });

  it('(x-1)^4 on [-3,3]', () => {
    expect(solve('(x-1)^4', 'x', { numeric: true, range: [-3, 3] })).toEqual([1]);
  });

  it('x^2+1 has no root: a minimum above zero is rejected', () => {
    expect(solve('x^2+1', 'x', { numeric: true, range: [-3, 3] })).toEqual([]);
  });

  it('x^2+0.001 has no root', () => {
    expect(solve('x^2+0.001', 'x', { numeric: true, range: [-3, 3] })).toEqual([]);
  });
});

describe('#966 item 4: the radical roots of a quadratic are in canonical text', () => {
  it('x^2-0.5', () => {
    expect(solve('x^2-0.5', 'x')).toEqual(['-sqrt(2)/2', 'sqrt(2)/2']);
  });

  it('x^2-2 (regression)', () => {
    expect(solve('x^2-2', 'x')).toEqual(['-sqrt(2)', 'sqrt(2)']);
  });

  it('x^2-x-1', () => {
    expect(solve('x^2-x-1', 'x')).toEqual(['1/2 - sqrt(5)/2', '1/2 + sqrt(5)/2']);
  });

  it('2*x^2-1', () => {
    expect(solve('2*x^2-1', 'x')).toEqual(['-sqrt(2)/2', 'sqrt(2)/2']);
  });

  it('x^2-8 reduces the radical', () => {
    expect(solve('x^2-8', 'x')).toEqual(['-2*sqrt(2)', '2*sqrt(2)']);
  });

  it('x^2+2*x-1', () => {
    expect(solve('x^2+2*x-1', 'x')).toEqual(['-1 - sqrt(2)', '-1 + sqrt(2)']);
  });

  it('rational roots stay numbers', () => {
    expect(solve('x^2-4', 'x')).toEqual([-2, 2]);
  });
});

describe('#966 item 5: solveExact keeps the text of a constant that is a root or a quotient of roots', () => {
  it('sin(x)=sqrt(2)/3', () => {
    expect(solveExact('sin(x)=sqrt(2)/3', 'x')).toEqual({
      roots: ['asin(sqrt(2)/3)', 'pi - asin(sqrt(2)/3)'],
      period: '2*pi',
    });
  });

  it('solve still throws the periodic error, and names the value and solveExact', () => {
    expect(() => solve('sin(x)=sqrt(2)/3', 'x')).toThrow(/solveExact/);
    expect(() => solve('sin(x)=sqrt(2)/3', 'x')).toThrow(/sqrt\(2\)\/3|0\.4714/);
  });

  it('2*cos(x)=sqrt(3)/5', () => {
    expect(solveExact('2*cos(x)=sqrt(3)/5', 'x')).toEqual({
      roots: ['acos(sqrt(3)/10)', '2*pi - acos(sqrt(3)/10)'],
      period: '2*pi',
    });
  });

  it('exp(x)=pi', () => {
    expect(solveExact('exp(x)=pi', 'x')).toEqual({ roots: ['log(pi)'], period: null });
  });

  it('a constant outside the text rules still has no exact text', () => {
    expect(() => solveExact('sin(x)=cos(1)', 'x')).toThrow(/no exact text/);
  });
});

describe('#966 item 6: integrate writes a power of x in one canonical text', () => {
  it.each([
    ['x^2', 'x^3/3'],
    ['1*x^2', 'x^3/3'],
    ['5*x^3', '5*x^4/4'],
    ['3*x^2', 'x^3'],
    ['2*x', 'x^2'],
    ['x', 'x^2/2'],
    ['0.5*x', 'x^2/4'],
    ['x^1', 'x^2/2'],
    ['6*x^5', 'x^6'],
    ['2.5*x', '5*x^2/4'],
  ])('integrate(%s)', (src, want) => {
    expect(integrate(src, 'x')).toBe(want);
  });
});

describe('#966 item 8: a linear root is the correctly rounded quotient', () => {
  it('1e-20*x-1e-30', () => {
    expect(solve('1e-20*x-1e-30', 'x')).toEqual([1e-10]);
  });

  it('3*x-1 is unchanged', () => {
    expect(solve('3*x-1', 'x')).toEqual([0.3333333333333333]);
  });

  it('0.1*x-0.3 is 3', () => {
    expect(solve('0.1*x-0.3', 'x')).toEqual([3]);
  });

  it('x-1e-10 keeps the tiny root', () => {
    expect(solve('x-1e-10', 'x')).toEqual([1e-10]);
  });

  it('7*x+14 is -2', () => {
    expect(solve('7*x+14', 'x')).toEqual([-2]);
  });
});

describe('#966 item 9: solveExact of a polynomial of degree 1 or 2', () => {
  it('x^2+x-1', () => {
    expect(solveExact('x^2+x-1', 'x')).toEqual({
      roots: ['-1/2 - sqrt(5)/2', '-1/2 + sqrt(5)/2'],
      period: null,
    });
  });

  it('2*x-1', () => {
    expect(solveExact('2*x-1', 'x')).toEqual({ roots: ['1/2'], period: null });
  });

  it('x^2-4 has integer roots', () => {
    expect(solveExact('x^2-4', 'x')).toEqual({ roots: ['-2', '2'], period: null });
  });

  it('x^2+1 has no real root', () => {
    expect(solveExact('x^2+1', 'x')).toEqual({ roots: [], period: null });
  });

  it('x^2-2*x+1 has one root', () => {
    expect(solveExact('x^2-2*x+1', 'x')).toEqual({ roots: ['1'], period: null });
  });

  it('a polynomial identity is reported as an identity', () => {
    expect(() => solveExact('x-x', 'x')).toThrow(/is an identity/);
  });

  it('a cubic keeps the error and names the polynomial forms', () => {
    expect(() => solveExact('x^3-2', 'x')).toThrow(/polynomial of degree 1 or 2/);
  });
});

describe('#966 item 7: a power is refused by its term count, not only by its total degree', () => {
  it('expand((x+y+z+w)^900) throws at once', () => {
    expect(() => expand('(x+y+z+w)^900')).toThrow(/more than 10000 terms/);
    expect(() => expand('(x+y+z+w)^900')).toThrow(RangeError);
  });

  it('a product of two large powers throws at once (P9)', () => {
    expect(() => expand('(x+y+z+w)^30*(x+y+z+w)^30')).toThrow(/more than 10000 terms/);
  });

  it('the error names expand', () => {
    expect(() => expand('(x+y+z+w)^900')).toThrow(/^expand:/);
  });

  it('(x+y+1)^2 is unchanged', () => {
    expect(expand('(x+y+1)^2')).toBe('x^2 + 2*x*y + 2*x + y^2 + 2*y + 1');
  });

  it('(x+y)^1000 still works: 1001 terms', () => {
    const out = expand('(x+y)^1000');
    expect(out.startsWith('x^1000 + ')).toBe(true);
    expect(out.endsWith(' + y^1000')).toBe(true);
    // 1000 products of growing polynomials: the time is the time of the existing multiplication.
  }, 60_000);

  it('(x+1)^2000 still gives the degree error', () => {
    expect(() => expand('(x+1)^2000')).toThrow(/degree above 1000/);
  });

  it('a base with few distinct exponents is not refused: (x^3+x^2+x+1)^100 has 301 terms', () => {
    // The binomial bound alone is 176851 and would refuse it.
    const out = expand('(x^3+x^2+x+1)^100');
    expect(out.startsWith('x^300 + ')).toBe(true);
    expect(out.endsWith(' + 1')).toBe(true);
  });

  it('(x^2+x+1)^500 has 1001 terms and is not refused', () => {
    // The binomial bound alone is 125751 and would refuse it.
    const out = expand('(x^2+x+1)^500');
    expect(out.startsWith('x^1000 + ')).toBe(true);
  }, 60_000);

  it('(x+y+z)^40 stays inside the limit (861 terms)', () => {
    expect(expand('(x+y+z)^40').startsWith('x^40 + ')).toBe(true);
  });
});

describe('#966 item 10: coefficientTexts writes each coefficient on its own', () => {
  it('[0.5, 0.25, 2] gives fractions', () => {
    expect(coefficientTexts([0.5, 0.25, 2])).toEqual(['1/2', '1/4', '2']);
  });

  it('[1/3, 0.5, 2] gives the same text for 0.5 as [0.5, 2]', () => {
    expect(coefficientTexts([1 / 3, 0.5, 2])).toEqual(['1/3', '1/2', '2']);
    expect(coefficientTexts([0.5, 2])).toEqual(['1/2', '2']);
  });

  it('a decimal with no small fraction keeps its decimal text', () => {
    expect(coefficientTexts([0.123456, 2])).toEqual(['0.123456', '2']);
  });

  it('a coefficient below the fraction noise stays a decimal, never 0/1', () => {
    // Every fraction is now written as a fraction, so a fixed tolerance would match 0/1 to 1e-20.
    expect(coefficientTexts([1e-14, 1e-15, 1e-20])).toEqual(['1e-14', '1e-15', '1e-20']);
    expect(expand('1e-20*x + 1')).toBe('1e-20*x + 1');
    expect(coefficientTexts([1 / 10000, 1 / 10001])).toEqual(['1/10000', '0.0000999900009999']);
  });

  it('the text of a coefficient does not depend on its neighbours', () => {
    for (const c of [0.5, 0.25, 0.1, 1 / 3, 7 / 12, 0.123456]) {
      expect(coefficientTexts([c, 1 / 3])[0]).toBe(coefficientTexts([c])[0]);
      expect(coefficientTexts([c, 0.5])[0]).toBe(coefficientTexts([c])[0]);
    }
  });
});
