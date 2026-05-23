import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createArrayNode } from '../src/node/ArrayNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathWithTransform: Record<string, any> = {};
const Node = createNode({ mathWithTransform });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const ArrayNode = createArrayNode({ Node });

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: any) {
  return new ConstantNode(v);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ArrayNode - construction & identity', () => {
  it('constructs with an array of nodes', () => {
    const node = new ArrayNode([makeConst(1), makeConst(2)]);
    expect(node.items).toHaveLength(2);
  });

  it('constructs with an empty array', () => {
    const node = new ArrayNode([]);
    expect(node.items).toHaveLength(0);
  });

  it('defaults to empty array when items are omitted', () => {
    const node = new ArrayNode();
    expect(node.items).toHaveLength(0);
  });

  it('has correct type property', () => {
    expect(new ArrayNode([]).type).toBe('ArrayNode');
  });

  it('has isArrayNode = true', () => {
    expect(new ArrayNode([]).isArrayNode).toBe(true);
  });

  it('static name is ArrayNode', () => {
    expect((ArrayNode as any).name).toBe('ArrayNode');
  });

  it('throws when items is not an array of Nodes', () => {
    expect(() => new ArrayNode([42 as any])).toThrow('Array containing Nodes expected');
  });

  it('throws when a non-Node is included in items', () => {
    expect(() => new ArrayNode(['string' as any])).toThrow();
  });
});

describe('ArrayNode - _compile', () => {
  it('evaluates to an array of values when config.matrix === "Array"', () => {
    // math.config.matrix === 'Array' means we get plain arrays
    const math = { config: { matrix: 'Array' } };
    const node = new ArrayNode([makeConst(1), makeConst(2), makeConst(3)]);
    const fn = node._compile(math, {});
    const scope = new Map();
    const result = fn(scope, {}, null);
    expect(result).toEqual([1, 2, 3]);
  });

  it('evaluates an empty array', () => {
    const math = { config: { matrix: 'Array' } };
    const node = new ArrayNode([]);
    const fn = node._compile(math, {});
    const scope = new Map();
    expect(fn(scope, {}, null)).toEqual([]);
  });

  it('evaluates to a matrix when config.matrix !== "Array"', () => {
    // math.config.matrix === 'Matrix' → calls math.matrix(array)
    const createdMatrices: any[] = [];
    const math = {
      config: { matrix: 'Matrix' },
      matrix: (arr: any[]) => {
        const m = { isMatrix: true, data: arr };
        createdMatrices.push(m);
        return m;
      },
    };
    const node = new ArrayNode([makeConst(10), makeConst(20)]);
    const fn = node._compile(math, {});
    const scope = new Map();
    const result = fn(scope, {}, null);
    expect(result.isMatrix).toBe(true);
    expect(result.data).toEqual([10, 20]);
  });
});

describe('ArrayNode - forEach', () => {
  it('calls callback for each child node', () => {
    const c1 = makeConst(1);
    const c2 = makeConst(2);
    const node = new ArrayNode([c1, c2]);
    const visited: { child: any; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(2);
    expect(visited[0].child).toBe(c1);
    expect(visited[0].path).toBe('items[0]');
    expect(visited[1].child).toBe(c2);
    expect(visited[1].path).toBe('items[1]');
  });

  it('calls callback with parent reference', () => {
    const node = new ArrayNode([makeConst(5)]);
    let capturedParent: any = null;
    node.forEach((_child, _path, parent) => {
      capturedParent = parent;
    });
    expect(capturedParent).toBe(node);
  });

  it('does not call callback for empty items', () => {
    const node = new ArrayNode([]);
    const visited: any[] = [];
    node.forEach((child) => visited.push(child));
    expect(visited).toHaveLength(0);
  });
});

describe('ArrayNode - map', () => {
  it('returns a new ArrayNode with transformed items', () => {
    const c1 = makeConst(1);
    const c2 = makeConst(2);
    const node = new ArrayNode([c1, c2]);
    const replacement = makeConst(99);
    const mapped = node.map(() => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.isArrayNode).toBe(true);
    expect(mapped.items).toHaveLength(2);
    expect(mapped.items[0]).toBe(replacement);
    expect(mapped.items[1]).toBe(replacement);
  });

  it('throws if callback returns non-Node', () => {
    const node = new ArrayNode([makeConst(1)]);
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('ArrayNode - clone', () => {
  it('creates a shallow copy with the same items', () => {
    const c1 = makeConst(1);
    const c2 = makeConst(2);
    const node = new ArrayNode([c1, c2]);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isArrayNode).toBe(true);
    expect(cloned.items).toHaveLength(2);
    // Shallow: same item instances
    expect(cloned.items[0]).toBe(c1);
    expect(cloned.items[1]).toBe(c2);
  });
});

describe('ArrayNode - toString', () => {
  it('formats single-item array', () => {
    const node = new ArrayNode([makeConst(5)]);
    expect(node.toString()).toBe('[5]');
  });

  it('formats multi-item array with comma separator', () => {
    const node = new ArrayNode([makeConst(1), makeConst(2), makeConst(3)]);
    expect(node.toString()).toBe('[1, 2, 3]');
  });

  it('formats empty array', () => {
    const node = new ArrayNode([]);
    expect(node.toString()).toBe('[]');
  });
});

describe('ArrayNode - toHTML', () => {
  it('wraps items in square bracket spans', () => {
    const node = new ArrayNode([makeConst(1), makeConst(2)]);
    const html = node.toHTML();
    expect(html).toContain('math-square-parenthesis');
    expect(html).toContain('[');
    expect(html).toContain(']');
    expect(html).toContain('math-separator');
  });

  it('includes each item in output', () => {
    const node = new ArrayNode([makeConst(42)]);
    expect(node.toHTML()).toContain('42');
  });
});

describe('ArrayNode - toTex', () => {
  it('wraps single items in bmatrix', () => {
    const node = new ArrayNode([makeConst(1), makeConst(2)]);
    const tex = node.toTex();
    expect(tex).toContain('\\begin{bmatrix}');
    expect(tex).toContain('\\end{bmatrix}');
  });
});

describe('ArrayNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const c = makeConst(7);
    const node = new ArrayNode([c]);
    const json = node.toJSON();
    expect(json.mathjs).toBe('ArrayNode');
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toBe(c);
  });

  it('fromJSON creates a node from JSON', () => {
    const c = makeConst(3);
    const node = ArrayNode.fromJSON({ items: [c] });
    expect(node.isArrayNode).toBe(true);
    expect(node.items[0]).toBe(c);
  });
});

describe('ArrayNode - equals', () => {
  it('equal nodes with same items', () => {
    const a = new ArrayNode([makeConst(1), makeConst(2)]);
    const b = new ArrayNode([makeConst(1), makeConst(2)]);
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when items differ', () => {
    const a = new ArrayNode([makeConst(1)]);
    const b = new ArrayNode([makeConst(2)]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when length differs', () => {
    const a = new ArrayNode([makeConst(1)]);
    const b = new ArrayNode([makeConst(1), makeConst(2)]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new ArrayNode([]).equals(null)).toBe(false);
  });
});

describe('ArrayNode - traverse', () => {
  it('visits root and children', () => {
    const c1 = makeConst(1);
    const c2 = makeConst(2);
    const node = new ArrayNode([c1, c2]);
    const visited: any[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(3);
    expect(visited[0]).toBe(node);
    expect(visited.includes(c1)).toBe(true);
    expect(visited.includes(c2)).toBe(true);
  });
});
