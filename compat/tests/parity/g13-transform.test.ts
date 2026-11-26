import { describe, expect, it } from 'vitest';
import { create as createMathjs, all as mathjsAll } from 'mathjs';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';

/**
 * #1572 — compat `expression.transform` was empty (0 of 26) and
 * `mathWithTransform` carried 3 of 315 entries. G13 wires the 26 mathjs
 * transforms onto `instance.expression.transform` and mirrors mathjs's
 * `mathWithTransform`: every instance function and constant, with the 26
 * transform names holding their transform versions.
 *
 * Compat keeps the expression denylist (#1549/#1216: `evaluate`, `parse`,
 * `compile`, `typed`, `import`, …) out of `mathWithTransform` — pinned by
 * `dogfood-g16-mathjs-compat-surface.test.ts` — so the key set is asserted
 * against the oracle minus those names, plus the documented compat-only
 * `compatBlockResultSet` compiler gate (#1556).
 */

const TRANSFORM_KEYS = [
  'and',
  'apply',
  'bitAnd',
  'bitOr',
  'column',
  'concat',
  'cumsum',
  'diff',
  'filter',
  'forEach',
  'index',
  'map',
  'mapSlices',
  'max',
  'mean',
  'min',
  'nullish',
  'or',
  'print',
  'quantileSeq',
  'range',
  'row',
  'std',
  'subset',
  'sum',
  'variance',
] as const;

/** The compat expression denylist: names an expression must never resolve (#1549). */
const COMPAT_DENYLIST = [
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'typed',
  'simplify',
  'derivative',
  'help',
  'chain',
  'parser',
  'resolve',
] as const;

/** The one compat-only `mathWithTransform` entry: the #1556 block-ResultSet gate. */
const COMPAT_ONLY_KEYS = ['compatBlockResultSet'] as const;

/** Transform behavior comparisons that take plain (non-rawArgs) arguments. */
const MATRIX = [
  [1, 5],
  [3, 4],
];

describe('G13 — expression.transform (#1572)', () => {
  const mt = createCompat(compatAll, {});
  const mj = createMathjs(mathjsAll, {}) as unknown as {
    expression: { transform: Record<string, unknown>; mathWithTransform: Record<string, unknown> };
    evaluate(expression: string): unknown;
    format(value: unknown, options: { precision: number }): string;
    add: unknown;
  };
  const mtTransform = mt.expression.transform;
  const mjTransform = mj.expression.transform;
  const mjMwt = mj.expression.mathWithTransform;

  it('has exactly the 26 transform keys of the mathjs oracle', () => {
    expect(Object.keys(mtTransform).sort()).toEqual(Object.keys(mjTransform).sort());
    expect(Object.keys(mtTransform)).toHaveLength(26);
    for (const key of TRANSFORM_KEYS) {
      expect(typeof mtTransform[key], key).toBe('function');
      expect(Object.prototype.hasOwnProperty.call(mtTransform, key), key).toBe(true);
    }
  });

  it('exposes the same function objects through mathWithTransform', () => {
    const mwt = mt.expression.mathWithTransform;
    for (const key of TRANSFORM_KEYS) {
      // mathjs resolves the former `apply` name to the `mapSlices` transform in
      // `mathWithTransform`, while `transform.apply` is its own instance.
      const expected = key === 'apply' ? mtTransform.mapSlices : mtTransform[key];
      expect(mwt[key], key).toBe(expected);
      expect(mjMwt[key], 'mathjs ' + key).toBe(
        key === 'apply' ? mjTransform.mapSlices : mjTransform[key]
      );
    }
    // Plain functions keep the instance identity, like mathjs.
    expect(mwt.add).toBe(mt.add);
    expect(mjMwt.add).toBe(mj.add);
  });

  it('mirrors the oracle mathWithTransform key set', () => {
    const mwtKeys = Object.keys(mt.expression.mathWithTransform).sort();
    const expected = new Set(Object.keys(mj.expression.mathWithTransform));
    for (const name of COMPAT_DENYLIST) expected.delete(name);
    for (const name of COMPAT_ONLY_KEYS) expected.add(name);
    expect(mwtKeys).toHaveLength(expected.size);
    expect(mwtKeys).toEqual([...expected].sort());
    for (const key of mwtKeys) {
      expect(Object.prototype.hasOwnProperty.call(mt.expression.mathWithTransform, key), key).toBe(
        true
      );
    }
  });

  it('matches the oracle on the transform behavior of the dim-capable functions', () => {
    type Transform = (...args: unknown[]) => unknown;
    const both = (key: keyof typeof mtTransform): [Transform, Transform] => [
      mtTransform[key] as Transform,
      mjTransform[key] as Transform,
    ];
    for (const key of ['max', 'min', 'mean', 'std', 'variance', 'sum', 'cumsum', 'diff'] as const) {
      const [mtFn, mjFn] = both(key);
      expect(JSON.stringify(mtFn(MATRIX, 1)), key).toBe(JSON.stringify(mjFn(MATRIX, 1)));
      expect(JSON.stringify(mtFn(MATRIX, 2)), key + ' dim 2').toBe(JSON.stringify(mjFn(MATRIX, 2)));
    }
    for (const key of ['column', 'row', 'concat'] as const) {
      const [mtFn, mjFn] = both(key);
      expect(JSON.stringify(mtFn(MATRIX, 1)), key).toBe(JSON.stringify(mjFn(MATRIX, 1)));
    }
    const double = (x: unknown): number => (x as number) * 2;
    const [mtApply, mjApply] = both('apply');
    expect(JSON.stringify(mtApply(MATRIX, 1, double)), 'apply').toBe(
      JSON.stringify(mjApply(MATRIX, 1, double))
    );
  });

  it('keeps the one-based evaluate semantics that already matched', () => {
    expect(mt.format(mt.evaluate('max([[1, 5], [3, 4]], 1)'), { precision: 14 })).toBe('[3, 5]');
    expect(mt.format(mj.evaluate('max([[1, 5], [3, 4]], 1)'), { precision: 14 })).toBe('[3, 5]');
  });

  it('keeps config-dependent constants live in mathWithTransform', () => {
    const big = createCompat(compatAll, { number: 'BigNumber' });
    expect(big.typeOf(big.expression.mathWithTransform.pi)).toBe('BigNumber');
    const instance = createCompat(compatAll, {});
    instance.config({ number: 'BigNumber' });
    expect(instance.typeOf(instance.expression.mathWithTransform.pi)).toBe('BigNumber');
    expect(instance.typeOf(instance.evaluate('pi'))).toBe('BigNumber');
  });
});
