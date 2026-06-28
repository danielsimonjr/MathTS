import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import type { MathNode, StringOptions } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createOperatorNode } from '../src/node/OperatorNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';
import { createAccessorNode } from '../src/node/AccessorNode.js';
import { createAssignmentNode } from '../src/node/AssignmentNode.js';
import { createConditionalNode } from '../src/node/ConditionalNode.js';

/**
 * Coverage-oriented tests that exercise the SOURCE node factories directly
 * (AssignmentNode, AccessorNode, IndexNode, ConditionalNode, ConstantNode and
 * the Node base class). They wire the factories with minimal but faithful mock
 * dependencies — mirroring the existing per-node test bootstrap — and drive the
 * rendering (toString/toTex/toHTML), compile paths, and structural helpers
 * across the branches the per-node unit tests left uncovered.
 *
 * Security invariant: property/method access is exercised through the real
 * getSafeProperty/setSafeProperty path; dangerous keys are asserted to throw,
 * never bypassed.
 */

/** Structural view of the mock Index object produced by the `index` factory. */
interface MockIndex {
  isIndex?: boolean;
  dimensions?: unknown[];
}

/** White-box view of the subtype fields read off base `MathNode` values here. */
interface NodeView {
  isSymbolNode?: boolean;
  name?: string;
}

// ── Shared bootstrap ─────────────────────────────────────────────────────────
const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  unaryMinus: (a: number) => -a,
  larger: (a: number, b: number) => a > b,
  smaller: (a: number, b: number) => a < b,
  pi: Math.PI,
  // a real `index` factory so IndexNode._compile produces something usable
  index: (...dims: unknown[]) => ({ isIndex: true, dimensions: dims }),
};

const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const OperatorNode = createOperatorNode({ Node });
const ConditionalNode = createConditionalNode({ Node });

const sizeFn = (value: unknown): number[] => {
  if (Array.isArray(value)) return [value.length];
  if (typeof value === 'string') return [value.length];
  return [];
};
const IndexNode = createIndexNode({ Node, size: sizeFn });

// subset/access for AccessorNode + AssignmentNode matrix paths.
const subset = (obj: unknown, idx: unknown, replacement?: unknown): unknown => {
  // idx is the mock Index object { isIndex, dimensions:[i] }
  const index = idx as MockIndex;
  const i = (index && index.dimensions ? index.dimensions[0] : idx) as PropertyKey;
  const target = obj as Record<PropertyKey, unknown>;
  if (replacement !== undefined) {
    target[i] = replacement;
    return target;
  }
  return target[i];
};
const AccessorNode = createAccessorNode({ subset, Node });
const AssignmentNode = createAssignmentNode({ subset, Node });

// ── Helpers ──────────────────────────────────────────────────────────────────
function c(v: unknown) {
  return new ConstantNode(v);
}
function s(name: string) {
  return new SymbolNode(name);
}
function op(o: string, fn: string, args: MathNode[]) {
  return new OperatorNode(o, fn, args);
}
/** An IndexNode that represents a matrix index like [2]. */
function matIndex(...vals: number[]) {
  return new IndexNode(vals.map((v) => c(v)));
}
/** An IndexNode that represents a bracket object property like ["b"]. */
function propIndex(propName: string) {
  return new IndexNode([c(propName)]);
}
/** An IndexNode that represents dot-notation object property like .b. */
function dotIndex(propName: string) {
  return new IndexNode([c(propName)], true);
}

// Mock numeric types that satisfy the duck-typed is* guards in utils/is.
class MockBigNumber {
  isBigNumber = true;
  private v: number;
  constructor(v: number) {
    this.v = v;
  }
  isZero() {
    return this.v === 0;
  }
  valueOf() {
    return this.v;
  }
}
MockBigNumber.prototype.isBigNumber = true;

class MockComplex {
  re: number;
  im: number;
  constructor(re: number, im: number) {
    this.re = re;
    this.im = im;
  }
}
(MockComplex.prototype as MockComplex & { isComplex: boolean }).isComplex = true;

