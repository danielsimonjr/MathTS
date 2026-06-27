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
export interface BigNumber {
  isBigNumber: boolean;
  constructor: {
    prototype: { isBigNumber: boolean };
    isDecimal?: (x: unknown) => boolean;
  };
}

export interface Complex {
  re: number;
  im: number;
}

export interface Fraction {
  n: number;
  d: number;
}

export interface Unit {
  constructor: {
    prototype: { isUnit: boolean };
  };
}

export interface Matrix {
  isMatrix?: boolean;
  _size?: number[];
  constructor: {
    prototype: { isMatrix: boolean };
  };
}

export interface DenseMatrix extends Matrix {
  isDenseMatrix: boolean;
}

export interface SparseMatrix extends Matrix {
  isSparseMatrix: boolean;
}

export interface Range {
  start: number;
  end: number;
  step: number;
  constructor: {
    prototype: { isRange: boolean };
  };
}

export interface Index {
  _dimensions: unknown[];
  _sourceSize?: (number | null)[];
  constructor: {
    prototype: { isIndex: boolean };
  };
}

export interface ResultSet {
  entries: unknown[];
  constructor: {
    prototype: { isResultSet: boolean };
  };
}

export interface Help {
  constructor: {
    prototype: { isHelp: boolean };
  };
}

export interface Chain {
  constructor: {
    prototype: { isChain: boolean };
  };
}

// AST Node types
export interface Node {
  isNode: boolean;
  constructor: {
    prototype: { isNode: boolean };
  };
}

export interface AccessorNode extends Node {
  isAccessorNode: boolean;
}

export interface ArrayNode extends Node {
  isArrayNode: boolean;
}

export interface AssignmentNode extends Node {
  isAssignmentNode: boolean;
}

export interface BlockNode extends Node {
  isBlockNode: boolean;
}

export interface ConditionalNode extends Node {
  isConditionalNode: boolean;
}

export interface ConstantNode extends Node {
  isConstantNode: boolean;
}

export interface FunctionAssignmentNode extends Node {
  isFunctionAssignmentNode: boolean;
}

export interface FunctionNode extends Node {
  isFunctionNode: boolean;
}

export interface IndexNode extends Node {
  isIndexNode: boolean;
}

export interface ObjectNode extends Node {
  isObjectNode: boolean;
}

export interface OperatorNode extends Node {
  isOperatorNode: boolean;
  op: string;
  args: Node[];
}

export interface ParenthesisNode extends Node {
  isParenthesisNode: boolean;
}

export interface RangeNode extends Node {
  isRangeNode: boolean;
}

export interface RelationalNode extends Node {
  isRelationalNode: boolean;
}

export interface SymbolNode extends Node {
  isSymbolNode: boolean;
}

