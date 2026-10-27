/**
 * Oracle pins for getStringSubset / functions subset string path (clone G17).
 */
import { describe, it, expect } from 'vitest';
import { getStringSubset } from '../src/node/utils/stringSubset.js';
import { index, subset } from '../../functions/src/factories/index.js';

describe('getStringSubset / subset string oracle (clone G17)', () => {
  it('getStringSubset: invalid index throws Index expected', () => {
    expect(() => getStringSubset('abcd', {} as never)).toThrow(new TypeError('Index expected'));
  });

  it('subset(string): invalid index throws Invalid index message', () => {
    expect(() => subset('abcd', { isIndex: true } as never)).toThrow(
      new TypeError('Invalid index: must be an Index or Index-like object')
    );
  });

  it('getStringSubset: single 1-wide index on abcd', () => {
    expect(getStringSubset('abcd', index(2))).toBe('c');
  });

  it('subset(string): single 1-wide index on abcd', () => {
    expect(subset('abcd', index(2))).toBe('c');
  });

  it('getStringSubset: empty index dimension returns empty string', () => {
    expect(getStringSubset('abcd', index(''))).toBe('');
  });

  it('subset(string): empty index dimension returns empty string', () => {
    expect(subset('abcd', index(''))).toBe('');
  });
});
