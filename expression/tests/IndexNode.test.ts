import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
// Minimal index function: returns a mock index object
function makeIndex(...dims: any[]) {
  return { dimensions: dims, isIndex: true, isObjectProperty: () => false };
}

const mathScope: Record<string, any> = {
  index: (...dims: any[]) => ({ dimensions: dims, isObjectIndex: true }),
};

const sizeFn = (value: any): number[] => {
  if (Array.isArray(value)) return [value.length];
  if (typeof value === 'string') return [value.length];
  return [];
};

const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const IndexNode = createIndexNode({ Node, size: sizeFn });

function makeConst(v: any) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IndexNode - construction & identity', () => {
  it('stores dimensions', () => {
    const node = new IndexNode([makeConst(1)]);
    expect(node.dimensions).toHaveLength(1);
  });

  it('has correct type', () => {
    expect(new IndexNode([makeConst(1)]).type).toBe('IndexNode');
  });

  it('has isIndexNode = true', () => {
    expect(new IndexNode([makeConst(1)]).isIndexNode).toBe(true);
  });

  it('has isNode = true', () => {
    expect((new IndexNode([makeConst(1)]) as any).isNode).toBe(true);
  });

  it('dotNotation defaults to false', () => {
    expect(new IndexNode([makeConst('a')]).dotNotation).toBe(false);
  });

  it('throws when dimensions contains non-nodes', () => {
    expect(() => new IndexNode([42 as any])).toThrow(
      'Array containing Nodes expected for parameter "dimensions"'
    );
  });

  it('throws when dotNotation used without object property', () => {
    // dotNotation requires dimensions = [ConstantNode with string value]
    expect(() => new IndexNode([makeConst(1)], true)).toThrow(
      'dotNotation only applicable for object properties'
    );
  });

  it('allows dotNotation with string constant dimension', () => {
    const node = new IndexNode([makeConst('foo')], true);
    expect(node.dotNotation).toBe(true);
  });
});

describe('IndexNode - isObjectProperty / getObjectProperty', () => {
  it('isObjectProperty returns true for single string constant dimension', () => {
    const node = new IndexNode([makeConst('name')]);
    expect(node.isObjectProperty()).toBe(true);
  });

  it('isObjectProperty returns false for numeric dimension', () => {
    const node = new IndexNode([makeConst(0)]);
    expect(node.isObjectProperty()).toBe(false);
  });

  it('isObjectProperty returns false for multiple dimensions', () => {
    const node = new IndexNode([makeConst('a'), makeConst('b')]);
    expect(node.isObjectProperty()).toBe(false);
  });

  it('getObjectProperty returns name when isObjectProperty', () => {
    const node = new IndexNode([makeConst('myProp')]);
    expect(node.getObjectProperty()).toBe('myProp');
  });

  it('getObjectProperty returns null when not an object property', () => {
    const node = new IndexNode([makeConst(0)]);
    expect(node.getObjectProperty()).toBeNull();
  });
});

describe('IndexNode - _compile', () => {
  const math = mathScope;
  const argNames = {};

  it('compiles numeric index and calls math.index', () => {
    const node = new IndexNode([makeConst(0)]);
    const fn = node._compile(math, argNames);
    const result = fn(new Map(), {}, null);
    expect(result).toHaveProperty('dimensions');
    expect(result.isObjectIndex).toBe(true);
  });

  it('compiles multi-dimensional index', () => {
    const node = new IndexNode([makeConst(1), makeConst(2)]);
    const fn = node._compile(math, argNames);
    const result = fn(new Map(), {}, null);
    expect(result.dimensions).toHaveLength(2);
  });
});

describe('IndexNode - forEach', () => {
  it('calls callback for each dimension with correct path', () => {
    const d0 = makeConst(1);
    const d1 = makeConst(2);
    const node = new IndexNode([d0, d1]);
    const visited: Array<{ child: any; path: string }> = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(2);
    expect(visited[0].path).toBe('dimensions[0]');
    expect(visited[1].path).toBe('dimensions[1]');
    expect(visited[0].child).toBe(d0);
    expect(visited[1].child).toBe(d1);
  });
});

