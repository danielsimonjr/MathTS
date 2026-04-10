/**
 * Graph Theory Functions
 *
 * Provides fundamental graph algorithms operating on adjacency matrices:
 * - adjacencyMatrix: create adjacency matrix from edge list
 * - shortestPath: Dijkstra's algorithm for shortest path
 * - minimumSpanningTree: Prim's algorithm for MST
 * - connectedComponents: BFS-based component detection
 * - stronglyConnectedComponents: Tarjan's algorithm for directed graphs
 * - topologicalSort: Kahn's algorithm for DAGs
 * - isConnected: check if graph is connected
 * - graphDistance: shortest path length between two nodes
 *
 * Input format: adjacency matrix as number[][] where adj[i][j] > 0
 * means an edge from i to j with that weight.
 *
 * @packageDocumentation
 */

// =============================================================================
// adjacencyMatrix - Create adjacency matrix from edge list
// =============================================================================

/**
 * Create an adjacency matrix from an edge list.
 *
 * @param edges - Array of [from, to] or [from, to, weight] tuples
 * @param n - Number of nodes in the graph
 * @param directed - Whether the graph is directed (default false)
 * @returns n x n adjacency matrix
 *
 * @example
 * adjacencyMatrix([[0, 1], [1, 2]], 3)
 * // => [[0, 1, 0], [1, 0, 0], [0, 1, 0]] (undirected)
 */
export function adjacencyMatrix(
  edges: number[][],
  n: number,
  directed: boolean = false,
): number[][] {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('adjacencyMatrix: n must be a non-negative integer');
  }
  const adj: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const edge of edges) {
    const u = edge[0];
    const v = edge[1];
    const w = edge.length > 2 ? edge[2] : 1;
    if (u < 0 || u >= n || v < 0 || v >= n) {
      throw new Error(`adjacencyMatrix: edge [${u}, ${v}] is out of bounds for n=${n}`);
    }
    adj[u][v] = w;
    if (!directed) {
      adj[v][u] = w;
    }
  }
  return adj;
}

// =============================================================================
// shortestPath - Dijkstra's Algorithm
// =============================================================================

/**
 * Find the shortest path between two nodes using Dijkstra's algorithm.
 *
 * Returns the sequence of node indices from start to end.
 * Returns an empty array if no path exists.
 *
 * Time complexity: O(V^2) with simple linear scan.
 *
 * @param adj - Adjacency matrix (weights must be non-negative)
 * @param start - Source node index
 * @param end - Destination node index
 * @returns Array of node indices forming the shortest path
 *
 * @example
 * const adj = [[0,1,0],[1,0,1],[0,1,0]];
 * shortestPath(adj, 0, 2) // => [0, 1, 2]
 */
export function shortestPath(adj: number[][], start: number, end: number): number[] {
  const n = adj.length;
  if (start < 0 || start >= n || end < 0 || end >= n) {
    throw new Error('shortestPath: start or end out of bounds');
  }
  if (start === end) return [start];

  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);
  dist[start] = 0;

  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && (u === -1 || dist[v] < dist[u])) u = v;
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;
    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0 && dist[u] + adj[u][v] < dist[v]) {
        dist[v] = dist[u] + adj[u][v];
        prev[v] = u;
      }
    }
  }

  // Reconstruct path
  const path: number[] = [];
  for (let v = end; v !== -1; v = prev[v]) path.unshift(v);
  return path[0] === start ? path : [];
}

// =============================================================================
// minimumSpanningTree - Prim's Algorithm
// =============================================================================

/**
 * Find the minimum spanning tree using Prim's algorithm.
 *
 * Returns edges of the MST as [from, to, weight] tuples.
 * The graph must be connected for a valid MST.
 *
 * Time complexity: O(V^2)
 *
 * @param adj - Adjacency matrix (undirected, symmetric)
 * @returns Array of MST edges as [from, to, weight]
 *
 * @example
 * const adj = [[0,2,0],[2,0,1],[0,1,0]];
 * minimumSpanningTree(adj) // => [[0, 1, 2], [1, 2, 1]]
 */
export function minimumSpanningTree(adj: number[][]): number[][] {
  const n = adj.length;
  if (n === 0) return [];

  const inMST = new Array(n).fill(false);
  const key = new Array(n).fill(Infinity);
  const parent = new Array(n).fill(-1);
  key[0] = 0;

  for (let count = 0; count < n; count++) {
    // Pick minimum key vertex not in MST
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!inMST[v] && (u === -1 || key[v] < key[u])) u = v;
    }
    if (u === -1 || key[u] === Infinity) break;
    inMST[u] = true;

    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0 && !inMST[v] && adj[u][v] < key[v]) {
        key[v] = adj[u][v];
        parent[v] = u;
      }
    }
  }

  const edges: number[][] = [];
  for (let v = 1; v < n; v++) {
    if (parent[v] !== -1) {
      edges.push([parent[v], v, adj[parent[v]][v]]);
    }
  }
  return edges;
}

// =============================================================================
// connectedComponents - BFS-based
// =============================================================================

/**
 * Find all connected components in an undirected graph.
 *
 * Returns an array of component arrays, where each component is an
 * array of node indices belonging to that component.
 *
 * @param adj - Adjacency matrix (undirected)
 * @returns Array of connected components
 *
 * @example
 * const adj = [[0,1,0],[1,0,0],[0,0,0]];
 * connectedComponents(adj) // => [[0, 1], [2]]
 */
