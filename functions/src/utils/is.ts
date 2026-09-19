// PERF: keep these type guards DEFINED LOCALLY — do NOT consolidate them into a
// re-export shim from `@danielsimonjr/mathts-core`. They are called in hot numerical
// loops (e.g. the studentized-range / Tukey Simpson integration), where V8 inlines
// local guards but will NOT inline them across a module boundary. A cross-module
// re-export measured ~40% slower on that path (tipped gap-tukey past its timeout).
// Cold utilities (number/object) live in core/internal; hot-path guards stay here.
// Enforced by `tests/is-guards-local.test.ts`.
//
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
/** Structural type of a BigNumber (`decimal.js`) value, as the type guards test it. */
export interface BigNumber {
  isBigNumber: boolean;
  constructor: {
    prototype: { isBigNumber: boolean };
    isDecimal?: (x: unknown) => boolean;
  };
}

/** Structural type of a complex number with real part `re` and imaginary part `im`. */
export interface Complex {
  re: number;
  im: number;
}

/** Structural type of a fraction with numerator `n` and denominator `d`. */
export interface Fraction {
  n: number;
  d: number;
}

/** Structural type of a Unit value, identified by the `isUnit` prototype flag. */
export interface Unit {
  constructor: {
    prototype: { isUnit: boolean };
  };
}

/** Structural type of a Matrix value, identified by the `isMatrix` prototype flag. */
export interface Matrix {
  isMatrix?: boolean;
  _size?: number[];
  constructor: {
    prototype: { isMatrix: boolean };
  };
}

/** Structural type of a DenseMatrix: a Matrix with the `isDenseMatrix` flag. */
export interface DenseMatrix extends Matrix {
  isDenseMatrix: boolean;
}

/** Structural type of a SparseMatrix: a Matrix with the `isSparseMatrix` flag. */
export interface SparseMatrix extends Matrix {
  isSparseMatrix: boolean;
}

/** Structural type of a Range with `start`, `end` and `step`. */
export interface Range {
  start: number;
  end: number;
  step: number;
  constructor: {
    prototype: { isRange: boolean };
  };
}

/** Structural type of one dimension of an Index: a Range or a set of values. */
export interface IndexDimension {
  _data?: unknown[];
  _size: number[];
  isRange?: boolean;
  start?: number;
  end?: number;
}

/** Structural type of an Index, which holds one entry for each dimension. */
export interface Index {
  _dimensions: (IndexDimension | string)[];
  _sourceSize?: (number | null)[];
  constructor: {
    prototype: { isIndex: boolean };
  };
}

/** Structural type of a ResultSet, which holds the results of an evaluation in `entries`. */
export interface ResultSet<T = unknown> {
  entries: T[];
  constructor: {
    prototype: { isResultSet: boolean };
  };
}

/** Structural type of a Help object, identified by the `isHelp` prototype flag. */
export interface Help {
  constructor: {
    prototype: { isHelp: boolean };
  };
}

/** Structural type of a Chain object, identified by the `isChain` prototype flag. */
export interface Chain {
  constructor: {
    prototype: { isChain: boolean };
  };
}

// AST Node types
/** Structural type of an expression-tree node, identified by the `isNode` flag. */
export interface Node {
  isNode: boolean;
  constructor: {
    prototype: { isNode: boolean };
  };
}

/** Structural type of an expression-tree node with the `isAccessorNode` flag. */
export interface AccessorNode extends Node {
  isAccessorNode: boolean;
}

/** Structural type of an expression-tree node with the `isArrayNode` flag. */
export interface ArrayNode extends Node {
  isArrayNode: boolean;
}

/** Structural type of an expression-tree node with the `isAssignmentNode` flag. */
export interface AssignmentNode extends Node {
  isAssignmentNode: boolean;
}

/** Structural type of an expression-tree node with the `isBlockNode` flag. */
export interface BlockNode extends Node {
  isBlockNode: boolean;
}

/** Structural type of an expression-tree node with the `isConditionalNode` flag. */
export interface ConditionalNode extends Node {
  isConditionalNode: boolean;
}

/** Structural type of an expression-tree node with the `isConstantNode` flag. */
export interface ConstantNode extends Node {
  isConstantNode: boolean;
}

/** Structural type of an expression-tree node with the `isFunctionAssignmentNode` flag. */
export interface FunctionAssignmentNode extends Node {
  isFunctionAssignmentNode: boolean;
}

/** Structural type of an expression-tree node with the `isFunctionNode` flag. */
export interface FunctionNode extends Node {
  isFunctionNode: boolean;
}

/** Structural type of an expression-tree node with the `isIndexNode` flag. */
export interface IndexNode extends Node {
  isIndexNode: boolean;
}

/** Structural type of an expression-tree node with the `isObjectNode` flag. */
export interface ObjectNode extends Node {
  isObjectNode: boolean;
}

/** Structural type of an expression-tree node with the `isOperatorNode` flag. It also has the operator `op` and the arguments `args`. */
export interface OperatorNode extends Node {
  isOperatorNode: boolean;
  op: string;
  args: Node[];
}

