/**
 * #996 (follow-up M8): typed `round` with a decimal count and a collection.
 *
 * The signature table had only the one-argument `'Array | Matrix'` row, so
 * `round([1.005, 2.675], 2)` threw "Too many arguments" and `round(2.675, [1, 2])` threw
 * "Unexpected type of argument". mathjs maps the scalar rows over the leaves
 * (`matAlgo14xDs`, `matAlgo11xS0s`, `matAlgo12xSfs`). The oracle is mathjs in the same process.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import * as F from '../src/index.js';
import { create, all } from '../../compat/src/index.js';

type Fn = (...a: unknown[]) => unknown;
const round = F.round as unknown as Fn;
const matrix = F.matrix as unknown as Fn;
const sparse = F.sparse as unknown as Fn;
const bignumber = F.bignumber as unknown as Fn;
const compat = create(all) as unknown as Record<'round' | 'evaluate', Fn>;

/** A leaf as text that keeps the sign of zero and the numeric type. */
function leaf(v: unknown): string {
  if (typeof v === 'number') return Object.is(v, -0) ? 'n:-0' : `n:${v}`;
  if (v instanceof BigNumber || mathjs.isBigNumber(v)) return `b:${String(v)}`;
  if (v instanceof Complex || mathjs.isComplex(v)) {
    const z = v as { re: number; im: number };
    return `c:${leaf(z.re)},${leaf(z.im)}`;
  }
  return `?:${String(v)}`;
}

function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shape);
  if (v !== null && typeof v === 'object' && 'toArray' in v) {
    return { matrix: shape((v as { toArray(): unknown }).toArray()) };
  }
  return leaf(v);
}

function same(got: unknown, want: unknown): void {
  expect(shape(got)).toEqual(shape(want));
}

describe('round(collection, n) maps the scalar rows over the leaves (#996, M8)', () => {
  const cases: Array<[string, unknown, unknown, unknown, unknown]> = [
    ['[1.005, 2.675], 2', [1.005, 2.675], 2, [1.005, 2.675], 2],
    ['[[-2.555], [-0]], 2', [[-2.555], [-0]], 2, [[-2.555], [-0]], 2],
    ['[-0, -2.5, 0.5], 0', [-0, -2.5, 0.5], 0, [-0, -2.5, 0.5], 0],
    ['[1.005], bignumber(2)', [1.005], bignumber(2), [1.005], mathjs.bignumber(2)],
    [
      '[complex(1.005, -2.675), 1.005], 2',
      [new Complex(1.005, -2.675), 1.005],
      2,
      [mathjs.complex(1.005, -2.675), 1.005],
      2,
    ],
  ];

  it.each(cases)('round(%s)', (_label, x, n, mx, mn) => {
    same(round(x, n), mathjs.round(mx as number[], mn as number));
    same(compat.round(x, n), mathjs.round(mx as number[], mn as number));
  });

  it('a dense and a sparse matrix keep their class', () => {
    same(round(matrix([1.005, -0]), 2), mathjs.round(mathjs.matrix([1.005, -0]), 2));
    const s = round(
      sparse([
        [1.005, 0],
        [0, -2.675],
      ]),
      2
    ) as { toArray(): unknown };
    expect(shape(s.toArray())).toEqual(
      shape(
        (
          mathjs.round(
            mathjs.sparse([
              [1.005, 0],
              [0, -2.675],
            ]),
            2
          ) as unknown as {
            toArray(): unknown;
          }
        ).toArray()
      )
    );
  });

  it('a scalar with a collection of counts', () => {
    same(round(2.675, [1, 2]), mathjs.round(2.675, [1, 2]));
    same(round(-2.675, [[0], [2]]), mathjs.round(-2.675, [[0], [2]]));
    same(
      round(new Complex(1.005, 2.675), [1, 2]),
      mathjs.round(mathjs.complex(1.005, 2.675), [1, 2])
    );
    same(round(bignumber('2.675'), [1, 2]), mathjs.round(mathjs.bignumber('2.675'), [1, 2]));
    same(round(2.675, matrix([1, 2])), mathjs.round(2.675, mathjs.matrix([1, 2])));
  });

  it('the evaluators', () => {
    const expr = 'round([1.005, 2.675], 2)';
    // mathjs evaluates an array literal to a Matrix (its `matrix` config); compare the entries.
    const entries = (v: unknown): unknown =>
      v !== null && typeof v === 'object' && 'toArray' in v
        ? (v as { toArray(): unknown }).toArray()
        : v;
    same(entries((F.evaluate as unknown as Fn)(expr)), entries(mathjs.evaluate(expr)));
    same(entries(compat.evaluate(expr)), entries(mathjs.evaluate(expr)));
  });

  it('each leaf takes the scalar row, also for a count outside 0..15 (MathTS extension, D2)', () => {
    same(round([123.456, -25], -1), [round(123.456, -1), round(-25, -1)]);
  });
});
