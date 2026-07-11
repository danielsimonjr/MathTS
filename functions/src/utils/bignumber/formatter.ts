import { isBigNumber } from '../is.js';
import { isInteger, normalizeFormatOptions, type FormatOptions } from '../number.js';

/**
 * Structural contract for the BigNumber values handled by this formatter.
 * Captures exactly the methods/properties used here. The configured BigNumber
 * implementation (e.g. decimal.js) provides these; the project's `BigNumber`
 * type alias points at a minimal local Decimal that does not declare them all,
 * so we model the runtime contract explicitly.
 */
interface BigNumberValue {
  e: number;
  constructor: new (value: number | string) => BigNumberValue;
  isFinite(): boolean;
  isNaN(): boolean;
  isZero(): boolean;
  isInteger(): boolean;
  gt(other: number | BigNumberValue): boolean;
  greaterThan(other: number | BigNumberValue): boolean;
  lessThan(other: number | BigNumberValue): boolean;
  add(other: number | BigNumberValue): BigNumberValue;
  sub(other: number | BigNumberValue): BigNumberValue;
  mul(other: number | BigNumberValue): BigNumberValue;
  pow(exp: number | BigNumberValue): BigNumberValue;
  toNumber(): number;
  toFixed(places?: number): string;
  toExponential(places?: number): string;
  toPrecision(sd?: number): string;
  toSignificantDigits(sd?: number): BigNumberValue;
  toBinary(): string;
  toOctal(): string;
  toHexadecimal(): string;
}

/**
 * Formats a BigNumber in a given base
 * @param {BigNumber} n
 * @param {number} base
 * @param {number} size
 * @returns {string}
 */
function formatBigNumberToBase(n: BigNumberValue, base: number, size?: number): string {
  const BigNumberCtor = n.constructor;
  const big2 = new BigNumberCtor(2);
  let suffix = '';
  if (size) {
    if (size < 1) {
      throw new Error('size must be in greater than 0');
    }
    if (!isInteger(size)) {
      throw new Error('size must be an integer');
    }
    if (n.greaterThan(big2.pow(size - 1).sub(1)) || n.lessThan(big2.pow(size - 1).mul(-1))) {
      throw new Error(`Value must be in range [-2^${size - 1}, 2^${size - 1}-1]`);
    }
    if (!n.isInteger()) {
      throw new Error('Value must be an integer');
    }
    if (n.lessThan(0)) {
      n = n.add(big2.pow(size));
    }
    suffix = `i${size}`;
  }
  switch (base) {
    case 2:
      return `${n.toBinary()}${suffix}`;
    case 8:
      return `${n.toOctal()}${suffix}`;
    case 16:
      return `${n.toHexadecimal()}${suffix}`;
    default:
      throw new Error(`Base ${base} not supported `);
  }
}

/**
 * Convert a BigNumber to a formatted string representation.
 *
 * Syntax:
 *
 *    format(value)
 *    format(value, options)
 *    format(value, precision)
 *    format(value, fn)
 *
 * Where:
 *
 *    {number} value   The value to be formatted
 *    {Object} options An object with formatting options. Available options:
 *                     {string} notation
 *                         Number notation. Choose from:
 *                         'fixed'          Always use regular number notation.
 *                                          For example '123.40' and '14000000'
 *                         'exponential'    Always use exponential notation.
 *                                          For example '1.234e+2' and '1.4e+7'
 *                         'auto' (default) Regular number notation for numbers
 *                                          having an absolute value between
 *                                          `lower` and `upper` bounds, and uses
 *                                          exponential notation elsewhere.
 *                                          Lower bound is included, upper bound
 *                                          is excluded.
 *                                          For example '123.4' and '1.4e7'.
 *                         'bin', 'oct, or
 *                         'hex'            Format the number using binary, octal,
 *                                          or hexadecimal notation.
 *                                          For example '0b1101' and '0x10fe'.
 *                     {number} wordSize    The word size in bits to use for formatting
 *                                          in binary, octal, or hexadecimal notation.
 *                                          To be used only with 'bin', 'oct', or 'hex'
 *                                          values for 'notation' option. When this option
 *                                          is defined the value is formatted as a signed
 *                                          twos complement integer of the given word size
 *                                          and the size suffix is appended to the output.
 *                                          For example
 *                                          format(-1, {notation: 'hex', wordSize: 8}) === '0xffi8'.
 *                                          Default value is undefined.
 *                     {number} precision   A number between 0 and 16 to round
 *                                          the digits of the number.
 *                                          In case of notations 'exponential',
 *                                          'engineering', and 'auto',
 *                                          `precision` defines the total
 *                                          number of significant digits returned.
 *                                          In case of notation 'fixed',
 *                                          `precision` defines the number of
 *                                          significant digits after the decimal
 *                                          point.
 *                                          `precision` is undefined by default.
 *                     {number} lowerExp    Exponent determining the lower boundary
 *                                          for formatting a value with an exponent
 *                                          when `notation='auto`.
 *                                          Default value is `-3`.
 *                     {number} upperExp    Exponent determining the upper boundary
 *                                          for formatting a value with an exponent
 *                                          when `notation='auto`.
 *                                          Default value is `5`.
 *    {Function} fn    A custom formatting function. Can be used to override the
 *                     built-in notations. Function `fn` is called with `value` as
 *                     parameter and must return a string. Is useful for example to
 *                     format all values inside a matrix in a particular way.
 *
 * Examples:
 *
 *    format(6.4)                                        // '6.4'
 *    format(1240000)                                    // '1.24e6'
 *    format(1/3)                                        // '0.3333333333333333'
 *    format(1/3, 3)                                     // '0.333'
 *    format(21385, 2)                                   // '21000'
 *    format(12e8, {notation: 'fixed'})                  // returns '1200000000'
 *    format(2.3,    {notation: 'fixed', precision: 4})  // returns '2.3000'
 *    format(52.8,   {notation: 'exponential'})          // returns '5.28e+1'
 *    format(12400,  {notation: 'engineering'})          // returns '12.400e+3'
 *
 * @param {BigNumber} value
 * @param {Object | Function | number | BigNumber} [options]
 * @return {string} str The formatted value
 */
