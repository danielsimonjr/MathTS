import { describe, it, expect } from 'vitest';
import { _switch } from '../src/switch.js';

// ---------------------------------------------------------------------------
// _switch  (matrix transpose) — canonical core copy.
// Migrated from expression/tests/utils-switch.test.ts when the dead-ship
// expression/src/utils/switch.ts local copy was retired (behavior-identical to
// this canonical). See dedup cleanup CHANGELOG entry.
// ---------------------------------------------------------------------------
describe('_switch', () => {
  it('transposes a 2x3 matrix to 3x2', () => {
    const mat = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(_switch(mat)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('transposes a 3x2 matrix to 2x3', () => {
    const mat = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    expect(_switch(mat)).toEqual([
      [1, 3, 5],
      [2, 4, 6],
    ]);
  });

  it('transposes a 1x1 matrix', () => {
    expect(_switch([[42]])).toEqual([[42]]);
  });

  it('transposes a square 2x2 matrix', () => {
    expect(
      _switch([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('transposes a square 3x3 matrix', () => {
    const mat = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    expect(_switch(mat)).toEqual([
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9],
    ]);
  });

  it('transposes a 1-row matrix', () => {
    expect(_switch([[10, 20, 30]])).toEqual([[10], [20], [30]]);
  });

  it('transposes a 1-column matrix (single element per row)', () => {
    expect(_switch([[1], [2], [3]])).toEqual([[1, 2, 3]]);
  });

  it('works with string elements', () => {
    expect(
      _switch([
        ['a', 'b'],
        ['c', 'd'],
      ])
    ).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });
});
