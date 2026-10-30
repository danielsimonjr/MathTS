import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng, type SeededRng } from '@danielsimonjr/mathts-core';
import { identity as matrixIdentity } from '../src/index.js';
import {
  addNode,
  crossoverSubtrees,
  DEFAULT_MUTATION_WEIGHTS,
  deleteNode,
  drawMutationOperator,
  identityMutation,
  insertNode,
  mutateConstant,
  mutateFeature,
  mutateOperator,
  MUTATE_CONSTANT_NEGATE_PROBABILITY,
  randomizeTree,
  rotateTree,
  simplifyConstants,
  swapOperands,
  weightedMutation,
  type ScalarMutationContext,
} from '../src/scalar-mutate.js';

const b = createScalarBuilder();

const testGrammar: ScalarGrammar = {
  variables: ['x', 'y'],
  parameters: ['c'],
  literals: [1, 2],
  binary: ['+', '*'],
  unary: ['sin', 'cos'],
  maxSize: 12,
};

const ctx: ScalarMutationContext = {
  grammar: testGrammar,
  perturbationFactor: 0.25,
  temperature: 1,
};

function stubRng(opts: { next?: number[]; nextInt?: number[] }): SeededRng {
  let ni = 0;
  let nii = 0;
  const base = createSeededRng(0);
  return {
    seed: 0,
    next: () => opts.next?.[ni++] ?? 0.5,
    nextInt: (max: number) => {
      const v = opts.nextInt?.[nii++] ?? 0;
      return v % max;
    },
    normal: () => base.normal(),
    fork: (label) => base.fork(label),
  };
}

function key(node: ScalarNode | null): string {
  return node === null ? 'null' : scalarCanonicalKey(node);
}

