/**
 * Dogfood #1235 - slu of a singular sparse matrix.
 *
 * The numeric factorization found no pivot and returned null. slu then read `.L` of null
 * and threw an internal TypeError, and lusolve with an explicit order and threshold
 * forwarded it. slu now throws the same Error that the dense lusolve throws.
 */
import { describe, it, expect } from 'vitest';
import { lusolve as lusolveFn, slu as sluFn, sparse } from '../src/factories/index.js';

const slu = sluFn as (a: unknown, order: number, threshold: number) => unknown;
const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => unknown;

const SINGULAR = /singular/i;
const systems: Array<[string, number[][]]> = [
  [
    'rank deficient 2x2',
    [
      [1, 2],
      [2, 4],
    ],
  ],
  [
    'zero 2x2',
    [
      [0, 0],
      [0, 0],
    ],
  ],
  [
    'zero row 3x3',
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
    ],
  ],
];

describe('dogfood #1235 slu of a singular sparse matrix', () => {
  // Order 2 on these inputs fails in csAmd (issue #1239), not in the factorization.
  for (const order of [0, 1, 3]) {
    for (const threshold of [0.001, 1]) {
      for (const [name, a] of systems) {
        it(`slu throws an Error for ${name}, order ${order}, threshold ${threshold}`, () => {
          let caught: unknown;
          try {
            slu(sparse(a), order, threshold);
          } catch (e) {
            caught = e;
          }
          expect(caught).toBeInstanceOf(Error);
          expect(caught).not.toBeInstanceOf(TypeError);
          expect((caught as Error).message).toMatch(SINGULAR);
        });
        it(`lusolve throws the singular Error for ${name}, order ${order}, threshold ${threshold}`, () => {
          const b = a.map((_, i) => [i + 1]);
          expect(() => lusolve(sparse(a), b, order, threshold)).toThrow(SINGULAR);
          expect(() => lusolve(sparse(a), b, order, threshold)).not.toThrow(TypeError);
        });
      }
    }
  }

  it('lusolve of the dense singular matrix throws the same message', () => {
    expect(() =>
      lusolve(
        [
          [1, 2],
          [2, 4],
        ],
        [[1], [2]]
      )
    ).toThrow('Linear system cannot be solved since matrix is singular');
    expect(() =>
      slu(
        sparse([
          [1, 2],
          [2, 4],
        ]),
        0,
        1
      )
    ).toThrow('Linear system cannot be solved since matrix is singular');
  });

  it('a nonsingular matrix still factorizes', () => {
    const f = slu(
      sparse([
        [4, 3],
        [6, 3],
      ]),
      1,
      0.001
    ) as { L: unknown; U: unknown };
    expect(f.L).toBeTruthy();
    expect(f.U).toBeTruthy();
  });
});
