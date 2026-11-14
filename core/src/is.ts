// type checks for all known types
//
// note that:
//
// - check by duck-typing on a property like `isUnit`, instead of checking instanceof.
//   instanceof cannot be used because that would not allow to pass data from
//   one instance of math.js to another since each has it's own instance of Unit.
// - check the `isUnit` property via the constructor, so there will be no
//   matches for "fake" instances like plain objects with a property `isUnit`.
//   That is important for security reasons.
// - It must not be possible to override the type checks used internally,
//   for security reasons, so these functions are not exposed in the expression
//   parser.

// Type interfaces for math.js types
/**
 * Shape of a BigNumber value that the duck-typing guards in this module read.
 */
export interface BigNumber {
  isBigNumber: boolean;
  constructor: {
    prototype: { isBigNumber: boolean };
    isDecimal?: (x: unknown) => boolean;
  };
}

/**
 * Shape of a complex number: real part `re` and imaginary part `im`.
 */
export interface Complex {
  re: number;
  im: number;
}

/**
 * Shape of a fraction: numerator `n` and denominator `d`.
 */
export interface Fraction {
  n: number;
  d: number;
}

/**
 * Shape of a Unit value that the duck-typing guards in this module read.
 */
export interface Unit {
  constructor: {
    prototype: { isUnit: boolean };
  };
}

/**
 * Shape of a Matrix value that the duck-typing guards in this module read.
 */
export interface Matrix {
  isMatrix?: boolean;
  _size?: number[];
  constructor: {
    prototype: { isMatrix: boolean };
  };
}

/**
 * Shape of a Matrix that also has the `isDenseMatrix` flag.
 */
export interface DenseMatrix extends Matrix {
  isDenseMatrix: boolean;
}

/**
 * Shape of a Matrix that also has the `isSparseMatrix` flag.
 */
export interface SparseMatrix extends Matrix {
  isSparseMatrix: boolean;
}

/**
 * Shape of a Range value: start, end and step.
 */
export interface Range {
  start: number;
  end: number;
  step: number;
  constructor: {
    prototype: { isRange: boolean };
  };
}

/**
 * Shape of one dimension of an Index.
 */
export interface IndexDimension {
  _data?: unknown[];
  _size: number[];
  isRange?: boolean;
  start?: number;
  end?: number;
}

/**
 * Shape of an Index value: its dimensions and the optional source size.
 */
export interface Index {
  _dimensions: (IndexDimension | string)[];
  _sourceSize?: (number | null)[];
  constructor: {
    prototype: { isIndex: boolean };
  };
}

// Type guard functions

/**
 * Structural view used by the duck-typing guards below: math.js types are
 * identified by `isX` flags on the instance and/or its constructor prototype,
 * never by `instanceof` (so values can cross math.js instance boundaries).
 */
type DuckObject = {
  constructor: { prototype: Record<string, unknown> };
} & Record<string, unknown>;

/** True when `x`'s constructor prototype carries `flag === true`. */
function hasPrototypeFlag(x: unknown, flag: string): boolean {
  return !!x && (x as DuckObject).constructor.prototype[flag] === true;
}

/**
 * True when `x` carries its own `ownFlag === true` and its constructor
 * prototype carries `protoFlag === true`.
 */
function hasOwnAndPrototypeFlag(x: unknown, ownFlag: string, protoFlag: string): boolean {
  return (
    !!x &&
    (x as DuckObject)[ownFlag] === true &&
    (x as DuckObject).constructor.prototype[protoFlag] === true
  );
}

/**
 * Test whether a value is a primitive number.
 *
 * @param x - The value to test.
 * @returns True when `typeof x` is `'number'`.
 */
export function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}

/**
 * Test whether a value is a BigNumber.
 *
 * @param x - The value to test.
 * @returns True when `x` and its constructor prototype both have `isBigNumber === true`, or when `x.constructor.isDecimal(x)` returns true.
 */
export function isBigNumber(x: unknown): x is BigNumber {
  if (!x || typeof x !== 'object' || typeof (x as BigNumber).constructor !== 'function') {
    return false;
  }

  const obj = x as BigNumber;

  if (
    obj.isBigNumber === true &&
    typeof obj.constructor.prototype === 'object' &&
    obj.constructor.prototype.isBigNumber === true
  ) {
    return true;
  }

  if (typeof obj.constructor.isDecimal === 'function' && obj.constructor.isDecimal(obj) === true) {
    return true;
  }

  return false;
}

/**
 * Test whether a value is a primitive bigint.
 *
 * @param x - The value to test.
 * @returns True when `typeof x` is `'bigint'`.
 */
export function isBigInt(x: unknown): x is bigint {
  return typeof x === 'bigint';
}

/**
 * Test whether a value is a Complex number.
 *
 * @param x - The value to test.
 * @returns True when `x` is an object whose prototype has `isComplex === true`.
 */
export function isComplex(x: unknown): x is Complex {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isComplex === true);
}

/**
 * Test whether a value is a Fraction.
 *
 * @param x - The value to test.
 * @returns True when `x` is an object whose prototype has `isFraction === true`.
 */
export function isFraction(x: unknown): x is Fraction {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isFraction === true);
}

/**
 * Test whether a value is a Unit.
 *
 * @param x - The value to test.
 * @returns True when the constructor prototype of `x` has `isUnit === true`.
 */
export function isUnit(x: unknown): x is Unit {
  return hasPrototypeFlag(x, 'isUnit');
}

