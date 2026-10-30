import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createScalarBuilder, type ScalarNode } from '../src/scalar-builder.js';
import {
  enumerateScalars,
  scalarGrammarAccepts,
  type EnumerationStop,
  type ScalarGrammar,
} from '../src/scalar-enumerate.js';
import { scalarCanonicalKey, scalarEquals, scalarSize } from '../src/scalar-structure.js';
import * as expression from '../src/index.js';

const tinyGrammar = (): ScalarGrammar => ({
  variables: ['x'],
  binary: ['+', '*'],
  unary: [],
  maxSize: 3,
});

function collect(
  grammar: ScalarGrammar,
  maxCandidates: number
): { nodes: ScalarNode[]; stop: EnumerationStop } {
  const gen = enumerateScalars(grammar, { maxCandidates });
  const nodes: ScalarNode[] = [];
  let result = gen.next();
  while (!result.done) {
    nodes.push(result.value);
    result = gen.next();
  }
  if (result.done !== true) {
    throw new Error('enumerateScalars did not return a stop reason');
  }
  return { nodes, stop: result.value };
}

describe('scalar-enumerate', () => {
  const b = createScalarBuilder();
  const x = b.symbol('x');
  const plusXX = b.op('+', [x, x]);
  const mulXX = b.op('*', [x, x]);

  it('exports enumeration API on the expression public surface', () => {
    expect(expression.enumerateScalars).toBe(enumerateScalars);
    expect(expression.scalarGrammarAccepts).toBe(scalarGrammarAccepts);
  });

  it('does not import createSeededRng', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/scalar-enumerate.ts', import.meta.url)),
      'utf8'
    );
    expect(src.includes('createSeededRng')).toBe(false);
  });

  it('tiny grammar oracle: visit order and exhausted-space', () => {
    const { nodes, stop } = collect(tinyGrammar(), 10);
    expect(stop).toBe('exhausted-space');
    expect(nodes).toHaveLength(3);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
    expect(scalarEquals(nodes[2]!, mulXX)).toBe(true);
  });

  it('tiny grammar stops at candidate-limit', () => {
    const { nodes, stop } = collect(tinyGrammar(), 2);
    expect(stop).toBe('candidate-limit');
    expect(nodes).toHaveLength(2);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
  });

  it('enumeration is deterministic by scalarCanonicalKey', () => {
    const keysA = collect(tinyGrammar(), 10).nodes.map(scalarCanonicalKey);
    const keysB = collect(tinyGrammar(), 10).nodes.map(scalarCanonicalKey);
    expect(keysB).toEqual(keysA);
  });

  it('admitMonotone prunes * subtrees from expansion', () => {
    const grammar: ScalarGrammar = {
      ...tinyGrammar(),
      admit: (node) => !(node.kind === 'op' && node.op === '*'),
      admitMonotone: true,
    };
    const { nodes, stop } = collect(grammar, 10);
    expect(stop).toBe('exhausted-space');
    expect(nodes).toHaveLength(2);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
  });

  it('scalarGrammarAccepts does not call admit', () => {
    const grammar: ScalarGrammar = {
      ...tinyGrammar(),
      admit: () => false,
    };
    expect(scalarGrammarAccepts(grammar, mulXX)).toBe(true);
  });
});

