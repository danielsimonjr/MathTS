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
 * - pageRank: PageRank centrality with optional random-restart fan-out (Slice 5.13)
 * - betweennessCentrality: Brandes betweenness centrality with optional restarts
 * - eigenvectorCentrality: power-iteration eigenvector centrality with optional restarts
 *
 * Input format: adjacency matrix as number[][] where adj[i][j] > 0
 * means an edge from i to j with that weight.
 *
 * Worker-dispatch strategy (Slice 5.13) — centrality random-restart fan-out:
 * - When `restarts >= CENTRALITY_WORKER_THRESHOLD` (4), the N independent
 *   restart computations are fanned out via `Promise.all`.  Each restart uses a
 *   different random-initialisation seed derived from the caller-supplied
 *   `restartSeed` via SplitMix64-style hashing:
 *     `seed_k = (baseSeed ^ (k * 0x9E3779B97F4A7C15)) >>> 0`
 * - Graph serialisation: the adjacency matrix is plain `number[][]` and is
 *   passed directly.  Option B (main-thread fan-out) is used because registering
 *   a new worker handler would require modifying packages/workerpool/src/worker.ts
 *   which is outside this slice's scope.
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
 * // => [[0, 1, 0], [1, 0, 1], [0, 1, 0]] (undirected)
 */
export function adjacencyMatrix(
  edges: number[][],
  n: number,
  directed: boolean = false
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

// =============================================================================
// Centrality Random-Restart Infrastructure (Slice 5.13)
// =============================================================================

/**
 * Minimum restart count before fanning out via Promise.all rather than running
 * sequentially.  Below this threshold restarts run one after another on the
 * current microtask, avoiding Promise scheduling overhead for the common
 * single-restart case.
 */
export const CENTRALITY_WORKER_THRESHOLD = 4;

/**
 * Shared options for centrality functions that support random-restart
 * fan-out (Slice 5.13).
 */
export interface CentralityRestartOptions {
  /**
   * Number of independent restarts to run (default 1 — no fan-out).
   * When `restarts >= CENTRALITY_WORKER_THRESHOLD` (4) the restarts are
   * dispatched as a `Promise.all` fan-out.
   */
  restarts?: number;
  /**
   * Base seed for reproducible restart initialisation.  Each restart k
   * receives a derived seed:
   *   `seed_k = ((baseSeed ^ (k * 0x9E3779B97F4A7C15)) >>> 0)`
   * Default: 0 (non-reproducible — uses `Math.random()`).
   */
  restartSeed?: number;
  /**
   * How to aggregate multi-restart results.
   * - `'mean'` (default): return the element-wise average rank vector.
   * - `'all'`: return all N rank vectors plus their mean and std.
   */
  aggregation?: 'mean' | 'all';
}

/**
 * Mulberry32 seeded PRNG.  Period 2^32.
 * @internal
 */
function _mulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

/**
 * Derive a per-restart seed from a base seed and restart index using the
 * SplitMix64-style Fibonacci-hash multiplier.
 *
 * `seed_k = ((baseSeed ^ (k * 0x9E3779B9)) >>> 0)`
 *
 * The 32-bit truncation of the 64-bit Fibonacci constant `0x9E3779B97F4A7C15`
 * is `0x9E3779B9`.  This gives excellent avalanche for uint32 seeds.
 *
 * @internal
 */
function _splitSeed(baseSeed: number, k: number): number {
  return ((baseSeed ^ (((k * 0x9e3779b9) | 0) >>> 0)) >>> 0) | 0;
}

/**
 * Aggregate an array of rank vectors: compute element-wise mean and std.
 * @internal
 */
function _aggregateRanks(
  vectors: Float64Array[],
  aggregation: 'mean' | 'all'
): PageRankResult | PageRankRestartResult {
  const n = vectors[0].length;
  const count = vectors.length;

  const mean = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) mean[i] += v[i];
  }
  for (let i = 0; i < n; i++) mean[i] /= count;

  if (aggregation === 'mean') {
    return { ranks: mean };
  }

  const std = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) {
      const d = v[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / count);

  return {
    ranks: mean,
    ranksPerRestart: vectors,
    restartStats: { mean, std },
  };
}

// =============================================================================
// PageRank (Slice 5.13)
// =============================================================================

/** Options for pageRank. */
export interface PageRankOptions {
  /**
   * Damping factor d (probability of following an edge rather than teleporting).
   * Brin & Page recommend 0.85.  Default: 0.85.
   */
  dampingFactor?: number;
  /**
   * Maximum number of power-iteration steps.  Default: 100.
   */
  maxIter?: number;
  /**
   * Convergence tolerance.  Iteration stops when the L1 norm of the rank
   * delta is below this value.  Default: 1e-6.
   */
  tol?: number;
}