// Map types
export interface PartitionedMap {
  a: Map<unknown, unknown>;
  b: Map<unknown, unknown>;
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

export function isNumber(x: unknown): x is number {
  return typeof x === 'number';
}

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

export function isBigInt(x: unknown): x is bigint {
  return typeof x === 'bigint';
}

export function isComplex(x: unknown): x is Complex {
  return (x && typeof x === 'object' && Object.getPrototypeOf(x).isComplex === true) || false;
}

export function isFraction(x: unknown): x is Fraction {
  return (x && typeof x === 'object' && Object.getPrototypeOf(x).isFraction === true) || false;
}

export function isUnit(x: unknown): x is Unit {
  return hasPrototypeFlag(x, 'isUnit');
}

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export const isArray = Array.isArray;

export function isMatrix(x: unknown): x is Matrix {
  return hasPrototypeFlag(x, 'isMatrix');
}

/**
 * Test whether a value is a collection: an Array or Matrix
 * @param {*} x
 * @returns {boolean} isCollection
 */
export function isCollection(x: unknown): x is unknown[] | Matrix {
  return Array.isArray(x) || isMatrix(x);
}

export function isDenseMatrix(x: unknown): x is DenseMatrix {
  return hasOwnAndPrototypeFlag(x, 'isDenseMatrix', 'isMatrix');
}

export function isSparseMatrix(x: unknown): x is SparseMatrix {
  return hasOwnAndPrototypeFlag(x, 'isSparseMatrix', 'isMatrix');
}

export function isRange(x: unknown): x is Range {
  return hasPrototypeFlag(x, 'isRange');
}

export function isIndex(x: unknown): x is Index {
  return hasPrototypeFlag(x, 'isIndex');
}

export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

export function isResultSet(x: unknown): x is ResultSet {
  return hasPrototypeFlag(x, 'isResultSet');
}

export function isHelp(x: unknown): x is Help {
  return hasPrototypeFlag(x, 'isHelp');
}

export function isFunction(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

export function isDate(x: unknown): x is Date {
  return x instanceof Date;
}

export function isRegExp(x: unknown): x is RegExp {
  return x instanceof RegExp;
}

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
  const o = object as Record<string, unknown>;
  return (
    object instanceof Map ||
    (typeof o.set === 'function' &&
      typeof o.get === 'function' &&
      typeof o.keys === 'function' &&
      typeof o.has === 'function')
  );
}

export function isPartitionedMap(object: unknown): object is PartitionedMap {
  const pm = object as { a?: unknown; b?: unknown };
  return isMap(object) && isMap(pm.a) && isMap(pm.b);
}

export function isObjectWrappingMap(object: unknown): boolean {
  if (!isMap(object)) return false;
  const wrapper = object as { wrappedObject?: unknown; [Symbol.toStringTag]?: string };
  return wrapper[Symbol.toStringTag] === 'ObjectWrappingMap' && isObject(wrapper.wrappedObject);
}

export function isNull(x: unknown): x is null {
  return x === null;
}

export function isUndefined(x: unknown): x is undefined {
  return x === undefined;
}

export function isAccessorNode(x: unknown): x is AccessorNode {
  return hasOwnAndPrototypeFlag(x, 'isAccessorNode', 'isNode');
}

export function isArrayNode(x: unknown): x is ArrayNode {
  return hasOwnAndPrototypeFlag(x, 'isArrayNode', 'isNode');
}

export function isAssignmentNode(x: unknown): x is AssignmentNode {
  return hasOwnAndPrototypeFlag(x, 'isAssignmentNode', 'isNode');
}

export function isBlockNode(x: unknown): x is BlockNode {
  return hasOwnAndPrototypeFlag(x, 'isBlockNode', 'isNode');
}

export function isConditionalNode(x: unknown): x is ConditionalNode {
  return hasOwnAndPrototypeFlag(x, 'isConditionalNode', 'isNode');
}

export function isConstantNode(x: unknown): x is ConstantNode {
  return hasOwnAndPrototypeFlag(x, 'isConstantNode', 'isNode');
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
export function rule2Node(node: Node): boolean {
  return (
    isConstantNode(node) ||
    (isOperatorNode(node) &&
      node.args.length === 1 &&
      isConstantNode(node.args[0]) &&
      '-+~'.includes(node.op))
  );
}

export function isFunctionAssignmentNode(x: unknown): x is FunctionAssignmentNode {
  return hasOwnAndPrototypeFlag(x, 'isFunctionAssignmentNode', 'isNode');
}

export function isFunctionNode(x: unknown): x is FunctionNode {
  return hasOwnAndPrototypeFlag(x, 'isFunctionNode', 'isNode');
}

export function isIndexNode(x: unknown): x is IndexNode {
  return hasOwnAndPrototypeFlag(x, 'isIndexNode', 'isNode');
}

export function isNode(x: unknown): x is Node {
  return hasOwnAndPrototypeFlag(x, 'isNode', 'isNode');
}

export function isObjectNode(x: unknown): x is ObjectNode {
  return hasOwnAndPrototypeFlag(x, 'isObjectNode', 'isNode');
}

export function isOperatorNode(x: unknown): x is OperatorNode {
  return hasOwnAndPrototypeFlag(x, 'isOperatorNode', 'isNode');
}

export function isParenthesisNode(x: unknown): x is ParenthesisNode {
  return hasOwnAndPrototypeFlag(x, 'isParenthesisNode', 'isNode');
}

export function isRangeNode(x: unknown): x is RangeNode {
  return hasOwnAndPrototypeFlag(x, 'isRangeNode', 'isNode');
}

export function isRelationalNode(x: unknown): x is RelationalNode {
  return hasOwnAndPrototypeFlag(x, 'isRelationalNode', 'isNode');
}

export function isSymbolNode(x: unknown): x is SymbolNode {
  return hasOwnAndPrototypeFlag(x, 'isSymbolNode', 'isNode');
}

export function isChain(x: unknown): x is Chain {
  return hasPrototypeFlag(x, 'isChain');
}

export function typeOf(x: unknown): string {
  const t = typeof x;

  if (t === 'object') {
    if (x === null) return 'null';
    if (isBigNumber(x)) return 'BigNumber'; // Special: weird mashup with Decimal
    const ctor = (x as { constructor?: { name?: string } }).constructor;
    if (ctor && ctor.name) return ctor.name;

    return 'Object'; // just in case
  }

  return t; // can be 'string', 'number', 'boolean', 'function', 'bigint', ...
}
