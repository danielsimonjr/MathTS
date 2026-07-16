/**
 * Graph Traversal, All-Pairs Shortest Paths, and Distance-Based Centrality
 *
 * Complements the existing single-source Dijkstra `shortestPath` /
 * `graphDistance` (see `../typed/graph.ts`) with:
 *
 * - `bfs` / `dfs`: visitation-order traversal (directed reading; neighbors
 *   visited in ascending index order).
 * - `floydWarshall`: all-pairs shortest-path distances (handles negative
 *   edge weights, not negative cycles).
 * - `bellmanFord`: single-source shortest paths, negative-weight-aware,
 *   with negative-cycle detection.
 * - `closenessCentrality` / `harmonicCentrality`: distance-based centrality
 *   measures (networkx-compatible conventions), built on `floydWarshall`.
 *
 * Input format: adjacency matrix as `number[][]` where `adj[i][j]` is the
 * weight of the directed edge i -> j.  Both `Infinity` and `0` (off the
 * diagonal) are treated as "no edge" by the weighted routines
 * (`floydWarshall`, `bellmanFord`, and the centrality functions).  `bfs`/`dfs`
 * instead treat any finite, nonzero off-diagonal entry as an edge.  Graphs
 * are read as directed (adjacency is never symmetrized).
 *
 * @packageDocumentation
 */

// =============================================================================
// bfs / dfs - Traversal order
// =============================================================================

/**
 * Breadth-first traversal order starting from `start`.
 *
 * A directed edge i -> j exists when `adj[i][j]` is finite and nonzero.
 * Neighbors are visited in ascending index order.
 *
 * @param adj - Adjacency matrix (directed reading; not symmetrized)
 * @param start - Source node index
 * @returns Node indices in BFS visitation order
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * bfs(adj, 0) // => [0, 1, 2]
 */
export function bfs(adj: number[][], start: number): number[] {
  const n = adj.length;
  if (start < 0 || start >= n) {
    throw new Error('bfs: start out of bounds');
  }
  const visited = new Array(n).fill(false);
  const order: number[] = [];
  const queue: number[] = [start];
  visited[start] = true;

  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (let v = 0; v < n; v++) {
      if (!visited[v] && Number.isFinite(adj[u][v]) && adj[u][v] !== 0) {
        visited[v] = true;
        queue.push(v);
      }
    }
  }
  return order;
}

/**
 * Depth-first traversal order starting from `start` (iterative, preserves
 * ascending-neighbor-order visitation as if implemented recursively).
 *
 * A directed edge i -> j exists when `adj[i][j]` is finite and nonzero.
 *
 * @param adj - Adjacency matrix (directed reading; not symmetrized)
 * @param start - Source node index
 * @returns Node indices in DFS visitation order
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * dfs(adj, 0) // => [0, 1, 2]
 */
export function dfs(adj: number[][], start: number): number[] {
  const n = adj.length;
  if (start < 0 || start >= n) {
    throw new Error('dfs: start out of bounds');
  }
  const visited = new Array(n).fill(false);
  const order: number[] = [];

  function visit(u: number): void {
    visited[u] = true;
    order.push(u);
    for (let v = 0; v < n; v++) {
      if (!visited[v] && Number.isFinite(adj[u][v]) && adj[u][v] !== 0) {
        visit(v);
      }
    }
  }
  visit(start);
  return order;
}

// =============================================================================
// floydWarshall - All-pairs shortest paths
// =============================================================================

/**
 * Determine whether `adj[i][j]` represents a real (weighted) edge.
 * Both `Infinity` and `0` off-diagonal are treated as "no edge".
 * @internal
 */
function _hasWeightedEdge(w: number): boolean {
  return Number.isFinite(w) && w !== 0;
}

/**
 * All-pairs shortest-path distances via the Floyd-Warshall algorithm.
 *
 * `d[i][j]` = 0 if i === j, else `adj[i][j]` when it is a finite nonzero
 * edge, else `Infinity`.  Handles negative edge weights.  A negative value
 * remaining on the diagonal after the triple loop indicates a negative
 * cycle reachable through that node (not flagged by this function — use
 * `bellmanFord` for explicit negative-cycle detection).
 *
 * Time complexity: O(V^3).
 *
 * @param adj - Adjacency matrix (directed reading)
 * @returns n x n matrix of shortest-path distances
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * floydWarshall(adj)[0][2] // => 2
 */
export function floydWarshall(adj: number[][]): number[][] {
  const n = adj.length;
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && _hasWeightedEdge(adj[i][j])) {
        dist[i][j] = adj[i][j];
      }
    }
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (dist[i][k] === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const throughK = dist[i][k] + dist[k][j];
        if (throughK < dist[i][j]) {
          dist[i][j] = throughK;
        }
      }
    }
  }

  return dist;
}

// =============================================================================
// bellmanFord - Single-source shortest paths (negative-weight aware)
// =============================================================================

