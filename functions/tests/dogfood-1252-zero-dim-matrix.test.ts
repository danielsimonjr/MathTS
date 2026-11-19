/**
 * Dogfood #1252 — a scalar passed to the matrix factory.
 *
 * `matrix(5)` used to return a DenseMatrix with no size (`_size` undefined), so qr and lup threw
 * `TypeError: Cannot read properties of undefined (reading 'length')` before their size checks.
 * As in mathjs, matrix accepts only an Array, a Matrix, a format string or no argument, and
 * throws TypeError for any other value. A 0-d matrix is never built, so every decomposition and
 * solver sees a valid size.
 */

import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';
import { MathJSDenseMatrix } from '../src/factories/matrix-bridge.js';

const { matrix, bignumber, complex } = math;
const m = math as unknown as Record<string, (...a: unknown[]) => unknown>;

describe('#1252 matrix rejects a scalar', () => {
  it.each([
    ['5', () => 5],
    ['bignumber(5)', () => bignumber(5)],
    ['complex(1, 2)', () => complex(1, 2)],
    ['0', () => 0],
    ['NaN', () => NaN],
    ['null', () => null],
  ])('matrix(%s) throws TypeError', (_n, make) => {
    expect(() => (matrix as (x: unknown) => unknown)(make())).toThrow(TypeError);
    expect(() => (matrix as (x: unknown) => unknown)(make())).toThrow(
      /Unexpected type of argument in function matrix/
    );
  });

  it('the DenseMatrix constructor rejects a scalar', () => {
    expect(() => new MathJSDenseMatrix(5 as never)).toThrow(TypeError);
  });

  it('the edge forms are unchanged', () => {
    expect((matrix() as { size(): number[] }).size()).toEqual([0]);
    expect((matrix([]) as { size(): number[] }).size()).toEqual([0]);
    expect((matrix('sparse') as { size(): number[] }).size()).toEqual([0, 0]);
    expect((matrix([[1, 2]]) as { size(): number[] }).size()).toEqual([1, 2]);
  });
});

describe('#1252 no decomposition or solver sees a size-less matrix', () => {
  const fns = ['qr', 'lup', 'det', 'inv', 'eigs', 'schur', 'pinv', 'trace', 'qrPivoted'];
  it.each(fns)('%s(matrix(5)) never reaches the function', (name) => {
    expect(typeof m[name]).toBe('function');
    let thrown: unknown;
    try {
      m[name](matrix(5 as never));
    } catch (e) {
      thrown = e;
    }
    // the TypeError comes from matrix(5), not from "reading 'length'"
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toMatch(/Unexpected type of argument in function matrix/);
  });

  it.each(['qr', 'lup'])('%s of a valid 1-D and 3-D input is still a RangeError', (name) => {
    expect(() => m[name]([1, 2])).toThrow(RangeError);
    expect(() => m[name]([[[1], [2]]])).toThrow('Matrix must be two dimensional (size: [1, 2, 1])');
  });
});

describe('#1272 matrix rejects a malformed storage object', () => {
  const mx = matrix as (x: unknown, f?: string) => unknown;
  it.each([
    ['{ size: [2] }', () => ({ size: [2] })],
    ['{ data: 5, size: [1] }', () => ({ data: 5, size: [1] })],
    ['{ data: [1, 2] }', () => ({ data: [1, 2] })],
    ['a CSC object', () => ({ values: [1], index: [0], ptr: [0, 1], size: [1, 1] })],
    ['{}', () => ({})],
  ])('matrix(%s) throws TypeError on the dense path', (_n, make) => {
    expect(() => mx(make())).toThrow(TypeError);
  });

  it.each([
    ['{ size: [2] }', () => ({ size: [2] })],
    ['{}', () => ({})],
    ['{ data: 5, size: [1] }', () => ({ data: 5, size: [1] })],
  ])('matrix(%s, "sparse") throws TypeError', (_n, make) => {
    expect(() => mx(make(), 'sparse')).toThrow(TypeError);
  });

  it('the DenseMatrix constructor rejects data that is not an Array', () => {
    expect(() => new MathJSDenseMatrix({ data: 5, size: [1] } as never)).toThrow(TypeError);
  });

  it('the valid storage objects are unchanged', () => {
    const d = mx({ data: [[1, 2]], size: [1, 2] }) as { size(): number[] };
    expect(d.size()).toEqual([1, 2]);
    const s = mx({ values: [1], index: [0], ptr: [0, 1], size: [1, 1] }, 'sparse') as {
      size(): number[];
    };
    expect(s.size()).toEqual([1, 1]);
    const s2 = mx({ data: [[1, 0]], size: [1, 2] }, 'sparse') as { size(): number[] };
    expect(s2.size()).toEqual([1, 2]);
  });
});

describe('#1272 matrix format strings match mathjs', () => {
  const mx = matrix as (x: unknown) => unknown;
  it.each([
    ['', '""'],
    ['foo', '"foo"'],
    [true, '"true"'],
    [false, '"false"'],
  ])('matrix(%j) throws Unknown matrix type', (x, q) => {
    expect(() => mx(x)).toThrow(TypeError);
    expect(() => mx(x)).toThrow('Unknown matrix type ' + q);
  });
  it.each(['dense', 'default', 'sparse'])('matrix(%s) is still empty', (f) => {
    expect(() => mx(f)).not.toThrow();
  });

  it.each([[0], [null], [false]])('matrix(%j, "sparse") throws', (x) => {
    expect(() => (matrix as (x: unknown, f: string) => unknown)(x, 'sparse')).toThrow(TypeError);
  });

  // These functions pass their format argument to matrix(format).
  it.each([
    ['zeros(2, 2, "foo")', () => m.zeros(2, 2, 'foo')],
    ['zeros("foo")', () => m.zeros('foo')],
    ['ones(2, "foo")', () => m.ones(2, 'foo')],
    ['identity("foo")', () => m.identity('foo')],
    ['identity("")', () => m.identity('')],
    ['rotationMatrix("foo")', () => m.rotationMatrix('foo')],
    ['matrixFromFunction([2, 2], "foo", f)', () => m.matrixFromFunction([2, 2], 'foo', () => 1)],
  ])('%s throws Unknown matrix type', (_n, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/Unknown matrix type/);
  });

  it('a known format still gives a matrix of that format', () => {
    const size = (x: unknown) => (x as { size(): number[] }).size();
    const type = (x: unknown) => (x as { type: string }).type;
    expect(size(m.zeros(2, 2, 'dense'))).toEqual([2, 2]);
    expect(type(m.zeros(2, 2, 'sparse'))).toBe('SparseMatrix');
    expect(size(m.ones(2, 'dense'))).toEqual([2]);
    expect(size(m.identity(2, 'sparse'))).toEqual([2, 2]);
    expect(size(m.identity('dense'))).toEqual([0]);
    expect(type(m.matrixFromFunction([2, 2], 'sparse', () => 1))).toBe('SparseMatrix');
  });
});