describe('IndexNode - map', () => {
  it('returns a new IndexNode with transformed dimensions', () => {
    const d0 = makeConst(1);
    const node = new IndexNode([d0]);
    const replacement = makeConst(99);
    const mapped: any = node.map((_child, _path, _parent) => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.dimensions[0]).toBe(replacement);
    expect(mapped.dotNotation).toBe(false);
  });

  it('throws when callback returns non-node', () => {
    const node = new IndexNode([makeConst(0)]);
    expect(() => node.map((_child) => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('IndexNode - clone', () => {
  it('creates a shallow copy', () => {
    const d0 = makeConst(1);
    const d1 = makeConst(2);
    const node = new IndexNode([d0, d1]);
    const cloned: any = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.dimensions[0]).toBe(d0);
    expect(cloned.dimensions[1]).toBe(d1);
    expect(cloned.dotNotation).toBe(false);
  });

  it('preserves dotNotation on clone', () => {
    const node = new IndexNode([makeConst('foo')], true);
    const cloned = node.clone();
    expect(cloned.dotNotation).toBe(true);
  });
});

describe('IndexNode - toString', () => {
  it('formats bracket notation', () => {
    const node = new IndexNode([makeConst(0)]);
    expect(node.toString()).toBe('[0]');
  });

  it('formats dot notation', () => {
    const node = new IndexNode([makeConst('name')], true);
    expect(node.toString()).toBe('.name');
  });

  it('formats multi-dimensional bracket notation', () => {
    const node = new IndexNode([makeConst(1), makeConst(2)]);
    expect(node.toString()).toBe('[1, 2]');
  });
});

describe('IndexNode - toHTML', () => {
  it('formats bracket notation in HTML', () => {
    const node = new IndexNode([makeConst(0)]);
    const html = node.toHTML();
    expect(html).toContain('math-square-parenthesis');
    expect(html).toContain('[');
    expect(html).toContain(']');
  });

  it('formats dot notation in HTML', () => {
    const node = new IndexNode([makeConst('key')], true);
    const html = node.toHTML();
    expect(html).toContain('math-accessor-operator');
    expect(html).toContain('math-property');
    expect(html).toContain('key');
  });
});

describe('IndexNode - toTex', () => {
  it('formats bracket notation in LaTeX as subscript', () => {
    const node = new IndexNode([makeConst(0)]);
    const tex = node.toTex();
    expect(tex).toContain('_{');
    expect(tex).toContain('}');
  });

  it('formats dot notation in LaTeX', () => {
    const node = new IndexNode([makeConst('prop')], true);
    const tex = node.toTex();
    expect(tex).toContain('.prop');
  });
});

describe('IndexNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const d0 = makeConst(1);
    const node = new IndexNode([d0]);
    const json = node.toJSON();
    expect(json.mathjs).toBe('IndexNode');
    expect(json.dimensions).toHaveLength(1);
    expect(json.dotNotation).toBe(false);
  });

  it('fromJSON creates IndexNode', () => {
    const d0 = makeConst('x');
    const node = IndexNode.fromJSON({ dimensions: [d0], dotNotation: false });
    expect(node.isIndexNode).toBe(true);
    expect(node.dimensions[0]).toBe(d0);
    expect(node.dotNotation).toBe(false);
  });
});

describe('IndexNode - equals', () => {
  it('equal nodes with same dimensions', () => {
    const a = new IndexNode([makeConst(1)]);
    const b = new IndexNode([makeConst(1)]);
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when dimensions differ', () => {
    const a = new IndexNode([makeConst(1)]);
    const b = new IndexNode([makeConst(2)]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new IndexNode([makeConst(0)]).equals(null as any)).toBe(false);
  });
});

describe('IndexNode - traverse', () => {
  it('visits root and each dimension', () => {
    const d0 = makeConst(1);
    const d1 = makeConst(2);
    const node = new IndexNode([d0, d1]);
    const visited: any[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(3); // root + 2 dims
    expect(visited[0]).toBe(node);
    expect(visited.some((n) => n === d0)).toBe(true);
    expect(visited.some((n) => n === d1)).toBe(true);
  });
});
