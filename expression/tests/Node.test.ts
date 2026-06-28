import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import type { MathNode, StringOptions } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createOperatorNode } from '../src/node/OperatorNode.js';
import { createParenthesisNode } from '../src/node/ParenthesisNode.js';

/**
 * White-box view of the subtype fields read off base `MathNode` values in these
 * tests (the base node type does not carry subtype fields, so they are declared
 * here as optional and accessed via a structural cast).
 */
interface NodeView {
  isConstantNode?: boolean;
  value?: unknown;
  args?: MathNode[];
}

// ─── Bootstrap the factory chain ──────────────────────────────────────────────

const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
  pi: Math.PI,
};

const Node = createNode({ mathWithTransform: mathScope });
const ConstantNode = createConstantNode({
  Node,
  isBounded: (v: unknown) => isFinite(v as number),
});
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const OperatorNode = createOperatorNode({ Node });
const _ParenthesisNode = createParenthesisNode({ Node });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConst(v: unknown) {
  return new ConstantNode(v);
}

function makeAdd(a: MathNode, b: MathNode) {
  return new OperatorNode('+', 'add', [a, b]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Node - type flags', () => {
  it('should report isNode true on Node instances', () => {
    const c = makeConst(1);
    expect(c.isNode).toBe(true);
  });

  it('should report correct type for ConstantNode', () => {
    expect(makeConst(1).type).toBe('ConstantNode');
  });

  it('should report correct type for OperatorNode', () => {
    const op = makeAdd(makeConst(1), makeConst(2));
    expect(op.type).toBe('OperatorNode');
  });
});

describe('Node - _compile must be implemented', () => {
  it('base Node._compile throws', () => {
    // Create a raw Node directly (it's an abstract base)
    const n = Object.create(Node.prototype) as MathNode;
    expect(() => n._compile({}, {})).toThrow('Method _compile must be implemented');
  });
});

describe('Node - forEach must be implemented', () => {
  it('base Node.forEach throws', () => {
    const n = Object.create(Node.prototype) as MathNode;
    expect(() => n.forEach(() => {})).toThrow('Cannot run forEach on a Node interface');
  });
});

describe('Node - map must be implemented', () => {
  it('base Node.map throws', () => {
    const n = Object.create(Node.prototype) as MathNode;
    expect(() => n.map((x: MathNode) => x)).toThrow('Cannot run map on a Node interface');
  });
});

describe('Node - clone must be implemented', () => {
  it('base Node.clone throws', () => {
    const n = Object.create(Node.prototype) as MathNode;
    expect(() => n.clone()).toThrow('Cannot clone a Node interface');
  });
});

describe('Node - traverse', () => {
  it('should call callback with the root node first', () => {
    const c = makeConst(42);
    const visited: { node: MathNode; path: string | null; parent: MathNode | null }[] = [];
    c.traverse((node: MathNode, path: string | null, parent: MathNode | null) => {
      visited.push({ node, path, parent });
    });
    expect(visited.length).toBeGreaterThan(0);
    expect(visited[0].node).toBe(c);
    expect(visited[0].path).toBeNull();
    expect(visited[0].parent).toBeNull();
  });

  it('should visit all children of an operator node', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    const op = makeAdd(a, b);
    const visited: MathNode[] = [];
    op.traverse((node: MathNode) => {
      visited.push(node);
    });
    // root + two children
    expect(visited.length).toBe(3);
    expect(visited[0]).toBe(op);
    expect(visited.some((n: MathNode) => n === a)).toBe(true);
    expect(visited.some((n: MathNode) => n === b)).toBe(true);
  });
});

describe('Node - filter', () => {
  it('should find nodes matching a predicate', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    const op = makeAdd(a, b);
    const constants = op.filter((n: NodeView) => n.isConstantNode === true);
    expect(constants.length).toBe(2);
  });

  it('should include root if it matches', () => {
    const c = makeConst(99);
    const found = c.filter((n: NodeView) => n.isConstantNode === true);
    expect(found.length).toBe(1);
    expect(found[0]).toBe(c);
  });

  it('should return empty array if nothing matches', () => {
    const c = makeConst(1);
    const found = c.filter((n: MathNode) => n.type === 'SymbolNode');
    expect(found).toEqual([]);
  });
});

describe('Node - transform', () => {
  it('should return an equal tree when callback returns the node unchanged', () => {
    const c = makeConst(5);
    const result = c.transform((n: MathNode) => n);
    // transform recurses via map(), which rebuilds nodes — identity is not
    // preserved, but the result is structurally equal.
    expect(result.equals(c)).toBe(true);
  });

  it('should replace nodes when callback returns a different node', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    const op = makeAdd(a, b);
    // Replace the first constant with a constant holding 99
    const replacement = makeConst(99);
    const result = op.transform((n: MathNode) => {
      const nv = n as unknown as NodeView;
      if (nv.isConstantNode && nv.value === 1) return replacement;
      return n;
    });
    // The replacement is returned as-is; the unchanged arg is rebuilt by map()
    // so it is structurally equal but not identical.
    const resultView = result as unknown as NodeView;
    expect(resultView.args![0]).toBe(replacement);
    expect(resultView.args![1].equals(b)).toBe(true);
  });
});

describe('Node - equals', () => {
  it('should return true for equal ConstantNodes', () => {
    const a = makeConst(42);
    const b = makeConst(42);
    expect(a.equals(b)).toBe(true);
  });

  it('should return false for different ConstantNodes', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    expect(a.equals(b)).toBe(false);
  });

  it('should return false when comparing with null', () => {
    const a = makeConst(1);
    expect(a.equals(null)).toBe(false);
  });

  it('should return false when comparing with undefined', () => {
    const a = makeConst(1);
    expect(a.equals(undefined)).toBe(false);
  });

  it('should return false when types differ', () => {
    const c = makeConst(1);
    const s = new SymbolNode('x');
    expect(c.equals(s)).toBe(false);
  });
});

describe('Node - cloneDeep', () => {
  it('should produce a structurally equal but distinct tree', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    const op = makeAdd(a, b);
    const deep = op.cloneDeep();
    expect(deep).not.toBe(op);
    expect(deep.equals(op)).toBe(true);
  });
});

describe('Node - getContent', () => {
  it('should return itself for a non-parenthesis node', () => {
    const c = makeConst(5);
    expect(c.getContent()).toBe(c);
  });
});

describe('Node - getIdentifier', () => {
  it('should return the type by default', () => {
    const c = makeConst(5);
    expect(c.getIdentifier()).toBe('ConstantNode');
  });
});

describe('Node - toString with custom handler', () => {
  it('should call a custom handler function', () => {
    const c = makeConst(7);
    const result = c.toString({
      handler: (_node: MathNode) => 'custom',
    });
    expect(result).toBe('custom');
  });

  it('should throw for non-function, non-object handler', () => {
    const c = makeConst(7);
    expect(() => c.toString({ handler: 123 } as unknown as StringOptions)).toThrow();
  });
});

describe('Node - toJSON must be implemented', () => {
  it('base Node.toJSON throws', () => {
    const n = Object.create(Node.prototype) as MathNode;
    expect(() => n.toJSON()).toThrow('toJSON not implemented');
  });
});

describe('Node - _ifNode', () => {
  it('should throw if callback returns non-node', () => {
    const a = makeConst(1);
    const b = makeConst(2);
    const op = makeAdd(a, b);
    expect(() => op.map((_child: MathNode) => ({ notANode: true }) as unknown as MathNode)).toThrow(
      'Callback function must return a Node'
    );
  });
});