/** Result when `restarts` is omitted or 1. */
export interface PageRankResult {
  /** Normalised rank vector (sums to 1). */
  ranks: Float64Array;
}

/** Result when `restarts > 1` and `aggregation === 'all'`. */
export interface PageRankRestartResult {
  /** Element-wise average of all restart rank vectors. */
  ranks: Float64Array;
  /** All N rank vectors, one per restart (only when `aggregation='all'`). */
  ranksPerRestart?: Float64Array[];
  /** Per-element mean and std across restarts (only when `aggregation='all'`). */
  restartStats?: { mean: Float64Array; std: Float64Array };
}

/**
 * Run one PageRank power iteration from a given random-initialisation seed.
 *
 * @param adj - Directed adjacency matrix (adj[i][j] > 0 means edge i → j)
 * @param d   - Damping factor (default 0.85)
 * @param maxIter - Maximum iterations (default 100)
 * @param tol - Convergence tolerance (default 1e-6)
 * @param seed - Mulberry32 seed for random initialisation (0 = deterministic uniform start)
 * @returns Normalised rank vector
 * @internal
 */
function _pageRankOnce(
  adj: number[][],
  d: number,
  maxIter: number,
  tol: number,
  seed: number
): Float64Array {
  const n = adj.length;
  if (n === 0) return new Float64Array(0);

  // Compute out-degree for each node; dangling nodes are handled by uniform teleport
  const outDegree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (adj[i][j] > 0) outDegree[i] += adj[i][j];
    }
  }

  // Initialise rank vector (random when seed != 0, uniform otherwise)
  let rank = new Float64Array(n);
  if (seed !== 0) {
    const rng = _mulberry32(seed);
    let total = 0;
    for (let i = 0; i < n; i++) {
      rank[i] = rng();
      total += rank[i];
    }
    for (let i = 0; i < n; i++) rank[i] /= total;
  } else {
    rank.fill(1 / n);
  }

  const teleport = (1 - d) / n;

  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Float64Array(n).fill(teleport);

    for (let i = 0; i < n; i++) {
      if (outDegree[i] === 0) {
        // Dangling node: distribute rank uniformly
        const share = (d * rank[i]) / n;
        for (let j = 0; j < n; j++) next[j] += share;
      } else {
        for (let j = 0; j < n; j++) {
          if (adj[i][j] > 0) {
            next[j] += d * rank[i] * (adj[i][j] / outDegree[i]);
          }
        }
      }
    }

    // L1 convergence check
    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(next[i] - rank[i]);
    rank = next;
    if (delta < tol) break;
  }

  return rank;
}

/**
 * Compute PageRank centrality for each node in a directed graph.
 *
 * **Single-restart path** (`restarts` omitted or 1): runs one power-iteration
 * sequence from a uniform initialisation and returns `{ ranks }` synchronously
 * (wrapped in a resolved Promise for a uniform async API).
 *
 * **Multi-restart path** (`restarts >= CENTRALITY_WORKER_THRESHOLD` = 4):
 * fans out N independent restarts via `Promise.all`, each initialised from a
 * different seed derived by SplitMix64-style hashing of `restartSeed × k`.
 * Results are averaged element-wise (or returned individually when
 * `aggregation: 'all'`).
 *
 * **Option B note:** all restarts execute on the main thread because adding a
 * new `centralityRestartChunk` worker handler would require modifying
 * `packages/workerpool/src/worker.ts`, which is outside this slice's scope.
 * The Promise.all fan-out still keeps the event loop responsive for consumers
 * that `await` the result.
 *
 * @param adj  - Directed adjacency matrix
 * @param opts - PageRank + restart options
 *
 * @example
 * const adj = [[0,1,0],[0,0,1],[1,0,0]];
 * const { ranks } = await pageRank(adj);
 * // ranks ≈ [0.333, 0.333, 0.333] (symmetric ring)
 *
 * @example
 * // 8 restarts, averaged
 * const result = await pageRank(adj, { restarts: 8, restartSeed: 42 });
 */
