import { describe, it, expect } from 'vitest';
import { maxFlow, minCut, hungarian, astar } from '../src/index.js';

describe('graph optimization', () => {
  it('hungarian cost = 5, assignment [1,0,2] (scipy)', () => {
    const r = hungarian([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]);
    expect(r.cost).toBeCloseTo(5, 8);
    expect(r.assignment).toEqual([1, 0, 2]);
  });
  it('hungarian 4x4 cost = 13, assignment [1,0,2,3] (scipy)', () => {
    const r = hungarian([
      [9, 2, 7, 8],
      [6, 4, 3, 7],
      [5, 8, 1, 8],
      [7, 6, 9, 4],
    ]);
    expect(r.cost).toBeCloseTo(13, 8);
    expect(r.assignment).toEqual([1, 0, 2, 3]);
  });
  // networkx.maximum_flow_value on this exact capacity matrix returns 5
  // (verified at build 2026-07-16), not 4 as originally drafted.
  it('maxFlow simple network = 5 (networkx maximum_flow_value)', () => {
    const cap = [
      [0, 3, 2, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 3],
      [0, 0, 0, 0],
    ];
    expect(maxFlow(cap, 0, 3).maxFlow).toBe(5);
  });
  it('minCut value equals maxFlow', () => {
    const cap = [
      [0, 3, 2, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 3],
      [0, 0, 0, 0],
    ];
    const c = minCut(cap, 0, 3);
    expect(c.value).toBe(5);
    expect(c.partition[0]).toContain(0); // source side
  });
  it('astar (h=0) finds the shortest path', () => {
    const adj = [
      [0, 1, 4],
      [1, 0, 1],
      [4, 1, 0],
    ];
    const r = astar(adj, 0, 2, () => 0);
    expect(r.cost).toBe(2);
    expect(r.path).toEqual([0, 1, 2]);
  });
  it('astar rejects a non-matrix adjacency (no infinite reconstruct loop)', () => {
    expect(() => astar({ A: { B: 1 }, B: {} } as unknown as number[][], 0, 1, () => 0)).toThrow(
      /adjacency/
    );
    expect(() =>
      astar(
        [
          [0, 1],
          [0, 0],
        ],
        'A' as unknown as number,
        1,
        () => 0
      )
    ).toThrow(/start or goal/);
  });
});
