/**
 * Oracle pins for setStringSubset / functions subset string setter (clone G17 set).
 */
import { describe, it, expect } from 'vitest';
import { setStringSubset, type IndexLike } from '../src/node/utils/stringSubset.js';
import { index, range, subset } from '../../functions/src/factories/index.js';
import { DimensionError } from '../src/error/DimensionError.js';

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

  it('setStringSubset: single index 1 on abcd via Index', () => {
    expect(setStringSubset('abcd', index(1) as IndexLike, 'X')).toBe('aXcd');
  });

  it('subset(string,set): single index 1 on abcd via Index', () => {
    expect(subset('abcd', index(1), 'X')).toBe('aXcd');
  });

  it('setStringSubset: empty index returns original string', () => {
    expect(setStringSubset('abcd', index('') as IndexLike, 'zz')).toBe('abcd');
  });

  it('subset(string,set): empty index returns original string', () => {
    expect(subset('abcd', index(''), 'zz')).toBe('abcd');
  });

  it('setStringSubset: replacement longer than index span throws DimensionError', () => {
    expect(() => setStringSubset('abcd', rangeIndex12() as IndexLike, 'xyz')).toThrow(
      DimensionError
    );
    try {
      setStringSubset('abcd', rangeIndex12() as IndexLike, 'xyz');
    } catch (e) {
      expect((e as DimensionError).actual).toBe(2);
      expect((e as DimensionError).expected).toBe(3);
    }
  });

  it('subset(string,set): replacement longer than index span throws DimensionError', () => {
    expect(() => subset('abcd', rangeIndex12(), 'xyz')).toThrow(DimensionError);
    try {
      subset('abcd', rangeIndex12(), 'xyz');
    } catch (e) {
      expect((e as DimensionError).actual).toBe(2);
      expect((e as DimensionError).expected).toBe(3);
    }
  });

  it('setStringSubset: replacement shorter than index span throws DimensionError', () => {
    expect(() => setStringSubset('abcd', rangeIndex12() as IndexLike, 'x')).toThrow(DimensionError);
    try {
      setStringSubset('abcd', rangeIndex12() as IndexLike, 'x');
    } catch (e) {
      expect((e as DimensionError).actual).toBe(2);
      expect((e as DimensionError).expected).toBe(1);
    }
  });

  it('subset(string,set): replacement shorter than index span throws DimensionError', () => {
    expect(() => subset('abcd', rangeIndex12(), 'x')).toThrow(DimensionError);
  });

  it('setStringSubset: out-of-range scalar index extends with default space', () => {
    expect(setStringSubset('abcd', index(9) as IndexLike, 'x')).toBe('abcd     x');
  });

  it('subset(string,set): out-of-range scalar index extends with default space', () => {
    expect(subset('abcd', index(9), 'x')).toBe('abcd     x');
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

  it('subset(string,set): non-string replacement is rejected by typed dispatch', () => {
    expect(() => subset('abcd', index(1), 9 as never)).toThrow(/Unexpected type of argument/);
  });
});
