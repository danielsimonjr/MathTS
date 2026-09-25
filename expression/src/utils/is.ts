// PERF: keep these type guards DEFINED LOCALLY — do NOT consolidate them into a
// re-export shim from `@danielsimonjr/mathts-core`. They are called in hot loops
// (parser/compiler AST walks), where V8 inlines local guards but will NOT inline them
// across a module boundary. A cross-module re-export measured ~40% slower on the
// functions studentized-range path (tipped gap-tukey past its timeout); the same
// inlining cost applies here. Cold utilities (number/object) live in core/internal;
// hot-path guards stay local. Enforced by `tests/is-guards-local.test.ts`.
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
/**
 * The minimum shape of a BigNumber that `isBigNumber` tests.
 */
export interface BigNumber {
  isBigNumber: boolean;
  constructor: {
    prototype: { isBigNumber: boolean };
    isDecimal?: (x: unknown) => boolean;
  };
}

/**
 * The minimum shape of a Complex number: the real part `re` and the imaginary part `im`.
 */
export interface Complex {
  re: number;
  im: number;
}

/**
 * The minimum shape of a Fraction: the numerator `n` and the denominator `d`.
 */
export interface Fraction {
  n: number;
  d: number;
}

/**
 * The minimum shape of a Unit that `isUnit` tests. The constructor prototype carries the `isUnit` flag.
 */
export interface Unit {
  constructor: {
    prototype: { isUnit: boolean };
  };
}

/**
 * The minimum shape of a Matrix that `isMatrix` tests. The constructor prototype carries the `isMatrix` flag.
 */
export interface Matrix {
  isMatrix?: boolean;
  _size?: number[];
  constructor: {
    prototype: { isMatrix: boolean };
  };
}

/**
 * The minimum shape of a DenseMatrix: a Matrix with the `isDenseMatrix` flag.
 */
export interface DenseMatrix extends Matrix {
  isDenseMatrix: boolean;
}

/**
 * The minimum shape of a SparseMatrix: a Matrix with the `isSparseMatrix` flag.
 */
export interface SparseMatrix extends Matrix {
  isSparseMatrix: boolean;
}

/**
 * The minimum shape of a Range that `isRange` tests. The constructor prototype carries the `isRange` flag.
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
 * The minimum shape of one dimension of an Index.
 */
export interface IndexDimension {
  _data?: unknown[];
  _size: number[];
  isRange?: boolean;
  start?: number;
  end?: number;
}

/**
 * The minimum shape of a Index that `isIndex` tests. The constructor prototype carries the `isIndex` flag.
 */
export interface Index {
  _dimensions: (IndexDimension | string)[];
  _sourceSize?: (number | null)[];
  constructor: {
    prototype: { isIndex: boolean };
  };
}

/**
 * The minimum shape of a ResultSet that `isResultSet` tests. The constructor prototype carries the `isResultSet` flag.
 */
export interface ResultSet<T = unknown> {
  entries: T[];
  constructor: {
    prototype: { isResultSet: boolean };
  };
}

/**
 * The minimum shape of a Help that `isHelp` tests. The constructor prototype carries the `isHelp` flag.
 */
export interface Help {
  constructor: {
    prototype: { isHelp: boolean };
  };
}

/**
 * The minimum shape of a Chain that `isChain` tests. The constructor prototype carries the `isChain` flag.
 */
export interface Chain {
  constructor: {
    prototype: { isChain: boolean };
  };
}

// AST Node types
/**
 * The minimum shape of an expression node. The constructor prototype carries the `isNode` flag.
 */
export interface Node {
  isNode: boolean;
  constructor: {
    prototype: { isNode: boolean };
  };
}

/**
 * The minimum shape of a AccessorNode: a Node with the `isAccessorNode` flag.
 */
export interface AccessorNode extends Node {
  isAccessorNode: boolean;
}

/**
 * The minimum shape of a ArrayNode: a Node with the `isArrayNode` flag.
 */
export interface ArrayNode extends Node {
  isArrayNode: boolean;
}

/**
 * The minimum shape of a AssignmentNode: a Node with the `isAssignmentNode` flag.
 */
export interface AssignmentNode extends Node {
  isAssignmentNode: boolean;
}

/**
 * The minimum shape of a BlockNode: a Node with the `isBlockNode` flag.
 */
export interface BlockNode extends Node {
  isBlockNode: boolean;
}

/**
 * The minimum shape of a ConditionalNode: a Node with the `isConditionalNode` flag.
 */
export interface ConditionalNode extends Node {
  isConditionalNode: boolean;
}

/**
 * The minimum shape of a ConstantNode: a Node with the `isConstantNode` flag.
 */