class MockUnit {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
}
(MockUnit.prototype as MockUnit & { isUnit: boolean }).isUnit = true;

// Minimal scope used by compiled nodes (a Map with has/get/set).
function scopeMap(init: Record<string, unknown> = {}) {
  return new Map<string, unknown>(Object.entries(init));
}

// ── AssignmentNode ────────────────────────────────────────────────────────────

describe('AssignmentNode — compile & evaluate', () => {
  it('simple symbol assignment a = 2 sets scope and returns the value', () => {
    const node = new AssignmentNode(s('a'), c(2));
    const fn = node._compile(mathScope, {});
    const scope = scopeMap();
    expect(fn(scope, {}, undefined)).toBe(2);
    expect(scope.get('a')).toBe(2);
  });

  it('object property assignment a.b = 5 (setSafeProperty)', () => {
    // object = SymbolNode a, index = object-property .b → the object-property
    // compile branch sets the property on the evaluated value of `a`.
    const obj = { b: 0 };
    const node = new AssignmentNode(s('a'), dotIndex('b'), c(5));
    const fn = node._compile(mathScope, {});
    expect(fn(scopeMap({ a: obj }), {}, undefined)).toBe(5);
    expect(obj.b).toBe(5);
  });

  it('matrix subset assignment a[2] = 9 (symbol object, matrix index)', () => {
    const node = new AssignmentNode(s('a'), matIndex(2), c(9));
    const fn = node._compile(mathScope, {});
    const arr = [0, 0, 0];
    const scope = scopeMap({ a: arr });
    expect(fn(scope, {}, undefined)).toBe(9);
    expect(arr[2]).toBe(9);
  });

  it('accessor-with-object-property parent: a.b[2] = 7', () => {
    // object = AccessorNode(a, .b); index = [2]
    const accessor = new AccessorNode(s('a'), dotIndex('b'));
    const node = new AssignmentNode(accessor, matIndex(2), c(7));
    const fn = node._compile(mathScope, {});
    const inner = [0, 0, 0];
    const scope = scopeMap({ a: { b: inner } });
    expect(fn(scope, {}, undefined)).toBe(7);
    expect(inner[2]).toBe(7);
  });

  it('accessor parent with non-object-property index: a[1][2] = 4', () => {
    // object = AccessorNode(a, [1]); index = [2]  → exercises evalParentIndex branch
    const accessor = new AccessorNode(s('a'), matIndex(1));
    const node = new AssignmentNode(accessor, matIndex(2), c(4));
    const fn = node._compile(mathScope, {});
    const inner = [0, 0, 0];
    const scope = scopeMap({ a: [inner, inner] });
    expect(fn(scope, {}, undefined)).toBe(4);
    expect(inner[2]).toBe(4);
  });

  it('security: assigning to "__proto__" via property assignment throws', () => {
    const node = new AssignmentNode(s('a'), dotIndex('__proto__'), c({ polluted: 1 }));
    const fn = node._compile(mathScope, {});
    const scope = scopeMap({ a: {} });
    expect(() => fn(scope, {}, undefined)).toThrow();
  });
});

