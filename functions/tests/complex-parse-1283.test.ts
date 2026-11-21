/**
 * #1283 through `complex(string)` of functions: the string reader is `Complex.parse` of core
 * (grammar of the mathjs string parser). The full table is in
 * `core/tests/complex-parse-1283.test.ts`; these cases pin the issue repros at this surface.
 */
import { describe, it, expect } from 'vitest';
import { complex } from '../src/index.js';

type Fn = (...a: unknown[]) => { re: number; im: number };
const cx = complex as unknown as Fn;

describe('complex(string) of functions (#1283)', () => {
  it('reads an exponent in the real part', () => {
    const z = cx('1e3+2i');
    expect([z.re, z.im]).toEqual([1000, 2]);
  });

  it('throws SyntaxError for text that is not a complex number', () => {
    expect(() => cx('abc')).toThrow(SyntaxError);
    expect(() => cx('2abc')).toThrow(SyntaxError);
    expect(() => cx('1+')).toThrow(SyntaxError);
  });

  it('keeps reading spaces around the sign and the unit (old behaviour)', () => {
    const z = cx('3 + 4 i');
    expect([z.re, z.im]).toEqual([3, 4]);
  });
});
