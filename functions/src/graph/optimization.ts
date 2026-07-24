/**
 * Graph Optimization — Max-Flow/Min-Cut, A* Search, Hungarian Assignment
 *
 * Complements the existing traversal/shortest-path/centrality graph
 * functions (`typed/graph.ts`, `graph/traversal-centrality.ts`) with
 * classic combinatorial-optimization algorithms:
 *
 * - `maxFlow` / `minCut`: Edmonds-Karp max-flow (BFS shortest-augmenting-path
 *   on the residual graph) and the corresponding min-cut via the
 *   max-flow-min-cut theorem.
 * - `astar`: heuristic-guided shortest path on a weighted adjacency matrix;
 *   reduces to Dijkstra when the heuristic is the zero function.
 * - `hungarian`: Kuhn-Munkres optimal assignment minimizing total cost on a
 *   square cost matrix.
 *
 * Input format: adjacency/capacity/cost matrices as `number[][]`, matching
 * the convention used elsewhere in this directory.
 *
 * @packageDocumentation
 */

// =============================================================================
// maxFlow / minCut - Edmonds-Karp max-flow and the induced min-cut
// =============================================================================

/** Result of `maxFlow`. */
export interface MaxFlowResult {
  /** Total maximum flow value from `source` to `sink`. */
  maxFlow: number;
  /** Flow matrix: `flow[i][j]` is the net flow sent along edge i -> j. */
  flow: number[][];
}

/**
 * BFS on the residual graph, looking for an augmenting path from `source`
 * to `sink`. Returns the parent array (predecessor on the found path) or
 * `null` if `sink` is unreachable.
 * @internal
 */
function _bfsResidual(residual: number[][], source: number, sink: number): number[] | null {
  const n = residual.length;
  const parent = new Array<number>(n).fill(-1);
  const visited = new Array(n).fill(false);
  visited[source] = true;
  const queue: number[] = [source];

  while (queue.length > 0) {
    const u = queue.shift()!;
    if (u === sink) return parent;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && residual[u][v] > 0) {
        visited[v] = true;
        parent[v] = u;
        queue.push(v);
      }
    }
  }
  return visited[sink] ? parent : null;
}

/**
 * Maximum flow from `source` to `sink` via the Edmonds-Karp algorithm
 * (Ford-Fulkerson with BFS shortest-augmenting-path selection).
 *
 * Time complexity: O(V*E^2) (O(V^5) on a dense adjacency matrix).
 *
 * @param capacity - Capacity matrix (directed reading; `capacity[i][j]` is
 *   the capacity of edge i -> j; 0 or negative means no edge)
 * @param source - Source node index
 * @param sink - Sink node index
 * @returns `{ maxFlow, flow }`
 *
 * @example
 * const cap = [[0,3,2,0],[0,0,1,2],[0,0,0,3],[0,0,0,0]];
 * maxFlow(cap, 0, 3).maxFlow // => 5
 */
export function maxFlow(capacity: number[][], source: number, sink: number): MaxFlowResult {
  const n = capacity.length;
  if (source < 0 || source >= n || sink < 0 || sink >= n) {
    throw new Error('maxFlow: source or sink out of bounds');
  }

  const residual: number[][] = capacity.map((row) => row.slice());
  const flow: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  let total = 0;
  if (source === sink) {
    return { maxFlow: 0, flow };
  }

  for (;;) {
    const parent = _bfsResidual(residual, source, sink);
    if (parent === null) break;

    // Bottleneck capacity along the found augmenting path.
    let pathFlow = Infinity;
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, residual[u][v]);
    }

    // Apply the augmenting flow: decrease forward residual, increase
    // reverse residual, and track net flow on the original edges.
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      residual[u][v] -= pathFlow;
      residual[v][u] += pathFlow;
      flow[u][v] += pathFlow;
      flow[v][u] -= pathFlow;
    }

    total += pathFlow;
  }

  return { maxFlow: total, flow };
}

/** Result of `minCut`. */
export interface MinCutResult {
  /** Value of the minimum cut (equals the maximum flow value). */
  value: number;
  /** `[S, T]` partition: `S` reachable from `source` in the residual
   * graph after saturating max-flow, `T` the rest. */
  partition: [number[], number[]];
}

/**
 * Minimum s-t cut, computed via the max-flow-min-cut theorem: run
 * `maxFlow`, then BFS the residual graph from `source` — reachable nodes
 * form the source-side partition `S`, the rest form `T`.
 *
 * @param capacity - Capacity matrix (directed reading)
 * @param source - Source node index
 * @param sink - Sink node index
 * @returns `{ value, partition: [S, T] }`
 *
 * @example
 * const cap = [[0,3,2,0],[0,0,1,2],[0,0,0,3],[0,0,0,0]];
 * minCut(cap, 0, 3) // => { value: 5, partition: [[0, ...], [...]] }
 */
export function minCut(capacity: number[][], source: number, sink: number): MinCutResult {
  const n = capacity.length;
  if (source < 0 || source >= n || sink < 0 || sink >= n) {
    throw new Error('minCut: source or sink out of bounds');
  }

  const { maxFlow: value, flow } = maxFlow(capacity, source, sink);

  const residual: number[][] = Array.from({ length: n }, (_, i) =>
    capacity[i].map((c, j) => c - flow[i][j])
  );

  const visited = new Array(n).fill(false);
  visited[source] = true;
  const queue: number[] = [source];
  while (queue.length > 0) {
    const u = queue.shift()!;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && residual[u][v] > 0) {
        visited[v] = true;
        queue.push(v);
      }
    }
  }

  const s: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    (visited[i] ? s : t).push(i);
  }

  return { value, partition: [s, t] };
}