describe('AssignmentNode — rendering', () => {
  it('toString of simple assignment', () => {
    expect(new AssignmentNode(s('a'), c(5)).toString()).toBe('a = 5');
  });

  it('toString wraps low-precedence value in parens for {parenthesis:"all"}', () => {
    const node = new AssignmentNode(s('a'), op('+', 'add', [c(1), c(2)]));
    expect(node.toString({ parenthesis: 'all' })).toBe('a = (1 + 2)');
  });

  it('toString does not wrap when not needed', () => {
    const node = new AssignmentNode(s('a'), op('+', 'add', [c(1), c(2)]));
    expect(node.toString()).toBe('a = 1 + 2');
  });

  it('toTex of assignment, with and without parens', () => {
    const node = new AssignmentNode(s('a'), op('+', 'add', [c(1), c(2)]));
    expect(node.toTex()).toContain('=');
    const tex = node.toTex({ parenthesis: 'all' });
    expect(tex).toContain('\\left(');
    expect(tex).toContain('\\right)');
  });

  it('toHTML of assignment, with and without parens', () => {
    const node = new AssignmentNode(s('a'), op('+', 'add', [c(1), c(2)]));
    expect(node.toHTML()).toContain('math-assignment-operator');
    expect(node.toHTML({ parenthesis: 'all' })).toContain('math-round-parenthesis');
  });

  it('renders the index for an object-property assignment', () => {
    const node = new AssignmentNode(s('a'), dotIndex('b'), c(2));
    expect(node.toString()).toBe('a.b = 2');
    expect(node.toHTML()).toContain('math-property');
    expect(node.toTex()).toContain('.b');
  });
});

describe('AssignmentNode — name getter & validation', () => {
  it('name returns object name for simple assignment', () => {
    expect(new AssignmentNode(s('foo'), c(1)).name).toBe('foo');
  });
  it('name returns property name for object-property assignment', () => {
    expect(new AssignmentNode(s('a'), dotIndex('bar'), c(1)).name).toBe('bar');
  });
  it('name returns "" for matrix-index assignment', () => {
    expect(new AssignmentNode(s('a'), matIndex(2), c(1)).name).toBe('');
  });

  it('throws when object is neither Symbol nor Accessor', () => {
    expect(() => new AssignmentNode(c(1), c(2))).toThrow(
      'SymbolNode or AccessorNode expected as "object"'
    );
  });
  it('throws when assigning to reserved symbol "end"', () => {
    expect(() => new AssignmentNode(s('end'), c(2))).toThrow('Cannot assign to symbol "end"');
  });
  it('throws when index is not an IndexNode', () => {
    expect(() => new AssignmentNode(s('a'), c(1), c(2))).toThrow(
      'IndexNode expected as "index"'
    );
  });
  it('throws when value is not a Node', () => {
    expect(() => new AssignmentNode(s('a'), 42 as unknown as MathNode)).toThrow(
      'Node expected as "value"'
    );
  });
});

describe('AssignmentNode — structural helpers', () => {
  it('clone produces an equal but distinct node', () => {
    const node = new AssignmentNode(s('a'), op('+', 'add', [c(1), c(2)]));
    const cl = node.clone();
    expect(cl).not.toBe(node);
    expect(cl.equals(node)).toBe(true);
  });
  it('forEach visits object and value (no index)', () => {
    const node = new AssignmentNode(s('a'), c(5));
    const paths: string[] = [];
    node.forEach((_child: MathNode, path: string) => paths.push(path));
    expect(paths).toEqual(['object', 'value']);
  });
  it('forEach visits object, index and value (with index)', () => {
    const node = new AssignmentNode(s('a'), dotIndex('b'), c(5));
    const paths: string[] = [];
    node.forEach((_child: MathNode, path: string) => paths.push(path));
    expect(paths).toEqual(['object', 'index', 'value']);
  });
  it('map rebuilds the node', () => {
    const node = new AssignmentNode(s('a'), dotIndex('b'), c(5));
    const mapped = node.map((child: MathNode) => child);
    expect(mapped.isAssignmentNode).toBe(true);
    expect(mapped.equals(node)).toBe(true);
  });
  it('toJSON / fromJSON round-trips', () => {
    const node = new AssignmentNode(s('a'), dotIndex('b'), c(5));
    const json = node.toJSON();
    expect(json.mathjs).toBe('AssignmentNode');
    expect(AssignmentNode.fromJSON(json).equals(node)).toBe(true);
  });
});

// ── AccessorNode ─────────────────────────────────────────────────────────────

