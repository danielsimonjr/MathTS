import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * G09 — indexed assignment that grows a matrix (#1557).
 *
 * mathjs grows a matrix on indexed assignment: `e = []; e[1, 1:2] = [5, 6];
 * e[2, :] = [7, 8]` ends as `DenseMatrix [[5, 6], [7, 8]]`, and 1-D growth
 * `a = []; a[3] = 4` ends as `[0, 0, 4]`. The growth lives in the `subset`
 * implementation the assignment path calls (resize to max(current, index) and
 * pad with the default value 0), so the direct `subset` rows double as the
 * control that the assignment row cannot drift from.
 *
 * The compat expression policy opts into assignment by default, so the rows
 * run with the default scope options on both sides.
 */

type EvaluateFn = (expr: string, scope?: unknown, options?: unknown) => unknown;
type IndexFn = (...args: unknown[]) => unknown;

const asEvaluate = (value: unknown): EvaluateFn => value as EvaluateFn;
const asFn = (value: unknown): IndexFn => value as IndexFn;

describe('G09 indexed assignment auto-resize (#1557)', () => {
  // The three repro rows from the issue, exactly as captured there.
  it('matches the oracle on the 2-D expression repro', () => {
    expectSame('e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('e = []', scope);
      ev('e[1, 1:2] = [5, 6]', scope);
      ev('e[2, :] = [7, 8]', scope);
      return ev('e', scope);
    });
  });

  it('matches the oracle on subset(matrix([]), ...) — the direct resize control', () => {
    expectSame('subset(matrix([]), index(1, [0, 1]), [5, 6])', {}, (L) =>
      asFn(L.subset)(asFn(L.matrix)([]), asFn(L.index)(1, [0, 1]), [5, 6])
    );
  });

  it('matches the oracle on subset([], ..., 0) — the plain-array resize control', () => {
    expectSame('subset([], index(1, [0, 1]), [5, 6], 0)', {}, (L) =>
      asFn(L.subset)([], asFn(L.index)(1, [0, 1]), [5, 6], 0)
    );
  });

  it('matches the oracle on 1-D growth a = []; a[3] = 4', () => {
    expectSame('a = []; a[3] = 4', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('a = []', scope);
      ev('a[3] = 4', scope);
      return ev('a', scope);
    });
  });

  // Acceptance criteria: growth via scalars, ranges and `:`, through expressions
  // and through `subset`.
  it('matches the oracle on scalar-index 2-D growth', () => {
    expectSame('e = []; e[1, 1] = 5', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('e = []', scope);
      ev('e[1, 1] = 5', scope);
      return ev('e', scope);
    });
    expectSame('e = []; e[1, 1] = 5; e[2, 2] = 8', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('e = []', scope);
      ev('e[1, 1] = 5', scope);
      ev('e[2, 2] = 8', scope);
      return ev('e', scope);
    });
  });

  it('matches the oracle on range-index 2-D growth', () => {
    expectSame('e = []; e[2:3, 1:2] = [[7, 8], [9, 10]]', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('e = []', scope);
      ev('e[2:3, 1:2] = [[7, 8], [9, 10]]', scope);
      return ev('e', scope);
    });
  });

  it('matches the oracle on a nested accessor assignment that grows', () => {
    expectSame('obj.m[2, 1] = 1 with m = matrix([])', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {
        obj: { m: asFn(L.matrix)([]) },
      };
      ev('obj.m[2, 1] = 1', scope);
      return scope.obj;
    });
  });

  it('matches the oracle on the subset scalar and range resize forms', () => {
    expectSame('subset(matrix([]), index(2, 2), 9)', {}, (L) =>
      asFn(L.subset)(asFn(L.matrix)([]), asFn(L.index)(2, 2), 9)
    );
    expectSame('subset(matrix([]), index([2, 3], [1, 2]), 9)', {}, (L) =>
      asFn(L.subset)(asFn(L.matrix)([]), asFn(L.index)([2, 3], [1, 2]), 9)
    );
  });

  // The issue's `subset` docs example: `f = d * e` after the growth repro.
  it('matches the oracle on the subset docs example f = d * e', () => {
    expectSame('d = [[1, 2], [3, 4]]; e = ...; f = d * e', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('d = [[1, 2], [3, 4]]', scope);
      ev('e = []', scope);
      ev('e[1, 1:2] = [5, 6]', scope);
      ev('e[2, :] = [7, 8]', scope);
      return ev('f = d * e', scope);
    });
  });

  // A matrix that does not need to grow keeps its shape: the resize must not
  // overwrite a value that already fits.
  it('matches the oracle on an assignment that does not grow', () => {
    expectSame('a = [1, 2]; a[2] = 9', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('a = [1, 2]', scope);
      ev('a[2] = 9', scope);
      return ev('a', scope);
    });
  });

  // A growth that cannot be expressed as a subset throws the same error.
  it('throws the same error when the replacement does not fit the subset', () => {
    expectSame('a = []; a[2, 1:3] = [7, 8]', {}, (L) => {
      const ev = asEvaluate(L.evaluate);
      const scope: Record<string, unknown> = {};
      ev('a = []', scope);
      return ev('a[2, 1:3] = [7, 8]', scope);
    });
  });

  it('pins the final repro value and type directly on the compat instance', () => {
    const { compat } = pair({});
    const ev = asEvaluate(compat.evaluate);
    const scope: Record<string, unknown> = {};
    ev('e = []', scope);
    ev('e[1, 1:2] = [5, 6]', scope);
    ev('e[2, :] = [7, 8]', scope);
    const e = ev('e', scope);
    expect(compat.typeOf(e)).toBe('DenseMatrix');
    expect(compat.format(e, { precision: 14 })).toBe('[[5, 6], [7, 8]]');
    const scope1d: Record<string, unknown> = {};
    ev('a = []', scope1d);
    ev('a[3] = 4', scope1d);
    expect(compat.format(ev('a', scope1d), { precision: 14 })).toBe('[0, 0, 4]');
  });
});
