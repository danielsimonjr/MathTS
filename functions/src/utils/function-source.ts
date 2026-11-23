/**
 * Reader for the parameter list of a function, from the text that `fn.toString()` gives.
 *
 * A callback adapter needs the number of parameters and the rest parameter of a plain function,
 * and the closure guard of the worker fan-out needs the parameter names. A regex such as
 * `/\(.*?\)/` ends the list at the first `)`, so a default value with a parenthesis cuts the
 * list. This module scans the text with the JavaScript grammar instead: it keeps the depth of
 * `()`, `[]` and `{}`, and it skips strings, template literals, comments and regular-expression
 * literals. The scan stops at the `)` that closes the list and never reads the body.
 *
 * Limits:
 * - A native function and a bound function have the source `function name() { [native code] }`.
 *   The reader gives no parameter for them. A rest parameter of a bound function is hidden.
 * - A `/` that is not a comment is a division or the start of a regular-expression literal. The
 *   scan decides by the last token before it. The rule can fail only inside the default value
 *   of a parameter, for example inside a function body in a default value.
 *
 * @packageDocumentation
 */

/** The parameter list of a function and the form of its header. */
export interface ParameterList {
  /**
   * `'function'` for `function` and `async function` (also a generator), `'arrow'` for an arrow
   * function, `'method'` for a method, a getter and a setter (their text has no `function`).
   */
  kind: 'function' | 'arrow' | 'method';
  /** True for `function*` and for a generator method. */
  generator: boolean;
  /**
   * The own name of a function expression, which is bound inside its body. Only a function of
   * kind `'function'` has one: the name of a method is not bound in its body.
   */
  name: string | undefined;
  /**
   * One text for each parameter, without comments and without a trailing comma. An entry is a
   * name, `name = default`, `...rest` or a destructuring pattern.
   */
  params: string[];
}

/** How a callback takes its arguments. */
export interface CallbackArity {
  /**
   * The larger of `fn.length` and the number of parameters. `fn.length` stops at the first
   * default value, so `(a, s = 1) => a` has length 1 and count 2.
   */
  count: number;
  /** True when a rest parameter takes the surplus arguments; undefined when the source cannot be read. */
  rest: boolean | undefined;
}

const IDENTIFIER = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;
const ID_PART = /[\p{ID_Continue}$\u200C\u200D]/u;
const WHITESPACE = /\s/;
const LINE_END = /[\n\r\u2028\u2029]/;

/** A word after which a `/` starts a regular-expression literal, not a division. */
const REGEX_AFTER_WORD = new Set([
  'typeof',
  'void',
  'delete',
  'in',
  'of',
  'instanceof',
  'new',
  'return',
  'yield',
  'await',
  'case',
  'do',
  'else',
  'throw',
]);

/** The code point that starts at `i`, as a string. */
function codePointAt(src: string, i: number): string {
  return String.fromCodePoint(src.codePointAt(i) ?? 0);
}

/** The end of the identifier or number that starts at `i` (`i` when no word starts there). */
function wordEnd(src: string, i: number): number {
  let j = i;
  while (j < src.length) {
    const ch = codePointAt(src, j);
    if (!ID_PART.test(ch)) break;
    j += ch.length;
  }
  return j;
}

/** The index after the white space and the comments that start at `i`; -1 for an open comment. */
function skipTrivia(src: string, i: number): number {
  let j = i;
  for (;;) {
    while (j < src.length && WHITESPACE.test(src[j])) j++;
    if (src[j] !== '/') return j;
    if (src[j + 1] === '/') {
      const end = src.slice(j + 2).search(LINE_END);
      j = end < 0 ? src.length : j + 2 + end;
    } else if (src[j + 1] === '*') {
      const end = src.indexOf('*/', j + 2);
      if (end < 0) return -1;
      j = end + 2;
    } else {
      return j;
    }
  }
}

/** The index after the string that starts at `i`; -1 when the string is not closed. */
function skipString(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === '\\') j += 2;
    else if (src[j] === quote) return j + 1;
    else j++;
  }
  return -1;
}