describe('AccessorNode — compile & evaluate', () => {
  it('reads an object property obj.prop (getSafeProperty)', () => {
    const node = new AccessorNode(s('obj'), dotIndex('prop'));
    const fn = node._compile(mathScope, {});
    expect(fn(scopeMap({ obj: { prop: 42 } }), {}, undefined)).toBe(42);
  });

  it('reads a matrix/array element a[2] (non-object-property branch)', () => {
    const node = new AccessorNode(s('a'), matIndex(2));
    const fn = node._compile(mathScope, {});
    expect(fn(scopeMap({ a: [10, 20, 30] }), {}, undefined)).toBe(30);
  });

  it('optional chaining short-circuits to undefined when object is null', () => {
    const node = new AccessorNode(s('obj'), dotIndex('prop'), true);
    const fn = node._compile(mathScope, {});
    expect(fn(scopeMap({ obj: null }), {}, undefined)).toBeUndefined();
  });

  it('optional chaining short-circuits in the matrix-index branch too', () => {
    const node = new AccessorNode(s('a'), matIndex(2), true);
    const fn = node._compile(mathScope, {});
    expect(fn(scopeMap({ a: null }), {}, undefined)).toBeUndefined();
  });

  it('nested optional chaining propagates the short-circuit (prevOptionalChaining)', () => {
    // a?.b.c — inner accessor is optional, outer is not but observes the
    // optionalShortCircuit flag set on the shared context.
    const inner = new AccessorNode(s('a'), dotIndex('b'), true);
    const outer = new AccessorNode(inner, dotIndex('c'));
    const fn = outer._compile(mathScope, {});
    expect(fn(scopeMap({ a: null }), {}, undefined)).toBeUndefined();
  });

  it('nested optional chaining in matrix-index outer branch', () => {
    const inner = new AccessorNode(s('a'), dotIndex('b'), true);
    const outer = new AccessorNode(inner, matIndex(1));
    const fn = outer._compile(mathScope, {});
    expect(fn(scopeMap({ a: null }), {}, undefined)).toBeUndefined();
  });

  it('security: reading "constructor" via accessor throws', () => {
    const node = new AccessorNode(s('obj'), dotIndex('constructor'));
    const fn = node._compile(mathScope, {});
    expect(() => fn(scopeMap({ obj: {} }), {}, undefined)).toThrow();
  });
});

describe('AccessorNode — rendering', () => {
  it('toString of object-property access', () => {
    expect(new AccessorNode(s('obj'), dotIndex('prop')).toString()).toBe('obj.prop');
  });
  it('toString of array index access', () => {
    expect(new AccessorNode(s('a'), matIndex(2)).toString()).toBe('a[2]');
  });
  it('toString of optional chaining (bracket)', () => {
    expect(new AccessorNode(s('obj'), propIndex('prop'), true).toString()).toBe('obj?.["prop"]');
  });
  it('toString of optional chaining (dot)', () => {
    expect(new AccessorNode(s('obj'), dotIndex('prop'), true).toString()).toBe('obj?.prop');
  });
  it('toHTML of array index access', () => {
    expect(new AccessorNode(s('a'), matIndex(2)).toHTML()).toContain('math-square-parenthesis');
  });
  it('toTex of array index access', () => {
    expect(new AccessorNode(s('a'), matIndex(2)).toTex()).toContain('_{');
  });

  it('wraps the object in parens when it needs them (operator object)', () => {
    const node = new AccessorNode(op('+', 'add', [s('a'), s('b')]), matIndex(1));
    expect(node.toString()).toBe('(a + b)[1]');
    expect(node.toHTML()).toContain('math-round-parenthesis');
    // _toTex has a known literal-string quirk for the paren case; ensure it runs.
    expect(node.toTex()).toContain('_{');
  });

  it('toJSON / fromJSON round-trips', () => {
    const node = new AccessorNode(s('obj'), dotIndex('prop'));
    const json = node.toJSON();
    expect(json.mathjs).toBe('AccessorNode');
    expect(AccessorNode.fromJSON(json).equals(node)).toBe(true);
  });
  it('clone and map preserve structure', () => {
    const node = new AccessorNode(s('obj'), dotIndex('prop'));
    expect(node.clone().equals(node)).toBe(true);
    expect(node.map((c2: MathNode) => c2).equals(node)).toBe(true);
  });
  it('forEach visits object and index', () => {
    const node = new AccessorNode(s('obj'), dotIndex('prop'));
    const paths: string[] = [];
    node.forEach((_child: MathNode, path: string) => paths.push(path));
    expect(paths).toEqual(['object', 'index']);
  });
  it('name getter returns the property name and "" for matrix index', () => {
    expect(new AccessorNode(s('obj'), dotIndex('prop')).name).toBe('prop');
    expect(new AccessorNode(s('a'), matIndex(2)).name).toBe('');
  });
  it('constructor validation', () => {
    expect(() => new AccessorNode(42 as unknown as MathNode, dotIndex('x'))).toThrow(
      'Node expected for parameter "object"'
    );
    expect(() => new AccessorNode(s('a'), c(1))).toThrow(
      'IndexNode expected for parameter "index"'
    );
  });
});

