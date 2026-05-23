import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createBlockNode } from '../src/node/BlockNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathWithTransform: Record<string, any> = {};
const Node = createNode({ mathWithTransform });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });

// Simple ResultSet implementation for tests
class ResultSet {
  entries: any[];
  constructor(entries: any[]) {
    this.entries = entries;
  }
  get isResultSet() {
    return true;
  }
}

const BlockNode = createBlockNode({ ResultSet, Node });

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: any) {
  return new ConstantNode(v);
}

function makeBlock(blocks: Array<{ node: any; visible?: boolean }>) {
  return new BlockNode(blocks);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BlockNode - construction & identity', () => {
  it('constructs with a single visible block', () => {
    const node = makeBlock([{ node: makeConst(1), visible: true }]);
    expect(node.blocks).toHaveLength(1);
    expect(node.blocks[0].visible).toBe(true);
  });

  it('defaults visible to true when omitted', () => {
    const node = makeBlock([{ node: makeConst(1) }]);
    expect(node.blocks[0].visible).toBe(true);
  });

  it('accepts visible: false', () => {
    const node = makeBlock([{ node: makeConst(1), visible: false }]);
    expect(node.blocks[0].visible).toBe(false);
  });

  it('has correct type property', () => {
    expect(makeBlock([{ node: makeConst(1) }]).type).toBe('BlockNode');
  });

  it('has isBlockNode = true', () => {
    expect(makeBlock([{ node: makeConst(1) }]).isBlockNode).toBe(true);
  });

  it('static name is BlockNode', () => {
    expect((BlockNode as any).name).toBe('BlockNode');
  });

  it('throws when argument is not an array', () => {
    expect(() => new BlockNode({} as any)).toThrow('Array expected');
  });

  it('throws when a block has non-Node node property', () => {
    expect(() => new BlockNode([{ node: 42 as any, visible: true }])).toThrow(
      'Property "node" must be a Node'
    );
  });

  it('throws when visible is not boolean', () => {
    expect(() => new BlockNode([{ node: makeConst(1), visible: 'yes' as any }])).toThrow(
      'Property "visible" must be a boolean'
    );
  });
});

describe('BlockNode - _compile', () => {
  const math = {};

  it('returns a ResultSet with visible results', () => {
    const node = makeBlock([
      { node: makeConst(10), visible: true },
      { node: makeConst(20), visible: true },
    ]);
    const fn = node._compile(math, {});
    const result = fn(new Map(), {}, null);
    expect(result).toBeInstanceOf(ResultSet);
    expect(result.entries).toEqual([10, 20]);
  });

  it('excludes hidden blocks from ResultSet', () => {
    const node = makeBlock([
      { node: makeConst(99), visible: false },
      { node: makeConst(42), visible: true },
    ]);
    const fn = node._compile(math, {});
    const result = fn(new Map(), {}, null);
    expect(result.entries).toEqual([42]);
  });

  it('returns empty ResultSet when all blocks are hidden', () => {
    const node = makeBlock([
      { node: makeConst(1), visible: false },
      { node: makeConst(2), visible: false },
    ]);
    const fn = node._compile(math, {});
    const result = fn(new Map(), {}, null);
    expect(result.entries).toEqual([]);
  });

  it('returns empty ResultSet for empty blocks', () => {
    const node = makeBlock([]);
    const fn = node._compile(math, {});
    const result = fn(new Map(), {}, null);
    expect(result.entries).toEqual([]);
  });
});