/** The index after the template literal that starts at `i`; -1 when it is not closed. */
function skipTemplate(src: string, i: number): number {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
    } else if (c === '`') {
      return j + 1;
    } else if (c === '$' && src[j + 1] === '{') {
      const group = scanGroup(src, j + 2, false);
      if (group === undefined) return -1;
      j = group.end;
    } else {
      j++;
    }
  }
  return -1;
}

/**
 * The index after the regular-expression literal that starts at `i`; -1 when no literal ends
 * on the same line (the `/` was a division).
 */
function skipRegex(src: string, i: number): number {
  let inClass = false;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\n' || c === '\r') return -1;
    if (c === '\\') j++;
    else if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return j + 1;
    j++;
  }
  return -1;
}

/**
 * Scan a bracket group. `from` is the index after the opening bracket. The scan ends at the
 * matching closing bracket. With `collect`, the text of each entry that the top-level commas
 * separate is returned, without comments and without white space at both ends.
 *
 * @returns the index after the closing bracket and the entries; undefined when the group is not closed
 */
function scanGroup(
  src: string,
  from: number,
  collect: boolean
): { end: number; entries: string[] } | undefined {
  const entries: string[] = [];
  let depth = 1;
  let current = '';
  // True when the last token ends a value, so that a following `/` is a division.
  let valueEnd = false;
  // True after a single `.`: the next word is a property name, not a keyword.
  let afterDot = false;
  let i = from;
  const push = (text: string): void => {
    if (collect) current += text;
  };
  while (i < src.length) {
    const c = src[i];
    if (WHITESPACE.test(c)) {
      push(c);
      i++;
      continue;
    }
    if (c === '/') {
      if (src[i + 1] === '/' || src[i + 1] === '*') {
        const next = skipTrivia(src, i);
        if (next < 0) return undefined;
        push(' ');
        i = next;
        continue;
      }
      if (!valueEnd) {
        const next = skipRegex(src, i);
        if (next >= 0) {
          push(src.slice(i, next));
          i = next;
          valueEnd = true;
          afterDot = false;
          continue;
        }
      }
      push(c);
      i++;
      valueEnd = false;
      afterDot = false;
      continue;
    }
    if (c === "'" || c === '"') {
      const next = skipString(src, i);
      if (next < 0) return undefined;
      push(src.slice(i, next));
      i = next;
      valueEnd = true;
      afterDot = false;
      continue;
    }
    if (c === '`') {
      const next = skipTemplate(src, i);
      if (next < 0) return undefined;
      push(src.slice(i, next));
      i = next;
      valueEnd = true;
      afterDot = false;
      continue;
    }
    const cp = codePointAt(src, i);
    if (ID_PART.test(cp)) {
      const end = wordEnd(src, i);
      const word = src.slice(i, end);
      push(word);
      valueEnd = afterDot || !REGEX_AFTER_WORD.has(word);
      afterDot = false;
      i = end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
      valueEnd = false;
    } else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) {
        if (collect) {
          const last = current.trim();
          if (last !== '') entries.push(last);
        }
        return { end: i + 1, entries };
      }
      valueEnd = true;
    } else if (c === ',' && depth === 1 && collect) {
      const entry = current.trim();
      if (entry !== '') entries.push(entry);
      current = '';
      i++;
      valueEnd = false;
      afterDot = false;
      continue;
    } else if (c === '.' && src[i + 1] !== '.' && src[i - 1] !== '.') {
      afterDot = true;
      valueEnd = false;
      push(c);
      i++;
      continue;
    } else if ((c === '+' || c === '-') && src[i - 1] === c) {
      // A postfix `++` or `--` ends a value.
      valueEnd = true;
    } else {
      valueEnd = false;
    }
    afterDot = false;
    push(c);
    i += cp.length;
  }
  return undefined;
}

/**
 * Read the parameter list of a function from its source text.
 *
 * The header is every form that `fn.toString()` gives: `function`, `async function`, a
 * generator, an arrow function with one bare parameter or a list, a method, a getter and a
 * setter, a method with a computed, a string or a numeric key, and a function that has a
 * comment in its header. The scan stops at the `)` that closes the list.
 *
 * @param source - The text of the function, from `fn.toString()`
 * @returns the list, or undefined when the text is a class, or its list is not closed
 */
