import { describe, expect, it } from 'vitest';
import { create as createMathjs, all as mathjsAll } from 'mathjs';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';

/**
 * CHALLENGER (G13 adversarial stage) — FAILING TESTS.
 *
 * The G13 builder populates `expression.transform` (26 keys) and
 * `expression.mathWithTransform` correctly, and `mathWithTransform.apply`
 * itself is the one-based transform. But the compat *evaluator* does not
 * resolve `apply` from that namespace: `evaluate('apply(...)')` runs the
 * zero-based `apply` alias (`mapSlices`, `formerly: 'apply'`) from the module
 * math scope instead of the one-based transform in `mathWithTransform`.
 *
 * These tests pin the divergence against live mathjs 15.3.0.
 */

type Probe = {
  evaluate(expr: string, scope?: Record<string, unknown>): unknown;
  compile(expr: string): { evaluate(scope?: Record<string, unknown>): unknown };
  parse(expr: string): { evaluate(scope?: Record<string, unknown>): unknown };
};

const mj = createMathjs(mathjsAll, {}) as unknown as Probe;
const mt = createCompat(compatAll, {}) as unknown as Probe;

/** Flatten any Matrix/array result to a plain array for a stable comparison. */
const plain = (value: unknown): unknown =>
  value !== null && typeof value === 'object' && 'toArray' in value
    ? (value as { toArray(): unknown }).toArray()
    : value;

describe('G13 challenger — apply via evaluate/compile/parse', () => {
  it('mathjs treats apply as one-based inside evaluate (baseline)', () => {
    expect(plain(mj.evaluate('apply([[1,2],[3,4]], 2, sum)'))).toEqual([3, 7]);
    expect(plain(mj.evaluate('apply([[1,2],[3,4]], 1, sum)'))).toEqual([4, 6]);
  });

  it('evaluate("apply(M, 2, sum)") is the one-based transform, like mathjs', () => {
    // FAILS on builder head: IndexError "Index out of range (2 > 1)" — the
    // zero-based alias rejects dim 2 instead of slicing along it.
    expect(plain(mt.evaluate('apply([[1,2],[3,4]], 2, sum)'))).toEqual(
      plain(mj.evaluate('apply([[1,2],[3,4]], 2, sum)'))
    );
  });

  it('evaluate("apply(M, 1, sum)") is the one-based transform, like mathjs', () => {
    // FAILS on builder head: returns [3, 7] (0-based alias) instead of [4, 6].
    expect(plain(mt.evaluate('apply([[1,2],[3,4]], 1, sum)'))).toEqual(
      plain(mj.evaluate('apply([[1,2],[3,4]], 1, sum)'))
    );
  });

  it('compile("apply(...)").evaluate() matches mathjs', () => {
    expect(plain(mt.compile('apply([[1,2],[3,4]], 2, sum)').evaluate())).toEqual(
      plain(mj.compile('apply([[1,2],[3,4]], 2, sum)').evaluate())
    );
  });

  it('parse("apply(...)").evaluate() matches mathjs', () => {
    // FAILS on builder head: "Undefined function apply".
    expect(plain(mt.parse('apply([[1,2],[3,4]], 2, sum)').evaluate())).toEqual(
      plain(mj.parse('apply([[1,2],[3,4]], 2, sum)').evaluate())
    );
  });

  it('apply is consistent with its sibling mapSlices inside evaluate', () => {
    // mapSlices resolves the one-based transform in both engines ...
    expect(plain(mt.evaluate('mapSlices([[1,2],[3,4]], 2, sum)'))).toEqual(
      plain(mj.evaluate('mapSlices([[1,2],[3,4]], 2, sum)'))
    );
    // ... so `apply` (the former name of mapSlices) must resolve too.
    expect(plain(mt.evaluate('apply([[1,2],[3,4]], 2, sum)'))).toEqual(
      plain(mj.evaluate('apply([[1,2],[3,4]], 2, sum)'))
    );
  });
});
