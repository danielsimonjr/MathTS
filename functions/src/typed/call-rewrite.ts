/**
 * Balanced-parenthesis call rewriter shared by the string rewrites in `algebra.ts`.
 *
 * @internal Not exported from the package index.
 * @packageDocumentation
 */

/** Names that the expression parser reads as operators. */
const WORD_OPERATORS = new Set(['mod', 'to', 'in', 'and', 'xor', 'or', 'not']);
const NAME_CHAR = /[\p{L}\p{N}_$]/u;

/**
 * Return the run of name characters that ends at the white space before `index`.
 *
 * @param expr - Expression string
 * @param index - Position of a call
 * @returns The run, or an empty string when no white space is before `index`
 */
function wordBeforeSpace(expr: string, index: number): string {
  let stop = index;
  while (stop > 0 && expr[stop - 1].trim() === '') stop--;
  if (stop === index) return '';
  let begin = stop;
  while (begin > 0 && NAME_CHAR.test(expr[begin - 1])) begin--;
  return expr.slice(begin, stop);
}

/**
 * Rewrite every call `name(arg)` whose name is in `names`.
 *
 * The scan counts parentheses, so a nested argument such as `(x+1)` stays whole.
 * A call preceded by an identifier character (for example `myexp(`) is not a match.
 * A call that follows a name and white space (`x exp(y)`, an implicit product) stays
 * as written, because a parenthesised replacement after a name reads as a call of
 * that name. A call after a word operator (`x mod exp(y)`) is rewritten.
 * When `rewrite` returns `undefined`, the call stays as written and the scan goes on
 * inside it. When the parentheses do not balance, the rest of the text stays as written.
 *
 * @param expr - Expression string
 * @param names - Function names to match
 * @param rewrite - Receives the name and the raw argument text; returns the replacement
 * @returns The rewritten expression
 */
export function rewriteCalls(
  expr: string,
  names: readonly string[],
  rewrite: (name: string, arg: string) => string | undefined
): string {
  const call = new RegExp(String.raw`(?<![\p{L}_$][\p{L}\p{N}_$]*)(${names.join('|')})\s*\(`, 'gu');
  let out = '';
  let last = 0;
  for (let m = call.exec(expr); m !== null; m = call.exec(expr)) {
    let depth = 1;
    let end = call.lastIndex;
    while (end < expr.length && depth > 0) {
      if (expr[end] === '(') depth++;
      else if (expr[end] === ')') depth--;
      end++;
    }
    if (depth !== 0) break; // unbalanced: leave the rest as written
    const word = wordBeforeSpace(expr, m.index);
    if (/[^\p{N}]/u.test(word) && !WORD_OPERATORS.has(word)) continue; // implicit product
    const replaced = rewrite(m[1], expr.slice(call.lastIndex, end - 1));
    if (replaced === undefined) continue;
    out += expr.slice(last, m.index) + replaced;
    last = end;
    call.lastIndex = end;
  }
  return out + expr.slice(last);
}

const NUMBER = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const NAME = /[\p{L}_$][\p{L}\p{N}_$]*/uy;

/**
 * Split a product at each top-level `*` (outside parentheses).
 *
 * The text is a product when its top level holds only names, numbers, parenthesis
 * groups, calls, `*`, `/`, `^` and unary signs. A sign is unary at the start or right
 * after `*`, `/`, `^` or another sign; a number keeps the sign of its exponent
 * (`1e-3`). Any other top-level content gives `undefined`: a binary `+` or `-`, a
 * comma, another operator, two operands separated only by a space, or parentheses
 * that do not balance.
 *
 * @param text - Expression fragment
 * @returns The trimmed factors, or `undefined` when the fragment is not a product
 */
export function topLevelFactors(text: string): string[] | undefined {
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
    if (ch === '(') {
      let depth = 1;
      while (next < text.length && depth > 0) {
        if (text[next] === '(') depth++;
        else if (text[next] === ')') depth--;
        next++;
      }
      if (depth !== 0) return undefined;
    } else if ('*/^+-'.includes(ch)) {
      if (ch === '+' || ch === '-') {
        if (operand) return undefined; // binary: the text is a sum
      } else if (!operand) return undefined;
      isOperand = false;
      if (ch === '*') {
        factors.push(text.slice(start, pos).trim());
        start = next;
      }
    } else {
      NUMBER.lastIndex = NAME.lastIndex = pos;
      const token = NUMBER.exec(text) ?? NAME.exec(text);
      if (token === null) return undefined;
      next = pos + token[0].length;
    }
    if (isOperand && operand && spaced) return undefined;
    operand = isOperand;
    spaced = false;
    pos = next;
  }
  if (!operand) return undefined;
  factors.push(text.slice(start).trim());
  return factors;
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
