/**
 * Graph Coloring, Cliques, Community Detection, Katz Centrality, Isomorphism
 *
 * Complements the existing traversal/shortest-path/centrality/optimization
 * graph functions (`typed/graph.ts`, `graph/traversal-centrality.ts`,
 * `graph/optimization.ts`) with:
 *
 * - `graphColoring`: greedy proper vertex coloring (Welsh-Powell: largest
 *   degree first).
 * - `maxClique`: a maximum clique via Bron-Kerbosch with pivoting.
 * - `louvainCommunities`: Louvain modularity community detection.
 * - `katzCentrality`: Katz centrality (matches `networkx.katz_centrality_numpy`).
 * - `isIsomorphic`: graph isomorphism test via backtracking with
 *   degree-sequence pruning.
 *
 * Input format: adjacency matrix as `number[][]`, matching the convention
 * used elsewhere in this directory. Structural functions (`graphColoring`,
 * `maxClique`, `isIsomorphic`) treat any finite, nonzero `adj[i][j]` as an
 * edge; `graphColoring`/`maxClique` read the graph as undirected (an edge
 * i-j exists if either `adj[i][j]` or `adj[j][i]` is a finite nonzero
 * value), while `isIsomorphic` reads directed (matching the bfs/dfs/
 * floydWarshall convention — pass a symmetric matrix for undirected graphs).
 * `louvainCommunities`/`katzCentrality` treat `adj[i][j]` as an edge weight
 * (0 = no edge) and require a symmetric (undirected) matrix.
 *
 * @packageDocumentation
 */

/**
 * Determine whether a finite, nonzero edge exists at `adj[i][j]`.
 * @internal
 */
function _edgeExists(adj: number[][], i: number, j: number): boolean {
  const w = adj[i][j];
  return Number.isFinite(w) && w !== 0;
}

/**
 * Determine whether an undirected edge exists between `i` and `j` (either
 * direction is a finite nonzero entry).
 * @internal
 */
function _undirectedEdgeExists(adj: number[][], i: number, j: number): boolean {
  return _edgeExists(adj, i, j) || _edgeExists(adj, j, i);
}

// =============================================================================
// graphColoring - Greedy proper vertex coloring (Welsh-Powell)
// =============================================================================

/**
 * Greedy proper vertex coloring using the Welsh-Powell heuristic: vertices
 * are processed in descending order of (undirected) degree, each assigned
 * the smallest color index not already used by an already-colored neighbor.
 * Ties in degree are broken by ascending vertex index (deterministic).
 *
 * Not guaranteed to use the chromatic number of colors (graph coloring is
 * NP-hard in general) — this is a fast heuristic upper bound, but the
 * result is always a *proper* coloring (no edge connects two same-colored
 * vertices).
 *
 * @param adj - Adjacency matrix (undirected reading: `adj[i][j]` or
 *   `adj[j][i]` nonzero means an edge)
 * @returns Color index (0-based) for each vertex, length = n
 *
 * @example
 * const adj = [[0,1,1],[1,0,1],[1,1,0]]; // triangle K3
 * graphColoring(adj) // => [0, 1, 2] (needs 3 colors)
 */
export function graphColoring(adj: number[][]): number[] {
  const n = adj.length;
  const colors = new Array<number>(n).fill(-1);
  if (n === 0) return colors;

  const degree = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && _undirectedEdgeExists(adj, i, j)) degree[i]++;
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => degree[b] - degree[a] || a - b
  );

  for (const v of order) {
    const usedByNeighbor = new Set<number>();
    for (let u = 0; u < n; u++) {
      if (u !== v && _undirectedEdgeExists(adj, v, u) && colors[u] !== -1) {
        usedByNeighbor.add(colors[u]);
      }
    }
    let c = 0;
    while (usedByNeighbor.has(c)) c++;
    colors[v] = c;
  }

  return colors;
}

// =============================================================================
// maxClique - Bron-Kerbosch with pivoting
// =============================================================================

