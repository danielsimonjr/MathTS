import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng, type SeededRng } from '@danielsimonjr/mathts-core';
import {
  addNode,
  crossoverSubtrees,
  DEFAULT_MUTATION_WEIGHTS,
  deleteNode,
  drawMutationOperator,
  identity,
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
  it('identity returns the same tree without using rng', () => {
    const tree = b.op('+', [b.symbol('x'), b.number(1)]);
    expect(key(identity(tree, stubRng({}), ctx))).toBe(key(tree));
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
    const keysA: string[] = [];
    const keysB: string[] = [];
    for (let i = 0; i < 20; i++) {
      const outA = mutate(tree, createSeededRng(1), ctx);
      keysA.push(outA === null ? 'null' : scalarCanonicalKey(outA));
    }
    for (let i = 0; i < 20; i++) {
      const outB = mutate(tree, createSeededRng(1), ctx);
      keysB.push(outB === null ? 'null' : scalarCanonicalKey(outB));
    }
    expect(keysA).toEqual(keysB);
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
