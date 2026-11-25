/**
 * #1034: typed functions that evaluate puts in scope give the mathjs 15 result on a nested
 * array, a matrix, a vector and a scalar. The expected values come from mathjs 15.2.0.
 */
import { describe, it, expect } from 'vitest';
import * as T from '../src/typed/expression-eval-barrel.js';
import { matrix } from '../src/index.js';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const f = T as unknown as Record<string, (...a: unknown[]) => unknown>;
const N = (): number[][] => [
  [1, 2],
  [3, 4],
];
const D = (): unknown => matrix(N());
const arr = (v: unknown): unknown =>
  v && typeof v === 'object' && 'toArray' in v ? (v as { toArray(): unknown }).toArray() : v;

describe('element-wise unary functions map a collection', () => {
  it('bitNot', () => {
    expect(f.bitNot(N())).toEqual([
      [-2, -3],
      [-4, -5],
    ]);
    expect(arr(f.bitNot(D()))).toEqual([
      [-2, -3],
      [-4, -5],
    ]);
    expect(f.bitNot([1, 2, 3])).toEqual([-2, -3, -4]);
    expect(() => f.bitNot([2.5])).toThrow(/Integer expected/);
  });
  it('nthRoot', () => {
    expect(f.nthRoot([1, 4, 9])).toEqual([1, 2, 3]);
    expect(arr(f.nthRoot(D()))).toEqual([
      [1, Math.SQRT2],
      [Math.sqrt(3), 2],
    ]);
    expect(f.nthRoot([8, 27], 3)).toEqual([2, 3]);
  });
  it('not', () => {
    expect(f.not([0, 1, 2])).toEqual([true, false, false]);
    expect(f.not(N())).toEqual([
      [false, false],
      [false, false],
    ]);
    const m = f.not(matrix([0, 3]));
    expect(arr(m)).toEqual([true, false]);
  });
});

describe('collection reductions', () => {
  it('hypot of a matrix', () => {
    expect(f.hypot(D())).toBeCloseTo(Math.sqrt(30), 12);
  });
  it('gcd of a vector', () => {
    expect(f.gcd([12, 18, 24])).toBe(6);
    expect(f.gcd([1, 2, 3])).toBe(1);
  });
  it('multinomial rejects the nested array and the matrix (mathjs 15.3.0 #3790, #1563)', () => {
    expect(() => f.multinomial(N())).toThrow(RangeError);
    expect(() => f.multinomial(D())).toThrow(RangeError);
  });
});

describe('pinv', () => {
  it('a matrix() input and a scalar', () => {
    const p = arr(f.pinv(D())) as number[][];
    expect(p[0][0]).toBeCloseTo(-2, 12);
    expect(p[1][1]).toBeCloseTo(-0.5, 12);
    expect(f.pinv(2.5)).toBeCloseTo(0.4, 15);
    expect(f.pinv(0)).toBe(0);
  });
});

describe('permutations', () => {
  it('a non-integer n uses the gamma function, as mathjs does', () => {
    expect(f.permutations(2.5)).toBeCloseTo(3.3233509704478403, 12);
    expect(f.permutations(5)).toBe(120);
  });
});

describe('norm', () => {
  it('the default norm of a matrix is the 2-norm', () => {
    expect(f.norm(N())).toBeCloseTo(5.464985704219043, 12);
    expect(f.norm(D())).toBeCloseTo(5.464985704219043, 12);
    expect(f.norm([1, 2, 3])).toBeCloseTo(Math.sqrt(14), 12);
    expect(f.norm(N(), 'fro')).toBeCloseTo(Math.sqrt(30), 12);
  });
});

describe('a DenseMatrix of the matrix package', () => {
  const native = (): DenseMatrix =>
    DenseMatrix.fromArray([
      [1, 4],
      [9, 16],
    ]);
  it('maps each entry and keeps the class when every result is a number', () => {
    const r = f.nthRoot(native());
    expect(r).toBeInstanceOf(DenseMatrix);
    expect(arr(r)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(arr(f.bitNot(native()))).toEqual([
      [-2, -5],
      [-10, -17],
    ]);
  });
  it('gives a nested array when a result is not a number', () => {
    expect(f.not(native())).toEqual([
      [false, false],
      [false, false],
    ]);
  });
});

describe('random and pickRandom', () => {
  const size = (v: unknown): number[] => {
    const out: number[] = [];
    for (let x = arr(v); Array.isArray(x); x = x[0]) out.push(x.length);
    return out;
  };
  it('a size gives an array of that size', () => {
    expect(size(f.random([2, 3]))).toEqual([2, 3]);
    const r = f.random([4], 5, 9) as number[];
    expect(r.every((x) => x >= 5 && x < 9)).toBe(true);
    expect(size(f.random(matrix([2])))).toEqual([2]);
    const i = f.randomInt([3], 5, 9) as number[];
    expect(i.every((x) => Number.isInteger(x) && x >= 5 && x < 9)).toBe(true);
  });
  it('pickRandom picks one entry of a nested array or a matrix', () => {
    expect([1, 2, 3, 4]).toContain(f.pickRandom(N()));
    expect([1, 2, 3, 4]).toContain(f.pickRandom(D()));
    expect((f.pickRandom(N(), 3) as number[]).every((x) => typeof x === 'number')).toBe(true);
  });
});
