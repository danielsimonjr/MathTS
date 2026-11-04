import { describe, it, expect } from 'vitest';
import { dtw } from '../src/signal/dtw.js';

describe('dtw', () => {
  it('identical sequences have zero distance', () => {
    expect(dtw([1, 2, 3], [1, 2, 3]).distance).toBe(0);
  });

  it('time-stretched copy warps to zero distance', () => {
    expect(dtw([1, 2, 3], [1, 2, 2, 3]).distance).toBe(0);
  });

  it('diagonal alignment cost', () => {
    expect(dtw([0, 0], [1, 1]).distance).toBe(2);
  });

  it('path runs from the first to the last cell', () => {
    const a = [1, 4, 2, 8];
    const b = [1, 2, 8, 8, 3];
    const { path } = dtw(a, b);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([a.length - 1, b.length - 1]);
  });

  it('custom local distance is used', () => {
    expect(dtw([0], [3], { dist: (x, y) => (x - y) ** 2 }).distance).toBe(9);
  });
});
