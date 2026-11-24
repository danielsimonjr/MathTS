import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { chain, compile, evaluate, parse, Parser, parser } from '../src/index.js';

describe('named compatibility expression imports', () => {
  it('uses the default matrix, constant, and compilation behavior', () => {
    const asMatrix = (value: unknown) => (value as { valueOf(): unknown }).valueOf();
    expect(asMatrix(evaluate('[1, PI]'))).toEqual(asMatrix(oracle.evaluate('[1, PI]')));
    expect(evaluate(['x', 'x + 1'], new Map([['x', 4]]))).toEqual([4, 5]);
    expect(compile('cos(pi)').evaluate()).toBe(oracle.compile('cos(pi)').evaluate());
    expect(parse('x+1').toString()).toBe(oracle.parse('x+1').toString());
  });

  it('constructs parsers with independent retained scopes', () => {
    const first = parser();
    const second = new Parser();
    expect(first).toBeInstanceOf(Parser);
    expect(second).toBeInstanceOf(Parser);
    first.set('x', 2);
    second.set('x', 5);
    expect(first.evaluate('x^2')).toBe(4);
    expect(second.evaluate('x^2')).toBe(25);
  });

  it('supports fluent named chains', () => {
    expect(chain(2).add(3).done()).toBe(oracle.chain(2).add(3).done());
  });
});
