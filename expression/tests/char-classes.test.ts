import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse, evaluate } from '../src/index.js';
import {
  OPERATOR_SYMBOLS,
  RADICAL_SYMBOLS,
  isMathDigitPair,
  isMathLetterPair,
} from '../src/utils/char-classes.js';

/** Every mathematical digit: U+1D7CE to U+1D7FF, as a surrogate pair. */
const MATH_DIGITS: string[] = [];
for (let cp = 0x1d7ce; cp <= 0x1d7ff; cp++) {
  MATH_DIGITS.push(String.fromCodePoint(cp));
}

/** The whole table: every symbol the tokenizer and the evaluator classify. */
const TABLE: string[] = [
  ...Object.keys(RADICAL_SYMBOLS),
  ...Object.keys(OPERATOR_SYMBOLS),
  ...MATH_DIGITS,
];

function outcome(run: () => unknown): 'ok' | 'syntax' | 'other' {
  try {
    run();
    return 'ok';
  } catch (error) {
    return error instanceof SyntaxError ? 'syntax' : 'other';
  }
}

describe('shared character-class table: parse and evaluate agree', () => {
  it('a bypass of parse would show: parse and evaluate classify every table symbol alike', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TABLE), (symbol) => {
        // Classification is what must agree: a symbol that parse rejects as a syntax error is
        // rejected by evaluate the same way. Scope errors (a function missing from this package's
        // scope) are not classification, so they are not compared.
        const parsed = outcome(() => parse(symbol + '2')) === 'syntax';
        const evaluated = outcome(() => evaluate(symbol + '2')) === 'syntax';
        expect(evaluated).toBe(parsed);
      }),
      { numRuns: TABLE.length * 2 }
    );
  });

  it('every mathematical digit is a parse-time SyntaxError, never a symbol', () => {
    expect(MATH_DIGITS).toHaveLength(50);
    for (const digit of MATH_DIGITS) {
      expect(() => parse(digit), digit).toThrow(SyntaxError);
      expect(() => evaluate(digit), digit).toThrow(SyntaxError);
    }
  });

  it('each code point of the mathematical alphanumeric block has the class that Unicode gives it', () => {
    // Independent oracle: the Unicode General_Category of the running engine, not this table.
    // Nd is a digit (rejected), Cn is unassigned (rejected), anything else is a name character.
    for (let cp = 0x1d400; cp <= 0x1d7ff; cp++) {
      const ch = String.fromCodePoint(cp);
      const expected = /\p{Nd}/u.test(ch) ? 'digit' : /\p{Cn}/u.test(ch) ? 'unassigned' : 'name';
      const actual = isMathDigitPair(ch[0], ch[1])
        ? 'digit'
        : isMathLetterPair(ch[0], ch[1])
          ? 'name'
          : 'unassigned';
      expect(actual, `U+${cp.toString(16).toUpperCase()}`).toBe(expected);
      if (expected === 'name') {
        expect(parse(ch).toString(), ch).toBe(ch);
      } else {
        expect(() => parse(ch), ch).toThrow(SyntaxError);
      }
    }
  });

  it('every operator sign evaluates as its ASCII token', () => {
    for (const [sign, ascii] of Object.entries(OPERATOR_SYMBOLS)) {
      expect(evaluate(`6 ${sign} 3`)).toBe(evaluate(`6 ${ascii} 3`));
    }
    expect(evaluate('6 × 3')).toBe(18);
    expect(evaluate('6 ÷ 3')).toBe(2);
    expect(evaluate('6 · 3')).toBe(18);
    expect(evaluate('5 − 2')).toBe(3);
    expect(evaluate('6 ⋅ 3')).toBe(18);
  });

  it('× and ÷ are operators, not identifiers', () => {
    expect(evaluate('x × 2', { x: 1 })).toBe(2);
    expect(parse('a×b').toString()).toBe('a * b');
  });
});

describe('radical signs', () => {
  it('∛ and ∜ evaluate in the expression package alone', () => {
    expect(evaluate('∛8')).toBe(2);
    expect(evaluate('∛(-8)')).toBe(-2);
    expect(evaluate('∜16')).toBe(2);
    expect(evaluate('cbrt(27)')).toBe(3);
    expect(evaluate('nthRoot(-8, 3)')).toBe(-2);
    expect(evaluate('nthRoot(81, 4)')).toBe(3);
    expect(evaluate('nthRoot(-16, 4)')).toBeNaN();
  });

  it('the operand is the unary operand: same parse as unary minus, grouping parentheses stripped', () => {
    expect(parse('√2^2').toString()).toBe('sqrt(2 ^ 2)');
    expect(parse('√(2)^2').toString()).toBe('sqrt(2 ^ 2)');
    expect(parse('√(a+b)^2').toString()).toBe('sqrt((a + b) ^ 2)');
    expect(parse('√(a)(b)').toString()).toBe('sqrt(a) (b)');
    expect(parse('√x!').toString()).toBe('sqrt(x!)');
    expect(parse('√(x)!').toString()).toBe('sqrt(x!)');
    expect(parse('-√4').toString()).toBe('-sqrt(4)');
    expect(parse('√√16').toString()).toBe('sqrt(sqrt(16))');
    expect(parse('√(√16)').toString()).toBe('sqrt(sqrt(16))');
    expect(evaluate('-√4')).toBe(-2);
    expect(evaluate('√√16')).toBe(2);
  });

  it('a radical is the right operand of implicit multiplication', () => {
    expect(parse('2√3').toString()).toBe('2 sqrt(3)');
    expect(parse('a√b').toString()).toBe('a sqrt(b)');
    expect(parse('√2√3').toString()).toBe('sqrt(2) sqrt(3)');
    expect(evaluate('2√9')).toBe(6);
    expect(evaluate('√4√9')).toBe(6);
    expect(evaluate('a√b', { a: 2, b: 16 })).toBe(8);
  });
});
