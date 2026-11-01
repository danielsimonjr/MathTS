/**
 * P7-7 pins: number comparator path for median / partitionSelect.
 */
import { describe, it, expect } from 'vitest';
import { median, partitionSelect } from '../src/index.js';

describe('P7-7 median / partitionSelect number path', () => {
  it('odd and even median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('NaN and -0', () => {
    expect(Number.isNaN(median([1, NaN, 3]) as number)).toBe(true);
    const m = median([-0, 0]) as number;
    expect(m === 0).toBe(true);
  });

  it('partitionSelect k=1 on a seeded vector', () => {
    const a = [9, 1, 5, 3, 7];
    const v = partitionSelect(a, 2);
    expect(v).toBe(5);
  });

  it('empty median throws', () => {
    expect(() => median([])).toThrow(/empty/);
  });
});