export async function pageRank(
  adj: number[][],
  opts?: PageRankOptions & CentralityRestartOptions
): Promise<PageRankResult | PageRankRestartResult> {
  const d = opts?.dampingFactor ?? 0.85;
  const maxIter = opts?.maxIter ?? 100;
  const tol = opts?.tol ?? 1e-6;
  const restarts = opts?.restarts ?? 1;
  const baseSeed = opts?.restartSeed ?? 0;
  const aggregation = opts?.aggregation ?? 'mean';

  if (restarts === 1) {
    // Single-restart fast path: uniform initialisation (seed=0)
    const ranks = _pageRankOnce(adj, d, maxIter, tol, 0);
    return { ranks };
  }

  if (restarts < CENTRALITY_WORKER_THRESHOLD) {
    // Below the fan-out threshold: run restarts sequentially
    const vectors: Float64Array[] = [];
    for (let k = 0; k < restarts; k++) {
      const seed = _splitSeed(baseSeed, k);
      vectors.push(_pageRankOnce(adj, d, maxIter, tol, seed === 0 ? 1 : seed));
    }
    return _aggregateRanks(vectors, aggregation) as PageRankResult | PageRankRestartResult;
  }

  // Fan-out path: Promise.all over N independent restarts (Option B — main thread)
  const tasks: Promise<Float64Array>[] = [];
  for (let k = 0; k < restarts; k++) {
    const seed = _splitSeed(baseSeed, k);
    const s = seed === 0 ? 1 : seed; // avoid degenerate zero seed
    tasks.push(Promise.resolve(_pageRankOnce(adj, d, maxIter, tol, s)));
  }
  const vectors = await Promise.all(tasks);
  return _aggregateRanks(vectors, aggregation) as PageRankResult | PageRankRestartResult;
}

// =============================================================================
// Betweenness Centrality (Slice 5.13)
// =============================================================================

/** Options for betweennessCentrality. */
export interface BetweennessOptions {
  /**
   * Whether the graph is directed.  Default: false (undirected).
   */
  directed?: boolean;
  /**
   * Normalise by the maximum possible betweenness: (n-1)(n-2)/2 for
   * undirected, (n-1)(n-2) for directed.  Default: true.
   */
  normalise?: boolean;
}

/** Result returned by betweennessCentrality. */
export interface BetweennessResult {
  /** Betweenness centrality score for each node (length = n). */
  centrality: Float64Array;
}

/** Result when `restarts > 1` and `aggregation === 'all'`. */
export interface BetweennessRestartResult {
  centrality: Float64Array;
  centralityPerRestart?: Float64Array[];
  restartStats?: { mean: Float64Array; std: Float64Array };
}

/**
 * Brandes' algorithm for betweenness centrality.
 *
 * BFS-based exact algorithm.  Time complexity O(VE).
 *
 * Random restarts for betweenness centrality approximate the scores using a
 * random subset of source nodes for each restart (each restart samples `n`
 * source nodes with replacement, seeded reproducibly).  With a single restart
 * the exact algorithm is run (all n sources).
 *
 * @internal
 */
function _betweennessOnce(
  adj: number[][],
  directed: boolean,
  normalise: boolean,
  seed: number
): Float64Array {
  const n = adj.length;
  if (n === 0) return new Float64Array(0);

  const cb = new Float64Array(n);

  // Determine source nodes for this restart
  let sources: number[];
  if (seed === 0) {
    // Exact: all nodes as sources
    sources = Array.from({ length: n }, (_, i) => i);
  } else {
    // Approximate: random sample of n source nodes with replacement
    const rng = _mulberry32(seed);
    sources = Array.from({ length: n }, () => Math.floor(rng() * n));
  }

  for (const s of sources) {
    // BFS from source s
    const stack: number[] = [];
    const pred: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Float64Array(n);
    sigma[s] = 1;
    const dist = new Float64Array(n).fill(-1);
    dist[s] = 0;
    const queue: number[] = [s];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (let w = 0; w < n; w++) {
        const edgeExists = directed ? adj[v][w] > 0 : adj[v][w] > 0 || adj[w][v] > 0;
        if (!edgeExists) continue;
        if (dist[w] < 0) {
          queue.push(w);
          dist[w] = dist[v] + 1;
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }

    // Back-propagation
    const delta = new Float64Array(n);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) cb[w] += delta[w];
    }
  }

  // Scale to match exact algorithm when sampling
  if (seed !== 0) {
    const scaleFactor = n / sources.length;
    for (let i = 0; i < n; i++) cb[i] *= scaleFactor;
  }

  if (normalise) {
    const denom = directed ? (n - 1) * (n - 2) : ((n - 1) * (n - 2)) / 2;
    if (denom > 0) {
      for (let i = 0; i < n; i++) cb[i] /= denom;
    }
  }

  return cb;
}

