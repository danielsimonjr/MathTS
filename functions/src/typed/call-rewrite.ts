/**
 * Balanced-parenthesis call rewriter shared by the string rewrites in `algebra.ts`.
 *
 * @internal Not exported from the package index.
 * @packageDocumentation
 */

/** Names that the expression parser reads as operators. */
const WORD_OPERATORS = new Set(['mod', 'to', 'in', 'and', 'xor', 'or', 'not']);
/** Names that the expression parser reads as constants, not as symbols. */
const VALUE_WORDS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const NAME_CHAR = /[\p{L}\p{N}_$]/u;
/** Report whether a UTF-16 unit is part of a name. Half of a surrogate pair counts as one. */
const isNameChar = (ch: string | undefined): boolean => {
  if (ch === undefined) return false;
  if (ch < '\u0080') return (ch >= 'a' && ch <= 'z') || /[A-Z0-9_$]/.test(ch);
  return (ch >= '\ud800' && ch <= '\udfff') || NAME_CHAR.test(ch);
};
/** The name characters that end a decimal number: `12`, `1e3`, the `5e3` of `1.5e3`. */
const DECIMAL_WORD = /^\d+(?:[eE]\d+)?$/;
/** A hexadecimal, binary or octal number: `0x1F`, `0b11`, `0o17`. */
const RADIX_WORD = /^0(?:x[0-9a-fA-F]+|b[01]+|o[0-7]+)$/;
const DIGIT = /\d/;

/**
 * A function that takes the position of a `(` or a `[` in a text. It returns the
 * position after the closing character, or -1 when the group does not close.
 */
export type GroupEnd = (pos: number) => number;

/** The string literals, comments and bracket pairs of an expression. */
interface Structure {
  /** The position of the other bracket of each `(`, `)`, `[` and `]`; -1 when it has none. */
  partner: Int32Array;
  /** `QUOTED` for each character of a string literal or a comment; `SEPARATOR` for a line end between statements. */
  marks: Uint8Array;
}
const QUOTED = 1;
const SEPARATOR = 2;

/**
 * Read the structure of an expression in one pass.
 *
 * A `"` opens a string. A `'` opens a string at the start of a value and is the
 * transpose operator after a value, as in the expression parser. A `#` opens a
 * comment that ends at the line end. Brackets in strings and comments do not count.
 *
 * @param expr - Expression string
 * @returns The structure, or `undefined` when the role of a `'` is not certain
 */
function readStructure(expr: string): Structure | undefined {
  const partner = new Int32Array(expr.length).fill(-1);
  const marks = new Uint8Array(expr.length);
  const parens: number[] = [];
  const brackets: number[] = [];
  let depth = 0; // nesting of (, [ and {: a line end is white space inside them
  let value: boolean | undefined = false; // the last token ends a value; undefined: not known
  let wordBegin = 0; // the last run of name characters
  let wordEnd = 0;
  let afterWord = false; // only white space follows that run
  for (let pos = 0; pos < expr.length; pos++) {
    const ch = expr[pos];
    if (isNameChar(ch)) {
      if (pos !== wordEnd) wordBegin = pos;
      wordEnd = pos + 1;
      afterWord = true;
      value = true;
      continue;
    }
    const wordBefore = afterWord;
    if (ch.trim() !== '') afterWord = false;
    if (ch === "'" && value === true && wordBefore) {
      // A word operator before the quote (`x mod 'a'`) does not end a value.
      const word = expr.slice(wordBegin, wordEnd);
      if (WORD_OPERATORS.has(word) && expr[wordBegin - 1] !== '.') {
        if (word === 'in') return undefined; // an operator, or the symbol `in` after a constant
        value = false;
      }
    }
    if (ch === '"' || (ch === "'" && value !== true)) {
      if (ch === "'" && value === undefined) return undefined;
      const begin = pos;
      for (pos++; pos < expr.length && expr[pos] !== ch; pos++) {
        if (expr[pos] === '\\') pos++;
      }
      marks.fill(QUOTED, begin, pos + 1);
      value = true;
    } else if (ch === '#') {
      const begin = pos;
      while (pos + 1 < expr.length && expr[pos + 1] !== '\n') pos++;
      marks.fill(QUOTED, begin, pos + 1);
    } else if (ch === '(' || ch === '[') {
      (ch === '(' ? parens : brackets).push(pos);
      depth++;
      value = false;
    } else if (ch === ')' || ch === ']') {
      const open = (ch === ')' ? parens : brackets).pop();
      if (open !== undefined) {
        partner[open] = pos;
        partner[pos] = open;
      }
      depth--;
      value = true;
    } else if (ch === '{') {
      depth++;
      value = false;
    } else if (ch === '}') {
      depth--;
      value = true;
    } else if (ch === '\n') {
      if (depth <= 0) {
        marks[pos] = SEPARATOR;
        value = false;
      }
    } else if (ch === '%') {
      value = undefined; // percent after a value, or the modulus operator
    } else if (ch === "'" || ch === '!') {
      value = true;
    } else if (ch !== '.' && ch.trim() !== '') {
      value = false;
    }
  }
  return { partner, marks };
}

