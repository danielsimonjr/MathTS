/**
 * The one character-class table for the expression tokenizer and for the
 * variable-name check. Every rule about a non-ASCII symbol lives here.
 *
 * - Radical signs (`√ ∛ ∜`) are prefix operators. The parser builds a function call.
 * - Operator signs (`· ⋅ × ÷ −`) are binary operators. The tokenizer maps each to its ASCII token.
 * - Mathematical digits (U+1D7CE to U+1D7FF) are not letters and not numbers. The
 *   tokenizer rejects them at parse time, so parse and evaluate agree.
 */

/** A radical sign: the function that the prefix operator calls. */
export interface RadicalSpec {
  /** Function name in the math scope. */
  readonly fn: 'sqrt' | 'cbrt' | 'nthRoot';
  /** Fixed second argument, used by `nthRoot` (`∜x` is `nthRoot(x, 4)`). */
  readonly index?: number;
}

export const RADICAL_SYMBOLS: Readonly<Record<string, RadicalSpec>> = Object.freeze({
  '√': { fn: 'sqrt' },
  '∛': { fn: 'cbrt' },
  '∜': { fn: 'nthRoot', index: 4 },
});

/** Operator signs and the ASCII token each one stands for. */
export const OPERATOR_SYMBOLS: Readonly<Record<string, string>> = Object.freeze({
  '·': '*',
  '⋅': '*',
  '×': '*',
  '÷': '/',
  '−': '-',
});

/** High surrogate of every mathematical digit (U+1D7CE to U+1D7FF). */
const MATH_DIGIT_HIGH = /^\uD835$/;
/** Low surrogate of every mathematical digit: U+1D7CE is 𝟎. */
const MATH_DIGIT_LOW = /^[\uDFCE-\uDFFF]$/;

/** True when the two code units start a mathematical digit (U+1D7CE to U+1D7FF). */
export function isMathDigitPair(high: string, low: string): boolean {
  return MATH_DIGIT_HIGH.test(high) && MATH_DIGIT_LOW.test(low);
}

/** True for a Latin, Greek or letter-like code unit, excluding the operator signs × and ÷. */
export function isLatinOrGreekLetter(c: string): boolean {
  return /^[a-zA-Z_$À-ÖØ-öø-ʯͰ-Ͽ℀-⅏]$/.test(c);
}

/**
 * True for a mathematical alphanumeric letter pair (U+1D400 to U+1D7FF), without the
 * mathematical digits and without the code points that the Unicode standard leaves unassigned.
 */
export function isMathLetterPair(high: string, low: string): boolean {
  return (
    /^\uD835$/.test(high) &&
    /^[\uDC00-\uDFFF]$/.test(low) &&
    !MATH_DIGIT_LOW.test(low) &&
    !/^[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]$/.test(
      low
    )
  );
}
