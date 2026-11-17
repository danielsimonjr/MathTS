/**
 * Dogfood #1104 — Frobenius norm of a matrix with extreme entries.
 *
 * The sum of squares overflows above about 1e154 and loses its digits below about
 * 1e-150. A finite sum of at least 2^-800 still gives sqrt(sum). Any other sum of
 * plain numbers is recomputed with a running scale. A NaN, infinite, complex or
 * BigNumber entry keeps the plain sum.
 */

import { describe, it, expect } from 'vitest';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import { norm } from '../src/typed/arithmetic.js';
import { factory_norm, matrix } from '../src/factories/index.js';

const nm = factory_norm as (x: unknown, p?: unknown) => unknown;
const big = [
  [1e200, 1e200],
  [0, 1e200],
];
const tiny = [
  [1e-200, 1e-200],
  [0, 1e-200],
];
const above = [[2 ** -399, 0]]; // sum = 2^-798
const below = [[2 ** -401, 0]]; // sum = 2^-802

describe("#1104 norm(A, 'fro')", () => {
  it('typed norm of an Array', () => {
    expect(norm(big, 'fro')).toBe(1.7320508075688773e200);
    expect(norm(tiny, 'fro')).toBe(1.7320508075688772e-200);
    expect(norm(above, 'fro')).toBe(Math.sqrt(2 ** -798));
    expect(norm(below, 'fro')).toBe(2 ** -401);
    expect(norm([[Infinity, Infinity]], 'fro')).toBe(Infinity);
    expect(norm([[NaN, 1]], 'fro')).toBeNaN();
    expect(norm([[0, 0]], 'fro')).toBe(0);
  });

  it('factory norm of a Matrix', () => {
    expect(nm(matrix(big), 'fro')).toBe(1.7320508075688773e200);
    expect(nm(matrix(tiny), 'fro')).toBe(1.7320508075688772e-200);
    expect(nm(matrix(above), 'fro')).toBe(Math.sqrt(2 ** -798));
    expect(nm(matrix(below), 'fro')).toBe(2 ** -401);
    expect(nm(matrix([[Infinity, Infinity]]), 'fro')).toBe(Infinity);
    expect(nm(matrix([[NaN, 1]]), 'fro')).toBeNaN();
    expect(nm(matrix([[0, 0]]), 'fro')).toBe(0);
  });

  it('factory norm of a complex or BigNumber matrix is unchanged', () => {
    expect(nm(matrix([[new Complex(3, 4), 0]]), 'fro')).toBe(5);
    const r = nm(matrix([[new BigNumber(3), new BigNumber(4)]]), 'fro');
    expect(r).toBeInstanceOf(BigNumber);
    expect((r as BigNumber).toString()).toBe('5');
  });
});
