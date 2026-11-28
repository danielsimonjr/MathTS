import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

describe('mathjs #1788 relational relTol', () => {
  it('equal honors instance relTol via activated factory_equal', () => {
    const math = create(all);
    expect(math.equal(1, 0.991)).toBe(false);
    math.config({ relTol: 1e-2 });
    expect(math.equal(1, 0.991)).toBe(true);
  });

  it('compare honors instance relTol for scalar numbers', () => {
    const math = create(all);
    math.config({ relTol: 1e-2 });
    expect(math.compare(1, 0.991)).toBe(0);
  });

  it('unequal inverts equal within relTol', () => {
    const math = create(all);
    math.config({ relTol: 1e-2 });
    expect(math.unequal(1, 0.991)).toBe(false);
  });
});

describe('mathjs #1788 statistics', () => {
  it('std returns NaN when input contains NaN', () => {
    const math = create(all);
    expect(math.std([NaN])).toBeNaN();
  });

  it('sum of empty array is zero', () => {
    const math = create(all);
    expect(math.sum([])).toBe(0);
  });

  it('mean rejects incompatible units with mathjs message', () => {
    const math = create(all);
    expect(() => math.mean(math.unit('5 m'), math.unit('3 kg'))).toThrow(/Units do not match/);
  });

  it('median(A, dim) is rejected', () => {
    const math = create(all);
    expect(() => math.median([1, 2, 3], 0)).toThrow(/median\(A, dim\) is not yet supported/);
  });

  it('mode throws when called with no arguments', () => {
    const math = create(all);
    expect(() => (math.mode as () => unknown)()).toThrow(/requires one or more parameters/);
  });
});