describe('scalar-mutate operators', () => {
  it('identityMutation returns the same tree without using rng', () => {
    const tree = b.op('+', [b.symbol('x'), b.number(1)]);
    expect(identityMutation(tree, stubRng({}), ctx)).toBe(tree);
  });

  it('mutateConstant perturbs one number leaf', () => {
    const tree = b.op('+', [b.number(10), b.symbol('x')]);
    const rng = stubRng({ nextInt: [0], next: [0.75, 1] });
    const out = mutateConstant(tree, rng, ctx);
    expect(key(out)).toBe(key(b.op('+', [b.number(11.25), b.symbol('x')])));
  });

  it('mutateOperator swaps a binary operator', () => {
    const tree = b.op('*', [b.symbol('x'), b.symbol('y')]);
    const rng = stubRng({ nextInt: [0, 0] });
    const out = mutateOperator(tree, rng, ctx);
    expect(key(out)).toBe(key(b.op('+', [b.symbol('x'), b.symbol('y')])));
  });

  it('mutateFeature renames one symbol', () => {
    const tree = b.op('+', [b.symbol('x'), b.symbol('y')]);
    const rng = stubRng({ nextInt: [0, 1] });
    const out = mutateFeature(tree, rng, ctx);
    expect(key(out)).toBe(key(b.op('+', [b.symbol('c'), b.symbol('y')])));
  });

  it('swapOperands reverses one binary node', () => {
    const tree = b.op('*', [b.symbol('x'), b.symbol('y')]);
    const rng = stubRng({ nextInt: [0] });
    const out = swapOperands(tree, rng, ctx);
    expect(key(out)).toBe(key(b.op('*', [b.symbol('y'), b.symbol('x')])));
  });

  it('addNode wraps a subtree in a binary operator with a new leaf', () => {
    const tree = b.symbol('x');
    const rng = stubRng({ nextInt: [0], next: [1, 0, 0, 0] });
    const out = addNode(tree, rng, ctx);
    expect(key(out)).toBe(key(b.op('+', [b.symbol('x'), b.symbol('x')])));
  });

  it('insertNode adds a binary node on one parent edge', () => {
    const tree = b.op('+', [b.symbol('x'), b.symbol('y')]);
    const rng = stubRng({ nextInt: [0, 1, 0, 0], next: [0] });
    const out = insertNode(tree, rng, ctx);
    expect(key(out)).toBe(
      key(b.op('+', [b.op('*', [b.symbol('x'), b.symbol('x')]), b.symbol('y')]))
    );
  });

  it('insertNode on a single-node tree returns null', () => {
    expect(insertNode(b.symbol('x'), stubRng({ nextInt: [0] }), ctx)).toBeNull();
  });

  it('deleteNode replaces a binary with one child', () => {
    const tree = b.op('+', [b.symbol('x'), b.symbol('y')]);
    const rng = stubRng({ nextInt: [0, 0] });
    const out = deleteNode(tree, rng, ctx);
    expect(key(out)).toBe(key(b.symbol('x')));
  });

  it('rotateTree performs a left rotation', () => {
    const tree = b.op('+', [b.op('*', [b.symbol('x'), b.symbol('y')]), b.symbol('c')]);
    const rng = stubRng({ nextInt: [0], next: [0.25] });
    const out = rotateTree(tree, rng, ctx);
    expect(key(out)).toBe(
      key(b.op('*', [b.symbol('x'), b.op('+', [b.symbol('y'), b.symbol('c')])]))
    );
  });

  it('simplifyConstants folds numeric subtrees', () => {
    const tree = b.op('+', [b.number(2), b.number(3)]);
    const out = simplifyConstants(tree);
    expect(key(out)).toBe(key(b.number(5)));
  });

  it('randomizeTree returns a grammar-bounded tree', () => {
    const rng = createSeededRng(99);
    const out = randomizeTree(b.symbol('x'), rng, ctx);
    expect(out).not.toBeNull();
    expect(scalarGrammarAccepts(testGrammar, out!)).toBe(true);
  });

  it('crossoverSubtrees grafts a donor subtree', () => {
    const left = b.op('+', [b.symbol('x'), b.symbol('y')]);
    const right = b.number(7);
    const rng = stubRng({ nextInt: [2, 0] });
    const out = crossoverSubtrees(left, right, rng, ctx);
    expect(key(out)).toBe(key(b.op('+', [b.symbol('x'), b.number(7)])));
  });

  it('exports the negate probability constant', () => {
    expect(MUTATE_CONSTANT_NEGATE_PROBABILITY).toBe(0.00743);
  });

  it('DEFAULT_MUTATION_WEIGHTS matches roadmap literals', () => {
    expect(DEFAULT_MUTATION_WEIGHTS).toEqual({
      rotateTree: 4.26,
      addNode: 2.47,
      deleteNode: 0.87,
      mutateOperator: 0.293,
      identity: 0.273,
      swapOperands: 0.198,
      mutateFeature: 0.1,
      mutateConstant: 0.0346,
      insertNode: 0.0112,
      simplifyConstants: 0.00209,
      randomizeTree: 0.000502,
    });
  });
});

describe('weightedMutation', () => {
  const tree = b.op('+', [b.op('*', [b.symbol('x'), b.number(2)]), b.symbol('y')]);
  const mutate = weightedMutation();

  it('accepts grammar for 1000 seeded draws when non-null', () => {
    const rng = createSeededRng(1);
    let any = false;
    for (let i = 0; i < 1000; i++) {
      const out = mutate(tree, rng, ctx);
      if (out !== null) {
        any = true;
        expect(scalarGrammarAccepts(testGrammar, out)).toBe(true);
      }
    }
    expect(any).toBe(true);
  });

  it('repeats canonical keys for the same seed', () => {
    const run = (): string[] => {
      const rng = createSeededRng(1);
      const keys: string[] = [];
      for (let i = 0; i < 20; i++) {
        keys.push(key(mutate(tree, rng, ctx)));
      }
      return keys;
    };
    const first = run();
    expect(run()).toEqual(first);
    // A single repeated draw would also "repeat"; the stream must actually vary.
    expect(new Set(first).size).toBeGreaterThan(2);
  });

  it('matches default weights under chi-square (df=10, alpha=0.001)', () => {
    const sum = Object.values(DEFAULT_MUTATION_WEIGHTS).reduce((a, w) => a + w, 0);
    const keys = Object.keys(DEFAULT_MUTATION_WEIGHTS) as (keyof typeof DEFAULT_MUTATION_WEIGHTS)[];
    const observed = Object.fromEntries(keys.map((k) => [k, 0])) as Record<
      keyof typeof DEFAULT_MUTATION_WEIGHTS,
      number
    >;
    const rng = createSeededRng(20261030);
    const draws = 400_000;
    for (let i = 0; i < draws; i++) {
      const pick = drawMutationOperator(rng);
      observed[pick] += 1;
    }
    let chi2 = 0;
    for (const k of keys) {
      const exp = (draws * DEFAULT_MUTATION_WEIGHTS[k]) / sum;
      const diff = observed[k] - exp;
      chi2 += (diff * diff) / exp;
    }
    expect(chi2).toBeLessThanOrEqual(29.588);
  });
});