/**
 * Find a maximum clique (largest set of mutually adjacent vertices) via the
 * Bron-Kerbosch algorithm with pivoting, exploring all maximal cliques and
 * keeping the largest. Exact (not a heuristic), but exponential worst-case —
 * intended for small-to-moderate graphs.
 *
 * @param adj - Adjacency matrix (undirected reading)
 * @returns Vertex indices of a maximum clique, ascending order
 *
 * @example
 * // triangle 0-1-2 plus a pendant 3 attached only to 0
 * const adj = [[0,1,1,1],[1,0,1,0],[1,1,0,0],[1,0,0,0]];
 * maxClique(adj) // => [0, 1, 2]
 */
export function maxClique(adj: number[][]): number[] {
  const n = adj.length;
  if (n === 0) return [];

  const hasEdge = (i: number, j: number): boolean => i !== j && _undirectedEdgeExists(adj, i, j);

  let best: number[] = [];

  function bronKerbosch(R: number[], P: Set<number>, X: Set<number>): void {
    if (P.size === 0 && X.size === 0) {
      if (R.length > best.length) best = R.slice();
      return;
    }
    // Pivot selection: maximize neighbors-in-P to minimize branching.
    let pivot = -1;
    let pivotCount = -1;
    for (const u of [...P, ...X]) {
      let cnt = 0;
      for (const w of P) if (hasEdge(u, w)) cnt++;
      if (cnt > pivotCount) {
        pivotCount = cnt;
        pivot = u;
      }
    }
    const candidates = pivot === -1 ? [...P] : [...P].filter((v) => !hasEdge(pivot, v));

    for (const v of candidates) {
      const newP = new Set<number>();
      const newX = new Set<number>();
      for (const w of P) if (hasEdge(v, w)) newP.add(w);
      for (const w of X) if (hasEdge(v, w)) newX.add(w);
      bronKerbosch([...R, v], newP, newX);
      P.delete(v);
      X.add(v);
    }
  }

  const initialP = new Set<number>(Array.from({ length: n }, (_, i) => i));
  bronKerbosch([], initialP, new Set<number>());

  return best.sort((a, b) => a - b);
}

// =============================================================================
// louvainCommunities - Louvain modularity community detection
// =============================================================================

/**
 * Run one local-moving pass of the Louvain algorithm to convergence on a
 * weighted graph, returning each node's community assignment (an index into
 * 0..n-1, not necessarily contiguous).
 *
 * **Tie-break (deterministic, no RNG):** nodes are visited in ascending
 * index order each pass; for a given node the candidate communities
 * (its current community plus every community containing a neighbor) are
 * compared in ascending community-index order, and a candidate only
 * replaces the current best when its modularity gain exceeds the best
 * found so far by more than `1e-12` (so the node's own community wins all
 * ties, and among strictly-better alternatives the first found in
 * ascending order wins — since communities are scanned in ascending order,
 * that is the smallest strictly-better community index).
 *
 * @internal
 */
function _louvainLocalMoving(W: number[][]): number[] {
  const n = W.length;
  const kDeg = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += W[i][j];
    kDeg[i] = s;
  }
  const m2 = kDeg.reduce((a, b) => a + b, 0); // 2m
  const m = m2 / 2;

  const community = Array.from({ length: n }, (_, i) => i);
  const sigmaTot = kDeg.slice();

  if (m === 0) return community; // no edges: every node stays isolated

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n; i++) {
      const ci = community[i];
      sigmaTot[ci] -= kDeg[i];

      // Weight from i to each neighboring community (excludes i's own self-loop).
      const neighborWeight = new Map<number, number>();
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const w = W[i][j];
        if (w > 0) {
          const cj = community[j];
          neighborWeight.set(cj, (neighborWeight.get(cj) ?? 0) + w);
        }
      }

      const candidates = new Set<number>(neighborWeight.keys());
      candidates.add(ci);
      const sortedCandidates = [...candidates].sort((a, b) => a - b);

      let bestC = ci;
      let bestGain = (neighborWeight.get(ci) ?? 0) / m - (kDeg[i] * sigmaTot[ci]) / (2 * m * m);

      for (const c of sortedCandidates) {
        if (c === ci) continue;
        const gain = (neighborWeight.get(c) ?? 0) / m - (kDeg[i] * sigmaTot[c]) / (2 * m * m);
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          bestC = c;
        }
      }

      community[i] = bestC;
      sigmaTot[bestC] += kDeg[i];
      if (bestC !== ci) improved = true;
    }
  }

  return community;
}

