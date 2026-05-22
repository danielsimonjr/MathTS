import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createConditionalNode } from '../src/node/ConditionalNode.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathWithTransform: Record<string, any> = {};
const Node = createNode({ mathWithTransform });
const isBounded = (v: any): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const ConditionalNode = createConditionalNode({ Node });

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: any) {
  return new ConstantNode(v);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConditionalNode - construction & identity', () => {
  it('stores condition, trueExpr, falseExpr', () => {
    const cond = makeConst(true);
    const yes = makeConst('yes');
    const no = makeConst('no');
    const node = new ConditionalNode(cond, yes, no);
    expect(node.condition).toBe(cond);
    expect(node.trueExpr).toBe(yes);
    expect(node.falseExpr).toBe(no);
  });

  it('has correct type property', () => {
    expect(new ConditionalNode(makeConst(1), makeConst(2), makeConst(3)).type).toBe(
      'ConditionalNode'
    );
  });

  it('has isConditionalNode = true', () => {
    expect(new ConditionalNode(makeConst(1), makeConst(2), makeConst(3)).isConditionalNode).toBe(
      true
    );
  });

  it('static name is ConditionalNode', () => {
    expect((ConditionalNode as any).name).toBe('ConditionalNode');
  });

  it('throws when condition is not a Node', () => {
    expect(() => new ConditionalNode(42 as any, makeConst(1), makeConst(2))).toThrow(
      'Parameter condition must be a Node'
    );
  });

  it('throws when trueExpr is not a Node', () => {
    expect(() => new ConditionalNode(makeConst(1), 'yes' as any, makeConst(2))).toThrow(
      'Parameter trueExpr must be a Node'
    );
  });

  it('throws when falseExpr is not a Node', () => {
    expect(() => new ConditionalNode(makeConst(1), makeConst(2), null as any)).toThrow(
      'Parameter falseExpr must be a Node'
    );
  });
});

describe('ConditionalNode - _compile (condition branching)', () => {
  const math = {};

  it('evaluates trueExpr when condition is true', () => {
    const node = new ConditionalNode(makeConst(true), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('yes');
  });

  it('evaluates falseExpr when condition is false', () => {
    const node = new ConditionalNode(makeConst(false), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('no');
  });

  it('treats 0 as false', () => {
    const node = new ConditionalNode(makeConst(0), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('no');
  });

  it('treats nonzero number as true', () => {
    const node = new ConditionalNode(makeConst(42), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('yes');
  });

  it('treats empty string as false', () => {
    const node = new ConditionalNode(makeConst(''), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('no');
  });

  it('treats nonempty string as true', () => {
    const node = new ConditionalNode(makeConst('x'), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('yes');
  });

  it('treats null as false', () => {
    const node = new ConditionalNode(makeConst(null), makeConst('yes'), makeConst('no'));
    const fn = node._compile(math, {});
    expect(fn(new Map(), {}, null)).toBe('no');
  });
});

describe('ConditionalNode - forEach', () => {
  it('calls callback for condition, trueExpr, falseExpr', () => {
    const cond = makeConst(true);
    const yes = makeConst('yes');
    const no = makeConst('no');
    const node = new ConditionalNode(cond, yes, no);
    const visited: { child: any; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(3);
    expect(visited[0].child).toBe(cond);
    expect(visited[0].path).toBe('condition');
    expect(visited[1].child).toBe(yes);
    expect(visited[1].path).toBe('trueExpr');
    expect(visited[2].child).toBe(no);
    expect(visited[2].path).toBe('falseExpr');
  });
});

describe('ConditionalNode - map', () => {
  it('returns a new ConditionalNode with mapped children', () => {
    const cond = makeConst(1);
    const yes = makeConst(2);
    const no = makeConst(3);
    const node = new ConditionalNode(cond, yes, no);
    const replacement = makeConst(99);
    const mapped = node.map(() => replacement);
    expect(mapped).not.toBe(node);
    expect(mapped.isConditionalNode).toBe(true);
    expect(mapped.condition).toBe(replacement);
    expect(mapped.trueExpr).toBe(replacement);
    expect(mapped.falseExpr).toBe(replacement);
  });

  it('throws if callback returns non-Node', () => {
    const node = new ConditionalNode(makeConst(1), makeConst(2), makeConst(3));
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('ConditionalNode - clone', () => {
  it('creates a shallow copy', () => {
    const cond = makeConst(true);
    const yes = makeConst('yes');
    const no = makeConst('no');
    const node = new ConditionalNode(cond, yes, no);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isConditionalNode).toBe(true);
    expect(cloned.condition).toBe(cond);
    expect(cloned.trueExpr).toBe(yes);
    expect(cloned.falseExpr).toBe(no);
  });
});

describe('ConditionalNode - toString', () => {
  it('formats as "condition ? trueExpr : falseExpr"', () => {
    const node = new ConditionalNode(makeConst(1), makeConst(2), makeConst(3));
    const str = node.toString();
    expect(str).toContain('?');
    expect(str).toContain(':');
    expect(str).toContain('1');
    expect(str).toContain('2');
    expect(str).toContain('3');
  });
});

describe('ConditionalNode - toHTML', () => {
  it('includes conditional operator spans', () => {
    const node = new ConditionalNode(makeConst(true), makeConst(1), makeConst(0));
    const html = node.toHTML();
    expect(html).toContain('math-conditional-operator');
    expect(html).toContain('?');
    expect(html).toContain(':');
  });
});

describe('ConditionalNode - toTex', () => {
  it('uses cases environment for LaTeX', () => {
    const node = new ConditionalNode(makeConst(1), makeConst(2), makeConst(3));
    const tex = node.toTex();
    expect(tex).toContain('\\begin{cases}');
    expect(tex).toContain('\\end{cases}');
    expect(tex).toContain('\\text{if }');
    expect(tex).toContain('otherwise');
  });
});

describe('ConditionalNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const cond = makeConst(true);
    const yes = makeConst(1);
    const no = makeConst(0);
    const node = new ConditionalNode(cond, yes, no);
    const json = node.toJSON();
    expect(json.mathjs).toBe('ConditionalNode');
    expect(json.condition).toBe(cond);
    expect(json.trueExpr).toBe(yes);
    expect(json.falseExpr).toBe(no);
  });

  it('fromJSON creates a node', () => {
    const cond = makeConst(true);
    const yes = makeConst('a');
    const no = makeConst('b');
    const node = ConditionalNode.fromJSON({ condition: cond, trueExpr: yes, falseExpr: no });
    expect(node.isConditionalNode).toBe(true);
    expect(node.condition).toBe(cond);
  });
});

describe('ConditionalNode - equals', () => {
  it('equal nodes', () => {
    const a = new ConditionalNode(makeConst(true), makeConst(1), makeConst(0));
    const b = new ConditionalNode(makeConst(true), makeConst(1), makeConst(0));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when condition differs', () => {
    const a = new ConditionalNode(makeConst(true), makeConst(1), makeConst(0));
    const b = new ConditionalNode(makeConst(false), makeConst(1), makeConst(0));
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new ConditionalNode(makeConst(1), makeConst(2), makeConst(3)).equals(null)).toBe(false);
  });
});

describe('ConditionalNode - traverse', () => {
  it('visits root and all three children', () => {
    const cond = makeConst(1);
    const yes = makeConst(2);
    const no = makeConst(3);
    const node = new ConditionalNode(cond, yes, no);
    const visited: any[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(4);
    expect(visited[0]).toBe(node);
    expect(visited.includes(cond)).toBe(true);
    expect(visited.includes(yes)).toBe(true);
    expect(visited.includes(no)).toBe(true);
  });
});
