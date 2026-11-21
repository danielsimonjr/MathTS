/**
 * #1260 — a decomposition of a nested array with a 3-D or mixed-depth shape.
 *
 * `resolveDimensions` (`operations/as-packed.ts`) checked that each row is an Array of the
 * same length, and never looked at the entries. A row of Arrays passed, and the arithmetic
 * that followed read `[2]` as 2 and `[1, 2]` as NaN, so `qrPivoted([[[1], [2]]])` returned a
 * factorization of a matrix that does not exist. Every function that takes a
 * `DecompositionMatrixInput` reads its input through this one function, so the test runs
 * the whole class. A guard at the end reads the source and fails when a new function that
 * takes a `DecompositionMatrixInput` is not in the table.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  qr,
  qrPivoted,
  lu,
  cholesky,
  svd,
  condest,
  matrixSchur,
  lq,
  rq,
  ql,
  eig,
  eigvals,
  powerIteration,
  lstsq,
  singularValues,
  lowRankApprox,
  pinv,
  cond,
  norm2,
  normFro,
  eigWasm,
  eigvalsWasm,
  spectralRadiusWasm,
  svdWasm,
  decompositionInputToDenseMatrix,
  decompositionInputToNestedArray,
} from '../src/index.js';
import { decompositionSource } from '../src/operations/as-packed.js';

type Call = (a: unknown) => unknown;

/** Every function of the class, with the extra arguments that it needs. */
const FUNCTIONS: Record<string, { call: Call; valid?: number[][] }> = {
  qr: { call: (a) => qr(a as number[][]) },
  qrPivoted: { call: (a) => qrPivoted(a as number[][]) },
  lu: { call: (a) => lu(a as number[][]) },
  cholesky: {
    call: (a) => cholesky(a as number[][]),
    valid: [
      [4, 2],
      [2, 3],
    ],
  },
  svd: { call: (a) => svd(a as number[][]) },
  condest: { call: (a) => condest(a as number[][] as never) },
  matrixSchur: { call: (a) => matrixSchur(a as number[][]) },
  lq: { call: (a) => lq(a as number[][]) },
  rq: { call: (a) => rq(a as number[][]) },
  ql: { call: (a) => ql(a as number[][]) },
  eig: { call: (a) => eig(a as number[][]) },
  eigvals: { call: (a) => eigvals(a as number[][]) },
  powerIteration: { call: (a) => powerIteration(a as number[][]) },
  lstsq: { call: (a) => lstsq(a as number[][], [1, 2]) },
  singularValues: { call: (a) => singularValues(a as number[][]) },
  lowRankApprox: { call: (a) => lowRankApprox(a as number[][], 1) },
  pinv: { call: (a) => pinv(a as number[][]) },
  cond: { call: (a) => cond(a as number[][]) },
  norm2: { call: (a) => norm2(a as number[][]) },
  normFro: { call: (a) => normFro(a as number[][]) },
  eigWasm: { call: (a) => eigWasm(a as number[][]) },
  eigvalsWasm: { call: (a) => eigvalsWasm(a as number[][]) },
  spectralRadiusWasm: { call: (a) => spectralRadiusWasm(a as number[][]) },
  svdWasm: { call: (a) => svdWasm(a as number[][]) },
  decompositionInputToDenseMatrix: {
    call: (a) => decompositionInputToDenseMatrix(a as number[][]),
  },
  decompositionInputToNestedArray: {
    call: (a) => decompositionInputToNestedArray(a as number[][]),
  },
  decompositionSource: { call: (a) => decompositionSource(a as number[][]) },
};

/** The error of a call, whether it throws at once or rejects. */
async function outcome(call: Call, input: unknown): Promise<unknown> {
  try {
    await call(input);
  } catch (e) {
    return e;
  }
  return undefined;
}

const THREE_D: Array<[string, unknown, string]> = [
  ['[[[1],[2]]]', [[[1], [2]]], '[1, 2, 1]'],
  [
    'two 2x2 layers',
    [
      [
        [1, 2],
        [3, 4],
      ],
      [
        [5, 6],
        [7, 8],
      ],
    ],
    '[2, 2, 2]',
  ],
  ['[[[]]]', [[[]]], '[1, 1, 0]'],
];

describe('#1260 decompositions reject a nested array that is not two dimensional', () => {
  describe.each(Object.entries(FUNCTIONS))('%s', (_name, { call, valid }) => {
    it.each(THREE_D)('%s throws a RangeError that names the size', async (_label, input, size) => {
      const error = await outcome(call, input);
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe(`Matrix must be two dimensional (size: ${size})`);
    });

    it('a row that mixes numbers and Arrays throws the jagged TypeError of the row', async () => {
      const error = await outcome(call, [
        [1, 2],
        [[3], [4]],
      ]);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toMatch(/jagged nested array at row 1/);
    });

    it('a flat array keeps its TypeError', async () => {
      const error = await outcome(call, [1, 2]);
      expect(error).toBeInstanceOf(TypeError);
    });

    it('a two dimensional array still works', async () => {
      expect(
        await outcome(
          call,
          valid ?? [
            [1, 2],
            [3, 4],
          ]
        )
      ).toBeUndefined();
    });
  });

  it('the table lists every function whose parameter is a DecompositionMatrixInput', () => {
    const dir = fileURLToPath(new URL('../src/operations/', import.meta.url));
    const found = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const text = readFileSync(dir + file, 'utf8');
      for (const m of text.matchAll(
        /export (?:async )?function (\w+)\(\s*\w+: DecompositionMatrixInput/g
      )) {
        found.add(m[1]);
      }
    }
    expect(found.size).toBeGreaterThan(15);
    expect([...found].filter((name) => !(name in FUNCTIONS))).toEqual([]);
  });
});
