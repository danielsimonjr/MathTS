/**
 * #911 (class): one rule for a scalar and a collection in `add`, `subtract`, `multiply`
 * and `divide`.
 *
 * The rule: a collection (Array, DenseMatrix, SparseMatrix) and a scalar (number, Unit,
 * Complex, Fraction, BigNumber) give the collection of the per-element results. This
 * holds for `add`, `subtract` and `multiply` in both operand orders, and for `divide`
 * with the collection first. `divide(scalar, collection)` is matrix division
 * (`scalar * inv(collection)` in mathjs 15, which rejects a vector with "Matrix must be
 * square"), so it is not a broadcast. It throws a TypeError that names `dotDivide`.
 *
 * The oracle for each case is the per-element map of the scalar operation, the workaround
 * that the issue gives.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex, Fraction, Unit } from '@danielsimonjr/mathts-core';
import {
  add,
  subtract,
  multiply,
  divide,
  dotDivide,
  evaluate,
  matrix,
  sparse,
} from '../src/index.js';

type Op = (a: unknown, b: unknown) => unknown;
const ops: Record<string, Op> = {
  add: add as unknown as Op,
  subtract: subtract as unknown as Op,
  multiply: multiply as unknown as Op,
  divide: divide as unknown as Op,
};
const m = (n: number): Unit => new Unit(n, 'm');
const s = (n: number): Unit => new Unit(n, 's');

/** An array result as strings, so a Unit, Complex or Fraction compares by its text. */
function texts(value: unknown): string[] {
  expect(Array.isArray(value)).toBe(true);
  return (value as unknown[]).map(String);
}

/** Every leaf of a nested array as its text. */
function leafTexts(value: unknown): unknown {
  return Array.isArray(value) ? value.map(leafTexts) : String(value);
}

/** A matrix result: its storage and its data, with every cell as text. */
function matrixTexts(value: unknown): { storage: string; rows: unknown } {
  const mat = value as { storage(): string; toArray(): unknown[] };
  expect(typeof mat.storage).toBe('function');
  return { storage: mat.storage(), rows: leafTexts(mat.toArray()) };
}

