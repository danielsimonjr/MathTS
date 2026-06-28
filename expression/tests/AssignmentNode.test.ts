import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';
import { createAssignmentNode } from '../src/node/AssignmentNode.js';
import type { MathNode } from '../src/node/Node.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, unknown> = {};
const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const IndexNode = createIndexNode({ Node, size: () => [] });

// Minimal subset/matrix for AssignmentNode compilation
const AssignmentNode = createAssignmentNode({
  subset: () => {},
  Node,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: unknown) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

// A string-keyed IndexNode (object property access like .b)
function makeObjIndex(propName: string) {
  // A ConstantNode whose value is a string creates an object property index
  return new IndexNode([makeConst(propName)], true); // dotNotation=true
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AssignmentNode - construction & identity', () => {
  it('constructs with symbol and value (simple assignment: a = 2)', () => {
    const node = new AssignmentNode(makeSym('a'), makeConst(2));
    expect(node.object.toString()).toBe('a');
    expect(node.index).toBeNull();
  });

  it('stores value when two-argument form is used', () => {
    const val = makeConst(42);
    const node = new AssignmentNode(makeSym('x'), val);
    expect(node.value).toBe(val);
  });

  it('has correct type property', () => {
    expect(new AssignmentNode(makeSym('x'), makeConst(1)).type).toBe('AssignmentNode');
  });

  it('has isAssignmentNode = true', () => {
    expect(new AssignmentNode(makeSym('x'), makeConst(1)).isAssignmentNode).toBe(true);
  });

  it('static name is AssignmentNode', () => {
    expect((AssignmentNode as unknown as { name: string }).name).toBe('AssignmentNode');
  });

  it('throws when object is not a SymbolNode or AccessorNode', () => {
    expect(() => new AssignmentNode(makeConst(1), makeConst(2))).toThrow(
      'SymbolNode or AccessorNode expected as "object"'
    );
  });

  it('throws when assigning to reserved symbol "end"', () => {
    expect(() => new AssignmentNode(makeSym('end'), makeConst(1))).toThrow(
      'Cannot assign to symbol "end"'
    );
  });

  it('throws when value is not a Node (index is an IndexNode but value is non-Node)', () => {
    // When three args are given: (symbol, indexNode, value).
    // Passing a SymbolNode as index triggers "IndexNode expected as index" first.
    // To test "value not a Node" we need a valid IndexNode and an invalid value.
    const validIdx = makeObjIndex('foo');
    expect(() => new AssignmentNode(makeSym('x'), validIdx, 42 as unknown as MathNode)).toThrow(
      'Node expected as "value"'
    );
  });
});

describe('AssignmentNode - name getter', () => {
  it('returns symbol name when no index', () => {
    const node = new AssignmentNode(makeSym('abc'), makeConst(1));
    expect(node.name).toBe('abc');
  });

  it('returns property name when index is an object property', () => {
    const node = new AssignmentNode(makeSym('obj'), makeObjIndex('foo'), makeConst(5));
    expect(node.name).toBe('foo');
  });
});

describe('AssignmentNode - _compile (simple variable assignment)', () => {
  it('assigns value to scope and returns it', () => {
    const node = new AssignmentNode(makeSym('x'), makeConst(7));
    const fn = node._compile({}, {});
    const scope = new Map();
    const result = fn(scope, {}, null);
    expect(result).toBe(7);
    expect(scope.get('x')).toBe(7);
  });

  it('returns expression result', () => {
    const node = new AssignmentNode(makeSym('y'), makeConst(99));
    const fn = node._compile({}, {});
    const scope = new Map();
    expect(fn(scope, {}, null)).toBe(99);
  });
});