export interface ConstantNode extends Node {
  isConstantNode: boolean;
  value: unknown;
}

/**
 * The minimum shape of a FunctionAssignmentNode: a Node with the `isFunctionAssignmentNode` flag.
 */
export interface FunctionAssignmentNode extends Node {
  isFunctionAssignmentNode: boolean;
}

/**
 * The minimum shape of a FunctionNode: a Node with the `isFunctionNode` flag.
 */
export interface FunctionNode extends Node {
  isFunctionNode: boolean;
}

/**
 * The minimum shape of a IndexNode: a Node with the `isIndexNode` flag.
 */
export interface IndexNode extends Node {
  isIndexNode: boolean;
}

/**
 * The minimum shape of a ObjectNode: a Node with the `isObjectNode` flag.
 */
export interface ObjectNode extends Node {
  isObjectNode: boolean;
}

/**
 * The minimum shape of an OperatorNode: a Node with the `isOperatorNode` flag, the operator `op` and the arguments `args`.
 */
export interface OperatorNode extends Node {
  isOperatorNode: boolean;
  op: string;
  args: Node[];
}

/**
 * The minimum shape of a ParenthesisNode: a Node with the `isParenthesisNode` flag.
 */
export interface ParenthesisNode extends Node {
  isParenthesisNode: boolean;
}

/**
 * The minimum shape of a RangeNode: a Node with the `isRangeNode` flag.
 */
export interface RangeNode extends Node {
  isRangeNode: boolean;
}

/**
 * The minimum shape of a RelationalNode: a Node with the `isRelationalNode` flag.
 */
export interface RelationalNode extends Node {
  isRelationalNode: boolean;
}

/**
 * The minimum shape of a SymbolNode: a Node with the `isSymbolNode` flag.
 */
export interface SymbolNode extends Node {
  isSymbolNode: boolean;
  name: string;
}

// Map types
/**
 * The minimum shape of a PartitionedMap: two maps, `a` and `b`.
 */
export interface PartitionedMap<K = unknown, V = unknown> {
  a: Map<K, V>;
  b: Map<K, V>;
}

// Type guard functions
/**
 * Return `true` if `typeof x` is `'number'`.
 * @param x - The value to test.
 */
export function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}

/**
 * Return `true` if the value is a BigNumber.
 * The test accepts an object with `isBigNumber === true` whose constructor prototype also has `isBigNumber === true`.
 * It also accepts an object for which `constructor.isDecimal` returns `true`.
 * @param x - The value to test.
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

/**
 * Return `true` if `typeof x` is `'bigint'`.
 * @param x - The value to test.
 */
export function isBigInt(x: unknown): x is bigint {
  return typeof x === 'bigint';
}

/**
 * Return `true` if the value is an object whose prototype has `isComplex === true`.
 * @param x - The value to test.
 */
export function isComplex(x: unknown): x is Complex {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isComplex === true);
}

/**
 * Return `true` if the value is an object whose prototype has `isFraction === true`.
 * @param x - The value to test.
 */
export function isFraction(x: unknown): x is Fraction {
  return !!(x && typeof x === 'object' && Object.getPrototypeOf(x).isFraction === true);
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isUnit === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isUnit(x: unknown): x is Unit {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isUnit?: boolean } } };
  return obj.constructor?.prototype?.isUnit === true;
}

/**
 * Return `true` if `typeof x` is `'string'`.
 * @param x - The value to test.
 */
export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export const isArray = Array.isArray;

/**
 * Return `true` if the value is an object whose constructor prototype has `isMatrix === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isMatrix(x: unknown): x is Matrix {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isMatrix?: boolean } } };
  return obj.constructor?.prototype?.isMatrix === true;
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
 * Return `true` if the value has `isDenseMatrix === true` and its constructor prototype has `isMatrix === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isSparseMatrix === true` and its constructor prototype has `isMatrix === true`.
 * @param x - The value to test.
 */
export function isSparseMatrix(x: unknown): x is SparseMatrix {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isSparseMatrix?: boolean;
    constructor?: { prototype?: { isMatrix?: boolean } };
  };
  return obj.isSparseMatrix === true && obj.constructor?.prototype?.isMatrix === true;
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isRange === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isRange(x: unknown): x is Range {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isRange?: boolean } } };
  return obj.constructor?.prototype?.isRange === true;
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isIndex === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isIndex(x: unknown): x is Index {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isIndex?: boolean } } };
  return obj.constructor?.prototype?.isIndex === true;
}

/**
 * Return `true` if `typeof x` is `'boolean'`.
 * @param x - The value to test.
 */