export function readParameterList(source: string): ParameterList | undefined {
  let i = skipTrivia(source, 0);
  if (i < 0) return undefined;
  // The header tokens: a word, a `*`, or `key` for a computed, string or numeric key.
  const tokens: string[] = [];
  let open = -1;
  let bareArrow = false;
  while (i < source.length) {
    const c = source[i];
    if (c === '(') {
      open = i;
      break;
    }
    if (c === '=' && source[i + 1] === '>') {
      bareArrow = true;
      break;
    }
    if (c === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      i = skipTrivia(source, i);
      if (i < 0) return undefined;
      continue;
    }
    if (WHITESPACE.test(c)) {
      i++;
    } else if (c === '[') {
      const group = scanGroup(source, i + 1, false);
      if (group === undefined) return undefined;
      tokens.push('key');
      i = group.end;
    } else if (c === "'" || c === '"') {
      const next = skipString(source, i);
      if (next < 0) return undefined;
      tokens.push('key');
      i = next;
    } else if (c === '*') {
      tokens.push('*');
      i++;
    } else if (ID_PART.test(codePointAt(source, i))) {
      const end = wordEnd(source, i);
      const word = source.slice(i, end);
      if (tokens.length === 0 && word === 'class') return undefined;
      tokens.push(word);
      i = end;
    } else {
      i++;
    }
  }
  if (open < 0 && !bareArrow) return undefined;

  if (bareArrow) {
    // `x => ...` and `async x => ...`
    const words = tokens[0] === 'async' && tokens.length === 2 ? tokens.slice(1) : tokens;
    if (words.length !== 1 || !IDENTIFIER.test(words[0])) return undefined;
    return { kind: 'arrow', generator: false, name: undefined, params: [words[0]] };
  }

  const group = scanGroup(source, open + 1, true);
  if (group === undefined) return undefined;
  const generator = tokens.includes('*');
  const functionAt =
    tokens[0] === 'function' ? 0 : tokens[0] === 'async' && tokens[1] === 'function' ? 1 : -1;
  if (functionAt >= 0) {
    // function [*] [name]
    let k = functionAt + 1;
    if (tokens[k] === '*') k++;
    const name = tokens[k] !== undefined && IDENTIFIER.test(tokens[k]) ? tokens[k] : undefined;
    return { kind: 'function', generator, name, params: group.entries };
  }
  const after = skipTrivia(source, group.end);
  if (after < 0) return undefined;
  const kind = source.startsWith('=>', after) ? 'arrow' : 'method';
  return { kind, generator, name: undefined, params: group.entries };
}

/**
 * The name that a parameter entry binds.
 *
 * Strips a leading `...`, takes the text before the first `=`, and returns it when it is one
 * identifier (the Unicode rule: `ID_Start`, `ID_Continue`, `$`, `_`, and the joiners).
 *
 * @param entry - One entry of `ParameterList.params`
 * @returns the name, or undefined for a destructuring pattern or another text
 */
export function parameterName(entry: string): string | undefined {
  let text = entry.trim();
  if (text.startsWith('...')) text = text.slice(3).trimStart();
  const equals = text.indexOf('=');
  const target = (equals < 0 ? text : text.slice(0, equals)).trim();
  return IDENTIFIER.test(target) ? target : undefined;
}

/**
 * How a callback takes its arguments: the number of its parameters (a default value counts) and
 * whether it has a rest parameter.
 *
 * `rest` is `undefined` when the source cannot be read. A caller treats that as "may take
 * every argument". A bound function hides its rest parameter: its source is native code.
 *
 * @param fn - The callback
 * @returns the count and the rest flag
 */
export function callbackArity(fn: (...args: never[]) => unknown): CallbackArity {
  const list = readParameterList(fn.toString());
  // Bound functions expose no formal parameters in source. Their remaining fixed arity
  // is available through length, but any rest parameter is hidden by the binding.
  if (fn.name.startsWith('bound ') && list?.params.length === 0) {
    return { count: fn.length, rest: undefined };
  }
  return {
    count: Math.max(fn.length, list?.params.length ?? 0),
    rest: list === undefined ? undefined : list.params.some((p) => p.startsWith('...')),
  };
}
