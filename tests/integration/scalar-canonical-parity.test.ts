/**
 * Canonicalization is an algebraic rewrite. It is bit-exact on the fixtures below
 * (safe integers). It is not a claim about every non-associative IEEE expression.
 * The oracle is `evaluateScalar` of the original and of `scalarCanonical(original)`,
 * compared with `Object.is`.
 */
import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonical,
  scalarCanonicalKey,
} from '@danielsimonjr/mathts-expression';
import { evaluateScalar } from '@danielsimonjr/mathts-functions';

describe('scalar canonical parity with evaluateScalar', () => {
  const scalar = createScalarBuilder();

  const quotientScope = { a: 6, b: 2, c: 3 };
  const a = scalar.symbol('a');
  const b = scalar.symbol('b');
  const c = scalar.symbol('c');
  const x = scalar.symbol('x');

  const quotientTrees = [
    scalar.op('/', [a, scalar.op('/', [b, c])]),
    scalar.op('/', [scalar.op('*', [a, c]), b]),
    scalar.op('*', [scalar.op('*', [c, a]), scalar.op('^', [b, scalar.number(-1)])]),
  ];

  const fixtures: {
    name: string;
    tree: ReturnType<typeof scalar.op>;
    scope: Record<string, number>;
    value: number;
  }[] = [
    { name: 'a/(b/c)', tree: quotientTrees[0], scope: quotientScope, value: 9 },
    { name: '*(a, c) / b', tree: quotientTrees[1], scope: quotientScope, value: 9 },
    { name: '*( *(c, a), ^(b, -1) )', tree: quotientTrees[2], scope: quotientScope, value: 9 },
    { name: '*(x, x)', tree: scalar.op('*', [x, x]), scope: { x: 7 }, value: 49 },
    { name: 'x^2', tree: scalar.op('^', [x, scalar.number(2)]), scope: { x: 7 }, value: 49 },
    {
      name: '(x^2)^3',
      tree: scalar.op('^', [scalar.op('^', [x, scalar.number(2)]), scalar.number(3)]),
      scope: { x: 2 },
      value: 64,
    },
    { name: 'x^6', tree: scalar.op('^', [x, scalar.number(6)]), scope: { x: 2 }, value: 64 },
    {
      name: '-(x, y)',
      tree: scalar.op('-', [scalar.symbol('x'), scalar.symbol('y')]),
      scope: { x: 5, y: 2 },
      value: 3,
    },
    {
      name: '+(1, x, 2)',
      tree: scalar.op('+', [scalar.number(1), x, scalar.number(2)]),
      scope: { x: 4 },
      value: 7,
    },
  ];

  it('quotient rows share one canonical key', () => {
    const keys = quotientTrees.map((t) => scalarCanonicalKey(t));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
  });

  it('x*x and x^2 share a key; (x^2)^3 and x^6 share a key', () => {
    expect(scalarCanonicalKey(scalar.op('*', [x, x]))).toBe(
      scalarCanonicalKey(scalar.op('^', [x, scalar.number(2)]))
    );
    expect(
      scalarCanonicalKey(scalar.op('^', [scalar.op('^', [x, scalar.number(2)]), scalar.number(3)]))
    ).toBe(scalarCanonicalKey(scalar.op('^', [x, scalar.number(6)])));
  });

  for (const { name, tree, scope, value } of fixtures) {
    it(`evaluateScalar agrees for ${name} = ${value}`, () => {
      expect(Object.is(evaluateScalar(tree, scope), value)).toBe(true);
      const canon = scalarCanonical(tree);
      expect(Object.is(evaluateScalar(canon, scope), value)).toBe(true);
    });
  }
});
