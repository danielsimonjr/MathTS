import { describe, it, expect } from 'vitest';
import {
  continuedFraction,
  eulerNumbers,
  stirlingS1,
  discreteLog,
  primitiveRoot,
  multiplicativeOrder,
  kroneckerSymbol,
  combinationsGen,
  permutationsGen,
} from '../src/index.js';

describe('number theory fills', () => {
  it('stirlingS1(5,2) = -50 (signed)', () => {
    expect(stirlingS1(5, 2)).toBe(-50);
  });
  it('eulerNumbers(6) = [1,0,-1,0,5,0,-61]', () => {
    expect(eulerNumbers(6)).toEqual([1, 0, -1, 0, 5, 0, -61]);
  });
  it('continuedFraction(3.245) starts [3,4,...]', () => {
    const cf = continuedFraction(3.245, 5);
    expect(cf[0]).toBe(3);
    expect(cf[1]).toBe(4);
  });
  it('discreteLog(2,3,5) = 3', () => {
    expect(discreteLog(2, 3, 5)).toBe(3);
  });
  it('primitiveRoot(7) = 3', () => {
    expect(primitiveRoot(7)).toBe(3);
  });
  it('multiplicativeOrder(2,7) = 3', () => {
    expect(multiplicativeOrder(2, 7)).toBe(3);
  });
  it('kroneckerSymbol(2,3) = -1', () => {
    expect(kroneckerSymbol(2, 3)).toBe(-1);
  });
  it('combinationsGen([1,2,3],2) enumerates tuples', () => {
    expect(combinationsGen([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });
  it('permutationsGen([1,2,3],2) has 6 tuples', () => {
    expect(permutationsGen([1, 2, 3], 2)).toHaveLength(6);
  });
});