// =============================================================================
// astar - Heuristic shortest path (reduces to Dijkstra when heuristic = 0)
// =============================================================================

/** Result of `astar`. */
export interface AStarResult {
  /** Node sequence from `start` to `goal` (empty if unreachable). */
  path: number[];
  /** Total path cost (Infinity if unreachable). */
  cost: number;
}

/**
 * A* shortest path on a weighted adjacency matrix, guided by `heuristic`
 * (an admissible estimate of the remaining cost to `goal`). With
 * `heuristic = () => 0` this reduces to Dijkstra's algorithm.
 *
 * A directed edge i -> j exists when `adj[i][j]` is finite and nonzero.
 *
 * @param adj - Adjacency matrix (directed reading; edge weights should be
 *   non-negative for optimality)
 * @param start - Source node index
 * @param goal - Target node index
 * @param heuristic - `(node) => estimated cost from node to goal`
 * @returns `{ path, cost }`; `{ path: [], cost: Infinity }` if unreachable
 *
 * @example
 * const adj = [[0,1,4],[1,0,1],[4,1,0]];
 * astar(adj, 0, 2, () => 0) // => { path: [0, 1, 2], cost: 2 }
 */
export function astar(
  adj: number[][],
  start: number,
  goal: number,
  heuristic: (node: number) => number
): AStarResult {
  const n = adj.length;
  if (start < 0 || start >= n || goal < 0 || goal >= n) {
    throw new Error('astar: start or goal out of bounds');
  }

  if (start === goal) {
    return { path: [start], cost: 0 };
  }

  const gScore = new Array(n).fill(Infinity);
  gScore[start] = 0;
  const cameFrom = new Array<number>(n).fill(-1);
  const closed = new Array(n).fill(false);

  // Open set as a simple array-backed min-priority-queue on fScore
  // (adequate for the dense adjacency-matrix sizes this API targets).
  const open: Array<{ node: number; fScore: number }> = [{ node: start, fScore: heuristic(start) }];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].fScore < open[bestIdx].fScore) bestIdx = i;
    }
    const { node: u } = open[bestIdx];
    open.splice(bestIdx, 1);

    if (closed[u]) continue;
    closed[u] = true;

    if (u === goal) break;

    for (let v = 0; v < n; v++) {
      if (closed[v] || !Number.isFinite(adj[u][v]) || adj[u][v] === 0) continue;
      const tentative = gScore[u] + adj[u][v];
      if (tentative < gScore[v]) {
        gScore[v] = tentative;
        cameFrom[v] = u;
        open.push({ node: v, fScore: tentative + heuristic(v) });
      }
    }
  }

  if (gScore[goal] === Infinity) {
    return { path: [], cost: Infinity };
  }

  const path: number[] = [];
  for (let v = goal; v !== -1; v = cameFrom[v]) {
    path.unshift(v);
    if (v === start) break;
  }

  return { path, cost: gScore[goal] };
}

// =============================================================================
// hungarian - Kuhn-Munkres optimal assignment (minimization)
// =============================================================================

/** Result of `hungarian`. */
export interface HungarianResult {
  /** `assignment[i]` is the column assigned to row i. */
  assignment: number[];
  /** Total cost of the optimal assignment. */
  cost: number;
}

/**
 * Optimal assignment minimizing total cost, via the Kuhn-Munkres
 * (Hungarian) algorithm on a square cost matrix. Uses the O(n^3)
 * Jonker-Volgenant-style potential/shortest-augmenting-path formulation
 * (1-indexed internally per the classical presentation).
 *
 * @param cost - Square cost matrix (`cost[i][j]` = cost of assigning row i
 *   to column j)
 * @returns `{ assignment, cost }`
 *
 * @example
 * hungarian([[4,1,3],[2,0,5],[3,2,2]])
 * // => { assignment: [1, 0, 2], cost: 5 } (scipy linear_sum_assignment)
 */
export function hungarian(cost: number[][]): HungarianResult {
  const n = cost.length;
  if (n === 0) {
    return { assignment: [], cost: 0 };
  }
  for (const row of cost) {
    if (row.length !== n) {
      throw new Error('hungarian: cost matrix must be square');
    }
  }

  // 1-indexed classical Hungarian algorithm (u/v potentials, shortest
  // augmenting paths). a[j] = row assigned to column j (0 = unassigned).
  const INF = Infinity;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const a = new Array(n + 1).fill(0); // a[j]: row matched to column j
  const p = new Array(n + 1).fill(0); // parent column in the alternating tree

  for (let i = 1; i <= n; i++) {
    a[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = a[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          p[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[a[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (a[j0] !== 0);

    // Augment along the alternating path back to the root.
    while (j0 !== 0) {
      const j1 = p[j0];
      a[j0] = a[j1];
      j0 = j1;
    }
  }

  const assignment = new Array(n).fill(-1);
  let totalCost = 0;
  for (let j = 1; j <= n; j++) {
    const i = a[j];
    if (i > 0) {
      assignment[i - 1] = j - 1;
      totalCost += cost[i - 1][j - 1];
    }
  }

  return { assignment, cost: totalCost };
}
