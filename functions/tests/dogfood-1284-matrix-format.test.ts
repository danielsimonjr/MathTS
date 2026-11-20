/**
 * #1284: the second argument of `matrix()`.
 *
 * `matrix([[1]], 'foo')` returned a dense matrix and `matrix(sparseMatrix, 'dense')` returned
 * the sparse matrix unchanged. mathjs throws `Unknown matrix type "foo".` for any other
 * string (a boolean is converted to a string first), and converts a matrix to the format
 * `'dense'`, `'default'` or `'sparse'`. The oracle is the mathjs `matrix` of the mathjs
 * devDependency: each message below is read from it as well as typed.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { storage(): string; size(): number[]; toArray(): unknown };
const matrix = math.matrix as unknown as Fn;
const mjMatrix = mathjs.matrix as unknown as Fn;

const DENSE_2 = [
  [1, 0],
  [0, 2],
];

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

describe('#1284 matrix() checks the format argument', () => {
  it.each([
    ['matrix([[1]], "foo")', () => matrix([[1]], 'foo'), () => mjMatrix([[1]], 'foo')],
    [
      'matrix(matrix([[1]]), "foo")',
      () => matrix(matrix([[1]]), 'foo'),
      () => mjMatrix(mjMatrix([[1]]), 'foo'),
    ],
    [
      'matrix(sparse, "foo")',
      () => matrix(matrix([[1]], 'sparse'), 'foo'),
      () => mjMatrix(mjMatrix([[1]], 'sparse'), 'foo'),
    ],
    ['matrix([[1]], true)', () => matrix([[1]], true), () => mjMatrix([[1]], true)],
    ['matrix([[1]], "")', () => matrix([[1]], ''), () => mjMatrix([[1]], '')],
    ['matrix("foo", "number")', () => matrix('foo', 'number'), () => mjMatrix('foo', 'number')],
  ])('%s throws the mathjs TypeError', (_name, actual, expected) => {
    const e = thrown(expected);
    expect(e).toBeInstanceOf(TypeError);
    expect(e!.message).toMatch(/^Unknown matrix type /);
    const a = thrown(actual);
    expect(a).toBeInstanceOf(TypeError);
    expect(a!.message).toBe(e!.message);
  });

  it('names the format in the message', () => {
    expect(thrown(() => matrix([[1]], 'foo'))!.message).toBe('Unknown matrix type "foo".');
    expect(thrown(() => matrix([[1]], true))!.message).toBe('Unknown matrix type "true".');
  });

  it('a second argument that is not a string or boolean throws TypeError', () => {
    for (const bad of [5, null, {}, []]) {
      const a = thrown(() => matrix([[1]], bad));
      expect(a).toBeInstanceOf(TypeError);
      expect(a!.message).toMatch(
        /^Unexpected type of argument in function matrix \(expected: string or boolean, actual: .+, index: 1\)$/
      );
      expect(thrown(() => mjMatrix([[1]], bad))).toBeInstanceOf(TypeError);
    }
  });

  it('the formats of the issue are accepted: dense, default, sparse', () => {
    expect((matrix([[1]], 'default') as Mat).storage()).toBe('dense');
    expect((matrix([[1]], 'dense') as Mat).storage()).toBe('dense');
    expect((matrix([[1]], 'sparse') as Mat).storage()).toBe('sparse');
    expect((matrix([[1]], 'dense', 'number') as Mat).storage()).toBe('dense');
  });

  it('matrix("sparse", "number") is the format and datatype form: an empty sparse matrix', () => {
    const m = matrix('sparse', 'number') as Mat;
    expect(m.storage()).toBe('sparse');
    expect(m.size()).toEqual([0, 0]);
    expect((mjMatrix('sparse', 'number') as Mat).size()).toEqual([0, 0]);
  });

  it('an explicit undefined format is accepted (an internal optional argument)', () => {
    const m = matrix([[1]], undefined) as Mat;
    expect(m.storage()).toBe('dense');
    expect(m.toArray()).toEqual([[1]]);
  });
});

describe('#1284 matrix(sparseMatrix, "dense") converts to dense', () => {
  const sparse = () => matrix(DENSE_2, 'sparse') as Mat;

  it.each(['dense', 'default'])(
    'matrix(sparse, "%s") is a dense matrix with the same entries',
    (format) => {
      const s = sparse();
      const d = matrix(s, format) as Mat;
      expect(d.storage()).toBe('dense');
      expect(d.size()).toEqual([2, 2]);
      expect(d.toArray()).toEqual(DENSE_2);
      const mj = mjMatrix(mjMatrix(DENSE_2, 'sparse'), format) as Mat;
      expect(mj.storage()).toBe('dense');
      expect(d.toArray()).toEqual(mj.toArray());
      // The input is not changed.
      expect(s.storage()).toBe('sparse');
    }
  );

  it('matrix(dense, "sparse") is still sparse', () => {
    const s = matrix(matrix(DENSE_2), 'sparse') as Mat;
    expect(s.storage()).toBe('sparse');
    expect(s.toArray()).toEqual(DENSE_2);
  });

  it('a matrix of the format that is asked for, and one with no format, is copied (mathjs)', () => {
    const d = matrix([[1]]) as Mat;
    const s = sparse();
    for (const [m, f] of [
      [d, 'dense'],
      [d, undefined],
      [s, 'sparse'],
      [s, undefined],
    ] as const) {
      const c = (f === undefined ? matrix(m) : matrix(m, f)) as Mat;
      expect(c).not.toBe(m);
      expect(c.storage()).toBe(m.storage());
      expect(c.toArray()).toEqual(m.toArray());
    }
  });
});

describe('#1284 matrix() with no argument is unchanged', () => {
  it('matrix() is an empty dense matrix of size [0]', () => {
    const m = matrix() as Mat;
    expect(m.storage()).toBe('dense');
    expect(m.size()).toEqual([0]);
  });

  it('matrix("sparse"), matrix("dense") and matrix("default") are empty matrices', () => {
    expect((matrix('sparse') as Mat).storage()).toBe('sparse');
    expect((matrix('dense') as Mat).storage()).toBe('dense');
    expect((matrix('default') as Mat).storage()).toBe('dense');
  });
});
