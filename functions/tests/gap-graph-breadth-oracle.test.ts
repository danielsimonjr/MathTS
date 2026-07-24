/**
 * Oracle tests for the graph-algorithm breadth extension: graphColoring,
 * maxClique, louvainCommunities, katzCentrality, isIsomorphic, the
 * `normalized` alias on betweennessCentrality, and the pre-existing
 * `directed` option on adjacencyMatrix.
 *
 * References regenerated with networkx 3.6.1
 * (`python -c "import networkx as nx; ..."`).
 *
 * Test graph G: edges [(0,1),(1,2),(2,0),(2,3),(3,4),(4,2)] — a triangle
 * 0-1-2 with a pendant triangle-ish tail 2-3-4-2.
 */

import { describe, it, expect } from 'vitest';
import {
  adjacencyMatrix,
  betweennessCentrality,
  graphColoring,
  isIsomorphic,
  katzCentrality,
  louvainCommunities,
  maxClique,
} from '../src/index.js';

const G_EDGES: number[][] = [
  [0, 1],
  [1, 2],
  [2, 0],
  [2, 3],
  [3, 4],
  [4, 2],
];
const G = adjacencyMatrix(G_EDGES, 5);

function isProperColoring(adj: number[][], colors: number[]): boolean {
  const n = adj.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if ((adj[i][j] !== 0 || adj[j][i] !== 0) && colors[i] === colors[j]) return false;
    }
  }
  return true;
}

function isClique(adj: number[][], vertices: number[]): boolean {
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i];
      const b = vertices[j];
      if (adj[a][b] === 0 && adj[b][a] === 0) return false;
    }
  }
  return true;
}

/** Modularity of `partition` on the unweighted undirected graph `adj`. */
function modularity(adj: number[][], partition: number[][]): number {
  const n = adj.length;
  const communityOf = new Array<number>(n);
  partition.forEach((group, ci) => group.forEach((v) => (communityOf[v] = ci)));

  const degree = new Array<number>(n).fill(0);
  let totalWeight = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      degree[i] += adj[i][j];
      totalWeight += adj[i][j];
    }
  }
  const m2 = totalWeight; // sum over full symmetric matrix = 2m
  let Q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (communityOf[i] === communityOf[j]) {
        Q += adj[i][j] - (degree[i] * degree[j]) / m2;
      }
    }
  }
  return Q / m2;
}

