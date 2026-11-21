/**
 * #1283 through `complex(string)` of the compat instance: the string reader is `Complex.parse`
 * of core (grammar of the mathjs string parser).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const m = create(all) as unknown as { complex: (x: unknown) => { re: number; im: number } };

describe('compat complex(string) (#1283)', () => {
  it('reads an exponent in the real part', () => {
    const z = m.complex('1e3+2i');
    expect([z.re, z.im]).toEqual([1000, 2]);
  });

  it('throws SyntaxError for text that is not a complex number', () => {
    expect(() => m.complex('abc')).toThrow(SyntaxError);
    expect(() => m.complex('2abc')).toThrow(SyntaxError);
    expect(() => m.complex('1+')).toThrow(SyntaxError);
  });

  it('keeps reading spaces around the sign and the unit (old behaviour)', () => {
    const z = m.complex('3 + 4 i');
    expect([z.re, z.im]).toEqual([3, 4]);
  });
});