describe('a scalar and an array give the per-element results (#911)', () => {
  const scalars: Array<[string, unknown, unknown[]]> = [
    ['number', 2, [1, 2, 3]],
    ['Unit', m(2), [m(1), m(2), m(3)]],
    ['Complex', new Complex(1, 1), [new Complex(1, 0), new Complex(0, 2)]],
    ['Fraction', new Fraction(1, 2), [new Fraction(1, 3), new Fraction(2, 3)]],
    ['BigNumber', new BigNumber('10'), [new BigNumber('1'), new BigNumber('2')]],
  ];

  for (const [type, scalar, elements] of scalars) {
    for (const name of ['add', 'subtract', 'multiply'] as const) {
      it(`${name}(${type}, array) and ${name}(array, ${type})`, () => {
        const op = ops[name];
        expect(texts(op(scalar, elements))).toEqual(elements.map((x) => String(op(scalar, x))));
        expect(texts(op(elements, scalar))).toEqual(elements.map((x) => String(op(x, scalar))));
      });
    }

    it(`divide(array, ${type}) divides each element`, () => {
      const op = ops.divide;
      expect(texts(op(elements, scalar))).toEqual(elements.map((x) => String(op(x, scalar))));
    });
  }

  it('gives the numbers that mathjs 15.2.0 gives for a number scalar', () => {
    expect(ops.add(2, [1, 2])).toEqual([3, 4]);
    expect(ops.subtract(2, [1, 2])).toEqual([1, 0]);
    expect(ops.subtract([1, 2], 2)).toEqual([-1, 0]);
    expect(ops.divide([1, 2], 2)).toEqual([0.5, 1]);
    expect(
      ops.divide(
        [
          [2, 4],
          [6, 8],
        ],
        2
      )
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('adds and subtracts unit arrays in both orders and keeps the unit', () => {
    expect(texts(ops.add(m(1), [m(1), m(2)]))).toEqual(['2 m', '3 m']);
    expect(texts(ops.add([m(1), m(2)], m(1)))).toEqual(['2 m', '3 m']);
    expect(texts(ops.subtract(m(5), [m(1), m(2)]))).toEqual(['4 m', '3 m']);
    expect(texts(ops.subtract([m(5), m(6)], m(1)))).toEqual(['4 m', '5 m']);
  });

  it('divides a number array by a Unit and a Unit array by a number', () => {
    expect(texts(ops.divide([2, 4], m(2)))).toEqual(['1 m^-1', '2 m^-1']);
    expect(texts(ops.divide([m(2), m(4)], 2))).toEqual(['1 m', '2 m']);
  });

  it('keeps the dimension check of the scalar operation', () => {
    expect(() => ops.add(m(1), [s(1)])).toThrow(/different dimensions/);
    expect(() => ops.subtract([m(1)], s(1))).toThrow(/different dimensions/);
  });

  it('does not add a bare number to a length (the scalar rule holds per element)', () => {
    expect(() => ops.add(m(1), [1, 2])).toThrow();
    expect(() => ops.subtract([1, 2], m(1))).toThrow();
  });

  it('reaches the same results from an expression string', () => {
    expect(evaluate('[1,2]/2')).toEqual([0.5, 1]);
    expect(texts(evaluate('2 m + [1 m, 2 m]'))).toEqual(['3 m', '4 m']);
    expect(texts(evaluate('[5 m, 6 m] - 1 m'))).toEqual(['4 m', '5 m']);
    expect(texts(evaluate('[2 m, 4 m] / 2'))).toEqual(['1 m', '2 m']);
  });
});

describe('a scalar and a matrix keep the matrix type and the storage (#911)', () => {
  it('adds, subtracts and divides a DenseMatrix by a Unit scalar', () => {
    const dense = matrix([m(1), m(2)]);
    expect(matrixTexts(ops.add(m(1), dense))).toEqual({ storage: 'dense', rows: ['2 m', '3 m'] });
    expect(matrixTexts(ops.subtract(dense, m(1))).storage).toBe('dense');
    expect(matrixTexts(ops.divide(dense, 2))).toEqual({ storage: 'dense', rows: ['0.5 m', '1 m'] });
  });

  it('scales a SparseMatrix by a Unit in either order and keeps the storage sparse', () => {
    const a = sparse([
      [1, 0],
      [0, 2],
    ]);
    const expected = {
      storage: 'sparse',
      // A Unit has no implicit zero: each cell reads `0 m`, so the cells stay uniform.
      rows: [
        ['2 m', '0 m'],
        ['0 m', '4 m'],
      ],
    };
    expect(matrixTexts(ops.multiply(m(2), a))).toEqual(expected);
    expect(matrixTexts(ops.multiply(a, m(2)))).toEqual(expected);
  });

  it('divides a SparseMatrix by a Unit and by a number', () => {
    const a = sparse([
      [2, 0],
      [0, 4],
    ]);
    expect(matrixTexts(ops.divide(a, m(2)))).toEqual({
      storage: 'sparse',
      rows: [
        ['1 m^-1', '0 m^-1'],
        ['0 m^-1', '2 m^-1'],
      ],
    });
    expect(matrixTexts(ops.divide(a, 2))).toEqual({
      storage: 'sparse',
      rows: [
        ['1', '0'],
        ['0', '2'],
      ],
    });
  });

  it('adds a Complex scalar to a SparseMatrix and keeps the storage sparse', () => {
    const a = sparse([
      [1, 0],
      [0, 2],
    ]);
    const out = matrixTexts(ops.add(new Complex(0, 1), a));
    expect(out.storage).toBe('sparse');
    expect(out.rows).toEqual([
      ['1 + i', 'i'],
      ['i', '2 + i'],
    ]);
  });

  it('leaves the number scalar on a matrix as it was', () => {
    expect(matrixTexts(ops.add(2, matrix([1, 2])))).toEqual({
      storage: 'dense',
      rows: ['3', '4'],
    });
    expect(matrixTexts(ops.divide(matrix([2, 4]), 2)).rows).toEqual(['1', '2']);
  });
});

describe('divide(scalar, collection) is matrix division and names the way out (#911)', () => {
  // #960 replaced the #911 dispatch error: a square matrix is a matrix division now, and a
  // non-square collection throws mathjs's RangeError.
  it('throws mathjs RangeError for a non-square collection, with a Unit scalar too', () => {
    expect(() => ops.divide(2, [1, 2])).toThrow(RangeError);
    expect(() => ops.divide(2, [1, 2])).toThrow('Matrix must be square (size: [2])');
    expect(() => ops.divide(2, matrix([1, 2]))).toThrow('Matrix must be square (size: [2])');
    expect(() => ops.divide(m(2), [1, 2])).toThrow('Matrix must be square (size: [2])');
    expect(() => ops.divide(new Complex(1, 1), sparse([[1, 0]]))).toThrow(
      'Matrix must be square (size: [1, 2])'
    );
  });

  it('has the element-wise form in dotDivide', () => {
    expect((dotDivide as unknown as Op)(2, [1, 2])).toEqual([2, 1]);
  });
});
