import { describe, it, expect } from 'vitest';
import { bfs, dfs, floydWarshall, bellmanFord, harmonicCentrality } from '../src/index.js';

const INF = Infinity;
const path3 = [
  [0, 1, INF],
  [1, 0, 1],
  [INF, 1, 0],
];

describe('graph traversal + all-pairs + centrality', () => {
  it('bfs from 0 on a path = [0,1,2]', () => {
    expect(bfs(path3, 0)).toEqual([0, 1, 2]);
  });
  it('dfs from 0 on a path = [0,1,2]', () => {
    expect(dfs(path3, 0)).toEqual([0, 1, 2]);
  });
  it('floydWarshall d(0,2) = 2', () => {
    expect(floydWarshall(path3)[0][2]).toBe(2);
  });
  it('bellmanFord distances + no negative cycle', () => {
    const r = bellmanFord(path3, 0);
    expect(r.dist[2]).toBe(2);
    expect(r.hasNegativeCycle).toBe(false);
  });
  it('bellmanFord detects a negative cycle', () => {
    const neg = [
      [0, 1, INF],
      [INF, 0, -3],
      [1, INF, 0],
    ]; // 0->1->2->0 = -1
    expect(bellmanFord(neg, 0).hasNegativeCycle).toBe(true);
  });
  it('harmonicCentrality middle node highest', () => {
    const h = harmonicCentrality(path3);
    expect(h[1]).toBeGreaterThan(h[0]);
  });
});
