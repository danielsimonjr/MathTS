/**
 * #1283: `Complex.parse` follows the grammar of the mathjs string parser (complex.js 2.4.3).
 *
 * The old parser had no exponent, read any prefix of the string with `parseFloat`, and gave NaN
 * or a wrong part for text that is not a complex number. The new parser reads a sum of signed
 * terms (a number, a number with `i`, `i`, or `i` with a number). Text that is not a complex
 * number throws `SyntaxError('Invalid Param')`.
 *
 * The oracle is mathjs 15.2.0 `complex(string)`. Three forms that the old parser read correctly
 * and mathjs rejects stay valid, so no working input breaks: whitespace anywhere except between
 * two number characters, an `E` exponent, and the word `Infinity`.
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '../src/types/complex.js';

/** Parse and return `[re, im]`, so the assertion uses `Object.is` (it tells -0 from 0). */
function parts(text: string): [number, number] {
  const z = Complex.parse(text);
  return [z.re, z.im];
}

function throwsInvalid(text: string): void {
  let error: unknown;
  try {
    Complex.parse(text);
  } catch (e) {
    error = e;
  }
  expect(error, JSON.stringify(text)).toBeInstanceOf(SyntaxError);
  expect((error as SyntaxError).message).toBe('Invalid Param');
}

describe('Complex.parse reads an exponent and sums signed terms (#1283)', () => {
  const rows: Array<[string, number, number]> = [
    ['1e3+2i', 1000, 2],
    ['1.5e-2-3e2i', 0.015, -300],
    ['1e+3-2e-1i', 1000, -0.2],
    ['1e3i', 0, 1000],
    ['-1e-3', -0.001, 0],
    ['2+i', 2, 1],
    ['2-i', 2, -1],
    ['2i+1', 1, 2],
    ['1+2i+3', 4, 2],
    ['i2', 0, 2],
    ['--1', 1, 0],
    ['1+-2i', 1, -2],
    ['+3', 3, 0],
    ['.5', 0.5, 0],
    ['5.', 5, 0],
    ['2I', 0, 2],
    ['1_000+2i', 1000, 2],
    ['1++2', 3, 0],
    ['+-+3', -3, 0],
    [' 1 + 2i ', 1, 2],
    ['3+4i\r\n', 3, 4],
    ['\t3+4i', 3, 4],
    ['1e400', Infinity, 0],
    ['1e-400i', 0, 0],
  ];
  for (const [text, re, im] of rows) {
    it(`${JSON.stringify(text)} is ${re} + ${im}i`, () => {
      const [gotRe, gotIm] = parts(text);
      expect(Object.is(gotRe, re), `re ${gotRe}`).toBe(true);
      expect(Object.is(gotIm, im), `im ${gotIm}`).toBe(true);
    });
  }
});

describe('Complex.parse throws SyntaxError for text that is not a complex number (#1283)', () => {
  const bad = [
    'abc',
    '2abc',
    '1+',
    '',
    ' ',
    'e',
    '1e',
    '1e+',
    '1+2j',
    '2*i',
    'NaN',
    'NaNi',
    '0x10',
    '.',
    '1..2',
    '1.2.3',
    'ii',
    '2ii',
    '2i3',
    '3i+',
    '+',
    '-',
    '1 2',
    '1 2i',
    '5 .5',
    '1e3 2',
    '1 e3',
    'infinity',
    'INFINITY',
    'Infinity2',
    '2Infinity',
    '1  2',
    '1 \t 2',
    '1   .5',
    '1  e3',
    '5\n\n.5',
  ];
  for (const text of bad) {
    it(`${JSON.stringify(text)} throws`, () => {
      throwsInvalid(text);
    });
  }
});

describe('Complex.parse keeps the forms that the old parser read (#1283, decision D4)', () => {
  const kept: Array<[string, number, number]> = [
    ['3 + 4 i', 3, 4],
    [' 1 + 2 i ', 1, 2],
    ['3 + 4i', 3, 4],
    ['1E3', 1000, 0],
    ['1E3+2I', 1000, 2],
    ['1.5E-2i', 0, 0.015],
    ['Infinity', Infinity, 0],
    ['-Infinity', -Infinity, 0],
    ['Infinityi', 0, Infinity],
    ['2+Infinityi', 2, Infinity],
    ['-Infinity-Infinityi', -Infinity, -Infinity],
  ];
  for (const [text, re, im] of kept) {
    it(`${JSON.stringify(text)} is ${re} + ${im}i`, () => {
      const [gotRe, gotIm] = parts(text);
      expect(Object.is(gotRe, re), `re ${gotRe}`).toBe(true);
      expect(Object.is(gotIm, im), `im ${gotIm}`).toBe(true);
    });
  }
});

describe('Complex.parse round trip (#1283)', () => {
  const values: Array<[number, number]> = [
    [1, 2],
    [-1.5, -2.5],
    [0, 1],
    [0, -1],
    [3, 0],
    [1e-7, -2e21],
    [1e21, 1e-7],
    [-0.1, 0.30000000000000004],
    [5e-324, -1.7976931348623157e308],
  ];
  for (const [re, im] of values) {
    it(`parse(toString()) of ${re} + ${im}i is the same value`, () => {
      const text = new Complex(re, im).toString();
      const [gotRe, gotIm] = parts(text);
      expect(Object.is(gotRe, re), `${text} re ${gotRe}`).toBe(true);
      expect(Object.is(gotIm, im), `${text} im ${gotIm}`).toBe(true);
    });
  }
});
