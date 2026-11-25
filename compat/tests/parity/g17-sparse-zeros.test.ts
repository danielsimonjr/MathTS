import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Differential tests for the sparse structural zeros of BigNumber, Fraction and
 * Unit (#1582), run against the mathjs 15.3.0 oracle (the compat devDependency).
 * mathjs builds a SparseMatrix with a typed zero test, so a BigNumber 0, a
 * Fraction 0, and a Unit whose value is 0 are dropped like a number 0 is; compat
 * kept them because its store checks compared with `!== 0`.
 *
 * The number-config rows pin that a number sparse matrix is unchanged.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const configured = (L: Instance, config: Record<string, string>): Instance =>
  (typeof L.version === 'string' && L.version.startsWith('0.')
    ? createCompat(compatAll, config)
    : create(all, config)) as unknown as Instance;

const densityOf = (value: unknown): number => (value as { density(): number }).density();

const CASES: [string, (L: Instance) => unknown][] = [
  [
    '#1582 unit(sparse([[1, 0], [0, 2]]))',
    (L) =>
      L.unit(
        L.sparse([
          [1, 0],
          [0, 2],
        ])
      ),
  ],
  [
    '#1582 [BigNumber config] sparse([[3, 0], [5, 0]]).density()',
    (L) =>
      densityOf(
        configured(L, { number: 'BigNumber' }).sparse([
          [3, 0],
          [5, 0],
        ])
      ),
  ],
  [
    "#1582 [BigNumber config] rotationMatrix(1, matrix([0, 0, 1]), 'sparse').density()",
    (L) => {
      const big = configured(L, { number: 'BigNumber' });
      return densityOf(big.rotationMatrix(1, big.matrix([0, 0, 1]), 'sparse'));
    },
  ],
  [
    '#1582 control: sparse([[3, 0], [5, 0]]).density() (number config)',
    (L) =>
      densityOf(
        L.sparse([
          [3, 0],
          [5, 0],
        ])
      ),
  ],
  [
    '#1582 [Fraction config] sparse([[3, 0], [5, 0]]).density()',
    (L) =>
      densityOf(
        configured(L, { number: 'Fraction' }).sparse([
          [3, 0],
          [5, 0],
        ])
      ),
  ],
  [
    '#1582 control: unit(sparse([[1, 0], [0, 2]])) nonzero entries',
    (L) =>
      (
        L.unit(
          L.sparse([
            [1, 0],
            [0, 2],
          ])
        ) as { get(i: number[]): unknown }
      ).get([1, 1]),
  ],
];

function show(
  L: { typeOf(v: unknown): string; format(v: unknown, o: object): string },
  v: unknown
) {
  return L.typeOf(v) + ' ' + L.format(v, { precision: 14 });
}

describe('sparse structural zeros of BigNumber, Fraction and Unit (#1582)', () => {
  for (const [label, run] of CASES) {
    it(label, () => {
      const oracle = create(all, {});
      const compat = createCompat(compatAll, {});
      const both: Instance[] = [oracle as unknown as Instance, compat as unknown as Instance];
      const outcomes = both.map((L) => {
        try {
          return { value: show(L, run(L)) };
        } catch (e) {
          return {
            error: (e as Error).name,
            message: (e as Error).message.split(':')[0],
          };
        }
      });
      expect(outcomes[1]).toEqual(outcomes[0]);
    });
  }

  it('#1582 the Unit zeros are not stored (density, not just format)', () => {
    const compat = createCompat(compatAll, {});
    const m = compat.unit(
      compat.sparse([
        [1, 0],
        [0, 2],
      ])
    );
    expect(densityOf(m)).toBe(0.5);
    expect(compat.typeOf((m as { get(i: number[]): unknown }).get([1, 1]))).toBe('Unit');
  });

  it('creating a compat instance does not change native number-sparse results', async () => {
    const { sparse: nativeSparse } = await import('@danielsimonjr/mathts-functions');
    const before = densityOf(
      nativeSparse([
        [3, 0],
        [5, 0],
      ])
    );
    createCompat(compatAll, {});
    const after = densityOf(
      nativeSparse([
        [3, 0],
        [5, 0],
      ])
    );
    expect(before).toBe(0.5);
    expect(after).toBe(0.5);
  });
});
