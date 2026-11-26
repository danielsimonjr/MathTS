/**
 * #1577 and #1578: `toTex` of a symbol that names a valueless unit must render
 * `\mathrm{…}` (and `deg` as `^\circ`) even when the name is also a function on
 * the instance (`b`, `A`), and the boolean operators must match the mathjs
 * 15.3.0 spacing (`true\wedgefalse`, `\negtrue`, `true\veebarfalse`).
 *
 * Expected values are the live mathjs 15.3.0 oracle output, byte for byte.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';

const m = create(all) as unknown as {
  parse: (expr: string) => { toTex: () => string };
};

describe('G14: unit names in toTex (#1577)', () => {
  it('renders a valueless unit as \\mathrm{…}', () => {
    expect(m.parse('2 cm + b').toTex()).toBe('2~\\mathrm{cm}+\\mathrm{b}');
  });

  it('renders inch as \\mathrm{…}', () => {
    expect(m.parse('2 inch').toTex()).toBe('2~\\mathrm{inch}');
  });

  it('renders A as \\mathrm{…} even though A is also a function name', () => {
    expect(m.parse('A').toTex()).toBe('\\mathrm{A}');
  });

  it('renders deg as ^\\circ', () => {
    expect(m.parse('deg').toTex()).toBe(' ^\\circ');
  });

  it('leaves non-units unchanged', () => {
    expect(m.parse('x + y').toTex()).toBe(' x+ y');
  });
});

describe('G14: boolean operator spacing in toTex (#1578)', () => {
  it('writes no space after \\wedge before a boolean', () => {
    expect(m.parse('true and false').toTex()).toBe('true\\wedgefalse');
  });

  it('writes no space after \\neg before a boolean', () => {
    expect(m.parse('not true').toTex()).toBe('\\negtrue');
  });

  it('writes no space after \\veebar before a boolean', () => {
    expect(m.parse('true xor false').toTex()).toBe('true\\veebarfalse');
  });
});