/**
 * Aggregate betweenness restart vectors into a result.
 * @internal
 */
function _aggregateBetweenness(
  vectors: Float64Array[],
  aggregation: 'mean' | 'all'
): BetweennessResult | BetweennessRestartResult {
  const n = vectors[0].length;
  const count = vectors.length;

  const mean = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) mean[i] += v[i];
  }
  for (let i = 0; i < n; i++) mean[i] /= count;

  if (aggregation === 'mean') {
    return { centrality: mean };
  }

  const std = new Float64Array(n);
  for (const v of vectors) {
    for (let i = 0; i < n; i++) {
      const d = v[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / count);

  return {
    centrality: mean,
    centralityPerRestart: vectors,
    restartStats: { mean, std },
  };
}

/**
 * Compute betweenness centrality for each node.
 *
 * Uses Brandes' BFS-based algorithm (exact for a single restart).  When
 * `restarts > 1` each restart samples n source nodes (with replacement) using
 * a distinct seed; the per-restart scores are averaged.
 *
 * Worker-dispatch strategy: Option B — all restarts run on the main thread
 * via `Promise.all`.
 *
 * @param adj  - Adjacency matrix
 * @param opts - Betweenness + restart options
 *
 * @example
 * const adj = [[0,1,1],[1,0,1],[1,1,0]];
 * const { centrality } = await betweennessCentrality(adj);
 */
export async function betweennessCentrality(
  adj: number[][],
  opts?: BetweennessOptions & CentralityRestartOptions
): Promise<BetweennessResult | BetweennessRestartResult> {
  const directed = opts?.directed ?? false;
  const normalise = opts?.normalise ?? true;
  const restarts = opts?.restarts ?? 1;
  const baseSeed = opts?.restartSeed ?? 0;
  const aggregation = opts?.aggregation ?? 'mean';

  if (restarts === 1) {
    const centrality = _betweennessOnce(adj, directed, normalise, 0);
    return { centrality };
  }

  if (restarts < CENTRALITY_WORKER_THRESHOLD) {
    const vectors: Float64Array[] = [];
    for (let k = 0; k < restarts; k++) {
      const seed = _splitSeed(baseSeed, k);
      vectors.push(_betweennessOnce(adj, directed, normalise, seed === 0 ? 1 : seed));
    }
    return _aggregateBetweenness(vectors, aggregation) as
      | BetweennessResult
      | BetweennessRestartResult;
  }

  // Fan-out path: Promise.all (Option B — main thread)
  const tasks: Promise<Float64Array>[] = [];
  for (let k = 0; k < restarts; k++) {
    const seed = _splitSeed(baseSeed, k);
    const s = seed === 0 ? 1 : seed;
    tasks.push(Promise.resolve(_betweennessOnce(adj, directed, normalise, s)));
  }
  const vectors = await Promise.all(tasks);
  return _aggregateBetweenness(vectors, aggregation) as
    | BetweennessResult
    | BetweennessRestartResult;
}

// =============================================================================
// Eigenvector Centrality (Slice 5.13)
// =============================================================================

/** Options for eigenvectorCentrality. */
export interface EigenvectorOptions {
  /**
   * Maximum number of power-iteration steps.  Default: 100.
   */
  maxIter?: number;
  /**
   * Convergence tolerance (L∞ norm of delta).  Default: 1e-6.
   */
  tol?: number;
}

/** Result from eigenvectorCentrality. */
export interface EigenvectorResult {
  /** Eigenvector centrality scores (length = n). */
  centrality: Float64Array;
}

/** Result when `restarts > 1` and `aggregation === 'all'`. */
export interface EigenvectorRestartResult {
  centrality: Float64Array;
  centralityPerRestart?: Float64Array[];
  restartStats?: { mean: Float64Array; std: Float64Array };
}

/**
 * One power-iteration run of eigenvector centrality.
 * @internal
 */
function _eigenvectorOnce(
  adj: number[][],
  maxIter: number,
  tol: number,
  seed: number
): Float64Array {
  const n = adj.length;
  if (n === 0) return new Float64Array(0);

  let x = new Float64Array(n);
  if (seed !== 0) {
    const rng = _mulberry32(seed);
    for (let i = 0; i < n; i++) x[i] = rng();
  } else {
    x.fill(1);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (adj[j][i] > 0) next[i] += adj[j][i] * x[j];
      }
    }

    // Normalise by L2 norm
    let norm = 0;
    for (let i = 0; i < n; i++) norm += next[i] * next[i];
    norm = Math.sqrt(norm);
    if (norm < 1e-15) break; // zero eigenvector — graph has no edges

    for (let i = 0; i < n; i++) next[i] /= norm;

    // Convergence check (L∞)
    let delta = 0;
    for (let i = 0; i < n; i++) delta = Math.max(delta, Math.abs(next[i] - x[i]));
    x = next;
    if (delta < tol) break;
  }

  return x;
}

