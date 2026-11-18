/**
 * Balanced-parenthesis call rewriter shared by the string rewrites in `algebra.ts`.
 *
 * @internal Not exported from the package index.
 * @packageDocumentation
 */

/**
 * Rewrite every call `name(arg)` whose name is in `names`.
 *
 * The scan counts parentheses, so a nested argument such as `(x+1)` stays whole.
 * A call preceded by an identifier character (for example `myexp(`) is not a match.
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
    const replaced = rewrite(m[1], expr.slice(call.lastIndex, end - 1));
    if (replaced === undefined) continue;
    out += expr.slice(last, m.index) + replaced;
    last = end;
    call.lastIndex = end;
  }
  return out + expr.slice(last);
}

/**
 * Report whether `text` has a top-level binary `+` or `-` (outside parentheses).
 * A sign at the start, or right after `*`, `/` or `^`, is unary and does not count.
 *
 * @param text - Expression fragment
 * @returns True when the fragment is a sum or difference at the top level
 */
export function hasTopLevelAdditive(text: string): boolean {
  let depth = 0;
  let prev = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && (ch === '+' || ch === '-') && prev !== '' && !'*/^'.includes(prev))
      return true;
    if (ch.trim() !== '') prev = ch;
  }
  return false;
}
