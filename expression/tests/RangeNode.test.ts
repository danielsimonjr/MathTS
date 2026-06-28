import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createRangeNode } from '../src/node/RangeNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, unknown> = {
  // Minimal range function: returns {start, end, step}
  range: (start: number, end: number, step?: number) => ({ start, end, step }),
};

const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const RangeNode = createRangeNode({ Node });

function makeConst(v: unknown) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RangeNode - construction & identity', () => {
  it('stores start and end (no step)', () => {
    const node = new RangeNode(makeConst(1), makeConst(10));
    expect(node.start).toBeDefined();
    expect(node.end).toBeDefined();
    expect(node.step).toBeNull();
  });

  it('stores start, end, and step', () => {
    const node = new RangeNode(makeConst(1), makeConst(10), makeConst(2));
    expect(node.step).toBeDefined();
    expect(node.step).not.toBeNull();
  });

  it('has correct type', () => {
    expect(new RangeNode(makeConst(1), makeConst(5)).type).toBe('RangeNode');
  });

  it('has isRangeNode = true', () => {
    expect(new RangeNode(makeConst(1), makeConst(5)).isRangeNode).toBe(true);
  });

  it('has isNode = true', () => {
    expect((new RangeNode(makeConst(1), makeConst(5)) as unknown as { isNode: boolean }).isNode).toBe(
      true
    );
  });

  it('throws when start is not a node', () => {
    expect(() => new RangeNode(42 as unknown as ReturnType<typeof makeConst>, makeConst(5))).toThrow(
      'Node expected'
    );
  });

  it('throws when end is not a node', () => {
    expect(() => new RangeNode(makeConst(1), 42 as unknown as ReturnType<typeof makeConst>)).toThrow(
      'Node expected'
    );
  });

  it('throws when step is provided but not a node', () => {
    expect(() =>
      new RangeNode(makeConst(1), makeConst(5), 'bad' as unknown as ReturnType<typeof makeConst>)
    ).toThrow('Node expected');
  });

  it('throws with too many arguments', () => {
    expect(() =>
      (RangeNode as unknown as (...args: unknown[]) => unknown)(
        makeConst(1),
        makeConst(5),
        makeConst(2),
        makeConst(0)
      )
    ).toThrow();
  });
});

describe('RangeNode - needsEnd', () => {
  it('returns false when no end symbol is used', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    expect(node.needsEnd()).toBe(false);
  });

  it('returns true when end symbol is used', () => {
    const node = new RangeNode(makeConst(1), makeSym('end'));
    expect(node.needsEnd()).toBe(true);
  });

  it('returns true when end is used in step position', () => {
    const node = new RangeNode(makeConst(1), makeConst(10), makeSym('end'));
    expect(node.needsEnd()).toBe(true);
  });
});

describe('RangeNode - _compile', () => {
  const math = mathScope;
  const argNames = {};

  it('compiles range without step', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    const fn = node._compile(math, argNames);
    const result = fn(new Map(), {}, null);
    expect(result).toMatchObject({ start: 1, end: 5 });
  });

  it('compiles range with step', () => {
    const node = new RangeNode(makeConst(0), makeConst(10), makeConst(2));
    const fn = node._compile(math, argNames);
    const result = fn(new Map(), {}, null);
    expect(result).toMatchObject({ start: 0, end: 10, step: 2 });
  });
});

describe('RangeNode - forEach', () => {
  it('visits start and end for range without step', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = new RangeNode(start, end);
    const paths: string[] = [];
    const children: unknown[] = [];
    node.forEach((child, path) => {
      children.push(child);
      paths.push(path);
    });
    expect(children).toHaveLength(2);
    expect(paths).toContain('start');
    expect(paths).toContain('end');
    expect(children).toContain(start);
    expect(children).toContain(end);
  });

  it('visits start, end, and step for range with step', () => {
    const start = makeConst(0);
    const end = makeConst(10);
    const step = makeConst(2);
    const node = new RangeNode(start, end, step);
    const paths: string[] = [];
    node.forEach((child, path) => paths.push(path));
    expect(paths).toContain('start');
    expect(paths).toContain('end');
    expect(paths).toContain('step');
  });
});

