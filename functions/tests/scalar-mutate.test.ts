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
  type ScalarMutationOperator,
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

  it('rotateTree golden: only left rotation applies', () => {
    const tree = b.op('+', [b.op('*', [b.symbol('x'), b.symbol('y')]), b.symbol('c')]);
    const expected = b.op('*', [b.symbol('x'), b.op('+', [b.symbol('y'), b.symbol('c')])]);
    expect(key(rotateTree(tree, stubRng({ nextInt: [0], next: [0.75] }), ctx))).toBe(key(expected));
  });

  it('rotateTree golden: both directions at the same node', () => {
    const tree = b.op('+', [
      b.op('*', [b.symbol('x'), b.symbol('y')]),
      b.op('*', [b.symbol('x'), b.symbol('c')]),
    ]);
    const leftFirst = b.op('*', [
      b.symbol('x'),
      b.op('+', [b.symbol('y'), b.op('*', [b.symbol('x'), b.symbol('c')])]),
    ]);
    const rightFirst = b.op('*', [
      b.op('+', [b.op('*', [b.symbol('x'), b.symbol('y')]), b.symbol('x')]),
      b.symbol('c'),
    ]);
    expect(key(rotateTree(tree, stubRng({ nextInt: [0], next: [0.25] }), ctx))).toBe(
      key(leftFirst)
    );
    expect(key(rotateTree(tree, stubRng({ nextInt: [0], next: [0.75] }), ctx))).toBe(
      key(rightFirst)
    );
  });

  it('deleteNode keeps the child chosen by the second nextInt draw', () => {
    const tree = b.op('+', [b.symbol('x'), b.symbol('y')]);
    expect(key(deleteNode(tree, stubRng({ nextInt: [0, 0] }), ctx))).toBe(key(b.symbol('x')));
    expect(key(deleteNode(tree, stubRng({ nextInt: [0, 1] }), ctx))).toBe(key(b.symbol('y')));
  });

  it('swapOperands swaps subtraction and division operands', () => {
    const divGrammar: ScalarGrammar = { ...testGrammar, binary: ['-', '/'] };
    const minusTree = b.op('-', [b.symbol('x'), b.symbol('y')]);
    const divTree = b.op('/', [b.symbol('x'), b.symbol('y')]);
    const minusCtx = { ...ctx, grammar: divGrammar };
    expect(key(swapOperands(minusTree, stubRng({ nextInt: [0] }), minusCtx))).toBe(
      key(b.op('-', [b.symbol('y'), b.symbol('x')]))
    );
    expect(key(swapOperands(divTree, stubRng({ nextInt: [0] }), minusCtx))).toBe(
      key(b.op('/', [b.symbol('y'), b.symbol('x')]))
    );
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

/**
 * `scalarCanonicalKey` sorts the operands of `+` and `*`, so a key comparison cannot see a
 * rotation or a swap that exchanged the operands of a commutative operator. These pins compare the
 * raw tree with `JSON.stringify`, on the non-commutative `-` and `/`, and replay the pre-P6-1
 * bodies of `swapOperands`, `deleteNode` and `rotateTree` as a reference over seeded trees.
 */
describe('structural pins: rotation side, swap and delete (P6-1)', () => {
  const raw = (node: ScalarNode | null): string => JSON.stringify(node);
  const ncGrammar: ScalarGrammar = {
    variables: ['x', 'y', 'z'],
    parameters: ['c'],
    literals: [1, 2],
    binary: ['+', '-', '*', '/'],
    unary: ['sin'],
    maxSize: 64,
  };
  const ncCtx: ScalarMutationContext = { ...ctx, grammar: ncGrammar };
  const [x, y, c] = [b.symbol('x'), b.symbol('y'), b.symbol('c')];

  it('rotateTree: only the left child is binary, both coin outcomes rotate left', () => {
    // -( /(x,y), c )  ->  /( x, -(y,c) )
    const tree = b.op('-', [b.op('/', [x, y]), c]);
    const expected = b.op('/', [x, b.op('-', [y, c])]);
    for (const u of [0.25, 0.75]) {
      expect(raw(rotateTree(tree, stubRng({ nextInt: [0], next: [u] }), ncCtx))).toBe(
        raw(expected)
      );
    }
  });

  it('rotateTree: only the right child is binary, both coin outcomes rotate right', () => {
    // -( c, /(x,y) )  ->  /( -(c,x), y )
    const tree = b.op('-', [c, b.op('/', [x, y])]);
    const expected = b.op('/', [b.op('-', [c, x]), y]);
    for (const u of [0.25, 0.75]) {
      expect(raw(rotateTree(tree, stubRng({ nextInt: [0], next: [u] }), ncCtx))).toBe(
        raw(expected)
      );
    }
  });

  it('rotateTree: both children are binary, the coin picks the side', () => {
    // -( /(x,y), *(x,c) )
    const tree = b.op('-', [b.op('/', [x, y]), b.op('*', [x, c])]);
    const left = b.op('/', [x, b.op('-', [y, b.op('*', [x, c])])]);
    const right = b.op('*', [b.op('-', [b.op('/', [x, y]), x]), c]);
    expect(raw(rotateTree(tree, stubRng({ nextInt: [0], next: [0.25] }), ncCtx))).toBe(raw(left));
    expect(raw(rotateTree(tree, stubRng({ nextInt: [0], next: [0.5] }), ncCtx))).toBe(raw(right));
    expect(raw(rotateTree(tree, stubRng({ nextInt: [0], next: [0.75] }), ncCtx))).toBe(raw(right));
  });

  it('swapOperands exchanges the operands of - and / exactly, and nothing else', () => {
    const tree = b.call('sin', b.op('-', [b.op('/', [x, y]), c]));
    // paths with a binary op, in walk order: the `-` (index 0), then the `/` (index 1)
    expect(raw(swapOperands(tree, stubRng({ nextInt: [0] }), ncCtx))).toBe(
      raw(b.call('sin', b.op('-', [c, b.op('/', [x, y])])))
    );
    expect(raw(swapOperands(tree, stubRng({ nextInt: [1] }), ncCtx))).toBe(
      raw(b.call('sin', b.op('-', [b.op('/', [y, x]), c])))
    );
  });

  it('deleteNode draws the path first and the surviving child second', () => {
    const tree = b.op('-', [b.op('/', [x, y]), c]);
    const draws: number[] = [];
    const rng = stubRng({ nextInt: [1, 1] });
    const spy: SeededRng = {
      ...rng,
      nextInt: (max) => {
        const v = rng.nextInt(max);
        draws.push(max, v);
        return v;
      },
    };
    // two binary paths: the root `-` and the inner `/`; the first draw (1) picks the `/`
    expect(raw(deleteNode(tree, spy, ncCtx))).toBe(raw(b.op('-', [y, c])));
    expect(draws).toEqual([2, 1, 2, 1]);
  });

  function randomTree(rng: SeededRng, budget: number): ScalarNode {
    if (budget <= 1 || rng.next() < 0.2) {
      const pick = rng.nextInt(4);
      return pick === 0 ? b.symbol('x') : pick === 1 ? b.symbol('y') : pick === 2 ? c : b.number(2);
    }
    if (rng.next() < 0.2) {
      return b.call('sin', randomTree(rng, budget - 1));
    }
    const op = ncGrammar.binary[rng.nextInt(ncGrammar.binary.length)];
    const half = Math.floor((budget - 1) / 2);
    return b.op(op, [randomTree(rng, half), randomTree(rng, budget - 1 - half)]);
  }

  type Path = readonly number[];
  const kids = (n: ScalarNode): readonly ScalarNode[] =>
    n.kind === 'call' ? [n.arg] : n.kind === 'op' ? n.args : [];
  function legacyPaths(node: ScalarNode, pred: (n: ScalarNode) => boolean): Path[] {
    const out: Path[] = [];
    const walk = (n: ScalarNode, path: Path): void => {
      if (pred(n)) {
        out.push(path);
      }
      kids(n).forEach((k, i) => walk(k, [...path, i]));
    };
    walk(node, []);
    return out;
  }
  const legacyAt = (root: ScalarNode, path: Path): ScalarNode =>
    path.reduce<ScalarNode>((cur, i) => kids(cur)[i], root);
  function legacyReplace(root: ScalarNode, path: Path, repl: ScalarNode): ScalarNode {
    if (path.length === 0) {
      return repl;
    }
    const [head, ...rest] = path;
    if (root.kind === 'call') {
      return { kind: 'call', fn: root.fn, arg: legacyReplace(root.arg, rest, repl) };
    }
    if (root.kind !== 'op') {
      return root;
    }
    return {
      kind: 'op',
      op: root.op,
      args: root.args.map((k, i) => (i === head ? legacyReplace(k, rest, repl) : k)),
    };
  }
  const isBin = (n: ScalarNode): boolean => n.kind === 'op' && n.args.length === 2;
  const ok = (grammar: ScalarGrammar, n: ScalarNode): ScalarNode | null =>
    scalarGrammarAccepts(grammar, n) ? n : null;

  function legacySwap(node: ScalarNode, rng: SeededRng, g: ScalarGrammar): ScalarNode | null {
    const paths = legacyPaths(node, isBin);
    if (paths.length === 0) {
      return null;
    }
    const path = paths[rng.nextInt(paths.length)];
    const cur = legacyAt(node, path);
    if (cur.kind !== 'op' || cur.args.length !== 2) {
      return null;
    }
    return ok(
      g,
      legacyReplace(node, path, { kind: 'op', op: cur.op, args: [cur.args[1], cur.args[0]] })
    );
  }
  function legacyDelete(node: ScalarNode, rng: SeededRng, g: ScalarGrammar): ScalarNode | null {
    const paths = legacyPaths(node, isBin);
    if (paths.length === 0) {
      return null;
    }
    const path = paths[rng.nextInt(paths.length)];
    const cur = legacyAt(node, path);
    if (cur.kind !== 'op' || cur.args.length !== 2) {
      return null;
    }
    return ok(g, legacyReplace(node, path, cur.args[rng.nextInt(2)]));
  }
  function legacyLeft(n: ScalarNode): ScalarNode | null {
    if (n.kind !== 'op' || n.args.length !== 2) {
      return null;
    }
    const [l, r] = n.args;
    if (l.kind !== 'op' || l.args.length !== 2) {
      return null;
    }
    return b.op(l.op, [l.args[0], b.op(n.op, [l.args[1], r])]);
  }
  function legacyRight(n: ScalarNode): ScalarNode | null {
    if (n.kind !== 'op' || n.args.length !== 2) {
      return null;
    }
    const [l, r] = n.args;
    if (r.kind !== 'op' || r.args.length !== 2) {
      return null;
    }
    return b.op(r.op, [b.op(n.op, [l, r.args[0]]), r.args[1]]);
  }
  function legacyRotate(node: ScalarNode, rng: SeededRng, g: ScalarGrammar): ScalarNode | null {
    const paths = legacyPaths(
      node,
      (n) => n.kind === 'op' && n.args.length === 2 && (isBin(n.args[0]) || isBin(n.args[1]))
    );
    if (paths.length === 0) {
      return null;
    }
    const path = paths[rng.nextInt(paths.length)];
    const cur = legacyAt(node, path);
    if (cur.kind !== 'op') {
      return null;
    }
    const rotated =
      rng.next() < 0.5
        ? (legacyLeft(cur) ?? legacyRight(cur))
        : (legacyRight(cur) ?? legacyLeft(cur));
    return rotated === null ? null : ok(g, legacyReplace(node, path, rotated));
  }

  it('swapOperands, deleteNode and rotateTree match the pre-P6-1 bodies, tree and rng state', () => {
    const cases: Array<
      [
        string,
        ScalarMutationOperator,
        (n: ScalarNode, r: SeededRng, g: ScalarGrammar) => ScalarNode | null,
      ]
    > = [
      ['swapOperands', swapOperands, legacySwap],
      ['deleteNode', deleteNode, legacyDelete],
      ['rotateTree', rotateTree, legacyRotate],
    ];
    let produced = 0;
    for (const [name, current, legacy] of cases) {
      for (let seed = 1; seed <= 600; seed++) {
        const tree = randomTree(createSeededRng(seed * 7919), 3 + (seed % 17));
        const a = createSeededRng(seed);
        const r = createSeededRng(seed);
        const got = current(tree, a, ncCtx);
        const want = legacy(tree, r, ncGrammar);
        expect(raw(got), `${name} seed ${seed}`).toBe(raw(want));
        // the same draws were consumed, so every later draw of a seeded search is unchanged
        expect(a.next(), `${name} seed ${seed} rng`).toBe(r.next());
        if (got !== null) {
          produced++;
        }
      }
    }
    expect(produced).toBeGreaterThan(900);
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