/**
 * Aggregate the graph by collapsing each community into a single super-node.
 * Internal community weight becomes a self-loop (doubled, per convention);
 * inter-community weight sums directly. Returns the aggregated weight
 * matrix and the super-node index for each original-level node.
 * @internal
 */
function _louvainAggregate(
  W: number[][],
  community: number[]
): { newW: number[][]; remap: Map<number, number> } {
  const distinct = [...new Set(community)].sort((a, b) => a - b);
  const remap = new Map<number, number>(distinct.map((c, idx) => [c, idx]));
  const k = distinct.length;
  const n = W.length;
  const newW: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));

  for (let i = 0; i < n; i++) {
    const ci = remap.get(community[i])!;
    for (let j = 0; j < n; j++) {
      const cj = remap.get(community[j])!;
      newW[ci][cj] += W[i][j];
    }
  }

  return { newW, remap };
}

/**
 * Louvain modularity-maximization community detection.
 *
 * Alternates a local-moving phase (greedily move each node into the
 * neighboring community that most increases modularity, deterministic
 * tie-break per `_louvainLocalMoving`) with an aggregation phase (collapse
 * each found community into a super-node) until a local-moving pass leaves
 * every node in its own singleton community (no further merge possible).
 *
 * Heuristic and **not** guaranteed to find the globally optimal partition,
 * but deterministic — no random seed is used, so the same graph always
 * produces the same partition.
 *
 * @param adj - Weighted undirected adjacency matrix (symmetric; `adj[i][j]`
 *   = edge weight, 0 = no edge)
 * @returns Partition as an array of vertex-index groups (every vertex
 *   appears in exactly one group)
 *
 * @example
 * // Two triangles 0-1-2 and 3-4-5 joined by a single bridge edge 2-3
 * louvainCommunities(adj) // => [[0,1,2],[3,4,5]] (two communities)
 */
export function louvainCommunities(adj: number[][]): number[][] {
  const n = adj.length;
  if (n === 0) return [];
  if (n === 1) return [[0]];

  let curW: number[][] = adj.map((row) => row.slice());
  // membership[i] = current super-node (at curW's level) that original node i belongs to
  let membership = Array.from({ length: n }, (_, i) => i);

  for (;;) {
    const community = _louvainLocalMoving(curW);
    const isIdentity = community.every((c, i) => c === i);
    if (isIdentity) break;

    const { newW, remap } = _louvainAggregate(curW, community);
    membership = membership.map((c) => remap.get(community[c])!);
    curW = newW;

    if (curW.length === 1) break;
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const c = membership[i];
    const group = groups.get(c);
    if (group) group.push(i);
    else groups.set(c, [i]);
  }

  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group);
}

// =============================================================================
// katzCentrality - Katz centrality (networkx-compatible)
// =============================================================================

/**
 * Solve the dense linear system `A x = b` via Gaussian elimination with
 * partial pivoting.
 * @internal
 */
