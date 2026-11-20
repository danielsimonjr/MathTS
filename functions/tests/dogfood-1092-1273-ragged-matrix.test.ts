/**
 * #1092, #1273 (dense row): `matrix()` of a ragged nested array.
 *
 * The MathJSDenseMatrix constructor took the size from the first element of each axis and did
 * not check the rest, so `matrix([[1], [2, 3]])` kept rows of two lengths under size [2, 1].
 * mathjs validates the data and throws `Dimension mismatch`. The oracle is the mathjs
 * `matrix` of the mathjs devDependency: each message below is read from it, not typed.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';
import { MathJSDenseMatrix } from '../src/factories/matrix-bridge.js';

type Fn = (...a: unknown[]) => unknown;
const matrix = math.matrix as unknown as Fn;
const mjMatrix = mathjs.matrix as unknown as Fn;
const evaluate = math.evaluate as unknown as Fn;

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

/** [input, mathjs message]; the message is read from mathjs below, the literal is the guard. */
const RAGGED: Array<[string, unknown, string]> = [
  ['[[1], []]', [[1], []], 'Dimension mismatch (0 != 1)'],
  ['[[1, 2], [3]]', [[1, 2], [3]], 'Dimension mismatch (1 != 2)'],
  ['[[1], [2, 3]] (#1273 dense row)', [[1], [2, 3]], 'Dimension mismatch (2 != 1)'],
  ['[[[1], [2]], [[3]]]', [[[1], [2]], [[3]]], 'Dimension mismatch (1 != 2)'],
  ['[[1], 2]', [[1], 2], 'Dimension mismatch (1 < 2)'],
  ['[1, [2]]', [1, [2]], 'Dimension mismatch (2 > 1)'],
];

describe('#1092 matrix() rejects a ragged nested array like mathjs', () => {
  it.each(RAGGED)('matrix(%s) throws the mathjs RangeError', (_name, input, message) => {
    const expected = thrown(() => mjMatrix(input));
    expect(expected).toBeInstanceOf(RangeError);
    expect(expected!.message).toBe(message);
    const actual = thrown(() => matrix(input));
    expect(actual).toBeInstanceOf(RangeError);
    expect(actual!.message).toBe(message);
  });

  it.each(RAGGED)('new MathJSDenseMatrix(%s) throws the same RangeError', (_n, input, message) => {
    const actual = thrown(() => new MathJSDenseMatrix(input as number[][]));
    expect(actual).toBeInstanceOf(RangeError);
    expect(actual!.message).toBe(message);
  });

  it('matrix(x, "dense") of a ragged array throws too', () => {
    expect(() => matrix([[1], [2, 3]], 'dense')).toThrow(/Dimension mismatch \(2 != 1\)/);
  });

  it('fft of a ragged matrix throws the RangeError, not a multiplyScalar TypeError', () => {
    const fft = math.fft as unknown as Fn;
    const e = thrown(() => fft(matrix([[1], []])));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toBe('Dimension mismatch (0 != 1)');
  });

  it('the expression language throws the RangeError', () => {
    const e = thrown(() => evaluate('matrix([[1], [2, 3]])'));
    expect(e).toBeInstanceOf(RangeError);
    expect(e!.message).toMatch(/Dimension mismatch \(2 != 1\)/);
  });
});

describe('#1092 valid shapes are unchanged', () => {
  it('a rectangular 2-D array', () => {
    const m = matrix([
      [1, 2],
      [3, 4],
    ]) as MathJSDenseMatrix;
    expect(m.size()).toEqual([2, 2]);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('matrix([[[]], [[]]]) has size [2, 1, 0]', () => {
    const m = matrix([[[]], [[]]]) as MathJSDenseMatrix;
    expect(m.size()).toEqual([2, 1, 0]);
    expect(m.size()).toEqual((mjMatrix([[[]], [[]]]) as { size(): number[] }).size());
  });

  it('matrix([]) has size [0] and matrix([1, 2, 3]) has size [3]', () => {
    expect((matrix([]) as MathJSDenseMatrix).size()).toEqual([0]);
    expect((matrix([1, 2, 3]) as MathJSDenseMatrix).size()).toEqual([3]);
  });

  it('the { data, size } form is trusted and skips validation, as in mathjs', () => {
    const m = new MathJSDenseMatrix({ data: [[1], [2, 3]], size: [2, 1] });
    expect(m.size()).toEqual([2, 1]);
  });

  it('internal producers keep working: add, multiply, transpose, map, clone, resize', () => {
    const a = matrix([
      [1, 2],
      [3, 4],
    ]) as MathJSDenseMatrix;
    const b = matrix([
      [5, 6],
      [7, 8],
    ]) as MathJSDenseMatrix;
    expect(((math.add as unknown as Fn)(a, b) as MathJSDenseMatrix).toArray()).toEqual([
      [6, 8],
      [10, 12],
    ]);
    expect(((math.multiply as unknown as Fn)(a, b) as MathJSDenseMatrix).toArray()).toEqual([
      [19, 22],
      [43, 50],
    ]);
    expect(((math.transpose as unknown as Fn)(a) as MathJSDenseMatrix).toArray()).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(a.map((v) => v * 2).toArray()).toEqual([
      [2, 4],
      [6, 8],
    ]);
    const c = a.clone();
    expect(c.toArray()).toEqual(a.toArray());
    expect(c).not.toBe(a);
  });
});

describe('#1092 validation cost: only user data is validated', () => {
  /** Count the calls of Array.isArray during fn. `validate` calls it once per element. */
  function isArrayCalls(fn: () => unknown): number {
    const original = Array.isArray;
    let calls = 0;
    Array.isArray = ((x: unknown): x is unknown[] => {
      calls++;
      return original(x);
    }) as typeof Array.isArray;
    try {
      fn();
    } finally {
      Array.isArray = original;
    }
    return calls;
  }

  const N = 40;
  const rows = (offset: number) =>
    Array.from({ length: N }, (_r, i) => Array.from({ length: N }, (_c, j) => offset + i + j));

  it('matrix(array) validates every element once', () => {
    const data = rows(0);
    expect(isArrayCalls(() => matrix(data))).toBeGreaterThanOrEqual(N * N);
  });

  it('add and multiply of two bridge matrices do not validate their result', () => {
    const a = matrix(rows(0)) as MathJSDenseMatrix;
    const b = matrix(rows(1)) as MathJSDenseMatrix;
    const add = math.add as unknown as Fn;
    const multiply = math.multiply as unknown as Fn;
    // Warm both paths, so a one-time lazy setup is not counted.
    add(a, b);
    multiply(a, b);
    expect(isArrayCalls(() => add(a, b))).toBeLessThan(N * N);
    expect(isArrayCalls(() => multiply(a, b))).toBeLessThan(N * N);
  });
});