describe('AssignmentNode - forEach', () => {
  it('visits object and value (no index)', () => {
    const sym = makeSym('x');
    const val = makeConst(5);
    const node = new AssignmentNode(sym, val);
    const visited: { child: MathNode; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(2);
    expect(visited[0].child).toBe(sym);
    expect(visited[0].path).toBe('object');
    expect(visited[1].child).toBe(val);
    expect(visited[1].path).toBe('value');
  });

  it('visits object, index, and value when index is present', () => {
    const sym = makeSym('obj');
    const idx = makeObjIndex('prop');
    const val = makeConst(42);
    const node = new AssignmentNode(sym, idx, val);
    const visited: { child: MathNode; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(3);
    expect(visited[0].path).toBe('object');
    expect(visited[1].path).toBe('index');
    expect(visited[2].path).toBe('value');
  });
});

describe('AssignmentNode - map', () => {
  it('returns a new AssignmentNode with mapped children', () => {
    const sym = makeSym('x');
    const val = makeConst(1);
    const node = new AssignmentNode(sym, val);
    const newVal = makeConst(99);
    const mapped = node.map((child, path) => (path === 'value' ? newVal : child));
    expect(mapped).not.toBe(node);
    expect(mapped.isAssignmentNode).toBe(true);
    expect(mapped.value).toBe(newVal);
    expect(mapped.object).toBe(sym);
  });

  it('throws if callback returns non-Node', () => {
    const node = new AssignmentNode(makeSym('x'), makeConst(1));
    expect(() => node.map(() => ({ notANode: true }) as unknown as MathNode)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('AssignmentNode - clone', () => {
  it('creates a shallow copy', () => {
    const sym = makeSym('x');
    const val = makeConst(5);
    const node = new AssignmentNode(sym, val);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isAssignmentNode).toBe(true);
    expect(cloned.object).toBe(sym);
    expect(cloned.value).toBe(val);
    expect(cloned.index).toBeNull();
  });
});

describe('AssignmentNode - toString', () => {
  it('formats simple assignment as "x = value"', () => {
    const node = new AssignmentNode(makeSym('x'), makeConst(5));
    expect(node.toString()).toBe('x = 5');
  });

  it('formats property assignment as "obj.prop = value"', () => {
    const node = new AssignmentNode(makeSym('obj'), makeObjIndex('prop'), makeConst(7));
    expect(node.toString()).toContain('obj');
    expect(node.toString()).toContain('prop');
    expect(node.toString()).toContain('= 7');
  });
});

describe('AssignmentNode - toHTML', () => {
  it('includes assignment operator span', () => {
    const node = new AssignmentNode(makeSym('x'), makeConst(1));
    const html = node.toHTML();
    expect(html).toContain('math-assignment-operator');
    expect(html).toContain('=');
    expect(html).toContain('x');
    expect(html).toContain('1');
  });
});

describe('AssignmentNode - toTex', () => {
  it('formats as "object=value"', () => {
    const node = new AssignmentNode(makeSym('x'), makeConst(3));
    const tex = node.toTex();
    expect(tex).toContain('=');
    expect(tex).toContain('x');
    expect(tex).toContain('3');
  });
});

describe('AssignmentNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const sym = makeSym('x');
    const val = makeConst(5);
    const node = new AssignmentNode(sym, val);
    const json = node.toJSON();
    expect(json.mathjs).toBe('AssignmentNode');
    expect(json.object).toBe(sym);
    expect(json.index).toBeNull();
    expect(json.value).toBe(val);
  });

  it('fromJSON creates a node', () => {
    const sym = makeSym('y');
    const val = makeConst(10);
    const node = AssignmentNode.fromJSON({ object: sym, index: null, value: val });
    expect(node.isAssignmentNode).toBe(true);
    expect(node.value).toBe(val);
  });
});

describe('AssignmentNode - equals', () => {
  it('equal nodes', () => {
    const a = new AssignmentNode(makeSym('x'), makeConst(5));
    const b = new AssignmentNode(makeSym('x'), makeConst(5));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when value differs', () => {
    const a = new AssignmentNode(makeSym('x'), makeConst(5));
    const b = new AssignmentNode(makeSym('x'), makeConst(6));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when name differs', () => {
    const a = new AssignmentNode(makeSym('x'), makeConst(5));
    const b = new AssignmentNode(makeSym('y'), makeConst(5));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new AssignmentNode(makeSym('x'), makeConst(1)).equals(null)).toBe(false);
  });
});
