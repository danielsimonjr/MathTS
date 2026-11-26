/**
 * #1288: compat `zeros` and `ones` take an Array size, three or more sizes and a format.
 *
 * The compat shim took two numbers only: `zeros([2, 3, 2])` returned `[0]` and `zeros(2, 3, 2)`
 * a 2 x 3 matrix. Every row below is compared with `zeros` / `ones` of the mathjs devDependency.
 * Directly imported helpers also cover the original native representations.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { create, all, zeros, ones } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const math = create(all) as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

/** The nested array of an Array or a matrix. */
function nested(v: unknown): unknown {
  if (Array.isArray(v)) return v;
  return (v as { toArray(): unknown }).toArray();
}

/** The size of an Array (the first entry of each level) or a matrix. */
function sizeOf(v: unknown): number[] {
  if (Array.isArray(v)) {
    const out: number[] = [];
    let cur: unknown = v;
    while (Array.isArray(cur)) {
      out.push(cur.length);
      cur = cur[0];
    }
    return out;
  }
  const s = (v as { size: number[] | (() => number[]) }).size;
  return typeof s === 'function' ? (v as { size(): number[] }).size() : [...s];
}

function isNative(v: unknown): boolean {
  return v instanceof DenseMatrix;
}

describe('compat zeros and ones with three or more sizes (#1288)', () => {
  it.each([
    ['zeros', [2, 3, 2]],
    ['zeros', [1, 0, 0]],
    ['zeros', [2, 0, 3]],
    ['zeros', [2, 2, 2, 2]],
    ['ones', [2, 1, 2]],
    ['ones', [3, 2, 2]],
  ] as [string, number[]][])('%s(...%j) has the size and the values of mathjs', (name, sizes) => {
    const expected = mj[name](...sizes);
    const actual = math[name](...sizes);
    expect(isNative(actual)).toBe(false);
    expect(sizeOf(actual)).toEqual(sizeOf(expected));
    expect(sizeOf(actual)).toEqual(sizes);
    expect(nested(actual)).toEqual(nested(expected));
  });

  it('zeros(2, 3, 2) is a matrix of size [2, 3, 2]', () => {
    const m = math.zeros(2, 3, 2) as { size(): number[]; storage(): string };
    expect(m.size()).toEqual([2, 3, 2]);
    expect(m.storage()).toBe('dense');
  });

  it('zeros(1, 0, 0) is a matrix of size [1, 0, 0]', () => {
    expect((math.zeros(1, 0, 0) as { size(): number[] }).size()).toEqual([1, 0, 0]);
  });
});

describe('compat zeros and ones with an Array size (#1288)', () => {
  it.each([
    ['zeros', [2, 3, 2]],
    ['zeros', [2, 3]],
    ['zeros', [3]],
    ['zeros', []],
    ['ones', [2, 3, 2]],
    ['ones', [2, 3]],
    ['ones', [2]],
  ] as [string, number[]][])('%s(%j) is an Array as in mathjs', (name, sizes) => {
    const expected = mj[name](sizes);
    const actual = math[name](sizes);
    expect(Array.isArray(expected)).toBe(true);
    expect(Array.isArray(actual)).toBe(true);
    expect(actual).toEqual(expected);
  });

  it('zeros([2, 3, 2]) is a 2 x 3 x 2 Array of 0', () => {
    const a = math.zeros([2, 3, 2]) as number[][][];
    expect(sizeOf(a)).toEqual([2, 3, 2]);
    expect(a.flat(2).every((v) => v === 0)).toBe(true);
  });

  it('zeros([]) is an empty Array', () => {
    expect(math.zeros([])).toEqual([]);
  });

  it('a matrix size gives a matrix, as in mathjs', () => {
    const expected = mj.zeros(mj.matrix([2, 3]));
    const actual = math.zeros(math.matrix([2, 3]));
    expect(sizeOf(actual)).toEqual(sizeOf(expected));
    expect(nested(actual)).toEqual(nested(expected));
  });
});

describe('compat zeros and ones with a format (#1288)', () => {
  it.each([
    ['zeros', [2, 2], 'sparse'],
    ['ones', [2, 2], 'sparse'],
    ['zeros', [2, 3, 2], 'dense'],
    ['zeros', [2, 3], 'dense'],
    ['ones', [2, 3], 'default'],
  ] as [string, number[], string][])(
    '%s(...%j, "%s") is the matrix of mathjs',
    (name, sizes, format) => {
      const expected = mj[name](...sizes, format) as { storage(): string };
      const actual = math[name](...sizes, format) as { storage(): string };
      expect(actual.storage()).toBe(expected.storage());
      expect(sizeOf(actual)).toEqual(sizeOf(expected));
      expect(nested(actual)).toEqual(nested(expected));
    }
  );

  it('zeros(2, 2, "sparse") is a sparse matrix', () => {
    const m = math.zeros(2, 2, 'sparse') as { storage(): string };
    expect(m.storage()).toBe('sparse');
  });

  it('an Array size and a format give a matrix', () => {
    const m = math.zeros([2, 2], 'sparse') as { storage(): string };
    expect(m.storage()).toBe('sparse');
  });
});

describe('direct zeros and ones imports keep the native forms (#1288)', () => {
  it('zeros(n) and ones(n) are the mathjs Matrix of size [n] (#1550)', () => {
    // #1550: `zeros`/`ones` bind the mathjs-shaped factories, so a single size
    // returns a Matrix under the default config, as in mathjs.
    expect(sizeOf(zeros(3))).toEqual([3]);
    expect(nested(zeros(3))).toEqual(nested(mj.zeros(3)));
    expect(nested(ones(3))).toEqual(nested(mj.ones(3)));
    expect(sizeOf(zeros(0))).toEqual([0]);
  });

  it('zeros(r, c) and ones(r, c) are matrices of r x c (#1550)', () => {
    const z = zeros(2, 3);
    const o = ones(2, 3);
    expect(sizeOf(z)).toEqual([2, 3]);
    expect(sizeOf(o)).toEqual([2, 3]);
    expect(nested(z)).toEqual(nested(mj.zeros(2, 3)));
    expect(nested(o)).toEqual(nested(mj.ones(2, 3)));
  });
});

describe('compat zeros and ones in the expression language (#1288)', () => {
  it('size(zeros(2, 3, 2)) is [2, 3, 2]', () => {
    const expected = nested(mj.evaluate('size(zeros(2, 3, 2))'));
    const actual = nested(math.evaluate('size(zeros(2, 3, 2))'));
    expect(expected).toEqual([2, 3, 2]);
    expect(actual).toEqual([2, 3, 2]);
  });

  it('size(ones([2, 3, 2])) is [2, 3, 2]', () => {
    const expected = nested(mj.evaluate('size(ones([2, 3, 2]))'));
    const actual = nested(math.evaluate('size(ones([2, 3, 2]))'));
    expect(actual).toEqual(expected);
  });
});
