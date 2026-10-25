import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ScalarBuildError, scalarCanonicalKey } from '@danielsimonjr/mathts-expression';
import {
  evaluate,
  evaluateScalar,
  nodeToScalar,
  parse,
  scalar,
  scalarToNode,
  scalarToTex,
  simplify,
  simplifyScalar,
  ScalarEvalError,
} from '../src/index.js';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeSource = readFileSync(join(__dirname, '../src/scalar-node-bridge.ts'), 'utf8');
const factoriesSource = readFileSync(join(__dirname, '../src/factories/index.ts'), 'utf8');

function sameScalar(a: ScalarNode, b: ScalarNode): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'number':
      return b.kind === 'number' && Object.is(a.value, b.value);
    case 'symbol':
      return b.kind === 'symbol' && a.name === b.name;
    case 'op':
      return (
        b.kind === 'op' &&
        a.op === b.op &&
        a.args.length === b.args.length &&
        a.args.every((child, i) => sameScalar(child, b.args[i]))
      );
    case 'call':
      return b.kind === 'call' && a.fn === b.fn && sameScalar(a.arg, b.arg);
    default:
      return false;
  }
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NUMBERS = [0, -0, 1, -1, 2, -5, 0.5, NaN, Infinity, -Infinity] as const;
const SYMBOLS = ['x', 'y', 'z', 'constructor'] as const;
const OPS = ['+', '-', '*', '/', '^'] as const;
const CALL_INPUTS = [
  'exp',
  'ln',
  'log',
  'log2',
  'log10',
  'sin',
  'cos',
  'tan',
  'sinh',
  'cosh',
  'tanh',
  'abs',
] as const;

function randomTree(rng: () => number, depth: number): ScalarNode {
  if (depth <= 0) {
    const pick = rng();
    if (pick < 0.35) {
      return scalar.number(NUMBERS[Math.floor(rng() * NUMBERS.length)]);
    }
    return scalar.symbol(SYMBOLS[Math.floor(rng() * SYMBOLS.length)]);
  }
  const kind = rng();
  if (kind < 0.25) {
    const op = OPS[Math.floor(rng() * OPS.length)];
    if (op === '^') {
      return scalar.op('^', [randomTree(rng, depth - 1), randomTree(rng, depth - 1)]);
    }
    const arity = Math.floor(rng() * 5);
    const args: ScalarNode[] = [];
    for (let i = 0; i < arity; i++) args.push(randomTree(rng, depth - 1));
    return scalar.op(op, args);
  }
  if (kind < 0.45) {
    const fn = CALL_INPUTS[Math.floor(rng() * CALL_INPUTS.length)];
    return scalar.call(fn, randomTree(rng, depth - 1));
  }
  if (kind < 0.6) {
    return scalar.number(NUMBERS[Math.floor(rng() * NUMBERS.length)]);
  }
  return scalar.symbol(SYMBOLS[Math.floor(rng() * SYMBOLS.length)]);
}

