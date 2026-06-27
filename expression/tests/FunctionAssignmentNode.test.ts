import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createFunctionAssignmentNode } from '../src/node/FunctionAssignmentNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {};
const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });

/**
 * A minimal typed mock: returns a plain function that dispatches the
 * first (and only) registered signature, wrapping it so tests can call
 * the returned function directly.
 */
function mockTyped(
  _name: string,
  signatures: Record<string, (...args: unknown[]) => unknown>
) {
  const entries = Object.entries(signatures);
  if (entries.length !== 1) throw new Error('mockTyped: expected exactly 1 signature');
  const impl = entries[0][1];
  return (...args: unknown[]) => impl(...args);
}

const FunctionAssignmentNode = createFunctionAssignmentNode({
  typed: mockTyped,
  Node,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: any) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FunctionAssignmentNode - construction & identity', () => {
  it('stores name, params, and expr', () => {
    const expr = makeConst(42);
    const node = new FunctionAssignmentNode('f', ['x'], expr);
    expect(node.name).toBe('f');
    expect(node.params).toEqual(['x']);
    expect(node.expr).toBe(expr);
  });

  it('stores multiple parameters', () => {
    const node = new FunctionAssignmentNode('g', ['a', 'b', 'c'], makeConst(1));
    expect(node.params).toEqual(['a', 'b', 'c']);
  });

  it('stores param types from object-form params', () => {
    const node = new FunctionAssignmentNode('h', [{ name: 'x', type: 'number' }], makeConst(0));
    expect(node.params).toEqual(['x']);
    expect(node.types).toEqual(['number']);
  });

  it('defaults param type to "any" for string params', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(0));
    expect(node.types).toEqual(['any']);
  });

  it('has correct type property', () => {
    expect(new FunctionAssignmentNode('f', ['x'], makeConst(1)).type).toBe(
      'FunctionAssignmentNode'
    );
  });

  it('has isFunctionAssignmentNode = true', () => {
    expect(new FunctionAssignmentNode('f', ['x'], makeConst(1)).isFunctionAssignmentNode).toBe(
      true
    );
  });

  it('static name is FunctionAssignmentNode', () => {
    expect((FunctionAssignmentNode as any).name).toBe('FunctionAssignmentNode');
  });

  it('throws when name is not a string', () => {
    expect(() => new FunctionAssignmentNode(42 as any, ['x'], makeConst(1))).toThrow(
      'String expected for parameter "name"'
    );
  });

  it('throws when params is not an array', () => {
    expect(() => new FunctionAssignmentNode('f', 'x' as any, makeConst(1))).toThrow(
      'Array containing strings or objects expected'
    );
  });

  it('throws when expr is not a Node', () => {
    expect(() => new FunctionAssignmentNode('f', ['x'], 42 as any)).toThrow(
      'Node expected for parameter "expr"'
    );
  });

  it('throws for reserved keyword function names', () => {
    // 'end' is a reserved keyword
    expect(() => new FunctionAssignmentNode('end', ['x'], makeConst(1))).toThrow(
      'Illegal function name'
    );
  });

  it('throws for duplicate parameter names', () => {
    expect(() => new FunctionAssignmentNode('f', ['x', 'x'], makeConst(1))).toThrow(
      'Duplicate parameter name "x"'
    );
  });
});

describe('FunctionAssignmentNode - _compile', () => {
  it('creates a callable function and sets it on scope', () => {
    // f(x) = x (identity)
    const expr = makeSym('x');
    const node = new FunctionAssignmentNode('f', ['x'], expr);
    const math = {};
    const fn = node._compile(math, {});
    const scope = new Map();
    const result = fn(scope, {}, null);
    expect(typeof result).toBe('function');
    expect(scope.get('f')).toBe(result);
  });

  it('the created function computes the expression body', () => {
    // f(x) = x (identity) — body is a SymbolNode 'x' which resolves from args
    const expr = makeSym('x');
    const node = new FunctionAssignmentNode('f', ['x'], expr);
    const math = {};
    const scope = new Map();
    const f = node._compile(math, {})(scope, {}, null);
    expect(f(5)).toBe(5);
    expect(f(42)).toBe(42);
  });

  it('constant-body function always returns same value', () => {
    // f(x) = 99
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(99));
    const math = {};
    const scope = new Map();
    const f = node._compile(math, {})(scope, {}, null);
    expect(f(0)).toBe(99);
    expect(f(100)).toBe(99);
  });

  it('attaches syntax and expr string to the returned function', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    const scope = new Map();
    const f: any = node._compile({}, {})(scope, {}, null);
    expect(f.syntax).toBe('f(x)');
    expect(typeof f.expr).toBe('string');
  });
});