describe('RangeNode - map', () => {
  it('returns a new RangeNode with transformed children', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = new RangeNode(start, end);
    const replacement = makeConst(99);
    const mapped = node.map((_child, _path, _parent) => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.start).toBe(replacement);
    expect(mapped.end).toBe(replacement);
    expect(mapped.step).toBeNull();
    expect(mapped.isRangeNode).toBe(true);
  });

  it('maps step too when present', () => {
    const start = makeConst(0);
    const end = makeConst(10);
    const step = makeConst(2);
    const node = new RangeNode(start, end, step);
    const replacement = makeConst(1);
    const mapped = node.map((_child, _path, _parent) => replacement);
    expect(mapped.step).toBe(replacement);
  });

  it('throws when callback returns non-node', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    expect(() =>
      node.map((_child) => ({ notANode: true }) as unknown as ReturnType<typeof makeConst>)
    ).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('RangeNode - clone', () => {
  it('creates a shallow copy of range without step', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = new RangeNode(start, end);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.start).toBe(start);
    expect(cloned.end).toBe(end);
    expect(cloned.step).toBeNull();
  });

  it('clones range with step', () => {
    const start = makeConst(0);
    const end = makeConst(10);
    const step = makeConst(2);
    const node = new RangeNode(start, end, step);
    const cloned = node.clone();
    expect(cloned.step).toBe(step);
  });
});

describe('RangeNode - toString', () => {
  it('formats start:end', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    expect(node.toString()).toBe('1:5');
  });

  it('formats start:step:end', () => {
    const node = new RangeNode(makeConst(0), makeConst(10), makeConst(2));
    expect(node.toString()).toBe('0:2:10');
  });
});

describe('RangeNode - toHTML', () => {
  it('includes range operator spans', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    const html = node.toHTML();
    expect(html).toContain('math-range-operator');
    expect(html).toContain(':');
  });

  it('includes step in HTML output', () => {
    const node = new RangeNode(makeConst(0), makeConst(10), makeConst(2));
    const html = node.toHTML();
    // Should have two range-operator colons: between start:step and step:end
    const count = (html.match(/math-range-operator/g) || []).length;
    expect(count).toBe(2);
  });
});

describe('RangeNode - toTex', () => {
  it('formats start:end in LaTeX', () => {
    const node = new RangeNode(makeConst(1), makeConst(5));
    const tex = node.toTex();
    expect(tex).toContain(':');
  });

  it('formats start:step:end in LaTeX', () => {
    const node = new RangeNode(makeConst(0), makeConst(10), makeConst(2));
    const tex = node.toTex();
    expect(tex).toBe('0:2:10');
  });
});

describe('RangeNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape (no step)', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = new RangeNode(start, end);
    const json = node.toJSON();
    expect(json.mathjs).toBe('RangeNode');
    expect(json.start).toBe(start);
    expect(json.end).toBe(end);
    expect(json.step).toBeNull();
  });

  it('toJSON includes step when present', () => {
    const step = makeConst(2);
    const node = new RangeNode(makeConst(0), makeConst(10), step);
    const json = node.toJSON();
    expect(json.step).toBe(step);
  });

  it('fromJSON creates RangeNode', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = RangeNode.fromJSON({ start, end });
    expect(node.isRangeNode).toBe(true);
    expect(node.start).toBe(start);
    expect(node.end).toBe(end);
    expect(node.step).toBeNull();
  });

  it('fromJSON with step creates RangeNode with step', () => {
    const start = makeConst(0);
    const end = makeConst(10);
    const step = makeConst(2);
    const node = RangeNode.fromJSON({ start, end, step });
    expect(node.step).toBe(step);
  });
});

describe('RangeNode - equals', () => {
  it('equal nodes with same start and end', () => {
    const a = new RangeNode(makeConst(1), makeConst(5));
    const b = new RangeNode(makeConst(1), makeConst(5));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when end differs', () => {
    const a = new RangeNode(makeConst(1), makeConst(5));
    const b = new RangeNode(makeConst(1), makeConst(6));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new RangeNode(makeConst(1), makeConst(5)).equals(null)).toBe(false);
  });
});

describe('RangeNode - traverse', () => {
  it('visits root plus start and end', () => {
    const start = makeConst(1);
    const end = makeConst(5);
    const node = new RangeNode(start, end);
    const visited: unknown[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(3);
    expect(visited[0]).toBe(node);
    expect(visited.some((n) => n === start)).toBe(true);
    expect(visited.some((n) => n === end)).toBe(true);
  });

  it('visits root, start, end, and step when step present', () => {
    const start = makeConst(0);
    const end = makeConst(10);
    const step = makeConst(2);
    const node = new RangeNode(start, end, step);
    const visited: unknown[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(4);
    expect(visited.some((n) => n === step)).toBe(true);
  });
});
