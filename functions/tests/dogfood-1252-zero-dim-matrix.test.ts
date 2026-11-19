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
import * as math from '../src/factories/index.js';
import { MathJSDenseMatrix } from '../src/factories/matrix-bridge.js';

const { matrix, bignumber, complex } = math;
const m = math as unknown as Record<string, (...a: unknown[]) => unknown>;

describe('#1252 matrix rejects a scalar', () => {
  it.each([
    ['5', () => 5],
    ['bignumber(5)', () => bignumber(5)],
    ['complex(1, 2)', () => complex(1, 2)],
    ['true', () => true],
    ['0', () => 0],
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
    if (!m[name]) return;
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
