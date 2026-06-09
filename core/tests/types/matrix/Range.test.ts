import { describe, it, expect } from 'vitest';
import { createRangeClass } from '../../../src/types/matrix/Range.js';

// The createRangeClass is a factory function. Let's mock the dependencies.
const Range = createRangeClass({} as any) as any;

describe('Range', () => {
  it('should create a Range correctly', () => {
    const range = new Range(2, 6);
    expect(range.start).toBe(2);
    expect(range.end).toBe(6);
    expect(range.step).toBe(1);
  });

  describe('valueOf', () => {
    it('should return a primitive array representation of the range', () => {
      const range = new Range(2, 6);
      expect(range.valueOf()).toEqual([2, 3, 4, 5]);
    });

    it('should cache the valueOf result', () => {
      const range = new Range(2, 6);
      const val1 = range.valueOf();
      const val2 = range.valueOf();
      // Should be the exact same array reference
      expect(val1).toBe(val2);
    });

    it('should invalidate cache when start changes', () => {
      const range = new Range(2, 6);
      const val1 = range.valueOf();
      expect(val1).toEqual([2, 3, 4, 5]);

      range.start = 3;
      const val2 = range.valueOf();
      expect(val2).toEqual([3, 4, 5]);
      expect(val1).not.toBe(val2);
    });

    it('should invalidate cache when end changes', () => {
      const range = new Range(2, 6);
      const val1 = range.valueOf();
      expect(val1).toEqual([2, 3, 4, 5]);

      range.end = 5;
      const val2 = range.valueOf();
      expect(val2).toEqual([2, 3, 4]);
      expect(val1).not.toBe(val2);
    });

    it('should invalidate cache when step changes', () => {
      const range = new Range(2, 6);
      const val1 = range.valueOf();
      expect(val1).toEqual([2, 3, 4, 5]);

      range.step = 2;
      const val2 = range.valueOf();
      expect(val2).toEqual([2, 4]);
      expect(val1).not.toBe(val2);
    });
  });
});
