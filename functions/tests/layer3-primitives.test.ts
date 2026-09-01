import { describe, it, expect } from 'vitest';
import {
  detZ,
  resultantZ,
  rothsteinResultant,
  hermiteReduce,
  residueIntegral,
  rothsteinTrager,
  integrateLayer3,
} from '../src/cas/layer3.js';

describe('detZ', () => {
  it('empty matrix is 1', () => {
    expect(detZ([])).toBe(1n);
  });
  it('1×1 and 2×2', () => {
    expect(detZ([[5n]])).toBe(5n);
    expect(
      detZ([
        [1n, 2n],
        [3n, 4n],
      ])
    ).toBe(-2n);
  });
  it('singular matrix is 0', () => {
    expect(
      detZ([
        [1n, 2n],
        [2n, 4n],
      ])
    ).toBe(0n);
  });
  it('swaps sign on a row exchange', () => {
    expect(
      detZ([
        [0n, 1n],
        [1n, 0n],
      ])
    ).toBe(-1n);
  });
});

describe('resultantZ edge cases', () => {
  it('zero polynomial yields 0', () => {
    expect(resultantZ([], [1n, 1n])).toBe(0n);
    expect(resultantZ([1n], [])).toBe(0n);
  });
  it('two constants yield 1', () => {
    expect(resultantZ([3n], [5n])).toBe(1n);
  });
  it('constant vs linear is the constant', () => {
    expect(resultantZ([2n], [3n, 1n])).toBe(2n);
    expect(resultantZ([3n, 1n], [2n])).toBe(2n);
  });
});

describe('hermiteReduce on a repeated factor', () => {
  it('peels (x^2-2)^2 and leaves a square-free remainder', () => {
    // Q = (x^2-2)^2 = x^4 - 4x^2 + 4; R = 1
    const h = hermiteReduce([1n], [4n, 0n, -4n, 0n, 1n], 'x');
    expect(h.rational).not.toBe('0');
    expect(h.squareFreeDenom.length).toBeLessThanOrEqual(3);
  });
});

describe('residue / Rothstein–Trager / Layer 3', () => {
  it('residueIntegral of 1/(x^2+1) is a real log/atan form', () => {
    const s = residueIntegral([1n], [1n, 0n, 1n], 'x');
    expect(s).toMatch(/log|atan/);
    expect(s).not.toBe('0');
  });
  it('rothsteinTrager of 1/(x^2-1) is a linear-residue log form', () => {
    const s = rothsteinTrager([1n], [-1n, 0n, 1n], 'x');
    expect(s).toMatch(/log/);
  });
  it('integrateLayer3 of 1/(x^3-2) is nonempty', () => {
    const s = integrateLayer3([1n], [-2n, 0n, 0n, 1n], 'x');
    expect(s).not.toBe('0');
    expect(s.length).toBeGreaterThan(3);
  });
  it('rothsteinResultant of 1/(x^2+1) has degree ≥ 1', () => {
    expect(rothsteinResultant([1n], [1n, 0n, 1n]).length).toBeGreaterThan(1);
  });
});