describe('operators reach nodes under a call', () => {
  const sinSum = b.call('sin', b.op('+', [b.symbol('x'), b.number(2)]));

  it('mutateConstant perturbs a number inside sin(...)', () => {
    const out = mutateConstant(sinSum, stubRng({ nextInt: [0], next: [0.75, 1] }), ctx);
    expect(key(out)).toBe(key(b.call('sin', b.op('+', [b.symbol('x'), b.number(2.25)]))));
  });

  it('mutateFeature renames a symbol inside sin(...)', () => {
    const out = mutateFeature(sinSum, stubRng({ nextInt: [0, 0] }), ctx);
    expect(key(out)).toBe(key(b.call('sin', b.op('+', [b.symbol('y'), b.number(2)]))));
  });

  it('swapOperands swaps the sum under sin(...)', () => {
    const out = swapOperands(sinSum, stubRng({ nextInt: [0] }), ctx);
    expect(key(out)).toBe(key(b.call('sin', b.op('+', [b.number(2), b.symbol('x')]))));
  });

  it('mutateOperator renames the call and the operator under it', () => {
    // choices in pre-order: ops first, then calls
    const op = mutateOperator(sinSum, stubRng({ nextInt: [0, 0] }), ctx);
    expect(key(op)).toBe(key(b.call('sin', b.op('*', [b.symbol('x'), b.number(2)]))));
    const fn = mutateOperator(sinSum, stubRng({ nextInt: [1, 0] }), ctx);
    expect(key(fn)).toBe(key(b.call('cos', b.op('+', [b.symbol('x'), b.number(2)]))));
  });

  it('addNode wraps the argument of sin(...)', () => {
    // path [0] is the sum: nextInt picks it, then the leaf draws 'x'
    const out = addNode(sinSum, stubRng({ nextInt: [1, 0, 0], next: [1, 0] }), ctx);
    expect(key(out)).toBe(
      key(b.call('sin', b.op('+', [b.op('+', [b.symbol('x'), b.number(2)]), b.symbol('x')])))
    );
  });

  it('insertNode puts an operator between sin and its argument', () => {
    const tree = b.call('sin', b.symbol('x'));
    // one edge (sin -> x); op index 1 is '*'; leaf 'y'; next < 0.5 keeps the child first
    const out = insertNode(tree, stubRng({ nextInt: [0, 1, 1], next: [0] }), ctx);
    expect(key(out)).toBe(key(b.call('sin', b.op('*', [b.symbol('x'), b.symbol('y')]))));
  });

  it('deleteNode removes the operator under sin(...)', () => {
    const out = deleteNode(sinSum, stubRng({ nextInt: [0, 1] }), ctx);
    expect(key(out)).toBe(key(b.call('sin', b.number(2))));
  });

  it('rotateTree rotates a binary node under sin(...)', () => {
    const tree = b.call(
      'sin',
      b.op('+', [b.op('*', [b.symbol('x'), b.symbol('y')]), b.symbol('c')])
    );
    const out = rotateTree(tree, stubRng({ nextInt: [0], next: [0.25] }), ctx);
    expect(key(out)).toBe(
      key(b.call('sin', b.op('*', [b.symbol('x'), b.op('+', [b.symbol('y'), b.symbol('c')])])))
    );
  });

  it('crossoverSubtrees replaces and donates nodes below a call', () => {
    // left paths: [], [0], [0,0], [0,1]; right paths: [], [0]
    const out = crossoverSubtrees(
      sinSum,
      b.call('cos', b.symbol('y')),
      stubRng({ nextInt: [3, 1] }),
      ctx
    );
    expect(key(out)).toBe(key(b.call('sin', b.op('+', [b.symbol('x'), b.symbol('y')]))));
  });

  it('never throws and always passes the grammar over a tree full of calls', () => {
    const rng = createSeededRng(7);
    const mutate = weightedMutation();
    let tree: ScalarNode = sinSum;
    for (let i = 0; i < 2000; i++) {
      const out = mutate(tree, rng, ctx);
      if (out !== null) {
        expect(scalarGrammarAccepts(testGrammar, out)).toBe(true);
        tree = out;
      }
    }
  });
});

