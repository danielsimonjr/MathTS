import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';
import { createAccessorNode } from '../src/node/AccessorNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {};
const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const IndexNode = createIndexNode({
  Node,
  size: (v: any) => (Array.isArray(v) ? [v.length] : [0]),
});

/**
 * Minimal subset stub for property access tests.
 * For matrix indexing: subset(matrix, index) → matrix[index]
 */
const subset = (obj: any, idx: any) => {
  if (typeof idx === 'string') return obj[idx];
  return obj[idx];
};

const AccessorNode = createAccessorNode({ subset, Node });

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: any) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

/**
 * Make an IndexNode that represents an object property (e.g., .foo)
 * A ConstantNode whose value is a string inside an IndexNode with dotNotation
 * triggers isObjectProperty() === true.
 */
function makePropertyIndex(propName: string) {
  return new IndexNode([makeConst(propName)], true); // dotNotation=true
}

/**
 * Make a bracket-notation IndexNode for a string property.
 * dotNotation=false but still a string constant → isObjectProperty() === true.
 */
function makeBracketStringIndex(propName: string) {
  return new IndexNode([makeConst(propName)], false);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AccessorNode - construction & identity', () => {
  it('constructs with object and index', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);
    expect(node.object).toBe(sym);
    expect(node.index).toBe(idx);
    expect(node.optionalChaining).toBe(false);
  });

  it('stores optionalChaining flag', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx, true);
    expect(node.optionalChaining).toBe(true);
  });

  it('has correct type property', () => {
    expect(new AccessorNode(makeSym('x'), makePropertyIndex('a')).type).toBe('AccessorNode');
  });

  it('has isAccessorNode = true', () => {
    expect(new AccessorNode(makeSym('x'), makePropertyIndex('a')).isAccessorNode).toBe(true);
  });

  it('static name is AccessorNode', () => {
    expect((AccessorNode as any).name).toBe('AccessorNode');
  });

  it('throws when object is not a Node', () => {
    const idx = makePropertyIndex('foo');
    expect(() => new AccessorNode(42 as any, idx)).toThrow('Node expected for parameter "object"');
  });

  it('throws when index is not an IndexNode', () => {
    expect(() => new AccessorNode(makeSym('obj'), makeConst('foo') as any)).toThrow(
      'IndexNode expected for parameter "index"'
    );
  });
});

describe('AccessorNode - name getter', () => {
  it('returns property name when index is an object property', () => {
    const node = new AccessorNode(makeSym('obj'), makePropertyIndex('myProp'));
    expect(node.name).toBe('myProp');
  });

  it('returns empty string when index is not a property', () => {
    // A non-object-property index (e.g. numeric) → name is ''
    // We can fake this by making an index with a numeric constant (not a string)
    const idx = new IndexNode([makeConst(0)], false); // numeric index
    const node = new AccessorNode(makeSym('arr'), idx);
    expect(node.name).toBe('');
  });
});

describe('AccessorNode - _compile (property access)', () => {
  it('reads an object property from scope', () => {
    // obj.foo where obj = { foo: 42 }
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);

    const math = {};
    const fn = node._compile(math, {});
    const scope = new Map([['obj', { foo: 42 }]]);
    expect(fn(scope, {}, null)).toBe(42);
  });

  it('reads a nested property', () => {
    const sym = makeSym('data');
    const idx = makePropertyIndex('value');
    const node = new AccessorNode(sym, idx);
    const fn = node._compile({}, {});
    const scope = new Map([['data', { value: 'hello' }]]);
    expect(fn(scope, {}, null)).toBe('hello');
  });

  it('optionalChaining returns undefined when object is null', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx, true); // optional chaining
    const fn = node._compile({}, {});
    const scope = new Map([['obj', null]]);
    expect(fn(scope, {}, null)).toBeUndefined();
  });

  it('optionalChaining returns undefined when object is undefined', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx, true);
    const fn = node._compile({}, {});
    const scope = new Map([['obj', undefined]]);
    expect(fn(scope, {}, null)).toBeUndefined();
  });

  it('non-optional chaining throws or returns value from getSafeProperty when object is null', () => {
    // Without optional chaining, accessing .foo on null will throw
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx, false); // NOT optional
    const fn = node._compile({}, {});
    const scope = new Map([['obj', null]]);
    // getSafeProperty throws or returns undefined on null
    expect(() => fn(scope, {}, null)).toThrow();
  });
});