/** Structural type of an expression-tree node with the `isParenthesisNode` flag. */
export interface ParenthesisNode extends Node {
  isParenthesisNode: boolean;
}

/** Structural type of an expression-tree node with the `isRangeNode` flag. */
export interface RangeNode extends Node {
  isRangeNode: boolean;
}

/** Structural type of an expression-tree node with the `isRelationalNode` flag. */
export interface RelationalNode extends Node {
  isRelationalNode: boolean;
}

/** Structural type of an expression-tree node with the `isSymbolNode` flag. */
export interface SymbolNode extends Node {
  isSymbolNode: boolean;
}

// Map types
/** Structural type of a map that holds its entries in two maps, `a` and `b`. */
export interface PartitionedMap<K = unknown, V = unknown> {
  a: Map<K, V>;
  b: Map<K, V>;
}

// Type guard functions
/** Return true if `x` is a primitive number. */
export function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}

/**
 * Return true if `x` is a BigNumber.
 *
 * The test is by duck typing: `x` and its constructor prototype both have `isBigNumber`
 * set to true, or the constructor function `isDecimal` accepts `x`.
 */
export function isBigNumber(x: unknown): x is BigNumber {
  if (
    !x ||
    typeof x !== 'object' ||
    typeof (x as { constructor?: unknown }).constructor !== 'function'
  ) {
    return false;
  }

  const obj = x as {
    isBigNumber?: boolean;
    constructor: {
      prototype?: { isBigNumber?: boolean };
      isDecimal?: (v: unknown) => boolean;
    };
  };

  if (
    obj.isBigNumber === true &&
    typeof obj.constructor.prototype === 'object' &&
    obj.constructor.prototype?.isBigNumber === true
  ) {
    return true;
  }

  if (typeof obj.constructor.isDecimal === 'function' && obj.constructor.isDecimal(obj) === true) {
    return true;
  }

  return false;
}

/** Return true if `x` is a primitive bigint. */
export function isBigInt(x: unknown): x is bigint {
  return typeof x === 'bigint';
}

/** Return true if `x` is an object whose prototype has `isComplex` set to true. */
export function isComplex(x: unknown): x is Complex {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isComplex === true);
}

/** Return true if `x` is an object whose prototype has `isFraction` set to true. */
export function isFraction(x: unknown): x is Fraction {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isFraction === true);
}

/** Return true if `x` is an object whose constructor prototype has `isUnit` set to true. */
export function isUnit(x: unknown): x is Unit {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isUnit?: boolean } } };
  return obj.constructor?.prototype?.isUnit === true;
}

/** Return true if `x` is a primitive string. */
export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

/** Return true if the value is an Array. This function is `Array.isArray`. */
export const isArray = Array.isArray;

/** Return true if `x` is an object whose constructor prototype has `isMatrix` set to true. */
export function isMatrix(x: unknown): x is Matrix {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isMatrix?: boolean } } };
  return obj.constructor?.prototype?.isMatrix === true;
}

/**
 * Test whether a value is a collection: an Array or Matrix
 * @param {*} x
 * @returns {boolean} isCollection
 */
export function isCollection(x: unknown): x is unknown[] | Matrix {
  return Array.isArray(x) || isMatrix(x);
}

/**
 * Return true if `x` has `isDenseMatrix` set to true and its constructor prototype has
 * `isMatrix` set to true.
 */
export function isDenseMatrix(x: unknown): x is DenseMatrix {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isDenseMatrix?: boolean;
    constructor?: { prototype?: { isMatrix?: boolean } };
  };
  return obj.isDenseMatrix === true && obj.constructor?.prototype?.isMatrix === true;
}

/**
 * Return true if `x` has `isSparseMatrix` set to true and its constructor prototype has
 * `isMatrix` set to true.
 */
export function isSparseMatrix(x: unknown): x is SparseMatrix {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isSparseMatrix?: boolean;
    constructor?: { prototype?: { isMatrix?: boolean } };
  };
  return obj.isSparseMatrix === true && obj.constructor?.prototype?.isMatrix === true;
}

/** Return true if `x` is an object whose constructor prototype has `isRange` set to true. */
export function isRange(x: unknown): x is Range {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isRange?: boolean } } };
  return obj.constructor?.prototype?.isRange === true;
}

/** Return true if `x` is an object whose constructor prototype has `isIndex` set to true. */
export function isIndex(x: unknown): x is Index {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isIndex?: boolean } } };
  return obj.constructor?.prototype?.isIndex === true;
}

/** Return true if `x` is a primitive boolean. */
export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

/** Return true if `x` is an object whose constructor prototype has `isResultSet` set to true. */
export function isResultSet(x: unknown): x is ResultSet {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isResultSet?: boolean } } };
  return obj.constructor?.prototype?.isResultSet === true;
}

