import { describe, expect, it } from 'vitest';
import { createScalarBuilder, ScalarBuildError } from '../src/scalar-builder.js';
import {
  forEachScalar,
  mapScalar,
  scalarCanonical,
  scalarCanonicalKey,
  scalarComplexity,
  scalarDepth,
  scalarEquals,
  scalarSize,
  scalarSymbols,
} from '../src/scalar-structure.js';
import * as expression from '../src/index.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deepFreeze(node: ScalarNode): void {
  Object.freeze(node);
  if (node.kind === 'call') {
    deepFreeze(node.arg);
  } else if (node.kind === 'op') {
    Object.freeze(node.args);
    for (const child of node.args) {
      deepFreeze(child);
    }
  }
}

type ScalarNode = import('../src/scalar-builder.js').ScalarNode;

describe('scalar-structure', () => {
  const scalar = createScalarBuilder();

  it('exports the structural toolkit on the expression public surface', () => {
    expect(expression.scalarCanonicalKey).toBe(scalarCanonicalKey);
    expect(expression.scalarCanonical).toBe(scalarCanonical);
    expect(expression.scalarEquals).toBe(scalarEquals);
    expect(expression.scalarSize).toBe(scalarSize);
    expect(expression.scalarDepth).toBe(scalarDepth);
    expect(expression.scalarComplexity).toBe(scalarComplexity);
    expect(expression.scalarSymbols).toBe(scalarSymbols);
    expect(expression.forEachScalar).toBe(forEachScalar);
    expect(expression.mapScalar).toBe(mapScalar);
    expect(expression.SCALAR_FUNCTION_LOWERING.ln).toBe('log');
    expect(expression.SCALAR_FUNCTION_LOWERING.log).toBe('log10');
  });

  it('preorder walk, size, depth, and symbols on +(x, *(y, 2))', () => {
    const x = scalar.symbol('x');
    const y = scalar.symbol('y');
    const tree = scalar.op('+', [x, scalar.op('*', [y, scalar.number(2)])]);
    const visits: { kind: string; depth: number }[] = [];
    forEachScalar(tree, (n, depth) => {
      if (n.kind === 'op') {
        visits.push({ kind: n.op, depth });
      } else if (n.kind === 'symbol') {
        visits.push({ kind: `sym:${n.name}`, depth });
      } else {
        visits.push({ kind: 'number', depth });
      }
    });
    expect(visits).toEqual([
      { kind: '+', depth: 0 },
      { kind: 'sym:x', depth: 1 },
      { kind: '*', depth: 1 },
      { kind: 'sym:y', depth: 2 },
      { kind: 'number', depth: 2 },
    ]);
    expect(scalarSize(tree)).toBe(5);
    expect(scalarDepth(tree)).toBe(3);
    expect(scalarSymbols(tree)).toEqual(['x', 'y']);
  });

  it('size and depth on small trees', () => {
    const x = scalar.symbol('x');
    expect(scalarSize(x)).toBe(1);
    expect(scalarDepth(x)).toBe(1);
    expect(scalarSize(scalar.op('^', [x, scalar.number(2)]))).toBe(3);
    expect(scalarDepth(scalar.op('^', [x, scalar.number(2)]))).toBe(2);
    expect(scalarSize(scalar.op('+', []))).toBe(1);
    expect(scalarDepth(scalar.op('+', []))).toBe(1);
    const sinx = scalar.call('sin', x);
    expect(scalarSize(sinx)).toBe(2);
    expect(scalarDepth(sinx)).toBe(2);
    const t = scalar.op('+', [sinx, scalar.number(2)]);
    expect(scalarSize(t)).toBe(4);
    expect(scalarDepth(t)).toBe(3);
  });

  it('mapScalar replaces symbols without mutating or canonicalizing', () => {
    const x = scalar.symbol('x');
    const y = scalar.symbol('y');
    const tree = scalar.op('+', [x, y]);
    const clone = structuredClone(tree);
    deepFreeze(tree);
    const mapped = mapScalar(tree, (n) => {
      if (n.kind === 'symbol' && n.name === 'x') {
        return scalar.symbol('z');
      }
      return n;
    });
    expect(mapped).toEqual(scalar.op('+', [scalar.symbol('z'), y]));
    expect(scalarSymbols(tree)).toEqual(['x', 'y']);
    expect(mapScalar(tree, (n) => n)).toBe(tree);
    expect(tree).toEqual(clone);
  });

  it('collects sorted unique symbols', () => {
    const tree = scalar.call(
      'ln',
      scalar.op('+', [scalar.symbol('b'), scalar.symbol('a'), scalar.symbol('a')])
    );
    expect(scalarSymbols(tree)).toEqual(['a', 'b']);
    expect(scalarSymbols(scalar.symbol(''))).toEqual(['']);
    expect(scalarSymbols(scalar.number(42))).toEqual([]);
  });

  it('scalarComplexity on the stored tree with Math.round', () => {
    const x = scalar.symbol('x');
    const tree = scalar.op('+', [scalar.call('sin', x), scalar.number(2)]);
    expect(scalarComplexity(tree)).toBe(4);
    expect(scalarComplexity(tree)).toBe(scalarSize(tree));
    expect(
      scalarComplexity(tree, {
        op: { '+': 1 },
        call: { sin: 3 },
        number: 1,
        symbol: { x: 2 },
      })
    ).toBe(7);
    expect(
      scalarComplexity(scalar.op('*', [scalar.symbol('x'), scalar.symbol('y')]), {
        op: { '*': 0.2 },
        symbol: 1,
      })
    ).toBe(2);
    expect(scalarComplexity(scalar.number(0), { number: 2.5 })).toBe(3);
    expect(scalarComplexity(scalar.number(0), { number: -1.5 })).toBe(-1);
    const minus = scalar.op('-', [x, scalar.symbol('y')]);
    expect(scalarComplexity(minus, { op: { '-': 5 }, symbol: 1 })).toBe(7);
    expect(scalarComplexity(minus, { symbol: { x: 4 } })).toBe(6);
  });

  const equivalenceClasses: { trees: () => ScalarNode[]; key: string }[] = [
    {
      key: '{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"2"}}',
      trees: () => {
        const x = scalar.symbol('x');
        return [
          scalar.op('^', [x, scalar.number(2)]),
          scalar.op('*', [x, x]),
          scalar.op('*', [x, scalar.op('*', [x])]),
        ];
      },
    },
    {
      key: '{"k":"*","a":[{"k":"^","b":{"k":"s","v":"b"},"e":{"k":"n","v":"-1"}},{"k":"s","v":"a"},{"k":"s","v":"c"}]}',
      trees: () => {
        const a = scalar.symbol('a');
        const b = scalar.symbol('b');
        const c = scalar.symbol('c');
        return [
          scalar.op('/', [a, scalar.op('/', [b, c])]),
          scalar.op('/', [scalar.op('*', [a, c]), b]),
          scalar.op('*', [scalar.op('*', [c, a]), scalar.op('^', [b, scalar.number(-1)])]),
        ];
      },
    },
    {
      key: '{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"y"}]}',
      trees: () => {
        const x = scalar.symbol('x');
        const y = scalar.symbol('y');
        return [scalar.op('+', [x, y]), scalar.op('+', [y, x])];
      },
    },
    {
      key: '{"k":"*","a":[{"k":"s","v":"a"},{"k":"s","v":"b"},{"k":"s","v":"c"}]}',
      trees: () => {
        const a = scalar.symbol('a');
        const b = scalar.symbol('b');
        const c = scalar.symbol('c');
        return [scalar.op('*', [a, scalar.op('*', [b, c])]), scalar.op('*', [c, b, a])];
      },
    },
    {
      key: '{"k":"+","a":[{"k":"n","v":"3"},{"k":"s","v":"x"}]}',
      trees: () => {
        const x = scalar.symbol('x');
        return [
          scalar.op('+', [scalar.number(1), scalar.number(2), x]),
          scalar.op('+', [x, scalar.number(3)]),
        ];
      },
    },
    {
      key: '{"k":"*","a":[{"k":"n","v":"6"},{"k":"s","v":"x"}]}',
      trees: () => {
        const x = scalar.symbol('x');
        return [
          scalar.op('*', [scalar.number(2), scalar.number(3), x]),
          scalar.op('*', [x, scalar.number(6)]),
        ];
      },
    },
    {
      key: '{"k":"s","v":"x"}',
      trees: () => {
        const x = scalar.symbol('x');
        return [scalar.op('*', [scalar.number(1), x]), x];
      },
    },
    {
      key: '{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"6"}}',
      trees: () => {
        const x = scalar.symbol('x');
        return [
          scalar.op('^', [scalar.op('^', [x, scalar.number(2)]), scalar.number(3)]),
          scalar.op('^', [x, scalar.number(6)]),
        ];
      },
    },
    {
      key: '{"k":"c","f":"log","a":{"k":"s","v":"x"}}',
      trees: () => [scalar.call('ln', scalar.symbol('x'))],
    },
    {
      key: '{"k":"c","f":"log10","a":{"k":"s","v":"x"}}',
      trees: () => [
        scalar.call('log', scalar.symbol('x')),
        scalar.call('log10', scalar.symbol('x')),
      ],
    },
    {
      key: '{"k":"n","v":"0"}',
      trees: () => [scalar.op('+', []), scalar.op('-', [])],
    },
    {
      key: '{"k":"n","v":"1"}',
      trees: () => [scalar.op('*', []), scalar.op('/', [])],
    },
    {
      key: '{"k":"s","v":"x"}',
      trees: () => [scalar.op('-', [scalar.symbol('x')])],
    },
  ];

  const nonEquivalence: { tree: () => ScalarNode; key: string }[] = [
    {
      key: '{"k":"+","a":[{"k":"*","a":[{"k":"n","v":"-1"},{"k":"s","v":"y"}]},{"k":"s","v":"x"}]}',
      tree: () => scalar.op('-', [scalar.symbol('x'), scalar.symbol('y')]),
    },
    {
      key: '{"k":"+","a":[{"k":"*","a":[{"k":"n","v":"-1"},{"k":"s","v":"x"}]},{"k":"s","v":"y"}]}',
      tree: () => scalar.op('-', [scalar.symbol('y'), scalar.symbol('x')]),
    },
    {
      key: '{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"x"}]}',
      tree: () => scalar.op('+', [scalar.symbol('x'), scalar.symbol('x')]),
    },
    {
      key: '{"k":"*","a":[{"k":"n","v":"2"},{"k":"s","v":"x"}]}',
      tree: () => scalar.op('*', [scalar.number(2), scalar.symbol('x')]),
    },
    {
      key: '{"k":"^","b":{"k":"n","v":"2"},"e":{"k":"n","v":"3"}}',
      tree: () => scalar.op('^', [scalar.number(2), scalar.number(3)]),
    },
    { key: '{"k":"n","v":"8"}', tree: () => scalar.number(8) },
    {
      key: '{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"0"}}',
      tree: () => scalar.op('/', [scalar.symbol('x'), scalar.symbol('x')]),
    },
    { key: '{"k":"n","v":"1"}', tree: () => scalar.number(1) },
    {
      key: '{"k":"*","a":[{"k":"n","v":"0"},{"k":"s","v":"x"}]}',
      tree: () => scalar.op('*', [scalar.number(0), scalar.symbol('x')]),
    },
    { key: '{"k":"n","v":"0"}', tree: () => scalar.number(0) },
    { key: '{"k":"n","v":"-0"}', tree: () => scalar.number(-0) },
    { key: '{"k":"n","v":"NaN"}', tree: () => scalar.number(NaN) },
    { key: '{"k":"n","v":"Infinity"}', tree: () => scalar.number(Infinity) },
    { key: '{"k":"n","v":"-Infinity"}', tree: () => scalar.number(-Infinity) },
    {
      key: '{"k":"s","v":"a\\"b"}',
      tree: () => scalar.symbol('a"b'),
    },
  ];

  it('equivalence classes share keys and scalarEquals', () => {
    for (const { key, trees } of equivalenceClasses) {
      const built = trees();
      for (const t of built) {
        expect(scalarCanonicalKey(t)).toBe(key);
      }
      for (let i = 0; i < built.length; i++) {
        for (let j = i + 1; j < built.length; j++) {
          expect(scalarEquals(built[i], built[j])).toBe(true);
          expect(scalarEquals(built[j], built[i])).toBe(true);
        }
      }
    }
  });

  it('non-equivalence keys and scalarEquals false', () => {
    for (const { key, tree } of nonEquivalence) {
      const t = tree();
      expect(scalarCanonicalKey(t)).toBe(key);
    }
    expect(
      scalarEquals(
        scalar.op('-', [scalar.symbol('x'), scalar.symbol('y')]),
        scalar.op('-', [scalar.symbol('y'), scalar.symbol('x')])
      )
    ).toBe(false);
    expect(
      scalarEquals(
        scalar.op('+', [scalar.symbol('x'), scalar.symbol('x')]),
        scalar.op('*', [scalar.number(2), scalar.symbol('x')])
      )
    ).toBe(false);
    expect(
      scalarEquals(scalar.op('^', [scalar.number(2), scalar.number(3)]), scalar.number(8))
    ).toBe(false);
    expect(
      scalarEquals(scalar.op('/', [scalar.symbol('x'), scalar.symbol('x')]), scalar.number(1))
    ).toBe(false);
    expect(
      scalarEquals(scalar.op('*', [scalar.number(0), scalar.symbol('x')]), scalar.number(0))
    ).toBe(false);
    expect(scalarEquals(scalar.number(-0), scalar.number(0))).toBe(false);
    expect(
      scalarEquals(scalar.call('ln', scalar.symbol('x')), scalar.call('log', scalar.symbol('x')))
    ).toBe(false);
  });

  it('canonicalization is idempotent for equivalence and non-equivalence trees', () => {
    const allTrees = [
      ...equivalenceClasses.flatMap((c) => c.trees()),
      ...nonEquivalence.map((c) => c.tree()),
    ];
    for (const t of allTrees) {
      const once = scalarCanonical(t);
      const twice = scalarCanonical(once);
      expect(twice).toEqual(once);
      expect(scalarCanonicalKey(once)).toBe(scalarCanonicalKey(t));
    }
  });

  it('survives deep-frozen inputs for every function', () => {
    const x = scalar.symbol('x');
    const y = scalar.symbol('y');
    const tree = scalar.op('+', [x, scalar.op('*', [y, scalar.number(2)])]);
    const clone = structuredClone(tree);
    deepFreeze(tree);
    forEachScalar(tree, () => {});
    mapScalar(tree, (n) => n);
    scalarSize(tree);
    scalarDepth(tree);
    scalarComplexity(tree);
    scalarSymbols(tree);
    scalarCanonical(tree);
    scalarCanonicalKey(tree);
    scalarEquals(tree, clone);
    expect(tree).toEqual(clone);
  });

  it('rejects bad power arity in scalarCanonical', () => {
    const bad = { kind: 'op', op: '^', args: [{ kind: 'number', value: 2 }] } as ScalarNode;
    expect(() => scalarCanonical(bad)).toThrow(ScalarBuildError);
    expect(() => scalarCanonical(bad)).toThrow(/exactly 2 args/);
  });

  it('mulberry32 pinned outputs', () => {
    const rng = mulberry32(0xc0ffee);
    expect(rng()).toBe(0.021141508361324668);
    expect(rng()).toBe(0.6661099966149777);
    expect(rng()).toBe(0.7799714196007699);
    expect(rng()).toBe(0.7395844468846917);
  });

  function reverseOpArgs(node: ScalarNode): ScalarNode {
    if (node.kind === 'call') {
      return { kind: 'call', fn: node.fn, arg: reverseOpArgs(node.arg) };
    }
    if (node.kind === 'op') {
      const args =
        node.op === '+' || node.op === '*'
          ? [...node.args].reverse().map((c) => reverseOpArgs(c))
          : node.args.map((c) => reverseOpArgs(c));
      return { kind: 'op', op: node.op, args };
    }
    return node;
  }

  function gen(rng: () => number, depth: number): ScalarNode {
    if (depth === 0 || rng() < 0.4) {
      if (rng() < 0.5) {
        const names = ['a', 'b', 'c'];
        return scalar.symbol(names[Math.floor(rng() * 3)]);
      }
      return scalar.number(1 + Math.floor(rng() * 5));
    }
    const op = rng() < 0.5 ? '+' : '*';
    const arity = rng() < 0.5 ? 2 : 3;
    const children: ScalarNode[] = [];
    for (let i = 0; i < arity; i++) {
      children.push(gen(rng, depth - 1));
    }
    return scalar.op(op, children);
  }

  it('canonical key is invariant under reversing + and * child order (200 trees)', () => {
    const rng = mulberry32(0xc0ffee);
    let count = 0;
    for (let i = 0; i < 200; i++) {
      const tree = gen(rng, 4);
      const reversed = reverseOpArgs(tree);
      expect(scalarCanonicalKey(reversed)).toBe(scalarCanonicalKey(tree));
      count += 1;
    }
    expect(count).toBe(200);
  });
});
