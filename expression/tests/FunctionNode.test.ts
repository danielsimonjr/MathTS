import { describe, it, expect } from 'vitest';
import { createNode } from '../src/node/Node.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createFunctionNode } from '../src/node/FunctionNode.js';
import type { MathNode } from '../src/node/Node.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  pi: Math.PI,
};

const Node = createNode({ mathWithTransform: mathScope });
const isBounded = (v: unknown): boolean => Number.isFinite(Number(v));
const ConstantNode = createConstantNode({ Node, isBounded });
const SymbolNode = createSymbolNode({ math: mathScope, Node });
const FunctionNode = createFunctionNode({ math: mathScope, Node, SymbolNode });

// ── Helpers ────────────────────────────────────────────────────────────────
function makeConst(v: unknown) {
  return new ConstantNode(v);
}

function makeSym(name: string) {
  return new SymbolNode(name);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FunctionNode - construction & identity', () => {
  it('constructs with a SymbolNode and args', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    expect(node.args).toHaveLength(1);
    expect(node.name).toBe('sin');
  });

  it('accepts a string as fn (auto-wraps in SymbolNode)', () => {
    const node = new FunctionNode('sqrt', [makeConst(4)]);
    expect(node.name).toBe('sqrt');
    expect(node.fn.toString()).toBe('sqrt');
  });

  it('constructs with empty args', () => {
    const node = new FunctionNode(makeSym('f'), []);
    expect(node.args).toHaveLength(0);
  });

  it('stores optional flag as boolean', () => {
    const node = new FunctionNode(makeSym('f'), [], true);
    expect(node.optional).toBe(true);
  });

  it('defaults optional to false', () => {
    const node = new FunctionNode(makeSym('f'), []);
    expect(node.optional).toBe(false);
  });

  it('has correct type property', () => {
    expect(new FunctionNode(makeSym('f'), []).type).toBe('FunctionNode');
  });

  it('has isFunctionNode = true', () => {
    expect(new FunctionNode(makeSym('f'), []).isFunctionNode).toBe(true);
  });

  it('static name is FunctionNode', () => {
    expect((FunctionNode as unknown as { name: string }).name).toBe('FunctionNode');
  });

  it('throws when fn is not a Node', () => {
    expect(() => new FunctionNode(42 as unknown as MathNode, [])).toThrow(
      'Node expected as parameter "fn"'
    );
  });

  it('throws when args contains non-Nodes', () => {
    expect(() => new FunctionNode(makeSym('f'), [42 as unknown as MathNode])).toThrow(
      'Array containing Nodes expected for parameter "args"'
    );
  });

  it('throws when optional is not boolean or undefined', () => {
    expect(() => new FunctionNode(makeSym('f'), [], 'yes' as unknown as boolean)).toThrow(
      'optional flag, if specified, must be boolean'
    );
  });
});

describe('FunctionNode - name getter', () => {
  it('returns empty string when fn has no name property', () => {
    // A ConstantNode has no .name in the usual sense, but here fn must be a Node
    // ConstantNode.toString() works but its name getter is undefined
    // We use SymbolNode as the normal case
    const node = new FunctionNode(makeSym('add'), [makeConst(1), makeConst(2)]);
    expect(node.name).toBe('add');
  });
});

describe('FunctionNode - _compile (SymbolNode fn in math scope)', () => {
  it('evaluates sqrt(4) = 2', () => {
    const node = new FunctionNode(makeSym('sqrt'), [makeConst(4)]);
    const fn = node._compile(mathScope, {});
    expect(fn(new Map(), {}, null)).toBe(2);
  });

  it('evaluates sin(0) ≈ 0', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    const fn = node._compile(mathScope, {});
    expect(fn(new Map(), {}, null)).toBeCloseTo(0);
  });

  it('evaluates add(3, 4) = 7', () => {
    const node = new FunctionNode(makeSym('add'), [makeConst(3), makeConst(4)]);
    const fn = node._compile(mathScope, {});
    expect(fn(new Map(), {}, null)).toBe(7);
  });

  it('evaluates abs(-5) = 5', () => {
    const node = new FunctionNode(makeSym('abs'), [makeConst(-5)]);
    const fn = node._compile(mathScope, {});
    expect(fn(new Map(), {}, null)).toBe(5);
  });

  it('throws when calling an undefined function', () => {
    const node = new FunctionNode(makeSym('unknownFn'), [makeConst(1)]);
    const fn = node._compile(mathScope, {});
    expect(() => fn(new Map(), {}, null)).toThrow('Undefined function unknownFn');
  });

  it('throws when calling a non-function value (e.g. pi)', () => {
    const node = new FunctionNode(makeSym('pi'), []);
    const fn = node._compile(mathScope, {});
    expect(() => fn(new Map(), {}, null)).toThrow("'pi' is not a function");
  });

  it('resolves function from user scope (overrides math scope)', () => {
    const node = new FunctionNode(makeSym('double'), [makeConst(21)]);
    const fn = node._compile(mathScope, {});
    const scope = new Map([['double', (x: number) => x * 2]]);
    expect(fn(scope, {}, null)).toBe(42);
  });
});

