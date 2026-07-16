import { describe, it, expect } from 'vitest';
import { windowFunction } from '../src/index.js';

describe('windowFunction', () => {
  it('rectangular still returns all ones', () => {
    expect(windowFunction(4, 'rectangular')).toEqual([1, 1, 1, 1]);
  });
  it('rect alias still returns all ones', () => {
    expect(windowFunction(3, 'rect')).toEqual([1, 1, 1]);
  });
  it('hann is correct (endpoints 0, symmetric peak 1)', () => {
    const w = windowFunction(5, 'hann');
    expect(w[0]).toBeCloseTo(0, 12);
    expect(w[2]).toBeCloseTo(1, 12);
    expect(w[4]).toBeCloseTo(0, 12);
  });
  it('throws on an unimplemented window instead of silently returning rectangular', () => {
    expect(() => windowFunction(8, 'kaiser')).toThrow(/kaiser|unknown|unsupported/i);
  });
});