function _solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < 1e-14) {
      throw new Error(
        'katzCentrality: singular system — reduce alpha (must be < 1/largest eigenvalue)'
      );
    }
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }
    const pivotVal = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivotVal;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Katz centrality: `x = alpha * A^T * x + beta`, solved directly via
 * `x = (I - alpha*A^T)^-1 * (beta * 1)`, then normalized so
 * `sign(sum(x)) * ||x||_2 = 1` — matching `networkx.katz_centrality_numpy`'s
 * convention exactly (including its "use A^T so directed graphs measure
 * in-edges" default). For an undirected (symmetric) `adj`, `A^T = A`.
 *
 * `alpha` must be strictly less than `1 / λ_max(A)` (the reciprocal of the
 * adjacency matrix's largest eigenvalue) for the system to be well-posed;
 * an ill-conditioned/singular system throws.
 *
 * @param adj - Adjacency matrix (directed reading; weighted or unweighted)
 * @param alpha - Attenuation factor (must satisfy `alpha < 1/λ_max`)
 * @param beta - Constant added at every node (default 1)
 * @returns L2-normalized Katz centrality score per vertex
 *
 * @example
 * const adj = [[0,1,1],[1,0,1],[1,1,0]]; // triangle K3
 * katzCentrality(adj, 0.1) // all three equal (symmetric graph)
 */
export function katzCentrality(adj: number[][], alpha: number, beta: number = 1): number[] {
  const n = adj.length;
  if (n === 0) return [];

  // M = I - alpha * A^T  =>  M[i][j] = delta_ij - alpha * adj[j][i]
  const M: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - alpha * adj[j][i])
  );
  const b = new Array<number>(n).fill(beta);

  const x = _solveLinearSystem(M, b);

  let sum = 0;
  let sumSq = 0;
  for (const xi of x) {
    sum += xi;
    sumSq += xi * xi;
  }
  const norm = Math.sign(sum) * Math.sqrt(sumSq);
  if (norm === 0) return x;

  return x.map((xi) => xi / norm);
}

// =============================================================================
// isIsomorphic - Backtracking isomorphism test with degree-sequence pruning
// =============================================================================

/**
 * Test whether two graphs are isomorphic: does there exist a bijection
 * `f` between their vertices such that `i -> j` is an edge in `graphA` iff
 * `f(i) -> f(j)` is an edge in `graphB`?
 *
 * Sound and complete backtracking search (not a heuristic): a quick reject
 * compares sorted (out-degree, in-degree) sequences, then a permutation
 * search builds the bijection incrementally, checking edge-consistency
 * against every previously-mapped vertex at each step. Exponential
 * worst-case (graph isomorphism has no known polynomial algorithm in
 * general) — intended for small-to-moderate graphs.
 *
 * @param graphA - Adjacency matrix (directed reading)
 * @param graphB - Adjacency matrix (directed reading)
 * @returns Whether the two graphs are isomorphic
 *
 * @example
 * const k3 = [[0,1,1],[1,0,1],[1,1,0]];
 * const c3 = [[0,1,1],[1,0,1],[1,1,0]]; // C3 === K3 for n=3
 * isIsomorphic(k3, c3) // => true
 */
export function isIsomorphic(graphA: number[][], graphB: number[][]): boolean {
  const n = graphA.length;
  if (graphB.length !== n) return false;
  if (n === 0) return true;

  const degreeSequence = (adj: number[][]): number[] => {
    const size = adj.length;
    const seq: number[] = [];
    for (let i = 0; i < size; i++) {
      let outDeg = 0;
      let inDeg = 0;
      for (let j = 0; j < size; j++) {
        if (_edgeExists(adj, i, j)) outDeg++;
        if (_edgeExists(adj, j, i)) inDeg++;
      }
      seq.push(outDeg * (size + 1) + inDeg);
    }
    return seq.sort((a, b) => a - b);
  };

  const degA = degreeSequence(graphA);
  const degB = degreeSequence(graphB);
  for (let i = 0; i < n; i++) {
    if (degA[i] !== degB[i]) return false;
  }

  const mapAtoB = new Array<number>(n).fill(-1);
  const usedB = new Array<boolean>(n).fill(false);
  const order = Array.from({ length: n }, (_, i) => i);

  function backtrack(pos: number): boolean {
    if (pos === n) return true;
    const a = order[pos];
    for (let b = 0; b < n; b++) {
      if (usedB[b]) continue;
      let consistent = true;
      for (let k = 0; k < pos; k++) {
        const a2 = order[k];
        const b2 = mapAtoB[a2];
        if (_edgeExists(graphA, a, a2) !== _edgeExists(graphB, b, b2)) {
          consistent = false;
          break;
        }
        if (_edgeExists(graphA, a2, a) !== _edgeExists(graphB, b2, b)) {
          consistent = false;
          break;
        }
      }
      if (!consistent) continue;

      mapAtoB[a] = b;
      usedB[b] = true;
      if (backtrack(pos + 1)) return true;
      usedB[b] = false;
      mapAtoB[a] = -1;
    }
    return false;
  }

  return backtrack(0);
}