export function connectedComponents(adj: number[][]): number[][] {
  const n = adj.length;
  const visited = new Array(n).fill(false);
  const components: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const component: number[] = [];
      const queue: number[] = [i];
      visited[i] = true;

      while (queue.length > 0) {
        const u = queue.shift()!;
        component.push(u);
        for (let v = 0; v < n; v++) {
          if (adj[u][v] > 0 && !visited[v]) {
            visited[v] = true;
            queue.push(v);
          }
        }
      }
      components.push(component);
    }
  }
  return components;
}

// =============================================================================
// stronglyConnectedComponents - Tarjan's Algorithm
// =============================================================================

/**
 * Find strongly connected components in a directed graph using Tarjan's algorithm.
 *
 * Returns an array of SCC arrays, each containing node indices.
 *
 * @param adj - Adjacency matrix (directed)
 * @returns Array of strongly connected components
 *
 * @example
 * const adj = [[0,1,0],[0,0,1],[1,0,0]];
 * stronglyConnectedComponents(adj) // => [[2, 1, 0]]
 */
export function stronglyConnectedComponents(adj: number[][]): number[][] {
  const n = adj.length;
  const index = new Array(n).fill(-1);
  const lowlink = new Array(n).fill(0);
  const onStack = new Array(n).fill(false);
  const stack: number[] = [];
  const sccs: number[][] = [];
  let idx = 0;

  function strongconnect(v: number): void {
    index[v] = idx;
    lowlink[v] = idx;
    idx++;
    stack.push(v);
    onStack[v] = true;

    for (let w = 0; w < n; w++) {
      if (adj[v][w] > 0) {
        if (index[w] === -1) {
          strongconnect(w);
          lowlink[v] = Math.min(lowlink[v], lowlink[w]);
        } else if (onStack[w]) {
          lowlink[v] = Math.min(lowlink[v], index[w]);
        }
      }
    }

    if (lowlink[v] === index[v]) {
      const scc: number[] = [];
      let w: number;
      do {
        w = stack.pop()!;
        onStack[w] = false;
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (let v = 0; v < n; v++) {
    if (index[v] === -1) {
      strongconnect(v);
    }
  }
  return sccs;
}

// =============================================================================
// topologicalSort - Kahn's Algorithm
// =============================================================================

/**
 * Topological sort of a directed acyclic graph using Kahn's algorithm.
 *
 * Returns an array of node indices in topological order.
 * Throws if the graph contains a cycle.
 *
 * @param adj - Adjacency matrix (directed, acyclic)
 * @returns Topologically sorted node indices
 *
 * @example
 * const adj = [[0,1,0],[0,0,1],[0,0,0]];
 * topologicalSort(adj) // => [0, 1, 2]
 */
export function topologicalSort(adj: number[][]): number[] {
  const n = adj.length;
  const inDegree = new Array(n).fill(0);

  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0) {
        inDegree[v]++;
      }
    }
  }

  const queue: number[] = [];
  for (let v = 0; v < n; v++) {
    if (inDegree[v] === 0) queue.push(v);
  }

  const result: number[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);
    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0) {
        inDegree[v]--;
        if (inDegree[v] === 0) queue.push(v);
      }
    }
  }

  if (result.length !== n) {
    throw new Error('topologicalSort: graph contains a cycle');
  }
  return result;
}

// =============================================================================
// isConnected - Check graph connectivity
// =============================================================================

/**
 * Check if an undirected graph is connected.
 *
 * A graph is connected if there is a path between every pair of vertices.
 *
 * @param adj - Adjacency matrix (undirected)
 * @returns true if the graph is connected
 *
 * @example
 * isConnected([[0,1],[1,0]]) // => true
 * isConnected([[0,0],[0,0]]) // => false
 */
export function isConnected(adj: number[][]): boolean {
  const n = adj.length;
  if (n <= 1) return true;

  const visited = new Array(n).fill(false);
  const queue: number[] = [0];
  visited[0] = true;
  let count = 1;

  while (queue.length > 0) {
    const u = queue.shift()!;
    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0 && !visited[v]) {
        visited[v] = true;
        count++;
        queue.push(v);
      }
    }
  }
  return count === n;
}

// =============================================================================
// graphDistance - Shortest path length
// =============================================================================

/**
 * Compute the shortest path length (distance) between two nodes.
 *
 * Uses Dijkstra's algorithm internally.
 * Returns Infinity if no path exists.
 *
 * @param adj - Adjacency matrix
 * @param start - Source node index
 * @param end - Destination node index
 * @returns Shortest path distance (sum of edge weights)
 *
 * @example
 * const adj = [[0,3,0],[3,0,2],[0,2,0]];
 * graphDistance(adj, 0, 2) // => 5
 */
export function graphDistance(adj: number[][], start: number, end: number): number {
  const n = adj.length;
  if (start < 0 || start >= n || end < 0 || end >= n) {
    throw new Error('graphDistance: start or end out of bounds');
  }
  if (start === end) return 0;

  const dist = new Array(n).fill(Infinity);
  const visited = new Array(n).fill(false);
  dist[start] = 0;

  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && (u === -1 || dist[v] < dist[u])) u = v;
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;
    for (let v = 0; v < n; v++) {
      if (adj[u][v] > 0 && dist[u] + adj[u][v] < dist[v]) {
        dist[v] = dist[u] + adj[u][v];
      }
    }
  }
  return dist[end];
}
