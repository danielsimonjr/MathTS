import { describe, it, expect } from 'vitest';
import { math } from './helpers/bootstrap.js';
import { createFunctionNode } from '../src/node/FunctionNode.js';
import { createNode } from '../src/node/Node.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createAccessorNode } from '../src/node/AccessorNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';
import { createParenthesisNode } from '../src/node/ParenthesisNode.js';
import { createFunctionAssignmentNode } from '../src/node/FunctionAssignmentNode.js';

/**
 * Coverage tests for the *source* `expression/src/node/FunctionNode.ts`.
 *
 * Coverage is measured against the source files, not the bundled dist that
 * `parse()` runs. So we build the real node constructors from source, wired to
 * the fully-populated math scope from the functions package (it provides
 * `subset`, `size`, `typed`, and every math function used by `_compile`/`_toTex`).
 */
const isBounded = (v: any): boolean => Number.isFinite(Number(v));

function buildNodes(customMath: Record<string, any>) {
  const Node = createNode({ mathWithTransform: customMath });
  const SymbolNode = createSymbolNode({ math: customMath, Node });
  const ConstantNode = createConstantNode({ Node, isBounded });
  const FunctionNode = createFunctionNode({ math: customMath, Node, SymbolNode });
  const AccessorNode = createAccessorNode({ subset: customMath.subset, Node });
  const IndexNode = createIndexNode({ Node, size: customMath.size });
  const ParenthesisNode = createParenthesisNode({ Node });
  const FunctionAssignmentNode = createFunctionAssignmentNode({
    typed: customMath.typed,
    Node,
  });
  return {
    Node,
    SymbolNode,
    ConstantNode,
    FunctionNode,
    AccessorNode,
    IndexNode,
    ParenthesisNode,
    FunctionAssignmentNode,
  };
}

// Default node-set wired to the real, full math scope.
const N = buildNodes(math);
const { SymbolNode, ConstantNode, FunctionNode, AccessorNode, IndexNode, ParenthesisNode } = N;

const c = (v: any) => new ConstantNode(v);
const s = (name: string) => new SymbolNode(name);
const fn = (name: string, args: any[]) => new FunctionNode(s(name), args);

// ── toTex via real latexFunctions table ───────────────────────────────────────

describe('FunctionNode - toTex (real latex templates)', () => {
  it('renders sin via object-of-converters template (\\sin)', () => {
    expect(fn('sin', [s('x')]).toTex()).toContain('\\sin');
  });

  it('renders sqrt via object template (\\sqrt)', () => {
    expect(fn('sqrt', [s('x')]).toTex()).toContain('\\sqrt');
  });

  it('renders add via object template with operator', () => {
    expect(fn('add', [s('a'), s('b')]).toTex()).toContain('+');
  });

  it('renders pow via object template with ^', () => {
    expect(fn('pow', [s('a'), s('b')]).toTex()).toContain('^');
  });

  it('renders abs via object template with \\left|', () => {
    expect(fn('abs', [s('x')]).toTex()).toContain('\\left|');
  });

  it('renders max via string template (\\max, ${args} join)', () => {
    expect(fn('max', [s('a'), s('b'), s('c')]).toTex()).toContain('\\max');
  });

  it('falls back to \\mathrm{} default template for unknown function', () => {
    expect(fn('foobar', [s('x'), s('y')]).toTex()).toContain('\\mathrm{foobar}');
  });

  it('uses numeric() latex function (a plain function converter)', () => {
    const tex = fn('numeric', [c(3)]).toTex();
    expect(tex).toBeTypeOf('string');
    expect(tex.length).toBeGreaterThan(0);
  });

  it('log uses arg-count-keyed object template (1 vs 2 args)', () => {
    expect(fn('log', [s('x')]).toTex()).toContain('\\ln');
    expect(fn('log', [s('x'), c(2)]).toTex()).toContain('\\log');
  });
});

// ── custom handler paths ──────────────────────────────────────────────────────