/**
 * Report whether the name characters from `begin` to `stop` end a number literal.
 * After a dot only a decimal number does: `2.0x1F` is the number `2.0` and the name `x1F`.
 *
 * @param expr - Expression string
 * @param begin - Position of the first name character
 * @param stop - Position after the last name character
 * @returns True for the end of a number literal
 */
function isNumberWord(expr: string, begin: number, stop: number): boolean {
  const word = expr.slice(begin, stop);
  return DECIMAL_WORD.test(word) || (RADIX_WORD.test(word) && expr[begin - 1] !== '.');
}

/**
 * Report whether the number literal or constant before `stop` ends a constant value.
 *
 * @param expr - Expression string
 * @param stop - Position after the text to read
 * @returns True after a number, a string or a constant name
 */
function endsConstant(expr: string, stop: number): boolean {
  while (stop > 0 && expr[stop - 1].trim() === '') stop--;
  if (stop === 0) return false;
  const prev = expr[stop - 1];
  if (prev === '"' || prev === "'") return true;
  if (prev === '.') return stop > 1 && DIGIT.test(expr[stop - 2]);
  let begin = stop;
  while (begin > 0 && isNameChar(expr[begin - 1])) begin--;
  const word = expr.slice(begin, stop);
  return isNumberWord(expr, begin, stop) || (VALUE_WORDS.has(word) && expr[begin - 1] !== '.');
}

/**
 * Report whether a parenthesised replacement at `index` reads as a call of the text
 * before it. The expression parser reads `(` as a call after a symbol (`x `), a
 * property (`x.y `) and an index (`x[1]`). It reads `(` as a product after a number
 * (`2 `, `1e3 `, `0x1F `), a constant name (`true `), a matrix (`[1, 2] `) and a word
 * operator (`mod `). The name `in` is a symbol after a constant (`2 in`).
 *
 * @param expr - Expression string
 * @param index - Position of a call
 * @param structure - The structure of `expr`
 * @returns True when the call at `index` must stay as written
 */
function readsAsCall(expr: string, index: number, structure: Structure): boolean {
  const { partner, marks } = structure;
  let stop = index;
  while (stop > 0 && expr[stop - 1].trim() === '' && marks[stop - 1] !== SEPARATOR) stop--;
  if (stop === 0) return false;
  const prev = expr[stop - 1];
  if (prev === ']') {
    // An index follows a value. Any other `[` opens a matrix.
    let open = partner[stop - 1];
    if (open < 0) return true;
    while (open > 0 && expr[open - 1].trim() === '' && marks[open - 1] !== SEPARATOR) open--;
    if (open === 0) return false;
    const before = expr[open - 1];
    if (!isNameChar(before)) return /[)\]}"'!]/.test(before);
    let begin = open;
    while (begin > 0 && isNameChar(expr[begin - 1])) begin--;
    return !WORD_OPERATORS.has(expr.slice(begin, open)) || expr[begin - 1] === '.';
  }
  if (prev === '.') {
    // A method (`x.sin(y)`), but a product after a number that ends with a dot (`2.sin(y)`).
    let begin = stop - 1;
    while (begin > 0 && DIGIT.test(expr[begin - 1])) begin--;
    const before = expr[begin - 1];
    return begin === stop - 1 || isNameChar(before) || before === '.';
  }
  if (stop === index) return false;
  let begin = stop;
  while (begin > 0 && isNameChar(expr[begin - 1])) begin--;
  const word = expr.slice(begin, stop);
  if (word === '' || isNumberWord(expr, begin, stop)) return false;
  if (expr[begin - 1] === '.') return true; // a property, also when its name is `mod` or `true`
  if (VALUE_WORDS.has(word)) return false;
  if (word === 'in') return endsConstant(expr, begin);
  return !WORD_OPERATORS.has(word);
}

/**
 * Rewrite every call `name(arg)` whose name is in `names`.
 *
 * One pass pairs the brackets, so a nested argument such as `(x+1)` stays whole and
 * the scan takes linear time. Text in a string literal or a comment stays as written.
 * A call preceded by an identifier character (for example `myexp(`) is not a match.
 * A method call (`x.exp(y)`) stays as written. A call that follows a name and white
 * space (`x exp(y)`) or an index (`x[1] exp(y)`) is an implicit product. It stays as
 * written, because a parenthesised replacement there reads as a call. A call after a
 * number, a matrix or a word operator (`2 exp(y)`, `x mod exp(y)`) is rewritten.
 * When `rewrite` returns `undefined`, the call stays as written and the scan goes on
 * inside it. When the parentheses do not balance, the rest of the text stays as written.
 *
 * @param expr - Expression string
 * @param names - Function names to match
 * @param rewrite - Receives the name, the raw argument text and the group ends of that
 *   text; returns the replacement
 * @returns The rewritten expression
 */