describe('grammar and call-name fidelity', () => {
  it('swapOperands returns null when the swapped tree breaks the grammar', () => {
    // the exponent may only be a leaf, so (x + y) ^ 2 is legal and 2 ^ (x + y) is not
    const grammar: ScalarGrammar = {
      ...testGrammar,
      binary: ['^', '+'],
      argumentLimits: { '^': [3, 1] },
    };
    const tree = b.op('^', [b.op('+', [b.symbol('x'), b.symbol('y')]), b.number(2)]);
    expect(scalarGrammarAccepts(grammar, tree)).toBe(true);
    const swapped = b.op('^', [b.number(2), b.op('+', [b.symbol('x'), b.symbol('y')])]);
    expect(scalarGrammarAccepts(grammar, swapped)).toBe(false);
    expect(swapOperands(tree, stubRng({ nextInt: [0] }), { ...ctx, grammar })).toBeNull();
  });

  it('addNode keeps the lowered name: natural log stays log, not log10', () => {
    const grammar: ScalarGrammar = { ...testGrammar, unary: ['log'] };
    // next 0 < 0.5 selects the call arm
    const out = addNode(b.symbol('x'), stubRng({ nextInt: [0, 0], next: [0] }), {
      ...ctx,
      grammar,
    });
    expect(out).toEqual({ kind: 'call', fn: 'log', arg: { kind: 'symbol', name: 'x' } });
  });

  it('randomizeTree only ever emits names the grammar lists, natural log included', () => {
    const grammar: ScalarGrammar = { ...testGrammar, unary: ['log'], binary: ['+'] };
    let sawLog = false;
    for (let seed = 1; seed <= 200; seed++) {
      const out = randomizeTree(b.symbol('x'), createSeededRng(seed), { ...ctx, grammar });
      if (out === null) continue;
      expect(scalarGrammarAccepts(grammar, out)).toBe(true);
      sawLog ||= JSON.stringify(out).includes('"fn":"log"');
    }
    expect(sawLog).toBe(true);
  });

  it('randomizeTree returns null for a grammar that allows no node', () => {
    const grammar: ScalarGrammar = { ...testGrammar, maxSize: 0 };
    expect(randomizeTree(b.symbol('x'), createSeededRng(1), { ...ctx, grammar })).toBeNull();
  });

  it('mutateOperator skips nodes that have no alternative', () => {
    const grammar: ScalarGrammar = { ...testGrammar, binary: ['+'], unary: ['sin', 'cos'] };
    const tree = b.call('sin', b.op('+', [b.symbol('x'), b.symbol('y')]));
    const out = mutateOperator(tree, stubRng({ nextInt: [0, 0] }), { ...ctx, grammar });
    // the only node with an alternative is the call
    expect(key(out)).toBe(key(b.call('cos', b.op('+', [b.symbol('x'), b.symbol('y')]))));
    const single: ScalarGrammar = { ...testGrammar, binary: ['+'], unary: ['sin'] };
    expect(mutateOperator(tree, stubRng({}), { ...ctx, grammar: single })).toBeNull();
  });

  it('rotateTree uses the direction that exists instead of failing', () => {
    // only the right child is binary, so the left rotation is impossible
    const tree = b.op('+', [b.symbol('c'), b.op('*', [b.symbol('x'), b.symbol('y')])]);
    const expected = b.op('*', [b.op('+', [b.symbol('c'), b.symbol('x')]), b.symbol('y')]);
    for (const u of [0.25, 0.75]) {
      expect(key(rotateTree(tree, stubRng({ nextInt: [0], next: [u] }), ctx))).toBe(key(expected));
    }
  });

  it('mutations do not modify their input', () => {
    const tree = b.call('sin', b.op('+', [b.symbol('x'), b.number(2)]));
    const frozen = JSON.stringify(tree);
    const mutate = weightedMutation();
    const rng = createSeededRng(3);
    for (let i = 0; i < 300; i++) {
      mutate(tree, rng, ctx);
    }
    expect(JSON.stringify(tree)).toBe(frozen);
  });
});

