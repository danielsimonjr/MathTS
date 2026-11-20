import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

// #1014 item 5: the LaTeX of an operator that is a command (\neg, \cdot, \wedge, \mod) joined the
// command directly to an operand whose TeX starts with a letter (true, false, null print bare), so
// TeX read the one unknown command `\negtrue`. A space separates a command from a letter. A digit
// needs no space (`\neg1` is valid TeX), and a symbol already carries a leading space.
describe('#1014 item 5: a TeX operator command and a letter operand', () => {
  it('writes a space after the prefix command of "not" before a boolean or null', () => {
    expect(parse('not true').toTex()).toBe('\\neg true');
    expect(parse('not false').toTex()).toBe('\\neg false');
    expect(parse('not null').toTex()).toBe('\\neg null');
  });

  it('writes a space after the binary command before a boolean', () => {
    expect(parse('2*true').toTex()).toBe('2\\cdot true');
    expect(parse('5 mod true').toTex()).toContain('\\mod true');
    expect(parse('a and true').toTex()).toContain('\\wedge true');
  });

  it('writes a space in the n-ary product', () => {
    expect(parse('2*3*true').toTex()).toBe('2\\cdot3\\cdot true');
  });

  it('keeps the TeX of a symbol or a number operand', () => {
    expect(parse('not a').toTex()).toBe('\\neg a');
    expect(parse('not 1').toTex()).toBe('\\neg1');
    expect(parse('2*3').toTex()).toBe('2\\cdot3');
  });
});