// ── IndexNode ────────────────────────────────────────────────────────────────

describe('IndexNode — object property vs matrix index', () => {
  it('isObjectProperty / getObjectProperty for a string single dimension', () => {
    const idx = propIndex('b');
    expect(idx.isObjectProperty()).toBe(true);
    expect(idx.getObjectProperty()).toBe('b');
  });
  it('isObjectProperty false / getObjectProperty null for numeric index', () => {
    const idx = matIndex(2);
    expect(idx.isObjectProperty()).toBe(false);
    expect(idx.getObjectProperty()).toBeNull();
  });

  it('toString of multi-dimensional index [1, 2]', () => {
    expect(matIndex(1, 2).toString()).toBe('[1, 2]');
  });
  it('toString of dot-notation index .b', () => {
    expect(dotIndex('b').toString()).toBe('.b');
  });
  it('toHTML of bracket index includes separators', () => {
    const html = matIndex(1, 2).toHTML();
    expect(html).toContain('math-square-parenthesis');
    expect(html).toContain('math-separator');
  });
  it('toHTML of dot-notation index', () => {
    const html = dotIndex('b').toHTML();
    expect(html).toContain('math-accessor-operator');
    expect(html).toContain('math-property');
  });
  it('toTex of bracket index', () => {
    expect(matIndex(1, 2).toTex()).toBe('_{1,2}');
  });
  it('toTex of dot-notation index', () => {
    expect(dotIndex('b').toTex()).toContain('.b');
  });

  it('clone / map / forEach', () => {
    const idx = matIndex(1, 2);
    expect(idx.clone().dimensions.length).toBe(2);
    expect(idx.map((c2: MathNode) => c2).dimensions.length).toBe(2);
    const paths: string[] = [];
    idx.forEach((_c: MathNode, p: string) => paths.push(p));
    expect(paths).toEqual(['dimensions[0]', 'dimensions[1]']);
  });

  it('constructor rejects non-Node dimensions', () => {
    expect(() => new IndexNode([42 as unknown as MathNode])).toThrow(
      'Array containing Nodes expected for parameter "dimensions"'
    );
  });
  it('constructor rejects dotNotation for non-object-property', () => {
    expect(() => new IndexNode([c(1)], true)).toThrow(
      'dotNotation only applicable for object properties'
    );
  });

  it('compiles & resolves the "end" symbol inside an index (needsEnd branch)', () => {
    const idx = new IndexNode([s('end')]);
    const fn = idx._compile(mathScope, {});
    // context is an array of length 3 → size = [3] → end resolves to 3
    const result = fn(scopeMap(), {}, [10, 20, 30]);
    expect(result.isIndex).toBe(true);
    expect(result.dimensions[0]).toBe(3);
  });

  it('compiles "end" arithmetic inside an index (A[end - 1])', () => {
    const idx = new IndexNode([op('-', 'subtract', [s('end'), c(1)])]);
    const fn = idx._compile(mathScope, {});
    const result = fn(scopeMap(), {}, [10, 20, 30]);
    expect(result.dimensions[0]).toBe(2);
  });

  it('throws when "end" is used without an indexable context', () => {
    const idx = new IndexNode([s('end')]);
    const fn = idx._compile(mathScope, {});
    expect(() => fn(scopeMap(), {}, 42)).toThrow('Cannot resolve "end"');
  });

  it('toJSON / fromJSON round-trips', () => {
    const idx = matIndex(1, 2);
    const json = idx.toJSON();
    expect(json.mathjs).toBe('IndexNode');
    expect(IndexNode.fromJSON(json).dimensions.length).toBe(2);
  });
});