/**
 * Aggregate eigenvector restart vectors into a result.
 * @internal
 */
function _aggregateEigenvector(
  vectors: Float64Array[],
  aggregation: 'mean' | 'all'
): EigenvectorResult | EigenvectorRestartResult {
  const n = vectors[0].length;
  const count = vectors.length;

  // Align signs: flip each vector if it differs in direction from vectors[0]
  const ref = vectors[0];
  const aligned = vectors.map((v) => {
    let dot = 0;
    for (let i = 0; i < n; i++) dot += v[i] * ref[i];
    if (dot < 0) {
      const flipped = new Float64Array(n);
      for (let i = 0; i < n; i++) flipped[i] = -v[i];
      return flipped;
    }
    return v;
  });

  const mean = new Float64Array(n);
  for (const v of aligned) {
    for (let i = 0; i < n; i++) mean[i] += v[i];
  }
  for (let i = 0; i < n; i++) mean[i] /= count;

  // Re-normalise mean
  let norm = 0;
  for (let i = 0; i < n; i++) norm += mean[i] * mean[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-15) {
    for (let i = 0; i < n; i++) mean[i] /= norm;
  }

  if (aggregation === 'mean') {
    return { centrality: mean };
  }

  const std = new Float64Array(n);
  for (const v of aligned) {
    for (let i = 0; i < n; i++) {
      const d = v[i] - mean[i];
      std[i] += d * d;
    }
  }
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(std[i] / count);

  return {
    centrality: mean,
    centralityPerRestart: aligned,
    restartStats: { mean, std },
  };
}

/**
 * Compute eigenvector centrality using power iteration.
 *
 * Each node's score is proportional to the sum of its neighbours' scores,
 * converging to the principal eigenvector of the adjacency matrix.
 *
 * When `restarts > 1`, each restart is initialised from a distinct random
 * vector seeded reproducibly.  The per-restart eigenvectors are sign-aligned
 * and then averaged to produce a stable estimate.
 *
 * Worker-dispatch strategy: Option B — all restarts run on the main thread
 * via `Promise.all`.
 *
 * @param adj  - Adjacency matrix (undirected, non-negative weights)
 * @param opts - Eigenvector + restart options
 *
 * @example
 * const adj = [[0,1,1],[1,0,1],[1,1,0]];
 * const { centrality } = await eigenvectorCentrality(adj);
 * // all ≈ [0.577, 0.577, 0.577] (symmetric k3)
 */
export async function eigenvectorCentrality(
  adj: number[][],
  opts?: EigenvectorOptions & CentralityRestartOptions
): Promise<EigenvectorResult | EigenvectorRestartResult> {
  const maxIter = opts?.maxIter ?? 100;
  const tol = opts?.tol ?? 1e-6;
  const restarts = opts?.restarts ?? 1;
  const baseSeed = opts?.restartSeed ?? 0;
  const aggregation = opts?.aggregation ?? 'mean';

  if (restarts === 1) {
    const centrality = _eigenvectorOnce(adj, maxIter, tol, 0);
    return { centrality };
  }

  if (restarts < CENTRALITY_WORKER_THRESHOLD) {
    const vectors: Float64Array[] = [];
    for (let k = 0; k < restarts; k++) {
      const seed = _splitSeed(baseSeed, k);
      vectors.push(_eigenvectorOnce(adj, maxIter, tol, seed === 0 ? 1 : seed));
    }
    return _aggregateEigenvector(vectors, aggregation) as
      | EigenvectorResult
      | EigenvectorRestartResult;
  }

  // Fan-out path: Promise.all (Option B — main thread)
  const tasks: Promise<Float64Array>[] = [];
  for (let k = 0; k < restarts; k++) {
    const seed = _splitSeed(baseSeed, k);
    const s = seed === 0 ? 1 : seed;
    tasks.push(Promise.resolve(_eigenvectorOnce(adj, maxIter, tol, s)));
  }
  const vectors = await Promise.all(tasks);
  return _aggregateEigenvector(vectors, aggregation) as
    | EigenvectorResult
    | EigenvectorRestartResult;
}
