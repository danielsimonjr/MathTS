/**
 * Sprint 2R clone-merge (RelationalNode._toString / _toTex) — independent string
 * oracles. Expected literals are built from operatorMap / latexOperators and the
 * documented wrap rules, not by round-tripping the renderer.
 *
 * Parser note: a two-operand comparison is OperatorNode, not RelationalNode.
 * Every case below is a chain (params.length >= 3) so it hits renderRelational.
 */
import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

function relational(expr: string): {
  isRelationalNode?: boolean;
  toString: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
  toHTML: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
  toTex: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
} {
  const node = parse(expr) as {
    isRelationalNode?: boolean;
    toString: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
    toHTML: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
    toTex: (options?: { parenthesis?: 'keep' | 'auto' | 'all' }) => string;
  };
  expect(node.isRelationalNode).toBe(true);
  return node;
}

describe('RelationalNode render oracle — chained comparisons', () => {
  it('toString keep: a < b <= c', () => {
    expect(relational('a < b <= c').toString()).toBe('a < b <= c');
    expect(relational('a < b <= c').toString({ parenthesis: 'keep' })).toBe('a < b <= c');
  });

  it('toString auto matches keep when the source has no ParenthesisNodes', () => {
    expect(relational('a < b <= c').toString({ parenthesis: 'auto' })).toBe('a < b <= c');
  });

  it('toTex keep: SymbolNode leading space + latexOperators.smaller / smallerEq', () => {
    // SymbolNode TeX is " a"; latexOperators.smaller is "<"; smallerEq is "\\leq".
    expect(relational('a < b <= c').toTex()).toBe(' a< b\\leq c');
    expect(relational('a < b <= c').toTex({ parenthesis: 'keep' })).toBe(' a< b\\leq c');
  });

  it('toTex auto matches keep when the source has no ParenthesisNodes', () => {
    expect(relational('a < b <= c').toTex({ parenthesis: 'auto' })).toBe(' a< b\\leq c');
  });

  it('toString all wraps every operand including symbols', () => {
    expect(relational('a < b <= c').toString({ parenthesis: 'all' })).toBe('(a) < (b) <= (c)');
  });

  it('toTex all wraps every operand with \\left( \\right)', () => {
    expect(relational('a < b <= c').toTex({ parenthesis: 'all' })).toBe(
      '\\left( a\\right)<\\left( b\\right)\\leq\\left( c\\right)'
    );
  });

  it('toString / toTex use operatorMap and latexOperators for == / !=', () => {
    expect(relational('a == b != c').toString()).toBe('a == b != c');
    expect(relational('a == b != c').toTex()).toBe(' a= b\\neq c');
  });
});

describe('RelationalNode render oracle — precedence wrapping', () => {
  it('toString keep: add binds tighter than relational, so 1 + 2 is not wrapped', () => {
    expect(relational('1 + 2 < 3 < 4').toString()).toBe('1 + 2 < 3 < 4');
  });

  it('toString all wraps every RelationalNode operand, including constants', () => {
    expect(relational('1 + 2 < 3 < 4').toString({ parenthesis: 'all' })).toBe(
      '(1 + 2) < (3) < (4)'
    );
  });

  it('toTex keep: add TeX is "1+2", joins are latexOperators.smaller with no extra spaces', () => {
    expect(relational('1 + 2 < 3 < 4').toTex()).toBe('1+2<3<4');
  });

  it('toTex all wraps every operand with \\left( \\right)', () => {
    expect(relational('1 + 2 < 3 < 4').toTex({ parenthesis: 'all' })).toBe(
      '\\left(1+2\\right)<\\left(3\\right)<\\left(4\\right)'
    );
  });
});

describe('RelationalNode render oracle — parenthesis keep vs auto', () => {
  it('toString keep preserves source parentheses on an additive operand', () => {
    expect(relational('(a + b) < c < d').toString({ parenthesis: 'keep' })).toBe('(a + b) < c < d');
  });

  it('toString auto drops source parentheses when add already binds tighter', () => {
    expect(relational('(a + b) < c < d').toString({ parenthesis: 'auto' })).toBe('a + b < c < d');
  });

  it('toTex keep wraps the ParenthesisNode with \\left( \\right)', () => {
    expect(relational('(a + b) < c < d').toTex({ parenthesis: 'keep' })).toBe(
      '\\left( a+ b\\right)< c< d'
    );
  });

  it('toTex auto drops the ParenthesisNode wrapper', () => {
    expect(relational('(a + b) < c < d').toTex({ parenthesis: 'auto' })).toBe(' a+ b< c< d');
  });
});

describe('RelationalNode render oracle — HTML chain', () => {
  const op = (glyph: string): string =>
    '<span class="math-operator math-binary-operator math-explicit-binary-operator">' +
    glyph +
    '</span>';
  const wrap = (inner: string): string =>
    '<span class="math-parenthesis math-round-parenthesis">(</span>' +
    inner +
    '<span class="math-parenthesis math-round-parenthesis">)</span>';
  const sym = (name: string): string => '<span class="math-symbol">' + name + '</span>';
  const num = (value: string): string => '<span class="math-number">' + value + '</span>';

  it('toHTML keep: a < b <= c', () => {
    expect(relational('a < b <= c').toHTML()).toBe(
      sym('a') + op('&lt;') + sym('b') + op('&lt;=') + sym('c')
    );
  });

  it('toHTML all wraps every operand including symbols', () => {
    expect(relational('a < b <= c').toHTML({ parenthesis: 'all' })).toBe(
      wrap(sym('a')) + op('&lt;') + wrap(sym('b')) + op('&lt;=') + wrap(sym('c'))
    );
  });

  it('toHTML keep: add binds tighter than relational, so 1 + 2 is not wrapped', () => {
    const addHtml = num('1') + op('+') + num('2');
    expect(relational('1 + 2 < 3 < 4').toHTML()).toBe(
      addHtml + op('&lt;') + num('3') + op('&lt;') + num('4')
    );
  });

  it('toHTML all wraps every RelationalNode operand, including the add subtree', () => {
    const addHtml = num('1') + op('+') + num('2');
    expect(relational('1 + 2 < 3 < 4').toHTML({ parenthesis: 'all' })).toBe(
      wrap(addHtml) + op('&lt;') + wrap(num('3')) + op('&lt;') + wrap(num('4'))
    );
  });
});