/**
 * Test whether a value is a primitive string.
 *
 * @param x - The value to test.
 * @returns True when `typeof x` is `'string'`.
 */
export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export const isArray = Array.isArray;

/**
 * Test whether a value is a Matrix of any storage type.
 *
 * @param x - The value to test.
 * @returns True when the constructor prototype of `x` has `isMatrix === true`.
 */
export function isMatrix(x: unknown): x is Matrix {
  return hasPrototypeFlag(x, 'isMatrix');
}

/**
 * Test whether a value is a collection: an Array or Matrix
 * @param x
 * @returns isCollection
 */
export function isCollection(x: unknown): x is unknown[] | Matrix {
  return Array.isArray(x) || isMatrix(x);
}

/**
 * Test whether a value is a DenseMatrix.
 *
 * @param x - The value to test.
 * @returns True when `x` has `isDenseMatrix === true` and its constructor prototype has `isMatrix === true`.
 */
export function isDenseMatrix(x: unknown): x is DenseMatrix {
  return hasOwnAndPrototypeFlag(x, 'isDenseMatrix', 'isMatrix');
}

/**
 * Test whether a value is a SparseMatrix.
 *
 * @param x - The value to test.
 * @returns True when `x` has `isSparseMatrix === true` and its constructor prototype has `isMatrix === true`.
 */
export function isSparseMatrix(x: unknown): x is SparseMatrix {
  return hasOwnAndPrototypeFlag(x, 'isSparseMatrix', 'isMatrix');
}

/**
 * Test whether a value is a Range.
 *
 * @param x - The value to test.
 * @returns True when the constructor prototype of `x` has `isRange === true`.
 */
export function isRange(x: unknown): x is Range {
  return hasPrototypeFlag(x, 'isRange');
}

/**
 * Test whether a value is an Index.
 *
 * @param x - The value to test.
 * @returns True when the constructor prototype of `x` has `isIndex === true`.
 */
export function isIndex(x: unknown): x is Index {
  return hasPrototypeFlag(x, 'isIndex');
}

/**
 * Test whether a value is a primitive boolean.
 *
 * @param x - The value to test.
 * @returns True when `typeof x` is `'boolean'`.
 */
export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

/**
 * Test whether a value is a function.
 *
 * @param x - The value to test.
 * @returns True when `typeof x` is `'function'`.
 */
export function isFunction(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

/**
 * Test whether a value is a Date.
 *
 * @param x - The value to test.
 * @returns True when `x` is an `instanceof Date`.
 */
export function isDate(x: unknown): x is Date {
  return x instanceof Date;
}

/**
 * Test whether a value is a regular expression.
 *
 * @param x - The value to test.
 * @returns True when `x` is an `instanceof RegExp`.
 */
export function isRegExp(x: unknown): x is RegExp {
  return x instanceof RegExp;
}

/**
 * Test whether a value is a plain object.
 *
 * @param x - The value to test.
 * @returns True when the constructor of `x` is `Object` and `x` is not a Complex or a Fraction.
 */
export function isObject(x: unknown): x is Record<string, unknown> {
  return !!(
    x &&
    typeof x === 'object' &&
    (x as { constructor?: unknown }).constructor === Object &&
    !isComplex(x) &&
    !isFraction(x)
  );
}

/**
 * Returns `true` if the passed object appears to be a Map (i.e. duck typing).
 *
 * Methods looked for are `get`, `set`, `keys` and `has`.
 *
 * @param object
 * @returns
 */
export function isMap(object: unknown): object is Map<unknown, unknown> {
  // We can use the fast instanceof, or a slower duck typing check.
  // The duck typing method needs to cover enough methods to not be confused with DenseMatrix.
  if (!object) {
    return false;
  }
  const o = object as Record<string, unknown>;
  return (
    object instanceof Map ||
    (typeof o.set === 'function' &&
      typeof o.get === 'function' &&
      typeof o.keys === 'function' &&
      typeof o.has === 'function')
  );
}

/**
 * Test whether a value is null.
 *
 * @param x - The value to test.
 * @returns True when `x === null`.
 */
export function isNull(x: unknown): x is null {
  return x === null;
}

/**
 * Test whether a value is undefined.
 *
 * @param x - The value to test.
 * @returns True when `x === undefined`.
 */
export function isUndefined(x: unknown): x is undefined {
  return x === undefined;
}

/**
 * Get the type name of a value.
 *
 * For an object, the result is `'null'`, `'BigNumber'`, `'Complex'`, `'Fraction'`,
 * the constructor name, or `'Object'`, in that order of test.
 * For other values, the result is the `typeof` string.
 *
 * @param x - The value to examine.
 * @returns The type name.
 */
export function typeOf(x: unknown): string {
  const t = typeof x;

  if (t === 'object') {
    if (x === null) return 'null';
    if (isBigNumber(x)) return 'BigNumber'; // Special: weird mashup with Decimal
    // Canonical names for core's own numeric types — a bundler may mangle the class
    // name (e.g. `Fraction` → `_Fraction`), so `constructor.name` is unreliable for
    // these. The Unit's value-type dispatch (`valueType`/`_getNumberConverter`) keys
    // on exactly these strings, so returning the mangled name silently breaks it.
    if (isComplex(x)) return 'Complex';
    if (isFraction(x)) return 'Fraction';
    const ctor = (x as { constructor?: { name?: string } }).constructor;
    if (ctor && ctor.name) return ctor.name;

    return 'Object'; // just in case
  }

  return t; // can be 'string', 'number', 'boolean', 'function', 'bigint', ...
}