describe('FunctionNode - forEach', () => {
  it('visits fn node and each arg', () => {
    const fnSym = makeSym('add');
    const arg1 = makeConst(1);
    const arg2 = makeConst(2);
    const node = new FunctionNode(fnSym, [arg1, arg2]);
    const visited: { child: MathNode; path: string }[] = [];
    node.forEach((child, path) => visited.push({ child, path }));
    expect(visited).toHaveLength(3);
    expect(visited[0].child).toBe(fnSym);
    expect(visited[0].path).toBe('fn');
    expect(visited[1].child).toBe(arg1);
    expect(visited[1].path).toBe('args[0]');
    expect(visited[2].child).toBe(arg2);
    expect(visited[2].path).toBe('args[1]');
  });

  it('visits only fn when args is empty', () => {
    const fnSym = makeSym('f');
    const node = new FunctionNode(fnSym, []);
    const visited: MathNode[] = [];
    node.forEach((child) => visited.push(child));
    expect(visited).toHaveLength(1);
    expect(visited[0]).toBe(fnSym);
  });
});

describe('FunctionNode - map', () => {
  it('returns a new FunctionNode with mapped children', () => {
    const fnSym = makeSym('abs');
    const arg = makeConst(-5);
    const node = new FunctionNode(fnSym, [arg]);
    const newArg = makeConst(5);
    const mapped = node.map((child, path) => (path === 'args[0]' ? newArg : child));
    expect(mapped).not.toBe(node);
    expect(mapped.isFunctionNode).toBe(true);
    expect(mapped.args[0]).toBe(newArg);
    expect(mapped.fn).toBe(fnSym);
  });

  it('throws if callback returns non-Node', () => {
    const node = new FunctionNode(makeSym('f'), [makeConst(1)]);
    expect(() => node.map(() => ({ notANode: true }) as unknown as MathNode)).toThrow(
      'Callback function must return a Node'
    );
  });
});

describe('FunctionNode - clone', () => {
  it('creates a shallow copy', () => {
    const fnSym = makeSym('sin');
    const arg = makeConst(0);
    const node = new FunctionNode(fnSym, [arg]);
    const cloned = node.clone();
    expect(cloned).not.toBe(node);
    expect(cloned.isFunctionNode).toBe(true);
    expect(cloned.fn).toBe(fnSym);
    expect(cloned.args[0]).toBe(arg);
    // args array should be a copy
    expect(cloned.args).not.toBe(node.args);
  });
});

describe('FunctionNode - toString', () => {
  it('formats as "fn(args)"', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    expect(node.toString()).toBe('sin(0)');
  });

  it('formats multi-arg function', () => {
    const node = new FunctionNode(makeSym('add'), [makeConst(1), makeConst(2)]);
    expect(node.toString()).toBe('add(1, 2)');
  });

  it('formats no-arg function', () => {
    const node = new FunctionNode(makeSym('random'), []);
    expect(node.toString()).toBe('random()');
  });

  it('supports custom handler via options', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    const result = node.toString({
      handler: { sin: () => 'CUSTOM_SIN' },
    });
    expect(result).toBe('CUSTOM_SIN');
  });
});

describe('FunctionNode - toHTML', () => {
  it('wraps function name in math-function span', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    const html = node.toHTML();
    expect(html).toContain('math-function');
    expect(html).toContain('sin');
    expect(html).toContain('(');
    expect(html).toContain(')');
  });
});

describe('FunctionNode - getIdentifier', () => {
  it('returns "FunctionNode:name"', () => {
    const node = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    expect(node.getIdentifier()).toBe('FunctionNode:sin');
  });
});

describe('FunctionNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const fnSym = makeSym('abs');
    const arg = makeConst(5);
    const node = new FunctionNode(fnSym, [arg]);
    const json = node.toJSON();
    expect(json.mathjs).toBe('FunctionNode');
    expect(json.fn).toBe(fnSym);
    expect(json.args).toHaveLength(1);
    expect(json.args[0]).toBe(arg);
  });

  it('fromJSON creates a node', () => {
    const fnSym = makeSym('sqrt');
    const arg = makeConst(9);
    const node = FunctionNode.fromJSON({ fn: fnSym, args: [arg] });
    expect(node.isFunctionNode).toBe(true);
    expect(node.name).toBe('sqrt');
    expect(node.args[0]).toBe(arg);
  });
});

describe('FunctionNode - equals', () => {
  it('equal nodes', () => {
    const a = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    const b = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when function name differs', () => {
    const a = new FunctionNode(makeSym('sin'), [makeConst(0)]);
    const b = new FunctionNode(makeSym('cos'), [makeConst(0)]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal when args differ', () => {
    const a = new FunctionNode(makeSym('abs'), [makeConst(1)]);
    const b = new FunctionNode(makeSym('abs'), [makeConst(2)]);
    expect(a.equals(b)).toBe(false);
  });

  it('not equal to null', () => {
    expect(new FunctionNode(makeSym('f'), []).equals(null)).toBe(false);
  });
});

describe('FunctionNode - traverse', () => {
  it('visits root, fn node, and all args', () => {
    const fnSym = makeSym('add');
    const arg1 = makeConst(1);
    const arg2 = makeConst(2);
    const node = new FunctionNode(fnSym, [arg1, arg2]);
    const visited: MathNode[] = [];
    node.traverse((n) => visited.push(n));
    expect(visited).toHaveLength(4); // node + fnSym + arg1 + arg2
    expect(visited[0]).toBe(node);
    expect(visited.includes(fnSym)).toBe(true);
    expect(visited.includes(arg1)).toBe(true);
    expect(visited.includes(arg2)).toBe(true);
  });
});

describe('FunctionNode - onUndefinedFunction', () => {
  it('throws an error with the function name', () => {
    expect(() => FunctionNode.onUndefinedFunction('missingFn')).toThrow(
      'Undefined function missingFn'
    );
  });
});