describe('graph algorithm breadth (oracle: networkx 3.6.1)', () => {
  describe('graphColoring', () => {
    it('produces a proper coloring of G using <= 3 colors', () => {
      const colors = graphColoring(G);
      expect(colors.length).toBe(5);
      expect(isProperColoring(G, colors)).toBe(true);
      expect(new Set(colors).size).toBeLessThanOrEqual(3);
    });

    it('properly colors a triangle with exactly 3 colors', () => {
      const k3 = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ];
      const colors = graphColoring(k3);
      expect(isProperColoring(k3, colors)).toBe(true);
      expect(new Set(colors).size).toBe(3);
    });

    it('colors an edgeless graph with a single color', () => {
      const empty = [
        [0, 0],
        [0, 0],
      ];
      const colors = graphColoring(empty);
      expect(colors).toEqual([0, 0]);
    });
  });

  describe('maxClique', () => {
    it('finds a maximum clique of size 3 in G ({0,1,2})', () => {
      const clique = maxClique(G);
      expect(clique.length).toBe(3);
      expect(isClique(G, clique)).toBe(true);
    });

    it('verifies maximality: no size-4 clique exists in G', () => {
      // Brute-force check every 4-subset of G's 5 vertices.
      const n = 5;
      let found4 = false;
      for (let mask = 0; mask < 1 << n; mask++) {
        const bits: number[] = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) bits.push(i);
        if (bits.length === 4 && isClique(G, bits)) found4 = true;
      }
      expect(found4).toBe(false);
    });

    it('finds K4 inside a graph containing a larger clique', () => {
      // 0-1-2-3 all mutually connected (K4), plus an isolated vertex 4.
      const k4plus = [
        [0, 1, 1, 1, 0],
        [1, 0, 1, 1, 0],
        [1, 1, 0, 1, 0],
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const clique = maxClique(k4plus);
      expect(clique.length).toBe(4);
      expect(isClique(k4plus, clique)).toBe(true);
    });
  });

  describe('katzCentrality', () => {
    it('matches nx.katz_centrality_numpy(G, alpha=0.1) exactly', () => {
      const kc = katzCentrality(G, 0.1);
      const expected = [0.430463, 0.430463, 0.508729, 0.430463, 0.430463];
      for (let i = 0; i < 5; i++) {
        expect(kc[i]).toBeCloseTo(expected[i], 5);
      }
    });

    it('is uniform on a symmetric complete graph (K3)', () => {
      const k3 = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ];
      const kc = katzCentrality(k3, 0.1);
      expect(kc[0]).toBeCloseTo(kc[1], 10);
      expect(kc[1]).toBeCloseTo(kc[2], 10);
    });
  });

  describe('betweennessCentrality with normalized option', () => {
    it('matches nx.betweenness_centrality(G, normalized=True) exactly', async () => {
      const { centrality } = await betweennessCentrality(G, { normalized: true });
      const expected = [0, 0, 0.666667, 0, 0];
      for (let i = 0; i < 5; i++) {
        expect(centrality[i]).toBeCloseTo(expected[i], 6);
      }
    });

    it('normalized default matches the pre-existing normalise default (true)', async () => {
      const a = await betweennessCentrality(G, {});
      const b = await betweennessCentrality(G, { normalized: true });
      for (let i = 0; i < 5; i++) {
        expect(a.centrality[i]).toBeCloseTo(b.centrality[i], 10);
      }
    });
  });

  describe('louvainCommunities', () => {
    it('returns a valid partition of G (every vertex exactly once)', () => {
      const partition = louvainCommunities(G);
      const seen = new Set<number>();
      for (const group of partition) {
        for (const v of group) {
          expect(seen.has(v)).toBe(false);
          seen.add(v);
        }
      }
      expect(seen.size).toBe(5);
    });

    it('reaches modularity >= 0.35 on the karate club graph (networkx ~0.42)', () => {
      // Zachary's karate club edge list (networkx.karate_club_graph()).
      const karateEdges: [number, number][] = [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [0, 6],
        [0, 7],
        [0, 8],
        [0, 10],
        [0, 11],
        [0, 12],
        [0, 13],
        [0, 17],
        [0, 19],
        [0, 21],
        [0, 31],
        [1, 2],
        [1, 3],
        [1, 7],
        [1, 13],
        [1, 17],
        [1, 19],
        [1, 21],
        [1, 30],
        [2, 3],
        [2, 7],
        [2, 8],
        [2, 9],
        [2, 13],
        [2, 27],
        [2, 28],
        [2, 32],
        [3, 7],
        [3, 12],
        [3, 13],
        [4, 6],
        [4, 10],
        [5, 6],
        [5, 10],
        [5, 16],
        [6, 16],
        [8, 30],
        [8, 32],
        [8, 33],
        [9, 33],
        [13, 33],
        [14, 32],
        [14, 33],
        [15, 32],
        [15, 33],
        [18, 32],
        [18, 33],
        [19, 33],
        [20, 32],
        [20, 33],
        [22, 32],
        [22, 33],
        [23, 25],
        [23, 27],
        [23, 29],
        [23, 32],
        [23, 33],
        [24, 25],
        [24, 27],
        [24, 31],
        [25, 31],
        [26, 29],
        [26, 33],
        [27, 33],
        [28, 31],
        [28, 33],
        [29, 32],
        [29, 33],
        [30, 32],
        [30, 33],
        [31, 32],
        [31, 33],
        [32, 33],
      ];
      const karate = adjacencyMatrix(karateEdges, 34);
      const partition = louvainCommunities(karate);

      // Validity: every vertex assigned exactly once.
      const seen = new Set<number>();
      for (const group of partition) for (const v of group) seen.add(v);
      expect(seen.size).toBe(34);

      const Q = modularity(karate, partition);
      expect(Q).toBeGreaterThanOrEqual(0.35);
    });
  });

  describe('isIsomorphic', () => {
    it('K3 is isomorphic to C3 (both are the same 3-cycle)', () => {
      const k3 = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ];
      const c3 = adjacencyMatrix(
        [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
        3
      );
      expect(isIsomorphic(k3, c3)).toBe(true);
    });

    it('P4 is not isomorphic to star4 (different degree sequences)', () => {
      const p4 = adjacencyMatrix(
        [
          [0, 1],
          [1, 2],
          [2, 3],
        ],
        4
      );
      const star4 = adjacencyMatrix(
        [
          [0, 1],
          [0, 2],
          [0, 3],
        ],
        4
      );
      expect(isIsomorphic(p4, star4)).toBe(false);
    });

    it('a relabeled copy of G is isomorphic to G', () => {
      // Relabel: 0->4, 1->3, 2->2, 3->1, 4->0 (reverse the labeling).
      const relabel = [4, 3, 2, 1, 0];
      const relabeledEdges = G_EDGES.map(([u, v]) => [relabel[u], relabel[v]]);
      const gRelabeled = adjacencyMatrix(relabeledEdges, 5);
      expect(isIsomorphic(G, gRelabeled)).toBe(true);
    });

    it('rejects graphs of different vertex counts', () => {
      const k3 = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
      ];
      const k4 = [
        [0, 1, 1, 1],
        [1, 0, 1, 1],
        [1, 1, 0, 1],
        [1, 1, 1, 0],
      ];
      expect(isIsomorphic(k3, k4)).toBe(false);
    });
  });

  describe('directed adjacency (pre-existing adjacencyMatrix option)', () => {
    it('a directed edge [[0,1]] gives an asymmetric matrix under {directed:true}', () => {
      const adj = adjacencyMatrix([[0, 1]], 2, true);
      expect(adj[0][1]).toBe(1);
      expect(adj[1][0]).toBe(0);
    });

    it('the same edge is symmetric under the default (undirected)', () => {
      const adj = adjacencyMatrix([[0, 1]], 2);
      expect(adj[0][1]).toBe(1);
      expect(adj[1][0]).toBe(1);
    });
  });
});