describe('FunctionAssignmentNode - forEach', () => {
  it('calls callback once for expr', () => {
    const expr = makeConst(1);
    const node = new FunctionAssignmentNode('f', ['x'], expr);
    const visited: { child: any; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(1);
    expect(visited[0].child).toBe(expr);
    expect(visited[0].path).toBe('expr');
  });
});

describe('FunctionAssignmentNode - map', () => {
  it('returns a new node with transformed expr', () => {
    const expr = makeConst(1);
    const replacement = makeConst(99);
    const node = new FunctionAssignmentNode('f', ['x'], expr);
    const mapped = node.map(() => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.isFunctionAssignmentNode).toBe(true);
    expect(mapped.expr).toBe(replacement);
    expect(mapped.name).toBe('f');
    expect(mapped.params).toEqual(['x']);
  });

  it('throws if callback returns non-Node', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('FunctionAssignmentNode - clone', () => {
  it('creates a shallow copy', () => {
    const expr = makeConst(5);
    const node = new FunctionAssignmentNode('f', ['x', 'y'], expr);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isFunctionAssignmentNode).toBe(true);
    expect(cloned.name).toBe('f');
    expect(cloned.params).toEqual(['x', 'y']);
    expect(cloned.expr).toBe(expr);
    // params array should be a copy (not same reference)
    expect(cloned.params).not.toBe(node.params);
  });
});

describe('FunctionAssignmentNode - toString', () => {
  it('formats as "name(params) = expr"', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(42));
    const str = node.toString();
    expect(str).toBe('f(x) = 42');
  });

  it('formats multi-param function', () => {
    const node = new FunctionAssignmentNode('g', ['a', 'b'], makeConst(1));
    expect(node.toString()).toBe('g(a, b) = 1');
  });
});

describe('FunctionAssignmentNode - toHTML', () => {
  it('wraps name and params in spans', () => {
    const node = new FunctionAssignmentNode('myFunc', ['x'], makeConst(1));
    const html = node.toHTML();
    expect(html).toContain('math-function');
    expect(html).toContain('math-parameter');
    expect(html).toContain('myFunc');
    expect(html).toContain('x');
    expect(html).toContain('=');
  });
});

describe('FunctionAssignmentNode - toTex', () => {
  it('formats using \\mathrm and \\left( \\right)', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(3));
    const tex = node.toTex();
    expect(tex).toContain('\\mathrm{f}');
    expect(tex).toContain('\\left(');
    expect(tex).toContain('\\right)');
    expect(tex).toContain('=');
    expect(tex).toContain('3');
  });
});

describe('FunctionAssignmentNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape with params as objects', () => {
    const node = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    const json = node.toJSON();
    expect(json.mathjs).toBe('FunctionAssignmentNode');
    expect(json.name).toBe('f');
    expect(json.params).toEqual([{ name: 'x', type: 'any' }]);
  });

  it('fromJSON creates a node', () => {
    const expr = makeConst(7);
    const node = FunctionAssignmentNode.fromJSON({
      name: 'f',
      params: [{ name: 'x', type: 'number' }],
      expr,
    });
    expect(node.isFunctionAssignmentNode).toBe(true);
    expect(node.name).toBe('f');
    expect(node.params).toEqual(['x']);
    expect(node.types).toEqual(['number']);
  });
});

describe('FunctionAssignmentNode - equals', () => {
  it('equal nodes', () => {
    const a = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    const b = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when name differs', () => {
    const a = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    const b = new FunctionAssignmentNode('g', ['x'], makeConst(1));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when params differ', () => {
    const a = new FunctionAssignmentNode('f', ['x'], makeConst(1));
    const b = new FunctionAssignmentNode('f', ['y'], makeConst(1));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new FunctionAssignmentNode('f', ['x'], makeConst(1)).equals(null)).toBe(false);
  });
});
