/**
 * Dogfood #1169 (code review C1, F1 and F2) - lsolve, lsolveAll and usolveAll of a regular
 * triangular system near 1e-100.
 *
 * The diagonal test used the absolute tolerance of `equalScalar`, so every diagonal entry
 * near 1e-100 counted as zero: lsolve threw "singular" and lsolveAll / usolveAll returned
 * [] (no solution). A triangular matrix is singular only when a diagonal entry is exactly 0,
 * so a number diagonal now uses `=== 0`, as usolve does.
 * Expected values: exact forward and back substitution.
 * L = [[2e-100, 0], [1e-100, 3e-100]], b = [1, 2]: x0 = 5e99, x1 = (2 - 0.5) / 3e-100 = 5e99.
 * U = [[2e-100, 1e-100], [0, 3e-100]], b = [1, 2]: x1 = 2 / 3e-100, x0 = (1 - x1 1e-100) / 2e-100.
 */
import { describe, it, expect } from 'vitest';
import { lsolve, lsolveAll, matrix, sparse, usolveAll } from '../src/factories/index.js';

const L = [
  [2e-100, 0],
  [1e-100, 3e-100],
];
const U = [
  [2e-100, 1e-100],
  [0, 3e-100],
];
const b = [[1], [2]];
const LX = [5e99, 5e99];
const UX = [(1 - (2 / 3e-100) * 1e-100) / 2e-100, 2 / 3e-100];

function column(v: unknown): number[] {
  const a = (
    v && typeof (v as { toArray?: () => unknown }).toArray === 'function'
      ? (v as { toArray: () => unknown }).toArray()
      : v
  ) as number[][];
  return a.map((r) => r[0]);
}

function expectClose(got: number[], want: number[]): void {
  expect(got.length).toBe(want.length);
  got.forEach((g, i) => expect(Math.abs(g / want[i] - 1)).toBeLessThanOrEqual(1e-14));
}

const inputs = [
  ['Array', (m: number[][]) => m],
  ['DenseMatrix', (m: number[][]) => matrix(m)],
  ['SparseMatrix', (m: number[][]) => sparse(m)],
] as const;

describe('C1 F1: lsolve of a diagonal near 1e-100', () => {
  it.each(inputs)('%s', (_name, wrap) => {
    expectClose(column(lsolve(wrap(L), b)), LX);
  });

  it('a diagonal of 1e-16 is regular, not singular', () => {
    expectClose(
      column(
        lsolve(
          [
            [1e-16, 0],
            [1, 1e-16],
          ],
          [1e-16, 2]
        )
      ),
      [1, 1e16]
    );
  });

  it('an exactly zero diagonal with a nonzero right side still throws', () => {
    expect(() =>
      lsolve(
        [
          [0, 0],
          [1, 1],
        ],
        [1, 2]
      )
    ).toThrow('Linear system cannot be solved since matrix is singular');
  });
});

describe('C1 F2: lsolveAll and usolveAll of a diagonal near 1e-100', () => {
  it.each(inputs)('lsolveAll %s', (_name, wrap) => {
    const r = lsolveAll(wrap(L), b) as unknown[];
    expect(r.length).toBe(1);
    expectClose(column(r[0]), LX);
  });

  it.each(inputs)('usolveAll %s', (_name, wrap) => {
    const r = usolveAll(wrap(U), b) as unknown[];
    expect(r.length).toBe(1);
    expectClose(column(r[0]), UX);
  });
});