/** Return true if `x` is an object whose constructor prototype has `isHelp` set to true. */
export function isHelp(x: unknown): x is Help {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isHelp?: boolean } } };
  return obj.constructor?.prototype?.isHelp === true;
}

/** Return true if `x` is a function. */
export function isFunction(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

/** Return true if `x` is a `Date` instance (`instanceof` test). */
export function isDate(x: unknown): x is Date {
  return x instanceof Date;
}

/** Return true if `x` is a `RegExp` instance (`instanceof` test). */
export function isRegExp(x: unknown): x is RegExp {
  return x instanceof RegExp;
}

/**
 * Return true if `x` is a plain object.
 *
 * The constructor of `x` must be `Object`, and `x` must not be a Complex or a Fraction.
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
 * @param {Map | object} object
 * @returns
 */
export function isMap(object: unknown): object is Map<unknown, unknown> {
  // We can use the fast instanceof, or a slower duck typing check.
  // The duck typing method needs to cover enough methods to not be confused with DenseMatrix.
  if (!object) {
    return false;
  }
  if (object instanceof Map) {
    return true;
  }
  // Duck typing check for Map-like objects
  const mapLike = object as {
    set?: unknown;
    get?: unknown;
    keys?: unknown;
    has?: unknown;
  };
  return (
    typeof mapLike.set === 'function' &&
    typeof mapLike.get === 'function' &&
    typeof mapLike.keys === 'function' &&
    typeof mapLike.has === 'function'
  );
}

/**
 * Return true if `object` is a map-like object whose `a` and `b` properties are also
 * map-like objects (see `isMap`).
 */
export function isPartitionedMap(object: unknown): object is PartitionedMap {
  if (!isMap(object)) return false;
  const partitioned = object as { a?: unknown; b?: unknown };
  return isMap(partitioned.a) && isMap(partitioned.b);
}

/** Return true if `x` is `null`. */
export function isNull(x: unknown): x is null {
  return x === null;
}

/** Return true if `x` is `undefined`. */
export function isUndefined(x: unknown): x is undefined {
  return x === undefined;
}

/**
 * Return true if `x` has `isAccessorNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isAccessorNode(x: unknown): x is AccessorNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isAccessorNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isAccessorNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isArrayNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isArrayNode(x: unknown): x is ArrayNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isArrayNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isArrayNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isAssignmentNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isAssignmentNode(x: unknown): x is AssignmentNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isAssignmentNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isAssignmentNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isBlockNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isBlockNode(x: unknown): x is BlockNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isBlockNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isBlockNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isConditionalNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isConditionalNode(x: unknown): x is ConditionalNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isConditionalNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isConditionalNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isConstantNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isConstantNode(x: unknown): x is ConstantNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isConstantNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isConstantNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isFunctionAssignmentNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isFunctionAssignmentNode(x: unknown): x is FunctionAssignmentNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isFunctionAssignmentNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isFunctionAssignmentNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isFunctionNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isFunctionNode(x: unknown): x is FunctionNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isFunctionNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isFunctionNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isIndexNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isIndexNode(x: unknown): x is IndexNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isIndexNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isIndexNode === true && obj.constructor?.prototype?.isNode === true;
}

/** Return true if `x` and its constructor prototype both have `isNode` set to true. */
export function isNode(x: unknown): x is Node {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isObjectNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isObjectNode(x: unknown): x is ObjectNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isObjectNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isObjectNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isOperatorNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isOperatorNode(x: unknown): x is OperatorNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isOperatorNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isOperatorNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isParenthesisNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isParenthesisNode(x: unknown): x is ParenthesisNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isParenthesisNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isParenthesisNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isRangeNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isRangeNode(x: unknown): x is RangeNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isRangeNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isRangeNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isRelationalNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isRelationalNode(x: unknown): x is RelationalNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isRelationalNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isRelationalNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return true if `x` has `isSymbolNode` set to true and its constructor prototype has
 * `isNode` set to true.
 */
export function isSymbolNode(x: unknown): x is SymbolNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isSymbolNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isSymbolNode === true && obj.constructor?.prototype?.isNode === true;
}

/** Return true if `x` is an object whose constructor prototype has `isChain` set to true. */
export function isChain(x: unknown): x is Chain {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isChain?: boolean } } };
  return obj.constructor?.prototype?.isChain === true;
}

/**
 * Return the type name of `x`.
 *
 * For `null` the name is `'null'`, and for a BigNumber it is `'BigNumber'`. For another
 * object it is the constructor name, or `'Object'` if the constructor has no name. For a
 * primitive it is the `typeof` result, for example `'number'`.
 */
export function typeOf(x: unknown): string {
  const t = typeof x;

  if (t === 'object') {
    if (x === null) return 'null';
    if (isBigNumber(x)) return 'BigNumber'; // Special: weird mashup with Decimal
    const obj = x as { constructor?: { name?: string } };
    if (obj.constructor && obj.constructor.name) return obj.constructor.name;

    return 'Object'; // just in case
  }

  return t; // can be 'string', 'number', 'boolean', 'function', 'bigint', ...
}
