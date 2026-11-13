import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse, evaluate } from '../src/index.js';
import { OPERATOR_SYMBOLS, RADICAL_SYMBOLS } from '../src/utils/char-classes.js';

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
  it('for every table symbol, parse rejects it exactly when evaluate rejects it', () => {
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
    fc.assert(
      fc.property(fc.constantFrom(...MATH_DIGITS), (digit) => {
        expect(() => parse(digit)).toThrow(SyntaxError);
        expect(() => evaluate(digit)).toThrow(SyntaxError);
      }),
      { numRuns: MATH_DIGITS.length }
    );
  });

  it('every operator sign evaluates as its ASCII token', () => {
    for (const [sign, ascii] of Object.entries(OPERATOR_SYMBOLS)) {
      expect(evaluate(`6 ${sign} 3`)).toBe(evaluate(`6 ${ascii} 3`));
    }
    expect(evaluate('6 × 3')).toBe(18);
    expect(evaluate('6 ÷ 3')).toBe(2);
    expect(evaluate('6 · 3')).toBe(18);
    expect(evaluate('5 − 2')).toBe(3);
  });

  it('× and ÷ are operators, not identifiers', () => {
    expect(evaluate('x × 2', { x: 1 })).toBe(2);
    expect(parse('a×b').toString()).toBe('a * b');
  });
});
