import { describe, it, expect } from 'vitest';
import { hasOwnProperty } from '../src/shared.js';

describe('hasOwnProperty', () => {
  it('should return true for own property', () => {
    expect(hasOwnProperty({ a: 1 }, 'a')).toBe(true);
  });

  it('should return false for inherited property', () => {
    expect(hasOwnProperty({}, 'toString')).toBe(false);
  });

  it('should return false for missing property', () => {
    expect(hasOwnProperty({ a: 1 }, 'b')).toBe(false);
  });

  it('should return falsy for null object', () => {
    expect(hasOwnProperty(null, 'a')).toBeFalsy();
  });

  it('should return falsy for undefined object', () => {
    expect(hasOwnProperty(undefined, 'a')).toBeFalsy();
  });

  it('should work with array indices', () => {
    expect(hasOwnProperty([1, 2, 3], '0')).toBe(true);
    expect(hasOwnProperty([1, 2, 3], '5')).toBe(false);
  });
});
