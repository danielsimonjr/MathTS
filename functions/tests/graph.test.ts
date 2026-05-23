/**
 * Graph Theory Tests
 */

import { describe, it, expect } from 'vitest';
import {
  adjacencyMatrix,
  shortestPath,
  minimumSpanningTree,
  connectedComponents,
  stronglyConnectedComponents,
  topologicalSort,
  isConnected,
  graphDistance,
} from '../src/typed/graph.js';

describe('Graph Theory', () => {
  // ===========================================================================
  // adjacencyMatrix
  // ===========================================================================
  describe('adjacencyMatrix', () => {
    it('should create undirected adjacency matrix from edge list', () => {
      const adj = adjacencyMatrix(
        [
          [0, 1],
          [1, 2],
        ],
        3
      );
      expect(adj).toEqual([
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0],
      ]);
    });

    it('should create directed adjacency matrix', () => {
      const adj = adjacencyMatrix(
        [
          [0, 1],
          [1, 2],
        ],
        3,
        true
      );
      expect(adj).toEqual([
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ]);
    });

    it('should handle weighted edges', () => {
      const adj = adjacencyMatrix(
        [
          [0, 1, 5],
          [1, 2, 3],
        ],
        3
      );
      expect(adj[0][1]).toBe(5);
      expect(adj[1][2]).toBe(3);
    });

    it('should create empty matrix for no edges', () => {
      const adj = adjacencyMatrix([], 3);
      expect(adj).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
    });

    it('should throw for out of bounds edges', () => {
      expect(() => adjacencyMatrix([[0, 5]], 3)).toThrow();
    });
  });

  // ===========================================================================
  // shortestPath
  // ===========================================================================
  describe('shortestPath', () => {
    it('should find direct path', () => {
      const adj = [
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0],
      ];
      expect(shortestPath(adj, 0, 2)).toEqual([0, 1, 2]);
    });

    it('should return single node for same start/end', () => {
      const adj = [
        [0, 1],
        [1, 0],
      ];
      expect(shortestPath(adj, 0, 0)).toEqual([0]);
    });

    it('should return empty for unreachable node', () => {
      const adj = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      expect(shortestPath(adj, 0, 2)).toEqual([]);
    });

    it('should find shortest weighted path', () => {
      // 0 --1-- 1 --1-- 2
      // |               |
      // +------10-------+
      const adj = [
        [0, 1, 10],
        [1, 0, 1],
        [10, 1, 0],
      ];
      expect(shortestPath(adj, 0, 2)).toEqual([0, 1, 2]);
    });

    it('should throw for out of bounds', () => {
      expect(() => shortestPath([[0]], -1, 0)).toThrow();
    });
  });

  // ===========================================================================
  // minimumSpanningTree
  // ===========================================================================
  describe('minimumSpanningTree', () => {
    it('should find MST of simple graph', () => {
      const adj = [
        [0, 2, 0, 6],
        [2, 0, 3, 8],
        [0, 3, 0, 0],
        [6, 8, 0, 0],
      ];
      const mst = minimumSpanningTree(adj);
      expect(mst.length).toBe(3);
      const totalWeight = mst.reduce((sum, e) => sum + e[2], 0);
      expect(totalWeight).toBe(11); // 2 + 3 + 6
    });

    it('should return empty for empty graph', () => {
      expect(minimumSpanningTree([])).toEqual([]);
    });

    it('should handle single node', () => {
      expect(minimumSpanningTree([[0]])).toEqual([]);
    });
  });

  // ===========================================================================
  // connectedComponents
  // ===========================================================================
  describe('connectedComponents', () => {
    it('should find single component in connected graph', () => {
      const adj = [
        [0, 1],
        [1, 0],
      ];
      const cc = connectedComponents(adj);
      expect(cc.length).toBe(1);
      expect(cc[0].sort()).toEqual([0, 1]);
    });

    it('should find multiple components', () => {
      const adj = [
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
      ];
      const cc = connectedComponents(adj);
      expect(cc.length).toBe(2);
    });

    it('should handle isolated nodes', () => {
      const adj = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      expect(connectedComponents(adj).length).toBe(3);
    });
  });

  // ===========================================================================
  // stronglyConnectedComponents
  // ===========================================================================
  describe('stronglyConnectedComponents', () => {
    it('should find SCCs in cyclic graph', () => {
      // 0 -> 1 -> 2 -> 0 (one SCC)
      const adj = [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0],
      ];
      const sccs = stronglyConnectedComponents(adj);
      expect(sccs.length).toBe(1);
      expect(sccs[0].sort()).toEqual([0, 1, 2]);
    });

    it('should find separate SCCs in DAG', () => {
      // 0 -> 1 -> 2 (no cycles)
      const adj = [
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ];
      const sccs = stronglyConnectedComponents(adj);
      expect(sccs.length).toBe(3);
    });

    it('should handle disconnected directed graph', () => {
      const adj = [
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
      ];
      const sccs = stronglyConnectedComponents(adj);
      expect(sccs.length).toBe(2);
    });
  });

  // ===========================================================================
  // topologicalSort
  // ===========================================================================
  describe('topologicalSort', () => {
    it('should sort linear DAG', () => {
      const adj = [
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, 0],
      ];
      expect(topologicalSort(adj)).toEqual([0, 1, 2]);
    });

    it('should throw for cyclic graph', () => {
      const adj = [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0],
      ];
      expect(() => topologicalSort(adj)).toThrow('cycle');
    });

    it('should handle diamond DAG', () => {
      // 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3
      const adj = [
        [0, 1, 1, 0],
        [0, 0, 0, 1],
        [0, 0, 0, 1],
        [0, 0, 0, 0],
      ];
      const sorted = topologicalSort(adj);
      expect(sorted[0]).toBe(0);
      expect(sorted[3]).toBe(3);
      expect(sorted.length).toBe(4);
    });
  });

  // ===========================================================================
  // isConnected
  // ===========================================================================
  describe('isConnected', () => {
    it('should return true for connected graph', () => {
      expect(
        isConnected([
          [0, 1],
          [1, 0],
        ])
      ).toBe(true);
    });

    it('should return false for disconnected graph', () => {
      expect(
        isConnected([
          [0, 0],
          [0, 0],
        ])
      ).toBe(false);
    });

    it('should return true for single node', () => {
      expect(isConnected([[0]])).toBe(true);
    });

    it('should return true for empty graph', () => {
      expect(isConnected([])).toBe(true);
    });
  });

  // ===========================================================================
  // graphDistance
  // ===========================================================================
  describe('graphDistance', () => {
    it('should return distance for connected nodes', () => {
      const adj = [
        [0, 3, 0],
        [3, 0, 2],
        [0, 2, 0],
      ];
      expect(graphDistance(adj, 0, 2)).toBe(5);
    });

    it('should return 0 for same node', () => {
      expect(graphDistance([[0]], 0, 0)).toBe(0);
    });

    it('should return Infinity for unreachable node', () => {
      const adj = [
        [0, 0],
        [0, 0],
      ];
      expect(graphDistance(adj, 0, 1)).toBe(Infinity);
    });

    it('should find shortest weighted distance', () => {
      const adj = [
        [0, 1, 10],
        [1, 0, 1],
        [10, 1, 0],
      ];
      expect(graphDistance(adj, 0, 2)).toBe(2); // 0->1->2
    });
  });
});
