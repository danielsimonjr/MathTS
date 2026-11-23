import { describe, expect, it } from 'vitest';
import { all as mathjsAll, create as createMathjs } from 'mathjs';
import { all, create } from '../src/index.js';

type MatrixResult = { size(): number[]; storage(): string; toArray(): unknown };
function describeMatrix(value: unknown) {
  const matrix = value as MatrixResult;
  return [matrix.storage(), matrix.size(), matrix.toArray()];
}

describe('mathjs Matrix results through create(all) (#993)', () => {
  const math = create(all);
  const reference = createMathjs(mathjsAll);
  const data = [
    [1, 0],
    [0, 2],
  ];

  it.each(['add', 'subtract', 'multiply'] as const)(
    '%s keeps dense and sparse matrices',
    (name) => {
      for (const storage of ['dense', 'sparse'] as const) {
        const arg = math.matrix(data, storage);
        const expected = reference.matrix(data, storage);
        expect(describeMatrix(math[name](arg, arg))).toEqual(
          describeMatrix(reference[name](expected, expected))
        );
      }
    }
  );

  it('preserves matrix literals through evaluation, compilation and parser state', () => {
    const expr = '[1,2;3,4]*[1;1]';
    const expected = describeMatrix(reference.evaluate(expr));
    expect(describeMatrix(math.evaluate(expr))).toEqual(expected);
    expect(describeMatrix(math.compile(expr).evaluate())).toEqual(expected);
    expect(describeMatrix(math.parser().evaluate(expr))).toEqual(expected);
    const arrays = create(all, { matrix: 'Array' });
    expect(arrays.evaluate(expr)).toEqual([[3], [7]]);
    arrays.config({ matrix: 'Matrix' });
    expect(describeMatrix(arrays.evaluate(expr))).toEqual(expected);
  });

  it('builds sized zero matrices and returns dimensions as a plain Array', () => {
    for (const dimensions of [
      [2, 3],
      [0, 3],
      [2, 0],
    ]) {
      expect(describeMatrix(math.zeros(...dimensions))).toEqual(
        describeMatrix(reference.zeros(...dimensions))
      );
    }
    expect(math.size(math.zeros(2, 3))).toEqual([2, 3]);
    expect(create(all, { matrix: 'Array' }).zeros(2, 2)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
