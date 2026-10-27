/**
 * Oracle pins for setStringSubset / functions subset string setter (clone G17 set).
 *
 * Independent literals: expected strings and error messages are written out,
 * not read back from the implementation. Covers the former `_setSubstring`
 * contract (origin/main functions/src/matrix/subset.ts) which this merge
 * delegates to expression setStringSubset.
 */
import { describe, it, expect } from 'vitest';
import { setStringSubset, type IndexLike } from '../src/node/utils/stringSubset.js';
import { index, range, subset } from '../../functions/src/factories/index.js';
import { DimensionError } from '../src/error/DimensionError.js';
import { IndexError } from '../src/error/IndexError.js';

/** Duck-typed index like assign.test.ts (must pass isIndex === true guard, not isIndex()). */
function duckIndexAt(i: number): IndexLike {
  return {
    isIndex: true,
    isScalar: () => true,
    size: () => [1],
    min: () => [i],
    max: () => [i],
    dimension: () => i,
    _dimensions: [i],
    _sourceSize: [null],
  } as IndexLike;
}

const rangeIndex12 = () => index(range(1, 3));

function expectThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected throw');
}

describe('setStringSubset / subset string setter oracle (clone G17 set)', () => {
  it('setStringSubset: invalid index throws Invalid index message', () => {
    expect(() => setStringSubset('abcd', {} as IndexLike, 'x')).toThrow(
      new TypeError('Invalid index: must be an Index or Index-like object')
    );
  });

  it('setStringSubset: isIndex not true throws Invalid index message', () => {
    expect(() => setStringSubset('abcd', { isIndex: false } as IndexLike, 'x')).toThrow(
      new TypeError('Invalid index: must be an Index or Index-like object')
    );
  });

  it('setStringSubset: duck-typed literal index at 1 on abcd', () => {
    expect(setStringSubset('abcd', duckIndexAt(1), 'X')).toBe('aXcd');
  });

  it('subset(string,set): duck-typed literal index at 1 on abcd', () => {
    expect(subset('abcd', duckIndexAt(1) as never, 'X')).toBe('aXcd');
  });

  it('setStringSubset: 0-based index 0 replaces first character', () => {
    expect(setStringSubset('abcd', index(0) as IndexLike, 'X')).toBe('Xbcd');
  });

  it('subset(string,set): 0-based index 0 replaces first character', () => {
    expect(subset('abcd', index(0), 'X')).toBe('Xbcd');
  });

  it('setStringSubset: single index 1 on abcd via Index', () => {
    expect(setStringSubset('abcd', index(1) as IndexLike, 'X')).toBe('aXcd');
  });

  it('subset(string,set): single index 1 on abcd via Index', () => {
    expect(subset('abcd', index(1), 'X')).toBe('aXcd');
  });

  it('setStringSubset: 1-element array index matches scalar replacement length 1', () => {
    expect(setStringSubset('abcd', index([1]) as IndexLike, 'X')).toBe('aXcd');
  });

  it('setStringSubset: empty index returns original string', () => {
    expect(setStringSubset('abcd', index('') as IndexLike, 'zz')).toBe('abcd');
  });

  it('subset(string,set): empty index returns original string', () => {
    expect(subset('abcd', index(''), 'zz')).toBe('abcd');
  });

  it('setStringSubset: matching-length range replacement', () => {
    expect(setStringSubset('abcd', rangeIndex12() as IndexLike, 'XY')).toBe('aXYd');
  });

  it('subset(string,set): matching-length range replacement', () => {
    expect(subset('abcd', rangeIndex12(), 'XY')).toBe('aXYd');
  });

  it('setStringSubset: replacement longer than index span throws DimensionError', () => {
    const err = expectThrow(() => setStringSubset('abcd', rangeIndex12() as IndexLike, 'xyz'));
    expect(err).toBeInstanceOf(DimensionError);
    expect((err as Error).message).toBe('Dimension mismatch (2 != 3)');
    expect((err as DimensionError).actual).toBe(2);
    expect((err as DimensionError).expected).toBe(3);
  });

  it('subset(string,set): replacement longer than index span throws DimensionError', () => {
    const err = expectThrow(() => subset('abcd', rangeIndex12(), 'xyz'));
    expect(err).toBeInstanceOf(DimensionError);
    expect((err as Error).message).toBe('Dimension mismatch (2 != 3)');
    expect((err as DimensionError).actual).toBe(2);
    expect((err as DimensionError).expected).toBe(3);
  });

  it('setStringSubset: replacement shorter than index span throws DimensionError', () => {
    const err = expectThrow(() => setStringSubset('abcd', rangeIndex12() as IndexLike, 'x'));
    expect(err).toBeInstanceOf(DimensionError);
    expect((err as Error).message).toBe('Dimension mismatch (2 != 1)');
    expect((err as DimensionError).actual).toBe(2);
    expect((err as DimensionError).expected).toBe(1);
  });

  it('subset(string,set): replacement shorter than index span throws DimensionError', () => {
    const err = expectThrow(() => subset('abcd', rangeIndex12(), 'x'));
    expect(err).toBeInstanceOf(DimensionError);
    expect((err as Error).message).toBe('Dimension mismatch (2 != 1)');
    expect((err as DimensionError).actual).toBe(2);
    expect((err as DimensionError).expected).toBe(1);
  });

  it('setStringSubset: two-dimensional index throws DimensionError', () => {
    const err = expectThrow(() => setStringSubset('abcd', index(1, 2) as IndexLike, 'x'));
    expect(err).toBeInstanceOf(DimensionError);
    expect((err as Error).message).toBe('Dimension mismatch (2 != 1)');
    expect((err as DimensionError).actual).toBe(2);
    expect((err as DimensionError).expected).toBe(1);
  });

  it('setStringSubset: negative index throws IndexError', () => {
    const err = expectThrow(() => setStringSubset('abcd', index(-1) as IndexLike, 'x'));
    expect(err).toBeInstanceOf(IndexError);
    expect((err as Error).message).toBe('Index out of range (-1 < 0)');
  });

  it('subset(string,set): negative index throws IndexError', () => {
    const err = expectThrow(() => subset('abcd', index(-1), 'x'));
    expect(err).toBeInstanceOf(IndexError);
    expect((err as Error).message).toBe('Index out of range (-1 < 0)');
  });

  it('setStringSubset: out-of-range scalar index extends with default space', () => {
    expect(setStringSubset('abcd', index(9) as IndexLike, 'x')).toBe('abcd     x');
  });

  it('subset(string,set): out-of-range scalar index extends with default space', () => {
    expect(subset('abcd', index(9), 'x')).toBe('abcd     x');
  });

  it('setStringSubset: out-of-range scalar index extends with custom defaultValue', () => {
    expect(setStringSubset('abcd', index(9) as IndexLike, 'x', '*')).toBe('abcd*****x');
  });

  it('subset(string,set): out-of-range scalar index extends with custom defaultValue', () => {
    expect(subset('abcd', index(9), 'x', '*')).toBe('abcd*****x');
  });

  it('setStringSubset: empty target pads then writes', () => {
    expect(setStringSubset('', index(2) as IndexLike, 'Z')).toBe('  Z');
    expect(setStringSubset('', index(2) as IndexLike, 'Z', '*')).toBe('**Z');
  });

  it('setStringSubset: bad defaultValue throws TypeError', () => {
    expect(() => setStringSubset('abcd', index(1) as IndexLike, 'x', 'ab')).toThrow(
      new TypeError('Single character expected as defaultValue')
    );
  });

  it('subset(string,set): bad defaultValue throws TypeError', () => {
    expect(() => subset('abcd', index(1), 'x', 'ab')).toThrow(
      new TypeError('Single character expected as defaultValue')
    );
  });

  it('setStringSubset: empty-string defaultValue throws TypeError', () => {
    expect(() => setStringSubset('abcd', index(1) as IndexLike, 'x', '')).toThrow(
      new TypeError('Single character expected as defaultValue')
    );
  });

  it('subset(string,set): non-string replacement is rejected by typed dispatch', () => {
    expect(() => subset('abcd', index(1), 9 as never)).toThrow(TypeError);
    expect(() => subset('abcd', index(1), 9 as never)).toThrow(
      'Unexpected type of argument in function subset (expected: string, actual: number, index: 2)'
    );
  });

  it('subset(string,set): 1-element array replacement is rejected by typed dispatch', () => {
    expect(() => subset('abcd', index(1), ['X'] as never)).toThrow(TypeError);
    expect(() => subset('abcd', index(1), ['X'] as never)).toThrow(
      'Unexpected type of argument in function subset (expected: string, actual: Array, index: 2)'
    );
  });
});