export function format(value: unknown, options?: unknown): string {
  const v = value as BigNumberValue;
  if (typeof options === 'function') {
    // handle format(value, fn)
    return (options as (value: unknown) => string)(value);
  }

  // handle special cases
  if (!v.isFinite()) {
    return v.isNaN() ? 'NaN' : v.gt(0) ? 'Infinity' : '-Infinity';
  }

  const { notation, precision, wordSize } = normalizeFormatOptions(
    options as FormatOptions | number | undefined
  );

  // handle the various notations
  switch (notation) {
    case 'fixed':
      return toFixed(v, precision);

    case 'exponential':
      return toExponential(v, precision);

    case 'engineering':
      return toEngineering(v, precision);

    case 'bin':
      return formatBigNumberToBase(v, 2, wordSize);

    case 'oct':
      return formatBigNumberToBase(v, 8, wordSize);

    case 'hex':
      return formatBigNumberToBase(v, 16, wordSize);

    case 'auto': {
      // determine lower and upper bound for exponential notation.
      const optionsObj = options as { lowerExp?: unknown; upperExp?: unknown } | undefined;
      const lowerExp = optionsObj?.lowerExp !== undefined ? optionsObj.lowerExp : -3;
      const upperExp = optionsObj?.upperExp !== undefined ? optionsObj.upperExp : 5;

      // handle special case zero
      if (v.isZero()) return '0';

      // determine whether or not to output exponential notation
      let str;
      const rounded = v.toSignificantDigits(precision);
      const exp = rounded.e;
      const expGteLower = isBigNumber(lowerExp)
        ? !(lowerExp as unknown as BigNumberValue).gt(exp)
        : exp >= (lowerExp as number);
      const expLtUpper = isBigNumber(upperExp)
        ? (upperExp as unknown as BigNumberValue).gt(exp)
        : exp < (upperExp as number);

      if (expGteLower && expLtUpper) {
        // normal number notation
        str = rounded.toFixed();
      } else {
        // exponential notation
        str = toExponential(v, precision);
      }

      // remove trailing zeros after the decimal point
      return str.replace(
        /((\.\d*?)(0+))($|e)/,
        function (_match: string, _g1: string, digits: string, _g3: string, e: string): string {
          return digits !== '.' ? digits + e : e;
        }
      );
    }
    default:
      throw new Error(
        'Unknown notation "' +
          notation +
          '". ' +
          'Choose "auto", "exponential", "fixed", "bin", "oct", or "hex.'
      );
  }
}

/**
 * Format a BigNumber in engineering notation. Like '1.23e+6', '2.3e+0', '3.500e-3'
 * @param {BigNumber} value
 * @param {number} [precision]        Optional number of significant figures to return.
 */
export function toEngineering(value: BigNumberValue, precision?: number): string {
  // find nearest lower multiple of 3 for exponent
  const e = value.e;
  const newExp = e % 3 === 0 ? e : e < 0 ? e - 3 - (e % 3) : e - (e % 3);

  // find difference in exponents, and calculate the value without exponent
  const valueWithoutExp = value.mul(Math.pow(10, -newExp));

  let valueStr = valueWithoutExp.toPrecision(precision);
  if (valueStr.includes('e')) {
    const BigNumberCtor = value.constructor;
    valueStr = new BigNumberCtor(valueStr).toFixed();
  }

  return valueStr + 'e' + (e >= 0 ? '+' : '') + newExp.toString();
}

/**
 * Format a number in exponential notation. Like '1.23e+5', '2.3e+0', '3.500e-3'
 * @param {BigNumber} value
 * @param {number} [precision]  Number of digits in formatted output.
 *                              If not provided, the maximum available digits
 *                              is used.
 * @returns {string} str
 */
export function toExponential(value: BigNumberValue, precision?: number): string {
  if (precision !== undefined) {
    return value.toExponential(precision - 1); // Note the offset of one
  } else {
    return value.toExponential();
  }
}

/**
 * Format a number with fixed notation.
 * @param {BigNumber} value
 * @param {number} [precision=undefined] Optional number of decimals after the
 *                                       decimal point. Undefined by default.
 */
export function toFixed(value: BigNumberValue, precision?: number): string {
  return value.toFixed(precision);
}
