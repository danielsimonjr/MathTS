import { describe, it, expect } from 'vitest';
import { summation, symbolicProduct } from '../src/index.js';

describe('summation — finite numeric bounds only', () => {
  it('sum k, k=1..10 = 55', () => {
    expect(summation('k', 'k', 1, 10)).toBe(55);
  });
  it('sum k^2, k=1..5 = 55', () => {
    expect(summation('k^2', 'k', 1, 5)).toBe(55);
  });
  it('throws (not 0) on a symbolic upper bound', () => {
    expect(() => summation('k', 'k', 1, 'n' as unknown as number)).toThrow(
      /symbolic|finite|not supported/i
    );
  });
});

describe('symbolicProduct — finite numeric bounds only', () => {
  it('prod k, k=1..5 = 120', () => {
    expect(symbolicProduct('k', 'k', 1, 5)).toBe(120);
  });
  it('throws (not 1) on a symbolic upper bound', () => {
    expect(() => symbolicProduct('k', 'k', 1, 'n' as unknown as number)).toThrow(
      /symbolic|finite|not supported/i
    );
  });
});
