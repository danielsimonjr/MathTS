import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * CHALLENGER findings for G09 (#1557) — indexed assignment that grows a matrix.
 *
 * These rows are NOT fixed on the builder head `9277b26b`. Each one is a real,
 * deterministic divergence from the mathjs 15.3.0 oracle, found by adversarial
 * probing of #1557's own scope (matrix-resizing indexed assignment). They are
 * recorded here as FAILING tests so the parity gap is visible and cannot be
 * mistaken for "already matches".
 *
 * Two families:
 *
 *  F1 / F3 — the *return value* of a column-indexed assignment is the wrong
 *  shape. mathjs reshapes the replacement to the index's shape, so writing a
 *  column with a row vector returns a column (`[[9], [9]]`); compat returns the
 *  un-reshaped row (`[9, 9]`). The stored matrix is identical on both sides —
 *  only the assignment's own result differs. The same rule applies without any
 *  growth (`e[:, 2] = [9, 9]`), with growth (`e[:, 3] = [5, 6]`), with a range
 *  on the row axis (`e[1:2, 2]`), and in 3-D (`m[1, :, 1]`, `m[:, 1, 1]`).
 *
 *  F2 — assignment through an *empty* index on an *empty* matrix must throw in
 *  mathjs. `a = []; a[:] = 5`, `e = []; e[:, 1] = 5`, `e = []; e[1:0] = 3` and
 *  `e = []; e[1:0, 1] = 3` all raise in mathjs (a `shape mismatch` broadcast
 *  error, or `Dimension mismatch`), while compat silently returns the value and
 *  leaves the matrix unchanged. The root cause is `isEmptyIndex`: mathjs only
 *  treats a *scalar* empty range (`start === end`) as empty, so a zero-length
 *  range/colon still reaches the resize path and fails its size validation;
 *  compat returns early for any empty index.
 */

type EvaluateFn = (expr: string, scope?: unknown) => unknown;
const asEvaluate = (value: unknown): EvaluateFn => value as EvaluateFn;

/** Run a sequence of assignments against one scope and return the stored name. */
function grow(exprs: string[], name: string) {
  return (L: Record<string, unknown>) => {
    const ev = asEvaluate(L.evaluate);
    const scope: Record<string, unknown> = {};
    for (const e of exprs) ev(e, scope);
    return scope[name];
  };
}

/** Run a sequence of assignments against one scope and return the LAST result. */
function lastResult(exprs: string[]) {
  return (L: Record<string, unknown>) => {
    const ev = asEvaluate(L.evaluate);
    const scope: Record<string, unknown> = {};
    let last: unknown;
    for (const e of exprs) last = ev(e, scope);
    return last;
  };
}

describe('CHALLENGER G09 — indexed assignment auto-resize findings (#1557)', () => {
  // ---------------------------------------------------------------------------
  // F1 — a column-indexed assignment returns a wrongly-shaped value.
  // ---------------------------------------------------------------------------
  describe('F1: column assignment return value shape', () => {
    it('F1a no-growth column write returns a column, not the row', () => {
      expectSame(
        'e = [[1,2],[3,4]]; e[:, 2] = [9, 9]',
        {},
        lastResult(['e = [[1,2],[3,4]]', 'e[:, 2] = [9, 9]'])
      );
    });

    it('F1b growing column write returns a column, not the row', () => {
      expectSame(
        'e = [[1,2],[3,4]]; e[:, 3] = [5, 6]',
        {},
        lastResult(['e = [[1,2],[3,4]]', 'e[:, 3] = [5, 6]'])
      );
    });

    it('F1c range on the row axis, scalar column', () => {
      expectSame(
        'e = [[1,2],[3,4]]; e[1:2, 2] = [9, 9]',
        {},
        lastResult(['e = [[1,2],[3,4]]', 'e[1:2, 2] = [9, 9]'])
      );
    });

    it('F1d 3-D middle axis colon', () => {
      expectSame(
        'm = zeros(2,2,2); m[1, :, 1] = [5, 6]',
        {},
        lastResult(['m = zeros(2,2,2)', 'm[1, :, 1] = [5, 6]'])
      );
    });

    it('F1e 3-D first axis colon', () => {
      expectSame(
        'm = zeros(2,2,2); m[:, 1, 1] = [5, 6]',
        {},
        lastResult(['m = zeros(2,2,2)', 'm[:, 1, 1] = [5, 6]'])
      );
    });

    it('F1f the stored matrix is correct — only the returned value differs', () => {
      // This is the control: it passes today, so F1a-F1e isolate the RETURN value.
      expectSame(
        'e[store] after e[:, 3] = [5, 6]',
        {},
        grow(['e = [[1,2],[3,4]]', 'e[:, 3] = [5, 6]'], 'e')
      );
      const { compat } = pair({});
      const ev = asEvaluate(compat.evaluate);
      const scope: Record<string, unknown> = {};
      ev('e = [[1,2],[3,4]]', scope);
      ev('e[:, 3] = [5, 6]', scope);
      expect(compat.format(scope.e, { precision: 14 })).toBe('[[1, 2, 5], [3, 4, 6]]');
    });
  });

  // ---------------------------------------------------------------------------
  // F2 — an empty index on an empty matrix must throw, not silently no-op.
  // ---------------------------------------------------------------------------
  describe('F2: empty index on an empty matrix must throw', () => {
    it('F2a a = []; a[:] = 5 throws (mathjs: shape mismatch)', () => {
      expectSame('a = []; a[:] = 5', {}, lastResult(['a = []', 'a[:] = 5']));
    });

    it('F2b e = []; e[:, 1] = 5 throws (mathjs: Dimension mismatch)', () => {
      expectSame('e = []; e[:, 1] = 5', {}, lastResult(['e = []', 'e[:, 1] = 5']));
    });

    it('F2c a = []; a[1:0] = 3 throws (empty range)', () => {
      expectSame('a = []; a[1:0] = 3', {}, lastResult(['a = []', 'a[1:0] = 3']));
    });

    it('F2d a = []; a[2:1] = 3 throws (reversed range)', () => {
      expectSame('a = []; a[2:1] = 3', {}, lastResult(['a = []', 'a[2:1] = 3']));
    });

    it('F2e e = []; e[1:0, 1] = 3 throws (empty range on the row axis)', () => {
      expectSame('e = []; e[1:0, 1] = 3', {}, lastResult(['e = []', 'e[1:0, 1] = 3']));
    });

    it('F2f the matrix is left unchanged by the failed write (compat side)', () => {
      // Pin what compat does instead of throwing: it returns the value and the
      // matrix stays empty. This is the observable wrong behavior, independent
      // of the oracle comparison above.
      const { compat } = pair({});
      const ev = asEvaluate(compat.evaluate);
      const scope: Record<string, unknown> = {};
      ev('a = []', scope);
      ev('a[:] = 5', scope);
      expect(compat.typeOf(scope.a)).toBe('DenseMatrix');
      expect(compat.format(scope.a, { precision: 14 })).toBe('[]');
    });
  });

  // ---------------------------------------------------------------------------
  // Controls: these pass on the builder head. They bound the findings so the
  // report cannot be read as "growth is broken" — growth itself is correct.
  // ---------------------------------------------------------------------------
  describe('controls — correct today, bound the findings', () => {
    it('C1 the issue repro grows correctly', () => {
      expectSame(
        'e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]',
        {},
        grow(['e = []', 'e[1, 1:2] = [5, 6]', 'e[2, :] = [7, 8]'], 'e')
      );
    });

    it('C2 1-D growth is correct', () => {
      expectSame('a = []; a[3] = 4', {}, grow(['a = []', 'a[3] = 4'], 'a'));
    });

    it('C3 3-D growth is correct', () => {
      expectSame('m = []; m[2, 3, 2] = 9', {}, grow(['m = []', 'm[2, 3, 2] = 9'], 'm'));
    });

    it('C4 row-axis growth return value is correct', () => {
      expectSame(
        'e = [[1,2],[3,4]]; e[3, :] = [5, 6]',
        {},
        lastResult(['e = [[1,2],[3,4]]', 'e[3, :] = [5, 6]'])
      );
    });
  });
});