export function rewriteCalls(
  expr: string,
  names: readonly string[],
  rewrite: (name: string, arg: string, groupEnd: GroupEnd) => string | undefined
): string {
  const structure = readStructure(expr);
  if (structure === undefined) return expr;
  const { partner, marks } = structure;
  const call = new RegExp(String.raw`(?<![\p{L}_$][\p{L}\p{N}_$]*)(${names.join('|')})\s*\(`, 'gu');
  let out = '';
  let last = 0;
  for (let m = call.exec(expr); m !== null; m = call.exec(expr)) {
    if (marks[m.index] === QUOTED) continue;
    const start = call.lastIndex;
    const close = partner[start - 1];
    if (close < 0) break; // unbalanced: leave the rest as written
    if (readsAsCall(expr, m.index, structure)) continue; // implicit product or method
    const replaced = rewrite(m[1], expr.slice(start, close), (pos) => {
      const end = partner[start + pos];
      return end < 0 || end >= close ? -1 : end - start + 1;
    });
    if (replaced === undefined) continue;
    out += expr.slice(last, m.index) + replaced;
    last = close + 1;
    call.lastIndex = last;
  }
  return out + expr.slice(last);
}

const NUMBER = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const NAME = /[\p{L}_$][\p{L}\p{N}_$]*/uy;

/**
 * Split a product at each top-level `*` (outside parentheses).
 *
 * The text is a product when its top level holds only names, numbers, parenthesis
 * groups, calls, indexes (`v[1]`), properties (`x.y`), the postfix operators `!` and
 * `'`, `*`, `/`, `^` and unary signs. A sign is unary at the start or right after `*`,
 * `/`, `^` or another sign; a number keeps the sign of its exponent (`1e-3`). Any
 * other top-level content gives `undefined`: a binary `+` or `-`, a comma, a string,
 * a matrix, another operator, two operands separated only by a space, or a group
 * that does not close.
 *
 * @param text - Expression fragment
 * @param groupEnd - The group ends of `text`. The default reads them from `text`.
 * @returns The trimmed factors, or `undefined` when the fragment is not a product
 */
export function topLevelFactors(text: string, groupEnd?: GroupEnd): string[] | undefined {
  let endOf = groupEnd;
  const factors: string[] = [];
  let start = 0;
  let operand = false; // the last token is an operand
  let spaced = false; // white space follows the last token
  let pos = 0;
  while (pos < text.length) {
    const ch = text[pos];
    if (ch.trim() === '') {
      spaced = true;
      pos++;
      continue;
    }
    let next = pos + 1;
    let isOperand = true;
    let postfix = false; // the token belongs to the operand before it
    if (ch === '(' || ch === '[') {
      if (endOf === undefined) {
        const structure = readStructure(text);
        if (structure === undefined) return undefined;
        const { partner } = structure;
        endOf = (at) => (partner[at] < 0 ? -1 : partner[at] + 1);
      }
      next = endOf(pos);
      if (next < 0) return undefined;
      if (ch === '[') {
        if (!operand) return undefined; // a matrix
        postfix = true;
      }
    } else if ('*/^+-'.includes(ch)) {
      if (ch === '+' || ch === '-') {
        if (operand) return undefined; // binary: the text is a sum
      } else if (!operand) return undefined;
      isOperand = false;
      if (ch === '*') {
        factors.push(text.slice(start, pos).trim());
        start = next;
      }
    } else if (ch === "'" || ch === '!') {
      if (!operand || (ch === '!' && text[next] === '=')) return undefined;
      postfix = true;
    } else {
      NUMBER.lastIndex = NAME.lastIndex = pos;
      let token = NUMBER.exec(text) ?? NAME.exec(text);
      if (token === null && ch === '.' && operand) {
        NAME.lastIndex = pos + 1;
        token = NAME.exec(text);
        postfix = true; // a property
        next++;
      }
      if (token === null) return undefined;
      next += token[0].length - 1;
    }
    if (isOperand && operand && spaced && !postfix) return undefined;
    operand = isOperand;
    spaced = false;
    pos = next;
  }
  if (!operand) return undefined;
  factors.push(text.slice(start).trim());
  return factors;
}

/**
 * Report whether a text has a comma outside its parentheses and brackets, as the
 * argument text of a call with two or more arguments does.
 *
 * @param text - Argument text of a call
 * @param groupEnd - The group ends of `text`
 * @returns True when a top-level comma is present or a group does not close
 */
export function hasTopLevelComma(text: string, groupEnd: GroupEnd): boolean {
  for (let pos = 0; pos < text.length; pos++) {
    if (text[pos] === ',') return true;
    if (text[pos] === '(' || text[pos] === '[') {
      const next = groupEnd(pos);
      if (next < 0) return true;
      pos = next - 1;
    }
  }
  return false;
}

/**
 * Report whether one pair of parentheses encloses all of `text`.
 *
 * @param text - Expression fragment
 * @returns True for `(x+1)`; false for `(x)*(y)`
 */
export function isParenthesised(text: string): boolean {
  if (!text.startsWith('(')) return false;
  let depth = 0;
  for (let pos = 0; pos < text.length; pos++) {
    if (text[pos] === '(') depth++;
    else if (text[pos] === ')' && --depth === 0) return pos === text.length - 1;
  }
  return false;
}
