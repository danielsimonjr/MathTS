import { describe, it, expect } from 'vitest';
import { parse as foreignParse } from '@danielsimonjr/mathts-expression';
import { parse, simplify, symbolicEqual } from '../src/index.js';

/**
 * A node that another parse built has other node classes than this package's own
 * parse. simplify must match nodes by structure, not by class (#937): the same
 * expression gives the same result, whichever parse built the node.
 */
describe('simplify on nodes built by another parse (#937)', () => {
  it('the nodes under test belong to other node classes', () => {
    const own = parse('x + x');
    const foreign = foreignParse('x + x');
    expect(foreign).not.toBeInstanceOf(own.constructor);
    expect(foreign.toString()).toBe(own.toString());
  });

  const cases: Array<[string, string]> = [
    ['x + x', '2 * x'],
    ['x - x', '0'],
    ['(x+1)*(x+1)', '(x + 1) ^ 2'],
    ['2 * x', '2 * x'],
    ['x * 1', 'x'],
    ['2 + 3', '5'],
  ];

  it.each(cases)('simplify(%s) is %s for a foreign node', (expr, expected) => {
    // simplify returns unknown, like every typed function; its Node result prints with String.
    expect(String(simplify(foreignParse(expr)))).toBe(expected);
    expect(String(simplify(parse(expr)))).toBe(expected);
  });

  it('symbolicEqual accepts a foreign node on either side', () => {
    expect(symbolicEqual(foreignParse('x + x'), parse('2 * x'))).toBe(true);
    expect(symbolicEqual(parse('x + x'), foreignParse('2 * x'))).toBe(true);
    expect(symbolicEqual(foreignParse('x + x'), parse('3 * x'))).toBe(false);
  });
});