describe('AccessorNode - forEach', () => {
  it('visits object and index', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);
    const visited: { child: any; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(2);
    expect(visited[0].child).toBe(sym);
    expect(visited[0].path).toBe('object');
    expect(visited[1].child).toBe(idx);
    expect(visited[1].path).toBe('index');
  });
});

describe('AccessorNode - map', () => {
  it('returns a new AccessorNode with mapped children', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);
    const newSym = makeSym('other');
    const mapped = node.map((child, path) => (path === 'object' ? newSym : child));
    expect(mapped).not.toBe(node);
    expect(mapped.isAccessorNode).toBe(true);
    expect(mapped.object).toBe(newSym);
    expect(mapped.index).toBe(idx);
  });

  it('preserves optionalChaining in mapped node', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx, true);
    const mapped = node.map((child) => child);
    expect(mapped.optionalChaining).toBe(true);
  });

  it('throws if callback returns non-Node', () => {
    const node = new AccessorNode(makeSym('x'), makePropertyIndex('a'));
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('AccessorNode - clone', () => {
  it('creates a shallow copy', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('bar');
    const node = new AccessorNode(sym, idx, true);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isAccessorNode).toBe(true);
    expect(cloned.object).toBe(sym);
    expect(cloned.index).toBe(idx);
    expect(cloned.optionalChaining).toBe(true);
  });
});

describe('AccessorNode - toString', () => {
  it('formats dot-notation property access', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo'); // dotNotation = true
    const node = new AccessorNode(sym, idx);
    const str = node.toString();
    // The index with dotNotation=true formats as ".foo"
    expect(str).toBe('obj.foo');
  });

  it('formats bracket string property access', () => {
    const sym = makeSym('obj');
    const idx = makeBracketStringIndex('foo'); // dotNotation = false
    const node = new AccessorNode(sym, idx);
    const str = node.toString();
    expect(str).toContain('obj');
    expect(str).toContain('foo');
  });
});

describe('AccessorNode - toHTML', () => {
  it('includes object HTML and index HTML', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);
    const html = node.toHTML();
    expect(html).toContain('obj');
    expect(html).toContain('foo');
  });
});

describe('AccessorNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('bar');
    const node = new AccessorNode(sym, idx, false);
    const json = node.toJSON();
    expect(json.mathjs).toBe('AccessorNode');
    expect(json.object).toBe(sym);
    expect(json.index).toBe(idx);
    expect(json.optionalChaining).toBe(false);
  });

  it('fromJSON creates a node', () => {
    const sym = makeSym('x');
    const idx = makePropertyIndex('y');
    const node = AccessorNode.fromJSON({ object: sym, index: idx, optionalChaining: true });
    expect(node.isAccessorNode).toBe(true);
    expect(node.optionalChaining).toBe(true);
  });
});

describe('AccessorNode - equals', () => {
  it('equal nodes', () => {
    const a = new AccessorNode(makeSym('obj'), makePropertyIndex('foo'));
    const b = new AccessorNode(makeSym('obj'), makePropertyIndex('foo'));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when property name differs', () => {
    const a = new AccessorNode(makeSym('obj'), makePropertyIndex('foo'));
    const b = new AccessorNode(makeSym('obj'), makePropertyIndex('bar'));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when object differs', () => {
    const a = new AccessorNode(makeSym('obj'), makePropertyIndex('foo'));
    const b = new AccessorNode(makeSym('other'), makePropertyIndex('foo'));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new AccessorNode(makeSym('x'), makePropertyIndex('a')).equals(null)).toBe(false);
  });
});

describe('AccessorNode - traverse', () => {
  it('visits root, object, and index', () => {
    const sym = makeSym('obj');
    const idx = makePropertyIndex('foo');
    const node = new AccessorNode(sym, idx);
    const visited: any[] = [];
    node.traverse((n) => visited.push(n));
    // node itself + sym + idx + idx's dimension (makeConst('foo'))
    expect(visited.length).toBeGreaterThanOrEqual(3);
    expect(visited[0]).toBe(node);
    expect(visited.includes(sym)).toBe(true);
    expect(visited.includes(idx)).toBe(true);
  });
});