describe('mutation picker', () => {
  const order = [
    'rotateTree',
    'addNode',
    'deleteNode',
    'mutateOperator',
    'identity',
    'swapOperands',
    'mutateFeature',
    'mutateConstant',
    'insertNode',
    'simplifyConstants',
    'randomizeTree',
  ] as const;

  function rngOf(u: number): SeededRng {
    return stubRng({ next: [u] });
  }

  it('walks the table in draw order with half-open intervals', () => {
    const sum = Object.values(DEFAULT_MUTATION_WEIGHTS).reduce((a, w) => a + w, 0);
    expect(sum).toBeCloseTo(8.512392, 12);
    expect(drawMutationOperator(rngOf(0))).toBe('rotateTree');
    expect(drawMutationOperator(rngOf(4.25 / sum))).toBe('rotateTree');
    expect(drawMutationOperator(rngOf(4.27 / sum))).toBe('addNode');
    expect(drawMutationOperator(rngOf(6.72 / sum))).toBe('addNode');
    expect(drawMutationOperator(rngOf(6.74 / sum))).toBe('deleteNode');
    expect(drawMutationOperator(rngOf(1 - 1e-12))).toBe('randomizeTree');
  });

  it('never returns a key whose weight is zero', () => {
    const weights = Object.fromEntries(order.map((k) => [k, 0])) as Record<
      (typeof order)[number],
      number
    >;
    weights.mutateConstant = 1;
    expect(drawMutationOperator(rngOf(0), weights)).toBe('mutateConstant');
    expect(drawMutationOperator(rngOf(1 - 1e-16), weights)).toBe('mutateConstant');
  });

  it('rejects weights that cannot form a distribution', () => {
    const bad = (patch: Partial<Record<(typeof order)[number], number>>) =>
      weightedMutation({ ...DEFAULT_MUTATION_WEIGHTS, ...patch });
    expect(() => bad({ addNode: -1 })).toThrow(RangeError);
    expect(() => bad({ addNode: Number.NaN })).toThrow(RangeError);
    expect(() => bad({ addNode: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    const zeros = Object.fromEntries(order.map((k) => [k, 0])) as Record<
      (typeof order)[number],
      number
    >;
    expect(() => weightedMutation(zeros)).toThrow(RangeError);
    const missing = { ...DEFAULT_MUTATION_WEIGHTS } as Partial<
      Record<(typeof order)[number], number>
    >;
    delete missing.addNode;
    expect(() => weightedMutation(missing as Record<(typeof order)[number], number>)).toThrow(
      RangeError
    );
  });

  it('a weighted override selects only the weighted operator', () => {
    const weights = Object.fromEntries(order.map((k) => [k, 0])) as Record<
      (typeof order)[number],
      number
    >;
    weights.swapOperands = 1;
    const mutate = weightedMutation(weights);
    const tree = b.op('*', [b.symbol('x'), b.symbol('y')]);
    expect(key(mutate(tree, createSeededRng(5), ctx))).toBe(
      key(b.op('*', [b.symbol('y'), b.symbol('x')]))
    );
  });
});

describe('public name of the identity mutation', () => {
  it('does not shadow the matrix identity export of the package', () => {
    const eye = matrixIdentity(2) as unknown as { toArray(): number[][] };
    expect(eye.toArray()).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});
