import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseMatrix, eig, lu, matrixLogm } from '@danielsimonjr/mathts-matrix';
import { eigsh, expm, lusolve, matrix, pow, schur, sparse, zeros } from '../src/index.js';

describe('a matrix that is not square throws a RangeError, as mathjs does', () => {
  it('expm of a 2 x 3, a 0 x 3 and a 3-D matrix', () => {
    expect(() =>
      expm(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ])
      )
    ).toThrow(RangeError);
    expect(() => expm(zeros(0, 3))).toThrow(RangeError);
    expect(() => expm(sparse([[1, 2, 3]]))).toThrow(RangeError);
    expect(() =>
      expm(
        matrix([
          [
            [1, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [0, 1],
          ],
        ])
      )
    ).toThrow(/2×2×2/);
  });
  it('pow keeps its RangeError', () => {
    expect(() =>
      pow(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ]),
        2
      )
    ).toThrow(RangeError);
  });
});

// One rule, one class (L3): every function that needs a square matrix throws the RangeError of
// `notSquareError` (core), whatever the container of the argument. Before, expm of an Array and of
// a native DenseMatrix threw a plain Error (matrix/src/operations/expm.ts), and expm of a boxed
// matrix threw a RangeError (number-matrix.ts squareOrder). mathjs throws RangeError for each.
describe('the square rule has one class for every container (mathjs RangeError)', () => {
  const A23 = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  const cases: [string, () => unknown][] = [
    ['expm(Array 2 x 3)', () => expm(A23)],
    ['expm(native DenseMatrix 2 x 3)', () => expm(DenseMatrix.fromArray(A23) as never)],
    ['expm(Array 2 x 0)', () => expm([[], []])],
    ['schur(Array 2 x 3)', () => schur(A23)],
    ['lusolve(Array 2 x 3, b)', () => lusolve(A23, [1, 2])],
    ['matrixLogm(native 2 x 3)', () => matrixLogm(DenseMatrix.fromArray(A23) as never)],
    ['lu(native 2 x 3)', () => lu(DenseMatrix.fromArray(A23))],
    ['eig(native 2 x 3)', () => eig(DenseMatrix.fromArray(A23))],
  ];
  it.each(cases)('%s throws a RangeError', (_label, call) => {
    expect(call).toThrow(RangeError);
  });
  it('the text of each site is kept', () => {
    expect(() => expm(A23)).toThrow('matrixExpm: matrix must be square (got 2×3)');
    expect(() => schur(A23)).toThrow('schur: matrix must be square (real Schur decomposition)');
  });
});

describe('source guard: no square throw outside notSquareError', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const dirs = [
    'core/src',
    'matrix/src',
    'functions/src',
    'compat/src',
    'tensor/src',
    'autograd/src',
  ];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name))
        : e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')
          ? [join(dir, e.name)]
          : []
    );
  // A throw whose text states the square rule. A text about an empty matrix is another rule.
  const throwText = /new (?:Range)?Error\(\s*([^;]{0,200})/g;
  const squareRule =
    /must be (?:a |an? \S+ )?square|requires a square|only defined for square|rank-2 square/;
  const hasSquareThrow = (src: string): boolean =>
    [...src.matchAll(throwText)].some(
      ([, text]) => squareRule.test(text) && !text.includes('non-empty')
    );
  it('every square rule throws through the core helper (core/src/square-error.ts is the one site)', () => {
    const hits = dirs
      .flatMap((d) => walk(join(root, d)))
      .filter((file) => !file.endsWith('square-error.ts'))
      .filter((file) => hasSquareThrow(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(hits).toEqual([]);
  });
});

describe('one message has one error class (eigsh)', () => {
  it('an empty dense input throws its own text, not the square text', () => {
    expect(() => eigsh([], 1)).toThrow(/eigsh: dense matrix input must be non-empty/);
    expect(() => eigsh([], 1)).not.toThrow(/square/);
  });
  it('a ragged dense input throws the square RangeError', () => {
    expect(() => eigsh([[1, 2], [3]], 1)).toThrow(RangeError);
    expect(() => eigsh([[1, 2], [3]], 1)).toThrow(/eigsh: dense matrix input must be square/);
  });
});