// ── ConditionalNode ───────────────────────────────────────────────────────────

describe('ConditionalNode — compile & evaluate (testCondition branches)', () => {
  function build(cond: unknown) {
    return new ConditionalNode(c(cond), c('y'), c('n'));
  }
  function run(cond: unknown) {
    return build(cond)._compile(mathScope, {})(scopeMap(), {}, undefined);
  }

  it('numeric condition', () => {
    expect(run(5)).toBe('y');
    expect(run(0)).toBe('n');
  });
  it('boolean condition', () => {
    expect(run(true)).toBe('y');
    expect(run(false)).toBe('n');
  });
  it('string condition', () => {
    expect(run('x')).toBe('y');
    expect(run('')).toBe('n');
  });
  it('BigNumber condition', () => {
    expect(run(new MockBigNumber(3))).toBe('y');
    expect(run(new MockBigNumber(0))).toBe('n');
  });
  it('Complex condition', () => {
    expect(run(new MockComplex(0, 1))).toBe('y');
    expect(run(new MockComplex(0, 0))).toBe('n');
  });
  it('Unit condition', () => {
    expect(run(new MockUnit(2))).toBe('y');
    expect(run(new MockUnit(0))).toBe('n');
  });
  it('null / undefined condition is false', () => {
    expect(run(null)).toBe('n');
    expect(run(undefined)).toBe('n');
  });
  it('unsupported condition type throws', () => {
    expect(() => run({})).toThrow('Unsupported type of condition');
  });
});

describe('ConditionalNode — rendering', () => {
  it('toString of a basic conditional wraps operator condition & negative branch', () => {
    const node = new ConditionalNode(
      op('>', 'larger', [s('a'), c(0)]),
      c(1),
      op('-', 'unaryMinus', [c(1)])
    );
    expect(node.toString()).toBe('(a > 0) ? 1 : (-1)');
  });

  it('toString with {parenthesis:"all"} wraps every branch', () => {
    const node = new ConditionalNode(s('x'), c(1), c(2));
    expect(node.toString({ parenthesis: 'all' })).toBe('(x) ? (1) : (2)');
  });

  it('toString of a plain (non-operator, high-precedence) conditional', () => {
    const node = new ConditionalNode(s('x'), c(1), c(2));
    expect(node.toString()).toBe('x ? 1 : 2');
  });

  it('toString of a nested conditional in the false branch', () => {
    const inner = new ConditionalNode(s('c'), s('d'), s('e'));
    const node = new ConditionalNode(s('a'), s('b'), inner);
    expect(node.toString()).toContain('?');
  });

  it('toHTML of a conditional', () => {
    const node = new ConditionalNode(op('>', 'larger', [s('a'), c(0)]), c(1), c(2));
    expect(node.toHTML()).toContain('math-conditional-operator');
  });

  it('toHTML with {parenthesis:"all"} wraps branches', () => {
    const node = new ConditionalNode(s('x'), c(1), c(2));
    expect(node.toHTML({ parenthesis: 'all' })).toContain('math-round-parenthesis');
  });

  it('toTex uses the cases environment', () => {
    const node = new ConditionalNode(op('>', 'larger', [s('a'), c(0)]), c(1), c(2));
    const tex = node.toTex();
    expect(tex).toContain('\\begin{cases}');
    expect(tex).toContain('\\end{cases}');
  });

  it('clone / map / forEach / toJSON / fromJSON', () => {
    const node = new ConditionalNode(s('a'), c(1), c(2));
    expect(node.clone().equals(node)).toBe(true);
    expect(node.map((c2: MathNode) => c2).equals(node)).toBe(true);
    const paths: string[] = [];
    node.forEach((_c: MathNode, p: string) => paths.push(p));
    expect(paths).toEqual(['condition', 'trueExpr', 'falseExpr']);
    const json = node.toJSON();
    expect(json.mathjs).toBe('ConditionalNode');
    expect(ConditionalNode.fromJSON(json).equals(node)).toBe(true);
  });

  it('constructor validation', () => {
    expect(() => new ConditionalNode(42 as unknown as MathNode, c(1), c(2))).toThrow(
      'Parameter condition must be a Node'
    );
    expect(() => new ConditionalNode(c(1), 42 as unknown as MathNode, c(2))).toThrow(
      'Parameter trueExpr must be a Node'
    );
    expect(() => new ConditionalNode(c(1), c(2), 42 as unknown as MathNode)).toThrow(
      'Parameter falseExpr must be a Node'
    );
  });
});