/** Result of `bellmanFord`. */
export interface BellmanFordResult {
  /** Shortest-path distance from source to each node (Infinity if unreachable). */
  dist: number[];
  /** True if a negative-weight cycle is reachable from the source. */
  hasNegativeCycle: boolean;
}

/**
 * Single-source shortest paths via the Bellman-Ford algorithm.
 *
 * Handles negative edge weights and detects a negative-weight cycle
 * reachable from `source`: relaxes all edges |V|-1 times, then performs one
 * additional pass — any edge that can still be relaxed indicates a
 * reachable negative cycle.
 *
 * Time complexity: O(V*E) (O(V^3) on a dense adjacency matrix).
 *
 * @param adj - Adjacency matrix (directed reading)
 * @param source - Source node index
 * @returns `{ dist, hasNegativeCycle }`
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * bellmanFord(adj, 0) // => { dist: [0, 1, 2], hasNegativeCycle: false }
 */
export function bellmanFord(adj: number[][], source: number): BellmanFordResult {
  const n = adj.length;
  if (source < 0 || source >= n) {
    throw new Error('bellmanFord: source out of bounds');
  }

  const dist = new Array(n).fill(Infinity);
  dist[source] = 0;

  const edges: Array<[number, number, number]> = [];
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      if (u !== v && _hasWeightedEdge(adj[u][v])) {
        edges.push([u, v, adj[u][v]]);
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    let changed = false;
    for (const [u, v, w] of edges) {
      if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        changed = true;
      }
    }
    if (!changed) break;
  }

  let hasNegativeCycle = false;
  for (const [u, v, w] of edges) {
    if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
      hasNegativeCycle = true;
      break;
    }
  }

  return { dist, hasNegativeCycle };
}

// =============================================================================
// closenessCentrality / harmonicCentrality - Distance-based centrality
// =============================================================================

/**
 * Closeness centrality for each node, using the networkx (Wasserman &
 * Faust) convention for possibly-disconnected graphs:
 *
 * `C(u) = ((r-1)/(n-1)) * ((r-1)/sum(d))`
 *
 * where `r` is the number of nodes that can reach `u` (including `u`) and
 * `sum(d)` is the sum of shortest-path distances from those nodes to `u`.
 * For a graph where every node reaches all others (`r === n`), this reduces
 * to `(n-1)/sum(d)`.  Isolated nodes (`r === 1`) score 0.
 *
 * **Direction note (matches networkx default):** closeness uses the
 * *incoming* distance to `u` for directed graphs — how reachable `u` is
 * *from* the rest of the graph, not how far `u` can reach. This mirrors
 * `networkx.closeness_centrality`'s documented default ("the closeness
 * distance function computes the incoming distance to u for directed
 * graphs"). For undirected graphs (symmetric `adj`) direction is moot.
 *
 * @param adj - Adjacency matrix (directed reading)
 * @returns Closeness centrality score for each node (length = n)
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * closenessCentrality(adj) // middle node scores highest
 */
export function closenessCentrality(adj: number[][]): number[] {
  const n = adj.length;
  const dist = floydWarshall(adj);
  const result = new Array(n).fill(0);

  for (let u = 0; u < n; u++) {
    let sum = 0;
    let reachable = 0;
    for (let v = 0; v < n; v++) {
      if (v === u) continue;
      if (dist[v][u] < Infinity) {
        sum += dist[v][u];
        reachable++;
      }
    }
    if (reachable === 0 || sum === 0) {
      result[u] = 0;
      continue;
    }
    const r = reachable + 1; // include u itself, matching networkx's convention
    result[u] = (r - 1 === n - 1 ? 1 : (r - 1) / (n - 1)) * ((r - 1) / sum);
  }
  return result;
}

/**
 * Harmonic centrality for each node:
 *
 * `H(u) = sum_{v != u} 1/d(v,u)`
 *
 * Unreachable nodes contribute 0 (1/Infinity), so this remains well-defined
 * for disconnected graphs without normalization.
 *
 * **Direction note (matches networkx default):** like closeness, harmonic
 * centrality sums *incoming* distances (`d(v,u)`, from other nodes to `u`),
 * matching `networkx.harmonic_centrality`'s directed-graph default. For
 * undirected graphs (symmetric `adj`) direction is moot.
 *
 * @param adj - Adjacency matrix (directed reading)
 * @returns Harmonic centrality score for each node (length = n)
 *
 * @example
 * const adj = [[0,1,Infinity],[1,0,1],[Infinity,1,0]];
 * harmonicCentrality(adj) // => [1.5, 2, 1.5] (middle node reaches both neighbors at distance 1)
 */
export function harmonicCentrality(adj: number[][]): number[] {
  const n = adj.length;
  const dist = floydWarshall(adj);
  const result = new Array(n).fill(0);

  for (let u = 0; u < n; u++) {
    let sum = 0;
    for (let v = 0; v < n; v++) {
      if (v === u) continue;
      if (dist[v][u] > 0 && dist[v][u] < Infinity) {
        sum += 1 / dist[v][u];
      }
    }
    result[u] = sum;
  }
  return result;
}
