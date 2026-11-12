/**
 * Issue #714 — numbers package entry (#714, dogfood G11).
 */

import { describe, it, expect } from 'vitest';
import { BigNumber, bignumber } from '../src/index.js';

describe('@danielsimonjr/mathts-numbers BigNumber construction (#714)', () => {
  it('exact repro imports: new BigNumber(1).toString()', () => {
    const x = new BigNumber(1);
    expect(x.toString()).toBe('1');
  });

  it('exports bignumber factory from the numbers barrel', () => {
    expect(typeof bignumber).toBe('function');
    expect(bignumber('0.1').add(bignumber('0.2')).toString()).toBe('0.3');
  });

  it('rejects a second argument instead of building an internal coefficient', () => {
    const x = new BigNumber(1);
    expect(x).toBeInstanceOf(BigNumber);
    const Ctor = BigNumber as unknown as new (...args: unknown[]) => BigNumber;
    expect(() => new Ctor(1, 2)).toThrow(TypeError);
    const copy = new BigNumber(x);
    expect(copy).not.toBe(x);
    expect(copy.toString()).toBe('1');
    expect(bignumber(x)).toBe(x);
  });
});