// ── ConstantNode ──────────────────────────────────────────────────────────────

describe('ConstantNode — rendering for all value types', () => {
  it('toString / toTex / toHTML of a number', () => {
    const n = c(42);
    expect(n.toString()).toBe('42');
    expect(n.toTex()).toBe('42');
    expect(n.toHTML()).toContain('math-number');
  });

  it('toTex of scientific notation uses \\cdot10^{}', () => {
    expect(c(2e21).toTex()).toContain('\\cdot10^{');
  });

  it('toTex of an infinite (unbounded) number renders \\infty', () => {
    expect(c(Infinity).toTex()).toBe('\\infty');
    expect(c(-Infinity).toTex()).toBe('-\\infty');
  });

  it('toString / toTex / toHTML of a string', () => {
    const n = c('hello');
    expect(n.toString()).toBe('"hello"');
    expect(n.toTex()).toContain('\\mathtt{');
    expect(n.toHTML()).toContain('math-string');
  });

  it('toHTML / toTex of a boolean (default toTex branch)', () => {
    const n = c(true);
    expect(n.toHTML()).toContain('math-boolean');
    expect(n.toTex()).toBe('true');
  });

  it('toHTML / toTex of null', () => {
    const n = c(null);
    expect(n.toHTML()).toContain('math-null-symbol');
    expect(n.toTex()).toBe('null');
  });

  it('toHTML of undefined', () => {
    expect(c(undefined).toHTML()).toContain('math-undefined');
  });

  it('toHTML default branch for an object-like value', () => {
    expect(c(new MockComplex(1, 2)).toHTML()).toContain('math-symbol');
  });

  it('toTex of a bigint', () => {
    expect(c(123n).toTex()).toBe('123');
  });

  it('toJSON / fromJSON round-trips', () => {
    const n = c(42);
    const json = n.toJSON();
    expect(json.mathjs).toBe('ConstantNode');
    expect(ConstantNode.fromJSON(json).equals(n)).toBe(true);
  });

  it('map returns a clone (no children)', () => {
    const n = c(42);
    expect(n.map((c2: MathNode) => c2).equals(n)).toBe(true);
  });

  it('forEach visits nothing', () => {
    let count = 0;
    c(1).forEach(() => count++);
    expect(count).toBe(0);
  });

  it('_compile produces a constant evaluator', () => {
    const fn = c(7)._compile(mathScope, {});
    expect(fn(scopeMap(), {}, undefined)).toBe(7);
  });
});