describe('scalar-enumerate order and constraints', () => {
  const b = createScalarBuilder();
  const x = b.symbol('x');
  const y = b.symbol('y');

  function keysOf(nodes: readonly ScalarNode[]): string[] {
    return nodes.map(scalarCanonicalKey);
  }

  it('orders leaves as variables, then parameters, then literals, as given', () => {
    const { nodes, stop } = collect(
      {
        variables: ['y', 'x'],
        parameters: ['c'],
        literals: [2, 1],
        binary: [],
        unary: [],
        maxSize: 1,
      },
      10
    );
    expect(stop).toBe('exhausted-space');
    expect(keysOf(nodes)).toEqual(
      keysOf([b.symbol('y'), b.symbol('x'), b.symbol('c'), b.number(2), b.number(1)])
    );
  });

  it('puts binary operators in grammar order, then calls, within one size', () => {
    const { nodes } = collect(
      { variables: ['x'], binary: ['*', '+'], unary: ['sin'], maxSize: 3 },
      20
    );
    expect(keysOf(nodes)).toEqual(
      keysOf([
        x,
        b.call('sin', x),
        b.op('*', [x, x]),
        b.op('+', [x, x]),
        b.call('sin', b.call('sin', x)),
      ])
    );
  });

  it('yields sizes in non-decreasing order', () => {
    const { nodes } = collect(
      { variables: ['x', 'y'], binary: ['+', '*', '-'], unary: ['sin', 'exp'], maxSize: 6 },
      400
    );
    const sizes = nodes.map(scalarSize);
    expect(sizes).toEqual([...sizes].sort((p, q) => p - q));
    expect(new Set(keysOf(nodes)).size).toBe(nodes.length);
  });

  it('keeps the first of two trees with one canonical key', () => {
    const { nodes } = collect({ variables: ['x', 'y'], binary: ['+'], unary: [], maxSize: 3 }, 20);
    expect(keysOf(nodes)).toEqual(
      keysOf([x, y, b.op('+', [x, x]), b.op('+', [x, y]), b.op('+', [y, y])])
    );
    expect(nodes.some((n) => scalarEquals(n, b.op('+', [y, x])) && n !== nodes[3])).toBe(false);
  });

  it('honours maxDepth', () => {
    const { nodes } = collect(
      { variables: ['x'], binary: ['+'], unary: [], maxSize: 7, maxDepth: 2 },
      20
    );
    expect(keysOf(nodes)).toEqual(keysOf([x, b.op('+', [x, x])]));
  });

  it('honours argumentLimits per argument position', () => {
    const grammar: ScalarGrammar = {
      variables: ['x', 'y'],
      binary: ['+'],
      unary: ['sin'],
      maxSize: 4,
      argumentLimits: { sin: [1] },
    };
    const { nodes } = collect(grammar, 50);
    const sins = nodes.filter((n) => n.kind === 'call');
    expect(keysOf(sins)).toEqual(keysOf([b.call('sin', x), b.call('sin', y)]));
    expect(scalarGrammarAccepts(grammar, b.call('sin', b.op('+', [x, y])))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.call('sin', y))).toBe(true);
  });

  it('treats -1 as no limit and limits only the named position', () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['^'],
      unary: [],
      maxSize: 5,
      argumentLimits: { '^': [-1, 1] },
    };
    const wideBase = b.op('^', [b.op('^', [x, x]), x]);
    const wideExponent = b.op('^', [x, b.op('^', [x, x])]);
    expect(scalarGrammarAccepts(grammar, wideBase)).toBe(true);
    expect(scalarGrammarAccepts(grammar, wideExponent)).toBe(false);
  });

  it('honours nesting: no sin under sin, while sin(cos(x)) and cos(sin(x)) stay legal', () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: [],
      unary: ['sin', 'cos'],
      maxSize: 3,
      nesting: { sin: { sin: 0 } },
    };
    const { nodes } = collect(grammar, 50);
    expect(keysOf(nodes)).toEqual(
      keysOf([
        x,
        b.call('sin', x),
        b.call('cos', x),
        b.call('sin', b.call('cos', x)),
        b.call('cos', b.call('sin', x)),
        b.call('cos', b.call('cos', x)),
      ])
    );
    expect(scalarGrammarAccepts(grammar, b.call('sin', b.call('sin', x)))).toBe(false);
  });

  it('counts nested nodes anywhere under the outer node', () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+'],
      unary: ['sin'],
      maxSize: 9,
      nesting: { sin: { '+': 1 } },
    };
    const onePlus = b.call('sin', b.op('+', [x, x]));
    const twoPlus = b.call('sin', b.op('+', [b.op('+', [x, x]), x]));
    expect(scalarGrammarAccepts(grammar, onePlus)).toBe(true);
    expect(scalarGrammarAccepts(grammar, twoPlus)).toBe(false);
  });

  it('scalarGrammarAccepts rejects trees outside the grammar', () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      parameters: ['c'],
      literals: [1],
      binary: ['+'],
      unary: ['sin'],
      maxSize: 3,
      maxDepth: 2,
    };
    expect(scalarGrammarAccepts(grammar, b.symbol('c'))).toBe(true);
    expect(scalarGrammarAccepts(grammar, b.number(42))).toBe(true);
    expect(scalarGrammarAccepts(grammar, b.number(Number.NaN))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.symbol('z'))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.op('*', [x, x]))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.call('cos', x))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.op('+', [x, x, x]))).toBe(false);
    expect(scalarGrammarAccepts(grammar, b.op('+', [b.op('+', [x, x]), x]))).toBe(false);
    expect(scalarGrammarAccepts({ ...grammar, maxSize: Number.NaN }, x)).toBe(false);
  });
});

describe('scalar-enumerate stop reasons', () => {
  it('stops with time-limit when the wall-clock budget is already spent', () => {
    const gen = enumerateScalars(
      { variables: ['x'], binary: ['+'], unary: [], maxSize: 5 },
      { maxCandidates: 100, maxWallClockMs: 0 }
    );
    const first = gen.next();
    expect(first).toEqual({ done: true, value: 'time-limit' });
  });

  it('stops with cancelled when the signal is already aborted', () => {
    const controller = new AbortController();
    controller.abort();
    const gen = enumerateScalars(
      { variables: ['x'], binary: ['+'], unary: [], maxSize: 5 },
      { maxCandidates: 100 },
      controller.signal
    );
    expect(gen.next()).toEqual({ done: true, value: 'cancelled' });
  });

  it('stops with cancelled when the signal aborts between yields', () => {
    const controller = new AbortController();
    const gen = enumerateScalars(
      { variables: ['x', 'y'], binary: ['+', '*'], unary: [], maxSize: 5 },
      { maxCandidates: 100 },
      controller.signal
    );
    expect(gen.next().done).toBe(false);
    controller.abort();
    expect(gen.next()).toEqual({ done: true, value: 'cancelled' });
  });

  it('honours the signal while admit rejects everything and nothing is yielded', () => {
    const controller = new AbortController();
    let admitCalls = 0;
    const gen = enumerateScalars(
      {
        variables: ['x', 'y', 'z'],
        binary: ['+', '*', '-', '/'],
        unary: ['sin', 'cos', 'exp'],
        maxSize: 9,
        admit: () => {
          admitCalls += 1;
          if (admitCalls === 500) controller.abort();
          return false;
        },
      },
      { maxCandidates: 1_000_000 },
      controller.signal
    );
    expect(gen.next()).toEqual({ done: true, value: 'cancelled' });
    expect(admitCalls).toBeLessThan(500 + 2 * 128);
  });

  it('rejects a NaN budget instead of enumerating without a limit', () => {
    const gen = enumerateScalars(
      { variables: ['x'], binary: [], unary: [], maxSize: 1 },
      { maxCandidates: Number.NaN }
    );
    expect(() => gen.next()).toThrow(RangeError);
  });

  it('returns candidate-limit with zero candidates before the first yield', () => {
    const gen = enumerateScalars(
      { variables: ['x'], binary: [], unary: [], maxSize: 1 },
      { maxCandidates: 0 }
    );
    expect(gen.next()).toEqual({ done: true, value: 'candidate-limit' });
  });
});
