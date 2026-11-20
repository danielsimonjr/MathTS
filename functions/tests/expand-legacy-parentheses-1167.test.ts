import { describe, it, expect } from 'vitest';
import { evaluate, expand } from '../src/index.js';

// #1167: the legacy fallback of expand() (input that is not a pure polynomial, such as a purely
// numeric product or one with sin(x)) spliced a bare sum into its neighbours, so a factor, a
// divisor, an exponent or a leading minus bound to one term only. The oracle is the value of the
// input: evaluate(expand(input)) must equal evaluate(input).

type Scope = Record<string, number>;
const scope: Scope = { a: 2, b: 3, c: 5, d: 7, e: 11, f: 13, x: 0.7 };

function num(value: unknown): number {
  return Number(value);
}

function expectSameValue(input: string): void {
  const expected = num(evaluate(input, { ...scope }));
  const actual = num(evaluate(expand(input), { ...scope }));
  const tolerance = 1e-12 * Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected), `${input} -> ${expand(input)}`).toBeLessThanOrEqual(
    tolerance
  );
}

describe('#1167 expand fallback keeps the parentheses', () => {
  // Expected values: mathjs 15.2.0 evaluate().
  const pinned: Array<[string, number]> = [
    ['2*(1+2)*(3+4)', 42],
    ['(1+2)*(3+4)*(5+6)', 231],
    ['(1+2)*(3+4)/2', 10.5],
    ['6/(1+2)*(3+4)', 14],
    ['(1+2)*(3+4)^3', 1029],
    ['2 (a+b)*(c+d)', 120],
    ['1/(1+2)^2', 0.1111111111111111],
    ['(1+2)^2^2', 81],
    ['2*(1+2)^2', 18],
    ['(1+2)^2/3', 3],
  ];

  for (const [input, value] of pinned) {
    it(`${input} keeps its value ${value}`, () => {
      expect(num(evaluate(input, { ...scope }))).toBeCloseTo(value, 12);
      expect(num(evaluate(expand(input), { ...scope }))).toBeCloseTo(value, 12);
    });
  }

  it('sweeps a prefix, a core and a suffix: the value never changes', () => {
    const prefixes = ['', '2*', '6/', 'x-', '-', 'sin(x)*', '2 '];
    const cores = ['(a+b)*(c+d)', '(a+b)^2'];
    const suffixes = ['', '*(e+f)', '/2', '^3', '*sin(x)', '+1'];
    for (const prefix of prefixes) {
      for (const core of cores) {
        for (const suffix of suffixes) expectSameValue(prefix + core + suffix);
      }
    }
  });

  it('keeps the value of a chain of three sums that hold a subtraction', () => {
    // The sum of the first two sums holds terms such as "1*-4". The next product splits that sum
    // again, and a minus that follows an operator is a sign, not a subtraction: the split once
    // cut "1*-4" into "1*" and "-4" and wrote "1**5".
    const inputs = [
      '(1-2)*(3-4)*(5+6)',
      '(1+2)*(3-4)*(5+6)',
      '(5-3)*(7-7)*(0.5)',
      '(1-2)*(3-4)*(5-6)*(2+1)',
      '2*(1-2)*(3-4)*(5+6)',
      '(1-2)*(3-4)*(5+6)/2',
      '(a-b)*(c-d)*(e+f)*sin(x)',
      '(a+b)*(c-d)*(e+f)*sin(x)',
    ];
    for (const input of inputs) {
      expectSameValue(input);
      expect(expand(input), input).not.toContain('**');
    }
  });

  it('does not cut the sign of an exponent literal', () => {
    // "2e-3" and "2.5E+2" are one number: the split once left "2e" and "-3", which does not parse.
    const inputs = [
      '(2e-3+1)*(3+4)',
      '(1-2e-3)*(3+4)',
      '(2.5E-2-1)*(3+4)',
      '(1+2)*(3e-3+4)',
      '(1e+3+1)*(3+4)',
      '(1e-3+1)*(3-4)*(5+6)',
      '(1-2)*(3-4)*(5e-1+6)',
      '(1e-3+sin(2))*(3+4)*(5+6)',
    ];
    for (const input of inputs) expectSameValue(input);
  });

  it('expands a plain product of two sums as before', () => {
    expect(expand('(a+b)*(c+d)')).toBe('a*c + a*d + b*c + b*d');
  });

  it('does not copy a function call that stands beside the square', () => {
    const text = expand('random()*(x+1)^2');
    expect(text.match(/random\(/g)?.length).toBe(1);
  });

  it('stops on a product that it must leave alone', () => {
    const input = '6/(1+2)*(3+4)*(5+6)';
    expect(num(evaluate(expand(input)))).toBeCloseTo(154, 12);
  });
});