describe('scalar-node-bridge source lock', () => {
  it('bridge module has no parse or factory evaluate import', () => {
    expect(bridgeSource).toContain('createScalarNodeBridge');
    expect(bridgeSource).not.toMatch(/parse\(/);
    expect(bridgeSource).not.toContain("from './factories/evaluate");
    expect(bridgeSource).not.toContain('normalForm');
    expect(factoriesSource).toContain('createScalarNodeBridge');
  });

  it('exports four bridge functions from the barrel, not the factory', async () => {
    const barrel = await import('../src/index.js');
    expect(barrel.scalarToNode).toBeTypeOf('function');
    expect(barrel.nodeToScalar).toBeTypeOf('function');
    expect(barrel.simplifyScalar).toBeTypeOf('function');
    expect(barrel.scalarToTex).toBeTypeOf('function');
    expect((barrel as { createScalarNodeBridge?: unknown }).createScalarNodeBridge).toBeUndefined();
  });
});

describe('scalar-node-bridge structural round-trip', () => {
  const rng = mulberry32(1);
  const trees: ScalarNode[] = [];

  for (let i = 0; i < 200; i++) {
    trees.push(randomTree(rng, 6));
  }

  for (const op of ['+', '-', '*', '/'] as const) {
    for (const arity of [0, 1, 2, 4]) {
      const args: ScalarNode[] = [];
      for (let j = 0; j < arity; j++) args.push(scalar.symbol('x'));
      trees.push(scalar.op(op, args));
    }
  }

  trees.push(
    scalar.op('^', [scalar.symbol('a'), scalar.op('^', [scalar.symbol('b'), scalar.symbol('c')])])
  );
  trees.push(
    scalar.op('^', [scalar.op('^', [scalar.symbol('a'), scalar.symbol('b')]), scalar.symbol('c')])
  );

  for (const fn of CALL_INPUTS) {
    trees.push(scalar.call(fn, scalar.symbol('x')));
  }

  {
    let chain = scalar.symbol('x');
    for (let d = 0; d < 63; d++) {
      chain = scalar.op('+', [chain, scalar.number(1)]);
    }
    trees.push(chain);
  }

  for (const t of trees) {
    it(`round-trip ${scalarCanonicalKey(t)}`, () => {
      const back = nodeToScalar(scalarToNode(t));
      expect(sameScalar(back, t)).toBe(true);
      expect(scalarCanonicalKey(back)).toBe(scalarCanonicalKey(t));
    });
  }

  it('scalarToNode rejects ^ with arity 1', () => {
    const bad = { kind: 'op' as const, op: '^' as const, args: [scalar.symbol('x')] };
    expect(() => scalarToNode(bad)).toThrow(ScalarBuildError);
    expect(() => scalarToNode(bad)).toThrow(/needs exactly 2 args/);
  });
});

describe('scalar-node-bridge log lowering', () => {
  const x = scalar.symbol('x');

  it('preserves ln vs log10 on scalarToNode', () => {
    const lnNode = scalar.call('ln', x);
    expect(lnNode.kind).toBe('call');
    if (lnNode.kind === 'call') expect(lnNode.fn).toBe('log');
    const lnExpr = scalarToNode(lnNode);
    expect(lnExpr.type).toBe('FunctionNode');
    expect((lnExpr as unknown as { name: string }).name).toBe('log');
    expect(lnExpr.toTex()).toBe('\\ln\\left( x\\right)');

    const log10Node = scalar.call('log', x);
    expect(log10Node.kind).toBe('call');
    if (log10Node.kind === 'call') expect(log10Node.fn).toBe('log10');
    const log10Expr = scalarToNode(log10Node);
    expect((log10Expr as unknown as { name: string }).name).toBe('log10');
    expect(log10Expr.toTex()).toBe('\\log_{10}\\left( x\\right)');
  });

  it('nodeToScalar maps parse ln/log to stored names', () => {
    expect(nodeToScalar(parse('ln(x)')).kind).toBe('call');
    expect((nodeToScalar(parse('ln(x)')) as { fn: string }).fn).toBe('log');
    expect((nodeToScalar(parse('log(x)')) as { fn: string }).fn).toBe('log');
  });
});

describe('scalar-node-bridge unary minus and parentheses', () => {
  it('maps unary minus to (-1)*x', () => {
    const s = nodeToScalar(parse('-x'));
    expect(s.kind).toBe('op');
    expect(s).toMatchObject({
      op: '*',
      args: [
        { kind: 'number', value: -1 },
        { kind: 'symbol', name: 'x' },
      ],
    });
    expect(evaluateScalar(s, { x: 3 })).toBe(-3);
  });

  it('unwraps unary plus and parentheses', () => {
    expect(nodeToScalar(parse('+x'))).toMatchObject({ kind: 'symbol', name: 'x' });
    expect(nodeToScalar(parse('(x+1)')).kind).toBe('op');
    expect(nodeToScalar(parse('(x+1)')).kind).not.toBe('parenthesis' as never);
  });

  it('drops implicit multiply and percentage flags', () => {
    const implicit = nodeToScalar(parse('2x'));
    expect(implicit.kind).toBe('op');
    expect(implicit).toMatchObject({ op: '*' });
    const pct = nodeToScalar(parse('50%'));
    expect(pct.kind).toBe('op');
    expect(pct).toMatchObject({ op: '/' });
  });

  it('scalar number -5 is ConstantNode not unaryMinus', () => {
    const n = scalarToNode(scalar.number(-5));
    expect(n.type).toBe('ConstantNode');
    expect((n as unknown as { value: number }).value).toBe(-5);
  });

  it('does not cancel --x', () => {
    const s = nodeToScalar(parse('--x'));
    expect(s).toMatchObject({
      kind: 'op',
      op: '*',
      args: [
        { kind: 'number', value: -1 },
        {
          kind: 'op',
          op: '*',
          args: [
            { kind: 'number', value: -1 },
            { kind: 'symbol', name: 'x' },
          ],
        },
      ],
    });
    expect(evaluateScalar(s, { x: 3 })).toBe(3);
  });

  it('unwraps parentheses under ^ so parse((-2)^2) evaluates to 4', () => {
    expect(evaluateScalar(nodeToScalar(parse('(-2)^2')))).toBe(4);
    expect(evaluateScalar(nodeToScalar(parse('-2^2')))).toBe(-4);
    const right = nodeToScalar(parse('a^b^c'));
    expect(right).toMatchObject({
      op: '^',
      args: [{ name: 'a' }, { op: '^', args: [{ name: 'b' }, { name: 'c' }] }],
    });
    const left = nodeToScalar(parse('(a^b)^c'));
    expect(left).toMatchObject({
      op: '^',
      args: [{ op: '^', args: [{ name: 'a' }, { name: 'b' }] }, { name: 'c' }],
    });
  });

  it('parenthesizes a negative ConstantNode pow base so toString keeps (-2)^2', () => {
    const t = scalar.op('^', [scalar.number(-2), scalar.number(2)]);
    const node = scalarToNode(t);
    expect(node.evaluate()).toBe(4);
    expect(evaluateScalar(t)).toBe(4);
    expect(node.toString()).toContain('(-2)');
    expect(evaluate(node.toString())).toBe(4);
    expect(evaluate(node.toString())).not.toBe(-4);
  });
});

describe('scalar-node-bridge rejects unsupported nodes', () => {
  const rejects = [
    'x = 1',
    'f(x) = x',
    'x ? 1 : 2',
    '[1, 2]',
    '1:3',
    'a[1]',
    'a.b',
    'a.b(x)',
    'x > 1',
    '2!',
    'not x',
    '~x',
    'a .* b',
    'sqrt(x)',
    'sign(x)',
    'nthRoot(x, 3)',
    'true',
    'false',
    '"hi"',
  ];

  for (const s of rejects) {
    it(`rejects ${s}`, () => {
      expect(() => nodeToScalar(parse(s))).toThrow(ScalarBuildError);
      expect(() => nodeToScalar(parse(s))).toThrow(/scalar bridge:/);
    });
  }

  it('rejects binary log when parse yields two args', () => {
    const twoArg = parse('log(x, 10)');
    if ((twoArg as { args?: unknown[] }).args?.length === 2) {
      expect(() => nodeToScalar(twoArg)).toThrow(ScalarBuildError);
      expect(() => nodeToScalar(twoArg)).toThrow(/needs exactly 1 arg/);
    }
  });

  it('rejects unknown functions by name even when arity is not 1', () => {
    expect(() => nodeToScalar(parse('nthRoot(x, 3)'))).toThrow(/function 'nthRoot' is outside/);
    expect(() => nodeToScalar(parse('sqrt(x)'))).toThrow(/function 'sqrt' is outside/);
  });

  it('rejects boolean and non-symbol callees', () => {
    expect(() => nodeToScalar(parse('true'))).toThrow(/constant value type 'boolean'/);
    expect(() => nodeToScalar(parse('a.b(x)'))).toThrow(/function callee is not a symbol/);
  });
});

describe('scalar-node-bridge operator FunctionNodes', () => {
  it('accepts add/multiply/subtract/divide/pow FunctionNodes', () => {
    expect(nodeToScalar(parse('add(x, y, z)'))).toMatchObject({
      kind: 'op',
      op: '+',
    });
    expect(nodeToScalar(parse('multiply(x, y, z)'))).toMatchObject({
      kind: 'op',
      op: '*',
    });
    const sub = nodeToScalar(parse('subtract(x, y, z)'));
    expect(sub).toMatchObject({
      kind: 'op',
      op: '-',
      args: [{ name: 'x' }, { name: 'y' }, { name: 'z' }],
    });
    const div = nodeToScalar(parse('divide(x, y, z)'));
    expect(div).toMatchObject({ kind: 'op', op: '/' });
    expect(nodeToScalar(parse('pow(x, y)'))).toMatchObject({
      kind: 'op',
      op: '^',
    });
  });

  it('maps FunctionNode unaryMinus/unaryPlus like the operator forms', () => {
    expect(nodeToScalar(parse('unaryMinus(x)'))).toMatchObject({
      op: '*',
      args: [{ value: -1 }, { name: 'x' }],
    });
    expect(nodeToScalar(parse('unaryPlus(x)'))).toMatchObject({ kind: 'symbol', name: 'x' });
  });

  it('round-trips n-ary subtract/divide through toString → parse', () => {
    const sub = scalar.op('-', [scalar.symbol('x'), scalar.symbol('y'), scalar.symbol('z')]);
    const div = scalar.op('/', [scalar.symbol('x'), scalar.symbol('y'), scalar.symbol('z')]);
    const scope = { x: 3, y: 1, z: 0.5 };
    expect(scalarToNode(sub).toString()).toBe('subtract(x, y, z)');
    expect(evaluateScalar(nodeToScalar(parse(scalarToNode(sub).toString())), scope)).toBe(
      evaluateScalar(sub, scope)
    );
    expect(evaluateScalar(nodeToScalar(parse(scalarToNode(div).toString())), scope)).toBe(
      evaluateScalar(div, scope)
    );
  });
});

describe('scalar-node-bridge degenerate arity', () => {
  it('one-arg subtract is identity for evaluateScalar but not Node.evaluate', () => {
    const t = scalar.op('-', [scalar.symbol('x')]);
    expect(evaluateScalar(t, { x: 3 })).toBe(3);
    expect(() => scalarToNode(t).evaluate({ x: 3 })).toThrow();
  });

  it('empty + evaluates in evaluateScalar only', () => {
    const t = scalar.op('+', []);
    expect(evaluateScalar(t)).toBe(0);
    expect(() => scalarToNode(t).evaluate()).toThrow();
  });
});

describe('scalar-node-bridge numeric parity', () => {
  const xs = [0.2, 0.5, 1, 1.5, 2, 3];

  function corpusTree(xSym: ScalarNode): ScalarNode[] {
    return [
      scalar.op('+', [xSym, scalar.number(1)]),
      scalar.op('*', [xSym, xSym]),
      scalar.op('-', [xSym, scalar.number(3)]),
      scalar.op('/', [xSym, scalar.number(2)]),
      scalar.op('^', [xSym, scalar.number(3)]),
      scalar.call('sin', xSym),
      scalar.call('ln', xSym),
      scalar.call('log', xSym),
      scalar.call('log10', xSym),
      scalar.call('log2', xSym),
      scalar.call('exp', xSym),
      scalar.call('abs', xSym),
      scalar.call('tanh', xSym),
      scalar.op('+', [xSym, scalar.number(1), scalar.number(2)]),
      scalar.op('^', [scalar.number(-2), scalar.number(3)]),
      scalar.op('^', [scalar.number(4), scalar.op('/', [scalar.number(1), scalar.number(2)])]),
    ];
  }

  for (const xVal of xs) {
    for (const t of corpusTree(scalar.symbol('x'))) {
      it(`evaluateScalar vs Node.evaluate at x=${xVal} for ${scalarCanonicalKey(t)}`, () => {
        const scope = { x: xVal, y: 1, z: 2 };
        const nodeVal = scalarToNode(t).evaluate(scope) as number;
        const scalarVal = evaluateScalar(t, scope);
        expect(Object.is(nodeVal, scalarVal)).toBe(true);
      });
    }
  }

  it('evaluate(string) matches evaluateScalar for safe corpus', () => {
    for (const xVal of xs) {
      const scope = { x: xVal, y: 1, z: 2 };
      for (const t of corpusTree(scalar.symbol('x'))) {
        if (t.kind === 'number' && (Object.is(t.value, -0) || Number.isNaN(t.value))) {
          continue;
        }
        const hasBadNumber = (n: ScalarNode): boolean => {
          if (n.kind === 'number' && (Object.is(n.value, -0) || Number.isNaN(n.value))) {
            return true;
          }
          if (n.kind === 'op') return n.args.some(hasBadNumber);
          if (n.kind === 'call') return hasBadNumber(n.arg);
          return false;
        };
        if (hasBadNumber(t)) continue;
        const fromString = evaluate(scalarToNode(t).toString(), scope) as number;
        expect(Object.is(fromString, evaluateScalar(t, scope))).toBe(true);
      }
    }
  });

  it('evaluateScalar throws where Node.evaluate returns non-finite complex', () => {
    const negRoot = scalar.op('^', [
      scalar.number(-8),
      scalar.op('/', [scalar.number(1), scalar.number(3)]),
    ]);
    expect(() => evaluateScalar(negRoot)).toThrow(ScalarEvalError);
    const nodeNeg = scalarToNode(negRoot).evaluate();
    const finiteNumber = typeof nodeNeg === 'number' && Number.isFinite(nodeNeg as number);
    expect(finiteNumber).toBe(false);

    const div0 = scalar.op('/', [scalar.number(1), scalar.number(0)]);
    expect(() => evaluateScalar(div0)).toThrow(ScalarEvalError);
    expect(scalarToNode(div0).evaluate()).toBe(Infinity);

    const logNeg = scalar.call('ln', scalar.number(-1));
    expect(() => evaluateScalar(logNeg)).toThrow(ScalarEvalError);
    const logRes = scalarToNode(logNeg).evaluate();
    expect(typeof logRes === 'object' || !Number.isFinite(logRes as number)).toBe(true);
  });
});

describe('scalar-node-bridge simplifyScalar', () => {
  const a = scalar.symbol('a');
  const b = scalar.symbol('b');
  const c = scalar.symbol('c');

  const divBc = scalar.op('/', [a, scalar.op('/', [b, c])]);
  const mulAcOverB = scalar.op('/', [scalar.op('*', [a, c]), b]);

  it('normalizes a/(b/c) and a*c/b', () => {
    const s1 = simplifyScalar(divBc);
    const s2 = simplifyScalar(mulAcOverB);
    const expected = scalar.op('/', [scalar.op('*', [a, c]), b]);
    expect(sameScalar(s1, expected)).toBe(true);
    expect(sameScalar(s2, expected)).toBe(true);
    expect(scalarCanonicalKey(s1)).toBe(scalarCanonicalKey(s2));
  });

  it('powers and constants', () => {
    expect(simplifyScalar(scalar.op('*', [a, a]))).toMatchObject({
      kind: 'op',
      op: '^',
      args: [a, { kind: 'number', value: 2 }],
    });
    expect(simplifyScalar(scalar.op('*', [scalar.op('*', [a, a]), a]))).toMatchObject({
      kind: 'op',
      op: '^',
      args: [a, { kind: 'number', value: 3 }],
    });
    expect(simplifyScalar(scalar.op('^', [scalar.number(2), scalar.number(3)]))).toMatchObject({
      kind: 'number',
      value: 8,
    });
    expect(
      simplifyScalar(
        scalar.op('^', [scalar.op('^', [scalar.number(2), scalar.number(3)]), scalar.number(2)])
      )
    ).toMatchObject({ kind: 'number', value: 64 });
    expect(scalarCanonicalKey(scalar.op('^', [scalar.number(2), scalar.number(3)]))).toContain('^');
  });

  it('n-ary subtract and divide keep evaluateScalar left-fold meaning', () => {
    const sub = scalar.op('-', [scalar.symbol('x'), scalar.symbol('y'), scalar.symbol('z')]);
    const div = scalar.op('/', [scalar.symbol('x'), scalar.symbol('y'), scalar.symbol('z')]);
    const scope = { x: 8, y: 2, z: 2, a: 1, b: 1, c: 1 };
    expect(evaluateScalar(simplifyScalar(sub), scope)).toBe(evaluateScalar(sub, scope));
    expect(evaluateScalar(simplifyScalar(div), scope)).toBe(evaluateScalar(div, scope));
    expect(evaluateScalar(sub, scope)).toBe(4);
    expect(evaluateScalar(div, scope)).toBe(2);
  });

  it('wraps simplify Complex folding as ScalarBuildError', () => {
    expect(() => simplifyScalar(scalar.call('log', scalar.number(-1)))).toThrow(ScalarBuildError);
    expect(() => simplifyScalar(scalar.call('log', scalar.number(-1)))).toThrow(/scalar bridge:/);
  });

  it('identities x^-1, 1*x, x+0, x/x', () => {
    expect(simplifyScalar(scalar.op('^', [a, scalar.number(-1)]))).toMatchObject({
      kind: 'op',
      op: '/',
    });
    expect(simplifyScalar(scalar.op('*', [scalar.number(1), a]))).toMatchObject({
      kind: 'symbol',
      name: 'a',
    });
    expect(simplifyScalar(scalar.op('+', [a, scalar.number(0)]))).toMatchObject({
      kind: 'symbol',
      name: 'a',
    });
    expect(simplifyScalar(scalar.op('/', [a, a]))).toMatchObject({ kind: 'number', value: 1 });
  });

  it('scalarToTex matches simplify(parse).toTex for sample formulas', () => {
    expect(scalarToTex(simplifyScalar(divBc))).toBe('\\frac{ a\\cdot c}{ b}');
    expect((simplify(parse('a/(b/c)')) as { toTex(): string }).toTex()).toBe(
      '\\frac{ a\\cdot c}{ b}'
    );

    const aa = scalar.op('*', [a, a]);
    expect(scalarToTex(simplifyScalar(aa))).toBe('{ a}^{2}');
    expect((simplify(parse('a*a')) as { toTex(): string }).toTex()).toBe('{ a}^{2}');

    const pow23 = scalar.op('^', [scalar.number(2), scalar.number(3)]);
    expect(scalarToTex(simplifyScalar(pow23))).toBe('8');
    expect((simplify(parse('2^3')) as { toTex(): string }).toTex()).toBe('8');
  });
});

describe('scalar-node-bridge scalarToTex pins', () => {
  const a = scalar.symbol('a');
  const b = scalar.symbol('b');
  const c = scalar.symbol('c');
  const x = scalar.symbol('x');

  const table: Array<[ScalarNode, string]> = [
    [scalar.number(2), '2'],
    [x, ' x'],
    [scalar.op('+', [a, b]), ' a+ b'],
    [scalar.op('*', [a, b]), ' a\\cdot b'],
    [scalar.op('-', [a, b]), ' a- b'],
    [scalar.op('/', [a, b]), '\\frac{ a}{ b}'],
    [scalar.op('^', [a, b]), '{ a}^{ b}'],
    [scalar.op('^', [scalar.op('^', [a, b]), c]), '{\\left({ a}^{ b}\\right)}^{ c}'],
    [scalar.op('^', [a, scalar.op('^', [b, c])]), '{ a}^{{ b}^{ c}}'],
    [scalar.number(-5), '-5'],
    [scalar.call('sin', x), '\\sin\\left( x\\right)'],
    [scalar.call('abs', x), '\\left| x\\right|'],
    [scalar.call('exp', x), '\\exp\\left( x\\right)'],
    [scalar.call('log2', x), '\\log_{2}\\left( x\\right)'],
    [scalar.call('tanh', x), '\\tanh\\left( x\\right)'],
    [scalar.number(NaN), '\\infty'],
    [scalar.number(Infinity), '\\infty'],
    [scalar.number(-Infinity), '-\\infty'],
    [scalar.number(-0), '0'],
  ];

  for (const [tree, tex] of table) {
    it(`toTex ${scalarCanonicalKey(tree)}`, () => {
      expect(scalarToTex(tree)).toBe(tex);
      expect(scalarToTex(tree)).toBe(scalarToNode(tree).toTex());
    });
  }

  it('passes StringOptions through', () => {
    const t = scalar.op('+', [a, b]);
    const opts = { parenthesis: 'all' as const };
    expect(scalarToTex(t, opts)).toBe(scalarToNode(t).toTex(opts));
  });
});

describe('scalar-node-bridge -0 and NaN round-trip', () => {
  it('preserves -0 and NaN with Object.is', () => {
    for (const v of [-0, NaN] as const) {
      const back = nodeToScalar(scalarToNode(scalar.number(v)));
      expect(back.kind).toBe('number');
      expect(Object.is((back as { value: number }).value, v)).toBe(true);
    }
  });
});

describe('scalar-node-bridge mutation sanity', () => {
  it('changing subtract fn to add would break one-arg minus identity', () => {
    const t = scalar.op('-', [scalar.symbol('x')]);
    const node = scalarToNode(t) as unknown as { fn: string };
    expect(node.fn).toBe('subtract');
    expect(evaluateScalar(t, { x: 3 })).toBe(3);
  });

  it('double SCALAR_FUNCTION_LOWERING would mis-name log', () => {
    const natural = scalar.call('ln', scalar.symbol('x'));
    expect(scalarToNode(natural).toTex()).toContain('\\ln');
    expect((scalarToNode(natural) as unknown as { name: string }).name).toBe('log');
  });
});
