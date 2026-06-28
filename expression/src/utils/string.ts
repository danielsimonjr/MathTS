import { isBigNumber, isString, typeOf } from './is.js';
import { format as formatNumber } from './number.js';
import { format as formatBigNumber } from './bignumber/formatter.js';

/**
 * Check if a text ends with a certain string.
 * @param {string} text
 * @param {string} search
 */
export function endsWith(text: string, search: string) {
  const start = text.length - search.length;
  const end = text.length;
  return text.substring(start, end) === search;
}

/**
 * Format a value of any type into a string.
 *
 * Usage:
 *     math.format(value)
 *     math.format(value, precision)
 *     math.format(value, options)
 *
 * When value is a function:
 *
 * - When the function has a property `syntax`, it returns this
 *   syntax description.
 * - In other cases, a string `'function'` is returned.
 *
 * When `value` is an Object:
 *
 * - When the object contains a property `format` being a function, this
 *   function is invoked as `value.format(options)` and the result is returned.
 * - When the object has its own `toString` method, this method is invoked
 *   and the result is returned.
 * - In other cases the function will loop over all object properties and
 *   return JSON object notation like '{"a": 2, "b": 3}'.
 *
 * Example usage:
 *     math.format(2/7)                // '0.2857142857142857'
 *     math.format(math.pi, 3)         // '3.14'
 *     math.format(new Complex(2, 3))  // '2 + 3i'
 *     math.format('hello')            // '"hello"'
 *
 * @param {*} value             Value to be stringified
 * @param {Object | number | Function} [options]
 *     Formatting options. See src/utils/number.js:format for a
 *     description of the available options controlling number output.
 *     This generic "format" also supports the option property `truncate: NN`
 *     giving the maximum number NN of characters to return (if there would
 *     have been more, they are deleted and replaced by an ellipsis).
 * @return {string} str
 */
export function format(value: unknown, options: unknown): string {
  const result: string = _format(value, options);
  if (
    options &&
    typeof options === 'object' &&
    'truncate' in options &&
    result.length > (options as { truncate: number }).truncate
  ) {
    return result.substring(0, (options as { truncate: number }).truncate - 3) + '...';
  }
  return result;
}

function _format(value: unknown, options: unknown): string {
  if (typeof value === 'number') {
    return formatNumber(value, options as Parameters<typeof formatNumber>[1]);
  }

  if (isBigNumber(value)) {
    return formatBigNumber(
      value as unknown as Parameters<typeof formatBigNumber>[0],
      options as Parameters<typeof formatBigNumber>[1]
    );
  }

  // note: we use unsafe duck-typing here to check for Fractions, this is
  // ok here since we're only invoking toString or concatenating its values
  if (looksLikeFraction(value)) {
    const v = value as { n: bigint; s: bigint; d: bigint; toString: (o?: unknown) => string };
    const opts = options as { fraction?: string } | null | undefined;
    if (!opts || opts.fraction !== 'decimal') {
      // output as ratio, like '1/3'
      // Convert sign to BigInt to avoid "Cannot mix BigInt and other types" error
      // when n is a BigInt (as in local Fraction implementation)
      const signedNumerator = typeof v.n === 'bigint' ? BigInt(v.s) * v.n : v.s * v.n;
      return `${signedNumerator}/${v.d}`;
    } else {
      // output as decimal, like '0.(3)'
      return v.toString();
    }
  }

  if (Array.isArray(value)) {
    return formatArray(value, options);
  }

  if (isString(value)) {
    return stringify(value);
  }

  if (typeof value === 'function') {
    const fn = value as { syntax?: unknown };
    return fn.syntax ? String(fn.syntax) : 'function';
  }

  if (value && typeof value === 'object') {
    const v = value as {
      format?: (o: unknown) => string;
      toString: (o?: unknown) => string;
    };
    if (typeof v.format === 'function') {
      return v.format(options);
    } else if (value && v.toString(options) !== {}.toString()) {
      // this object has a non-native toString method, use that one
      return v.toString(options);
    } else {
      const entries = Object.keys(value).map((key) => {
        return stringify(key) + ': ' + format((value as Record<string, unknown>)[key], options);
      });

      return '{' + entries.join(', ') + '}';
    }
  }

  return String(value);
}

/**
 * Stringify a value into a string enclosed in double quotes.
 * Unescaped double quotes and backslashes inside the value are escaped.
 * @param {*} value
 * @return {string}
 */
export function stringify(value: unknown) {
  const text = String(value);
  let escaped = '';
  let i = 0;
  while (i < text.length) {
    const c = text.charAt(i);
    escaped += c in controlCharacters ? (controlCharacters as Record<string, string>)[c] : c;
    i++;
  }

  return '"' + escaped + '"';
}

const controlCharacters = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/**
 * Escape special HTML characters
 * @param {*} value
 * @return {string}
 */
export function escape(value: unknown) {
  let text = String(value);
  text = text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return text;
}

/**
 * Recursively format an n-dimensional matrix
 * Example output: "[[1, 2], [3, 4]]"
 * @param {Array} array
 * @param {Object | number | Function} [options]  Formatting options. See
 *                                                lib/utils/number:format for a
 *                                                description of the available
 *                                                options.
 * @returns {string} str
 */
function formatArray(array: unknown, options: unknown): string {
  if (Array.isArray(array)) {
    let str = '[';
    const len = array.length;
    for (let i = 0; i < len; i++) {
      if (i !== 0) {
        str += ', ';
      }
      str += formatArray(array[i], options);
    }
    str += ']';
    return str;
  } else {
    return format(array, options);
  }
}

/**
 * Check whether a value looks like a Fraction (unsafe duck-type check)
 * @param {*} value
 * @return {boolean}
 */
function looksLikeFraction(value: unknown): boolean {
  return (
    (!!value &&
      typeof value === 'object' &&
      typeof (value as { s?: unknown }).s === 'bigint' &&
      typeof (value as { n?: unknown }).n === 'bigint' &&
      typeof (value as { d?: unknown }).d === 'bigint') ||
    false
  );
}

/**
 * Compare two strings
 * @param {string} x
 * @param {string} y
 * @returns {number}
 */
export function compareText(x: unknown, y: unknown) {
  // we don't want to convert numbers to string, only accept string input
  if (!isString(x)) {
    throw new TypeError(
      'Unexpected type of argument in function compareText ' +
        '(expected: string or Array or Matrix, actual: ' +
        typeOf(x) +
        ', index: 0)'
    );
  }
  if (!isString(y)) {
    throw new TypeError(
      'Unexpected type of argument in function compareText ' +
        '(expected: string or Array or Matrix, actual: ' +
        typeOf(y) +
        ', index: 1)'
    );
  }

  return x === y ? 0 : x > y ? 1 : -1;
}
