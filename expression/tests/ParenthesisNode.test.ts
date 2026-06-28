import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createParenthesisNode } from '../src/node/ParenthesisNode.js';
import { createOperatorNode } from '../src/node/OperatorNode.js';
import type { MathNode } from '../src/node/Node.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
};

const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const ParenthesisNode = createParenthesisNode({ Node });
const _OperatorNode = createOperatorNode({ Node });

function makeConst(v: unknown) {
  return new ConstantNode(v);
}

function makeParen(content: MathNode) {
  return new ParenthesisNode(content);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ParenthesisNode - construction & identity', () => {
  it('stores content', () => {
    const inner = makeConst(42);
    const node = makeParen(inner);
    expect(node.content).toBe(inner);
  });

  it('has correct type', () => {
    expect(makeParen(makeConst(1)).type).toBe('ParenthesisNode');
  });

  it('has isParenthesisNode = true', () => {
    expect(makeParen(makeConst(1)).isParenthesisNode).toBe(true);
  });

  it('has isNode = true', () => {
    expect((makeParen(makeConst(1)) as unknown as { isNode: boolean }).isNode).toBe(true);
  });

  it('throws when content is not a node', () => {
    expect(() => makeParen(42 as unknown as MathNode)).toThrow(
      'Node expected for parameter "content"'
    );
  });
});

describe('ParenthesisNode - _compile', () => {
  const math = mathScope;
  const argNames = {};

  it('delegates to content compile', () => {
    const inner = makeConst(99);
    const node = makeParen(inner);
    const fn = node._compile(math, argNames);
    expect(fn(new Map(), {}, null)).toBe(99);
  });

  it('works with nested parentheses', () => {
    const inner = makeConst(5);
    const node = makeParen(makeParen(inner));
    const fn = node._compile(math, argNames);
    expect(fn(new Map(), {}, null)).toBe(5);
  });
});

describe('ParenthesisNode - getContent', () => {
  it('returns the inner content (unwraps one level)', () => {
    const inner = makeConst(7);
    const node = makeParen(inner);
    expect(node.getContent()).toBe(inner);
  });

  it('unwraps multiple levels of parentheses', () => {
    const inner = makeConst(7);
    const node = makeParen(makeParen(makeParen(inner)));
    expect(node.getContent()).toBe(inner);
  });
});

describe('ParenthesisNode - forEach', () => {
  it('calls callback once for the content with path "content"', () => {
    const inner = makeConst(3);
    const node = makeParen(inner);
    const visited: Array<{ child: MathNode; path: string }> = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(1);
    expect(visited[0].child).toBe(inner);
    expect(visited[0].path).toBe('content');
  });
});

describe('ParenthesisNode - map', () => {
  it('maps callback over content and returns new ParenthesisNode', () => {
    const inner = makeConst(1);
    const node = makeParen(inner);
    const replacement = makeConst(99);
    const mapped = node.map((_child, _path, _parent) => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.content).toBe(replacement);
    expect(mapped.isParenthesisNode).toBe(true);
  });
});

describe('ParenthesisNode - clone', () => {
  it('creates a shallow copy with same content ref', () => {
    const inner = makeConst(5);
    const node = makeParen(inner);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.content).toBe(inner);
    expect(cloned.isParenthesisNode).toBe(true);
  });
});

describe('ParenthesisNode - toString', () => {
  it('wraps content in parentheses by default (keep mode)', () => {
    const node = makeParen(makeConst(7));
    expect(node.toString()).toBe('(7)');
  });

  it('wraps content in parentheses when parenthesis = "keep"', () => {
    const node = makeParen(makeConst(3));
    expect(node.toString({ parenthesis: 'keep' })).toBe('(3)');
  });

  it('does not wrap when parenthesis = "auto"', () => {
    const node = makeParen(makeConst(3));
    expect(node.toString({ parenthesis: 'auto' })).toBe('3');
  });

  it('does not wrap when parenthesis = "all"', () => {
    // In 'all' mode, the OperatorNode adds outer parens, but ParenthesisNode itself
    // defers to content when not in "keep" mode
    const node = makeParen(makeConst(3));
    expect(node.toString({ parenthesis: 'all' })).toBe('3');
  });
});

describe('ParenthesisNode - toHTML', () => {
  it('wraps in parenthesis span by default', () => {
    const node = makeParen(makeConst(7));
    const html = node.toHTML();
    expect(html).toContain('math-round-parenthesis');
    expect(html).toContain('(');
    expect(html).toContain(')');
  });

  it('does not wrap when parenthesis = "auto"', () => {
    const node = makeParen(makeConst(3));
    const html = node.toHTML({ parenthesis: 'auto' });
    expect(html).not.toContain('math-round-parenthesis');
  });
});

describe('ParenthesisNode - toTex', () => {
  it('wraps in \\left( \\right) by default', () => {
    const node = makeParen(makeConst(5));
    const tex = node.toTex();
    expect(tex).toContain('\\left(');
    expect(tex).toContain('\\right)');
  });

  it('does not wrap when parenthesis = "auto"', () => {
    const node = makeParen(makeConst(5));
    const tex = node.toTex({ parenthesis: 'auto' });
    expect(tex).not.toContain('\\left(');
  });
});

describe('ParenthesisNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const inner = makeConst(7);
    const node = makeParen(inner);
    const json = node.toJSON();
    expect(json.mathjs).toBe('ParenthesisNode');
    expect(json.content).toBe(inner);
  });

  it('fromJSON creates a node', () => {
    const inner = makeConst(3);
    const node = ParenthesisNode.fromJSON({ content: inner });
    expect(node.isParenthesisNode).toBe(true);
    expect(node.content).toBe(inner);
  });
});

describe('ParenthesisNode - equals', () => {
  it('equal when content is equal', () => {
    const a = makeParen(makeConst(5));
    const b = makeParen(makeConst(5));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when content differs', () => {
    const a = makeParen(makeConst(5));
    const b = makeParen(makeConst(6));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(makeParen(makeConst(1)).equals(null)).toBe(false);
  });
});

describe('ParenthesisNode - traverse', () => {
  it('visits root and inner content', () => {
    const inner = makeConst(1);
    const node = makeParen(inner);
    const visited: MathNode[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(2);
    expect(visited[0]).toBe(node);
    expect(visited[1]).toBe(inner);
  });
});
