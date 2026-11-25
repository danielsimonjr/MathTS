import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

// #1014 item 5 originally added a space between a LaTeX operator command (\neg, \cdot, \wedge,
// \mod) and an operand whose TeX starts with a letter (true, false, null print bare), so TeX did
// not read one command (`\negtrue`). #1578 pins mathjs 15.3.0 parity instead: mathjs joins the
// operator and its operands with no added space, and the space before a symbol operand comes from
// the SymbolNode itself. The expected values below are the mathjs 15.3.0 oracle output.
describe('#1014 item 5 / #1578: operator command joined to a letter operand', () => {
  it('joins the prefix command of "not" to a boolean or null with no space', () => {
    expect(parse('not true').toTex()).toBe('\\negtrue');
    expect(parse('not false').toTex()).toBe('\\negfalse');
    expect(parse('not null').toTex()).toBe('\\negnull');
  });

  it('joins the binary command to a boolean with no space', () => {
    expect(parse('2*true').toTex()).toBe('2\\cdottrue');
    expect(parse('5 mod true').toTex()).toContain('\\modtrue');
    expect(parse('a and true').toTex()).toContain('\\wedgetrue');
  });

  it('joins the n-ary product with no spaces', () => {
    expect(parse('2*3*true').toTex()).toBe('2\\cdot3\\cdottrue');
  });

  it('keeps the TeX of a symbol or a number operand (the symbol space is its own)', () => {
    expect(parse('not a').toTex()).toBe('\\neg a');
    expect(parse('not 1').toTex()).toBe('\\neg1');
    expect(parse('2*3').toTex()).toBe('2\\cdot3');
  });
});