describe('BlockNode - forEach', () => {
  it('calls callback for each child node with correct path', () => {
    const c1 = makeConst(1);
    const c2 = makeConst(2);
    const node = makeBlock([{ node: c1 }, { node: c2 }]);
    const visited: { child: any; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(2);
    expect(visited[0].child).toBe(c1);
    expect(visited[0].path).toBe('blocks[0].node');
    expect(visited[1].child).toBe(c2);
    expect(visited[1].path).toBe('blocks[1].node');
  });
});

describe('BlockNode - map', () => {
  it('returns a new BlockNode with replaced nodes', () => {
    const c1 = makeConst(1);
    const replacement = makeConst(99);
    const node = makeBlock([{ node: c1, visible: false }]);
    const mapped = node.map(() => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.isBlockNode).toBe(true);
    expect(mapped.blocks[0].node).toBe(replacement);
    expect(mapped.blocks[0].visible).toBe(false);
  });

  it('throws if callback returns non-Node', () => {
    const node = makeBlock([{ node: makeConst(1) }]);
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('BlockNode - clone', () => {
  it('creates a new BlockNode with same blocks', () => {
    const c = makeConst(5);
    const node = makeBlock([{ node: c, visible: true }]);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isBlockNode).toBe(true);
    expect(cloned.blocks[0].node).toBe(c);
    expect(cloned.blocks[0].visible).toBe(true);
  });

  it('preserves visible: false in clone', () => {
    const node = makeBlock([{ node: makeConst(1), visible: false }]);
    const cloned = node.clone();
    expect(cloned.blocks[0].visible).toBe(false);
  });
});

describe('BlockNode - toString', () => {
  it('formats visible blocks without semicolon', () => {
    const node = makeBlock([{ node: makeConst(5), visible: true }]);
    expect(node.toString()).toBe('5');
  });

  it('appends semicolon for hidden blocks', () => {
    const node = makeBlock([{ node: makeConst(5), visible: false }]);
    expect(node.toString()).toBe('5;');
  });

  it('joins multiple blocks with newline', () => {
    const node = makeBlock([
      { node: makeConst(1), visible: true },
      { node: makeConst(2), visible: false },
    ]);
    const str = node.toString();
    expect(str).toContain('\n');
    expect(str).toContain('1');
    expect(str).toContain('2;');
  });
});

describe('BlockNode - toHTML', () => {
  it('includes HTML separator between blocks', () => {
    const node = makeBlock([
      { node: makeConst(1), visible: true },
      { node: makeConst(2), visible: true },
    ]);
    const html = node.toHTML();
    expect(html).toContain('<br />');
    expect(html).toContain('1');
    expect(html).toContain('2');
  });

  it('appends semicolon span for hidden blocks', () => {
    const node = makeBlock([{ node: makeConst(9), visible: false }]);
    const html = node.toHTML();
    expect(html).toContain('math-separator');
    expect(html).toContain(';');
  });
});

describe('BlockNode - toTex', () => {
  it('formats blocks with \\;\\; separator', () => {
    const node = makeBlock([
      { node: makeConst(1), visible: true },
      { node: makeConst(2), visible: true },
    ]);
    const tex = node.toTex();
    expect(tex).toContain('\\;\\;');
    expect(tex).toContain('1');
    expect(tex).toContain('2');
  });

  it('appends ; for hidden blocks', () => {
    const node = makeBlock([{ node: makeConst(3), visible: false }]);
    expect(node.toTex()).toContain('3;');
  });
});

describe('BlockNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const c = makeConst(7);
    const node = makeBlock([{ node: c, visible: true }]);
    const json = node.toJSON();
    expect(json.mathjs).toBe('BlockNode');
    expect(json.blocks).toHaveLength(1);
    expect(json.blocks[0].node).toBe(c);
    expect(json.blocks[0].visible).toBe(true);
  });

  it('fromJSON creates a node', () => {
    const c = makeConst(4);
    const node = BlockNode.fromJSON({ blocks: [{ node: c, visible: false }] });
    expect(node.isBlockNode).toBe(true);
    expect(node.blocks[0].node).toBe(c);
    expect(node.blocks[0].visible).toBe(false);
  });
});

describe('BlockNode - equals', () => {
  it('equal nodes', () => {
    const a = makeBlock([{ node: makeConst(1), visible: true }]);
    const b = makeBlock([{ node: makeConst(1), visible: true }]);
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when values differ', () => {
    const a = makeBlock([{ node: makeConst(1), visible: true }]);
    const b = makeBlock([{ node: makeConst(2), visible: true }]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when visibility differs', () => {
    const a = makeBlock([{ node: makeConst(1), visible: true }]);
    const b = makeBlock([{ node: makeConst(1), visible: false }]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(makeBlock([{ node: makeConst(1) }]).equals(null)).toBe(false);
  });
});
