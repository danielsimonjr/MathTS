/**
 * #1284 in compat: `matrix(data, format)` checks the format and converts a SparseMatrix to
 * dense. compat returns a native matrix for a native input, so that branch needs its own check.
 * The oracle is the mathjs `matrix` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { storage?(): string; size?(): number[]; toArray(): unknown };
const math = create(all) as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

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

describe('compat matrix() checks the format argument (#1284)', () => {
  it.each([
    ['an Array', () => [[1]]],
    ['a bridge matrix', () => math.matrix([[1]])],
    ['a native DenseMatrix', () => new DenseMatrix([[1]])],
    ['a native SparseMatrix', () => SparseMatrix.fromDense(new DenseMatrix([[1]]))],
  ])('%s with the format "foo" throws the mathjs TypeError', (_name, make) => {
    const expected = thrown(() => mj.matrix([[1]], 'foo'))!;
    const actual = thrown(() => math.matrix(make(), 'foo'));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toBe(expected.message);
    expect(actual!.message).toBe('Unknown matrix type "foo".');
  });

  it('a boolean format is read as a string, as in mathjs', () => {
    const actual = thrown(() => math.matrix(new DenseMatrix([[1]]), true));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toBe('Unknown matrix type "true".');
  });

  it('a format that is not a string or boolean throws TypeError', () => {
    expect(thrown(() => math.matrix([[1]], 5))).toBeInstanceOf(TypeError);
    expect(thrown(() => math.matrix(new DenseMatrix([[1]]), null))).toBeInstanceOf(TypeError);
  });

  it('the expression language gives the same error', () => {
    const e = thrown(() => math.evaluate('matrix([[1]], "foo")'));
    expect(e).toBeInstanceOf(TypeError);
    expect(e!.message).toBe('Unknown matrix type "foo".');
  });

  it('the valid formats are unchanged', () => {
    expect((math.matrix([[1]], 'default') as Mat).storage?.()).toBe('dense');
    expect((math.matrix([[1]], 'dense') as Mat).storage?.()).toBe('dense');
    expect((math.matrix([[1]], 'sparse') as Mat).storage?.()).toBe('sparse');
    const native = new DenseMatrix([[1, 2]]);
    expect(math.matrix(native)).toBe(native);
    expect(math.matrix(native, 'dense')).toBe(native);
    expect(math.matrix(native, undefined)).toBe(native);
  });
});

describe('compat matrix(sparse, "dense") converts to dense (#1284)', () => {
  it.each(['dense', 'default'])(
    'a native SparseMatrix with the format "%s" is a DenseMatrix',
    (format) => {
      const s = SparseMatrix.fromDense(new DenseMatrix(DENSE_2));
      const d = math.matrix(s, format) as DenseMatrix;
      expect(d).toBeInstanceOf(DenseMatrix);
      expect(d.toArray()).toEqual(DENSE_2);
      expect(s).toBeInstanceOf(SparseMatrix);
    }
  );

  it.each(['dense', 'default'])(
    'a bridge sparse matrix with the format "%s" is dense',
    (format) => {
      const s = math.matrix(DENSE_2, 'sparse');
      const d = math.matrix(s, format) as Mat;
      expect(d.storage?.()).toBe('dense');
      expect(d.toArray()).toEqual(DENSE_2);
    }
  );

  it('a native SparseMatrix with the format "sparse" is returned as it is', () => {
    const s = SparseMatrix.fromDense(new DenseMatrix(DENSE_2));
    expect(math.matrix(s, 'sparse')).toBe(s);
    expect(math.matrix(s)).toBe(s);
  });

  it('a native DenseMatrix with the format "sparse" is sparse', () => {
    const s = math.matrix(new DenseMatrix(DENSE_2), 'sparse') as Mat;
    expect(s.storage?.()).toBe('sparse');
    expect(s.toArray()).toEqual(DENSE_2);
  });
});