// ── Node base class ────────────────────────────────────────────────────────────

describe('Node base class — wrappers and helpers', () => {
  it('evaluate() compiles and evaluates', () => {
    const node = op('+', 'add', [c(2), c(3)]);
    expect(node.evaluate()).toBe(5);
  });

  it('compile().evaluate(scope) reads from scope', () => {
    const node = op('+', 'add', [s('x'), c(1)]);
    expect(node.compile().evaluate({ x: 41 })).toBe(42);
  });

  it('compile().evaluate() with no scope works', () => {
    const node = op('*', 'multiply', [c(7), c(6)]);
    expect(node.compile().evaluate()).toBe(42);
  });

  it('compile rejects a scope using a reserved keyword', () => {
    const node = op('+', 'add', [c(1), c(1)]);
    expect(() => node.compile().evaluate({ end: 5 })).toThrow('reserved keyword');
  });

  it('transform replaces a matching node', () => {
    const node = op('+', 'add', [s('x'), c(1)]);
    const replaced = node.transform((n: MathNode) => {
      const nv = n as unknown as NodeView;
      return nv.isSymbolNode && nv.name === 'x' ? c(10) : n;
    });
    expect(replaced.evaluate()).toBe(11);
  });

  it('filter finds matching nodes', () => {
    const node = op('+', 'add', [op('+', 'add', [s('x'), s('x')]), s('y')]);
    const xs = node.filter((n: NodeView) => !!(n.isSymbolNode && n.name === 'x'));
    expect(xs.length).toBe(2);
  });

  it('traverse visits every node', () => {
    const node = op('+', 'add', [c(1), c(2)]);
    const visited: MathNode[] = [];
    node.traverse((n: MathNode) => visited.push(n));
    expect(visited.length).toBe(3);
  });

  it('_ifNode error: map callback returning a non-Node throws', () => {
    const node = op('+', 'add', [s('a'), s('b')]);
    expect(() => node.map(() => 'not a node' as unknown as MathNode)).toThrow(
      'Callback function must return a Node'
    );
  });

  it('toString / toHTML / toTex with a function handler (custom string)', () => {
    const node = op('+', 'add', [c(2), c(3)]);
    const handler = () => 'CUSTOM';
    expect(node.toString({ handler })).toBe('CUSTOM');
    expect(node.toHTML({ handler })).toBe('CUSTOM');
    expect(node.toTex({ handler })).toBe('CUSTOM');
  });

  it('_getCustomString throws for an invalid handler type', () => {
    expect(() => c(1).toString({ handler: 'bad' } as unknown as StringOptions)).toThrow(
      'Object or function expected as callback'
    );
  });

  it('getContent returns the node itself', () => {
    const node = op('+', 'add', [c(1), c(2)]);
    expect(node.getContent()).toBe(node);
  });

  it('cloneDeep produces an equal, independent tree', () => {
    const node = op('+', 'add', [s('a'), s('b')]);
    const deep = node.cloneDeep();
    expect(deep).not.toBe(node);
    expect(deep.equals(node)).toBe(true);
  });

  it('equals returns false against null', () => {
    expect(c(1).equals(null)).toBe(false);
  });

  it('abstract Node methods throw when not implemented', () => {
    const bare = new Node();
    expect(() => bare._compile(mathScope, {})).toThrow('Method _compile must be implemented');
    expect(() => bare.forEach(() => {})).toThrow('Cannot run forEach on a Node interface');
    expect(() => bare.map((x: MathNode) => x)).toThrow('Cannot run map on a Node interface');
    expect(() => bare.clone()).toThrow('Cannot clone a Node interface');
    expect(() => bare._toString()).toThrow('_toString not implemented');
    expect(() => bare._toHTML()).toThrow('_toHTML not implemented');
    expect(() => bare._toTex()).toThrow('_toTex not implemented');
    expect(() => bare.toJSON()).toThrow('toJSON not implemented');
  });
});