export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isResultSet === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isResultSet(x: unknown): x is ResultSet {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isResultSet?: boolean } } };
  return obj.constructor?.prototype?.isResultSet === true;
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isHelp === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isHelp(x: unknown): x is Help {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isHelp?: boolean } } };
  return obj.constructor?.prototype?.isHelp === true;
}

/**
 * Return `true` if `typeof x` is `'function'`.
 * @param x - The value to test.
 */
export function isFunction(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

/**
 * Return `true` if the value is an instance of `Date`.
 * @param x - The value to test.
 */
export function isDate(x: unknown): x is Date {
  return x instanceof Date;
}

/**
 * Return `true` if the value is an instance of `RegExp`.
 * @param x - The value to test.
 */
export function isRegExp(x: unknown): x is RegExp {
  return x instanceof RegExp;
}

/**
 * Return `true` if the value is a plain object.
 * The constructor must be `Object`, and the value must not be a Complex or a Fraction.
 * @param x - The value to test.
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
 * Return `true` if the value is Map-like and its `a` and `b` properties are Map-like.
 * The `isMap` function defines Map-like.
 * @param object - The value to test.
 */
export function isPartitionedMap(object: unknown): object is PartitionedMap {
  if (!isMap(object)) return false;
  const partitioned = object as { a?: unknown; b?: unknown };
  return isMap(partitioned.a) && isMap(partitioned.b);
}

/**
 * Return `true` if the value is `null`.
 * @param x - The value to test.
 */
export function isNull(x: unknown): x is null {
  return x === null;
}

/**
 * Return `true` if the value is `undefined`.
 * @param x - The value to test.
 */
export function isUndefined(x: unknown): x is undefined {
  return x === undefined;
}

/**
 * Return `true` if the value has `isAccessorNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isArrayNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isAssignmentNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isBlockNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isConditionalNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isConstantNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
 */
export function isConstantNode(x: unknown): x is ConstantNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isConstantNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isConstantNode === true && obj.constructor?.prototype?.isNode === true;
}

/* Very specialized: returns true for those nodes which in the numerator of
   a fraction means that the division in that fraction has precedence over implicit
   multiplication, e.g. -2/3 x parses as (-2/3) x and 3/4 x parses as (3/4) x but
   6!/8 x parses as 6! / (8x). It is located here because it is shared between
   parse.js and OperatorNode.js (for parsing and printing, respectively).

   This should *not* be exported from mathjs, unlike most of the tests here.
   Its name does not start with 'is' to prevent utils/snapshot.js from thinking
   it should be exported.
*/
/**
 * Return `true` if the node is a ConstantNode, or a one-argument OperatorNode with a ConstantNode argument.
 * For the OperatorNode, the string `'-+~'` must contain the operator.
 * The parser and the precedence helpers in `operators.ts` use this test to give the division in a numerator like `-2/3 x` precedence over implicit multiplication.
 * @param node - The node to test.
 */
export function rule2Node(node: unknown): boolean {
  return (
    isConstantNode(node) ||
    (isOperatorNode(node) &&
      node.args.length === 1 &&
      isConstantNode(node.args[0]) &&
      '-+~'.includes(node.op))
  );
}

/**
 * Return `true` if the value has `isFunctionAssignmentNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isFunctionNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isIndexNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
 */
export function isIndexNode(x: unknown): x is IndexNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isIndexNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isIndexNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return `true` if the value has `isNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
 */
export function isNode(x: unknown): x is Node {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return `true` if the value has `isObjectNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isOperatorNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isParenthesisNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isRangeNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isRelationalNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
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
 * Return `true` if the value has `isSymbolNode === true` and its constructor prototype has `isNode === true`.
 * @param x - The value to test.
 */
export function isSymbolNode(x: unknown): x is SymbolNode {
  if (!x || typeof x !== 'object') return false;
  const obj = x as {
    isSymbolNode?: boolean;
    constructor?: { prototype?: { isNode?: boolean } };
  };
  return obj.isSymbolNode === true && obj.constructor?.prototype?.isNode === true;
}

/**
 * Return `true` if the value is an object whose constructor prototype has `isChain === true`.
 * The test uses duck typing, not `instanceof`.
 * @param x - The value to test.
 */
export function isChain(x: unknown): x is Chain {
  if (!x || typeof x !== 'object') return false;
  const obj = x as { constructor?: { prototype?: { isChain?: boolean } } };
  return obj.constructor?.prototype?.isChain === true;
}

/**
 * Return the type name of a value.
 * For `null`, the result is `'null'`. For a BigNumber, the result is `'BigNumber'`.
 * For another object, the result is the constructor name, or `'Object'` if there is no name.
 * For other values, the result is `typeof x`.
 * @param x - The value to test.
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