describe('FunctionNode - custom handler', () => {
  it('toTex honors a custom handler map', () => {
    expect(fn('f', [s('x')]).toTex({ handler: { f: () => 'CUSTOM' } })).toBe('CUSTOM');
  });

  it('toString honors a custom handler map', () => {
    expect(fn('g', [s('x')]).toString({ handler: { g: () => 'GSTR' } })).toBe('GSTR');
  });

  it('toTex falls through to default when handler returns undefined', () => {
    expect(fn('sin', [s('x')]).toTex({ handler: { sin: () => undefined } })).toContain('\\sin');
  });

  it('toString falls through when handler returns undefined', () => {
    expect(fn('sin', [s('x')]).toString({ handler: { sin: () => undefined } })).toBe('sin(x)');
  });
});

// ── expandTemplate via custom math toTex string templates ─────────────────────

describe('FunctionNode - _toTex / expandTemplate (custom math)', () => {
  it('expands a string template with ${args[0]}', () => {
    const m = { ...math, myfn: Object.assign((x: number) => x, { toTex: '\\myfn\\left(${args[0]}\\right)' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('myfn'), [new b.ConstantNode(2)]);
    const tex = node.toTex();
    expect(tex).toContain('\\myfn');
    expect(tex).toContain('2');
  });

  it('expands a string template with ${args} array join and $$ escape', () => {
    const m = {
      ...math,
      joiner: Object.assign((...a: number[]) => a.length, { toTex: 'J[$$]\\{${args}\\}' }),
    };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('joiner'), [
      new b.ConstantNode(1),
      new b.ConstantNode(2),
    ]);
    const tex = node.toTex();
    expect(tex).toContain('J[');
    expect(tex).toContain('$');
    expect(tex).toContain('1');
    expect(tex).toContain('2');
  });

  it('uses a function-form toTex converter on the math entry', () => {
    const m = {
      ...math,
      fnconv: Object.assign((x: number) => x, {
        toTex: (node: any) => 'FNCONV(' + node.args.length + ')',
      }),
    };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('fnconv'), [new b.ConstantNode(5)]);
    expect(node.toTex()).toBe('FNCONV(1)');
  });

  it('uses an object-form toTex converter keyed by arg count (string entry)', () => {
    const m = {
      ...math,
      objconv: Object.assign((x: number, y: number) => x + y, {
        toTex: { 1: 'ONE(${args[0]})', 2: 'TWO(${args[0]},${args[1]})' },
      }),
    };
    const b = buildNodes(m);
    const one = new b.FunctionNode(new b.SymbolNode('objconv'), [new b.ConstantNode(7)]);
    expect(one.toTex()).toContain('ONE(');
    const two = new b.FunctionNode(new b.SymbolNode('objconv'), [
      new b.ConstantNode(3),
      new b.ConstantNode(4),
    ]);
    expect(two.toTex()).toContain('TWO(');
  });

  it('uses an object-form toTex converter with function entry per arg count', () => {
    const m = {
      ...math,
      objfn: Object.assign((x: number) => x, {
        toTex: { 1: (node: any) => 'OBJFN1[' + node.args.length + ']' },
      }),
    };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('objfn'), [new b.ConstantNode(9)]);
    expect(node.toTex()).toBe('OBJFN1[1]');
  });

  it('throws ReferenceError when template references a missing property', () => {
    const m = { ...math, bad: Object.assign((x: number) => x, { toTex: '${nope}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('bad'), [new b.ConstantNode(1)]);
    expect(() => node.toTex()).toThrow(/does not exist/);
  });

  it('throws TypeError when template property is a number (default switch case)', () => {
    const m = { ...math, badnum: Object.assign((x: number) => x, { toTex: '${myNum}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('badnum'), [new b.ConstantNode(1)]);
    (node as any).myNum = 42;
    expect(() => node.toTex()).toThrow(TypeError);
  });

  it('throws TypeError when an array template entry is not a Node', () => {
    const m = { ...math, badarr: Object.assign((x: number) => x, { toTex: '${badList}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('badarr'), [new b.ConstantNode(1)]);
    (node as any).badList = [123];
    expect(() => node.toTex()).toThrow(/is not a Node/);
  });

  it('expands an array property of Nodes into a comma-separated tex list', () => {
    const m = { ...math, listfn: Object.assign((x: number) => x, { toTex: '[${myArgs}]' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('listfn'), [new b.ConstantNode(1)]);
    (node as any).myArgs = [new b.ConstantNode(7), new b.ConstantNode(8)];
    const tex = node.toTex();
    expect(tex).toContain('7');
    expect(tex).toContain('8');
    expect(tex).toContain(',');
  });

  it('expands a single Node-valued template property to its tex', () => {
    const m = { ...math, nodeprop: Object.assign((x: number) => x, { toTex: 'NP{${myNode}}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('nodeprop'), [new b.ConstantNode(1)]);
    (node as any).myNode = new b.ConstantNode(99);
    expect(node.toTex()).toContain('99');
  });

  it('throws TypeError when a template property is a plain (non-Node) object', () => {
    const m = { ...math, objprop: Object.assign((x: number) => x, { toTex: '${myObj}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('objprop'), [new b.ConstantNode(1)]);
    (node as any).myObj = { plain: true };
    expect(() => node.toTex()).toThrow(/has to be a Node, String or array of Nodes/);
  });

  it('expands a square-bracketed template index ${prop[0]}', () => {
    const m = { ...math, idxfn: Object.assign((x: number) => x, { toTex: 'IDX{${args[0]}}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('idxfn'), [new b.ConstantNode(11)]);
    expect(node.toTex()).toContain('11');
  });

  it('throws TypeError when ${prop[0]} indexes a non-Node', () => {
    const m = { ...math, idxbad: Object.assign((x: number) => x, { toTex: '${myList[0]}' }) };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('idxbad'), [new b.ConstantNode(1)]);
    (node as any).myList = ['not-a-node'];
    expect(() => node.toTex()).toThrow(/is not a Node/);
  });
});

// ── _compile branches ─────────────────────────────────────────────────────────

describe('FunctionNode - _compile (arg count switch)', () => {
  it('compiles a 1-arg function call (sqrt(4) = 2)', () => {
    const f = fn('sqrt', [c(4)])._compile(math, {});
    expect(f(new Map(), {}, null)).toBe(2);
  });

  it('compiles a 2-arg function call (pow(2,3) = 8)', () => {
    const f = fn('pow', [c(2), c(3)])._compile(math, {});
    expect(f(new Map(), {}, null)).toBe(8);
  });

  it('compiles a >2-arg function call (max(1,2,3) = 3)', () => {
    const f = fn('max', [c(1), c(2), c(3)])._compile(math, {});
    expect(f(new Map(), {}, null)).toBe(3);
  });

  it('compiles a 0-arg function call via custom math', () => {
    const m = { ...math, nullary: () => 42 };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('nullary'), []);
    expect(node._compile(m, {})(new Map(), {}, null)).toBe(42);
  });
});

describe('FunctionNode - _compile (rawArgs)', () => {
  it('passes unevaluated nodes to a rawArgs function (static)', () => {
    const raw = Object.assign((nodes: any[]) => nodes.length, {}) as any;
    raw.rawArgs = true;
    const m = { ...math, rawfn: raw };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('rawfn'), [
      new b.ConstantNode(1),
      new b.ConstantNode(2),
    ]);
    expect(node._compile(m, {})(new Map(), {}, null)).toBe(2);
  });

  it('rawArgs function resolved from scope is invoked raw', () => {
    const raw = Object.assign((nodes: any[]) => nodes.length, {}) as any;
    raw.rawArgs = true;
    const m = { ...math, rawfn2: raw };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('rawfn2'), [new b.ConstantNode(1)]);
    const scopeRaw = Object.assign((nodes: any[]) => nodes.length * 10, {}) as any;
    scopeRaw.rawArgs = true;
    const scope = new Map<string, any>([['rawfn2', scopeRaw]]);
    expect(node._compile(m, {})(scope, {}, null)).toBe(10);
  });

  it('rawArgs static fn overridden in scope by non-raw fn evaluates regularly', () => {
    const raw = Object.assign((_nodes: any[]) => -1, {}) as any;
    raw.rawArgs = true;
    const m = { ...math, rawfn3: raw };
    const b = buildNodes(m);
    const node = new b.FunctionNode(new b.SymbolNode('rawfn3'), [new b.ConstantNode(5)]);
    const scope = new Map<string, any>([['rawfn3', (x: number) => x * 2]]);
    expect(node._compile(m, {})(scope, {}, null)).toBe(10);
  });
});

describe('FunctionNode - _compile (arg-name function)', () => {
  it('invokes a function passed via argNames (regular)', () => {
    // fn name `g` is an argName -> resolved from args, invoked with evaluated args.
    const node = fn('g', [c(2)]);
    const compiled = node._compile(math, { g: true });
    const args = { g: (x: number) => x + 100 };
    expect(compiled(new Map(), args, null)).toBe(102);
  });

  it('invokes a rawArgs function passed via argNames', () => {
    const node = fn('g', [c(2), c(3)]);
    const compiled = node._compile(math, { g: true });
    const rawG = Object.assign((nodes: any[]) => nodes.length, {}) as any;
    rawG.rawArgs = true;
    expect(compiled(new Map(), { g: rawG }, null)).toBe(2);
  });

  it('throws when arg-name value is not a function', () => {
    const node = fn('g', [c(2)]);
    const compiled = node._compile(math, { g: true });
    expect(() => compiled(new Map(), { g: 5 }, null)).toThrow(/was not a function/);
  });
});

describe('FunctionNode - _compile (optional chaining)', () => {
  it('short-circuits to undefined when optional fn symbol is undefined', () => {
    const node = new FunctionNode(s('maybeFn'), [c(2)], true);
    const compiled = node._compile(math, {});
    expect(compiled(new Map(), {}, null)).toBeUndefined();
  });
});

describe('FunctionNode - _compile (accessor fn with object property)', () => {
  it('invokes an object method resolved through getSafeMethod', () => {
    // Build fn = AccessorNode(object=SymbolNode("obj"), index=IndexNode(["method"]))
    const indexNode = new IndexNode([c('method')]);
    const accessor = new AccessorNode(s('obj'), indexNode);
    const node = new FunctionNode(accessor, [c(3)]);
    const compiled = node._compile(math, {});
    const obj = { method: (x: number) => x + 100 };
    expect(compiled(new Map([['obj', obj]]), {}, null)).toBe(103);
  });

  it('rawArgs object method is invoked raw', () => {
    const indexNode = new IndexNode([c('rawm')]);
    const accessor = new AccessorNode(s('obj'), indexNode);
    const node = new FunctionNode(accessor, [c(1), c(2)]);
    const compiled = node._compile(math, {});
    const rawm = Object.assign(function (this: any, nodes: any[]) {
      return nodes.length;
    }, {}) as any;
    rawm.rawArgs = true;
    expect(compiled(new Map([['obj', { rawm }]]), {}, null)).toBe(2);
  });

  it('optional chaining on an accessor method short-circuits when base is nullish', () => {
    const indexNode = new IndexNode([c('method')]);
    const accessor = new AccessorNode(s('obj'), indexNode);
    const node = new FunctionNode(accessor, [c(3)], true);
    const compiled = node._compile(math, {});
    expect(compiled(new Map([['obj', null]]), {}, null)).toBeUndefined();
  });
});

describe('FunctionNode - _compile (dynamically resolved fn)', () => {
  it('invokes a function produced by a parenthesised expression', () => {
    // fn = ParenthesisNode(SymbolNode("square")) -> not a SymbolNode, not an
    // object-property accessor -> dynamic resolution branch.
    const node = new FunctionNode(new ParenthesisNode(s('square')), [c(3)]);
    const compiled = node._compile(math, {});
    expect(compiled(new Map(), {}, null)).toBe(9);
  });

  it('invokes a rawArgs function produced dynamically', () => {
    // fn resolves dynamically (from scope, via a parenthesised symbol) to a
    // rawArgs function -> exercises the dynamic-branch rawArgs path.
    const node = new FunctionNode(new ParenthesisNode(s('dynraw')), [c(1), c(2)]);
    const compiled = node._compile(math, {});
    const dynraw = Object.assign((nodes: any[]) => nodes.length, {}) as any;
    dynraw.rawArgs = true;
    expect(compiled(new Map([['dynraw', dynraw]]), {}, null)).toBe(2);
  });

  it('throws when the dynamic expression is not a function', () => {
    const node = new FunctionNode(new ParenthesisNode(c(5)), [c(3)]);
    const compiled = node._compile(math, {});
    expect(() => compiled(new Map(), {}, null)).toThrow(/did not evaluate to a function/);
  });

  it('optional chaining on a dynamic fn short-circuits when undefined', () => {
    // The inner symbol resolves (from scope) to undefined; optional chaining
    // then short-circuits the outer call to undefined.
    const node = new FunctionNode(new ParenthesisNode(s('maybe')), [c(3)], true);
    const compiled = node._compile(math, {});
    expect(compiled(new Map([['maybe', undefined]]), {}, null)).toBeUndefined();
  });
});

describe('FunctionNode - _compile (errors)', () => {
  it('throws Undefined function for unknown symbol', () => {
    const node = fn('nope123', [c(1)]);
    expect(() => node._compile(math, {})(new Map(), {}, null)).toThrow(/Undefined function/);
  });

  it('throws when symbol resolves to a non-function value', () => {
    const node = fn('pi', []);
    expect(() => node._compile(math, {})(new Map(), {}, null)).toThrow(/is not a function/);
  });
});

// ── structural methods ────────────────────────────────────────────────────────

describe('FunctionNode - structural', () => {
  it('toJSON / fromJSON round-trips', () => {
    const node = fn('sqrt', [c(9)]);
    const json = node.toJSON();
    expect(json.mathjs).toBe('FunctionNode');
    const restored = FunctionNode.fromJSON(json);
    expect(restored.isFunctionNode).toBe(true);
    expect(restored.name).toBe('sqrt');
  });

  it('clone makes a shallow copy', () => {
    const node = fn('add', [c(1), c(2)]);
    const cl = node.clone();
    expect(cl).not.toBe(node);
    expect(cl.args).not.toBe(node.args);
    expect(cl.toString()).toBe(node.toString());
  });

  it('map transforms children and returns a new node', () => {
    const node = fn('abs', [c(-5)]);
    const mapped = node.map((child: any) => child);
    expect(mapped).not.toBe(node);
    expect(mapped.isFunctionNode).toBe(true);
  });

  it('map throws when callback returns a non-Node', () => {
    const node = fn('abs', [c(1)]);
    expect(() => node.map(() => ({ notANode: true }) as any)).toThrow(/must return a Node/);
  });

  it('forEach visits fn and each arg', () => {
    const node = fn('add', [c(1), c(2)]);
    const visited: string[] = [];
    node.forEach((_child: any, path: string) => visited.push(path));
    expect(visited).toEqual(['fn', 'args[0]', 'args[1]']);
  });

  it('getIdentifier returns FunctionNode:name', () => {
    expect(fn('sin', [s('x')]).getIdentifier()).toBe('FunctionNode:sin');
  });

  it('_toString formats a FunctionAssignmentNode fn in parentheses', () => {
    const fa = new N.FunctionAssignmentNode('inc', ['x'], fn('add', [s('x'), c(1)]));
    const node = new FunctionNode(fa as any, [c(5)]);
    // fn part should be wrapped in parens in the string form
    expect(node.toString()).toContain('(');
  });

  it('toHTML wraps the function name in a span', () => {
    const html = fn('sin', [c(0)]).toHTML();
    expect(html).toContain('math-function');
    expect(html).toContain('sin');
  });

  it('onUndefinedFunction throws', () => {
    expect(() => FunctionNode.onUndefinedFunction('missing')).toThrow(/Undefined function missing/);
  });
});
