import { describe, it, expect } from 'vitest';
import { polygamma, trigamma, jacobiP, gegenbauerC } from '../src/index.js';

describe('polygamma + orthogonal polynomials', () => {
  it('trigamma(2) = polygamma(1,2) = 0.6449340668', () => {
    expect(trigamma(2)).toBeCloseTo(0.6449340668, 7);
    expect(polygamma(1, 2)).toBeCloseTo(0.6449340668, 7);
  });
  it('polygamma(2,1) = -2.4041138063', () => {
    expect(polygamma(2, 1)).toBeCloseTo(-2.4041138063, 6);
  });
  it('polygamma(0,1) matches digamma = -0.5772156649', () => {
    expect(polygamma(0, 1)).toBeCloseTo(-0.5772156649, 8);
  });
  it('jacobiP(2,1,1,0.5) = 0.1875', () => {
    expect(jacobiP(2, 1, 1, 0.5)).toBeCloseTo(0.1875, 8);
  });
  it('gegenbauerC(2,1,x) = 4x^2-1', () => {
    expect(gegenbauerC(2, 1, 0.5)).toBeCloseTo(0, 8);
    expect(gegenbauerC(2, 1, 1)).toBeCloseTo(3, 8);
  });
});
