/**
 * #966: follow-ups of the `solve` and `solveExact` work (items 1 to 10 of the issue).
 *
 * Each test pins one reported input.
 */

import { describe, it, expect } from 'vitest';
import { solve, expand } from '../src/index.js';

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
