/**
 * Sprint 2R clone-merge (RelationalNode._toString / _toTex) — independent string
 * oracles for chained relationals, parenthesis: 'all', and precedence wrapping.
 */
import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

describe('RelationalNode render oracle — chained comparisons', () => {
  it('toString exact: a < b <= c', () => {
    expect(parse('a < b <= c').toString()).toBe('a < b <= c');
  });

  it('toTex exact: a < b <= c', () => {
    expect(parse('a < b <= c').toTex()).toBe(' a< b\\leq c');
  });

  it('toString exact: parenthesis all wraps every operand', () => {
    expect(parse('a < b <= c').toString({ parenthesis: 'all' })).toBe('(a) < (b) <= (c)');
  });

  it('toTex exact: parenthesis all wraps every operand', () => {
    expect(parse('a < b <= c').toTex({ parenthesis: 'all' })).toBe(
      '\\left( a\\right)<\\left( b\\right)\\leq\\left( c\\right)'
    );
  });
});

describe('RelationalNode render oracle — precedence-wrapped operands', () => {
  it('toString exact: lower-precedence lhs needs parens only when required', () => {
    expect(parse('1 + 2 < 3').toString()).toBe('1 + 2 < 3');
  });

  it('toString exact: parenthesis all wraps additive lhs', () => {
    expect(parse('1 + 2 < 3').toString({ parenthesis: 'all' })).toBe('(1 + 2) < 3');
  });

  it('toTex exact: parenthesis all wraps additive lhs', () => {
    expect(parse('1 + 2 < 3').toTex({ parenthesis: 'all' })).toBe('\\left(1+2\\right)<3');
  });
});
