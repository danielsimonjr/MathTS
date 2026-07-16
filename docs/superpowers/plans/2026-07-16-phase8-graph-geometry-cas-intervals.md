# Phase 8 — Graph · Geometry · Interpolation/BVP · Intervals · CAS Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Close the remaining breadth gaps — graph algorithms, computational-geometry additions, N-D interpolation + general BVP, interval arithmetic, and a real symbolic CAS engine (resolving the Phase-0 pass-through no-ops) — all oracle-pinned vs scipy/networkx/sympy.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: scipy 1.17.1, numpy 2.3.4, networkx 3.6.1, sympy 1.14.0.

## Global Constraints

- Tests import built `dist/` — rebuild before vitest.
- **Oracle-pinned** to scipy/networkx/sympy/closed forms (verify at build time). Never round-trip.
- No new cross-package deps. Building blocks: existing `shortestPath`/`pageRank`/`adjacencyMatrix`/`convexHull`/`kdTree`/`slerp` (quaternion helpers in `functions/src/typed/`), `svd` (for procrustes), `linsolve`, the expression parser/evaluator (`parse`/`evaluate` from `../factories/evaluate.js`) for CAS. Import from source modules.
- Additive & non-breaking. strict + eslint zero. **New public exports → curated `docs/reference/functions.md` table** (docs-completeness gate) + `npm run docs:functions`/`docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms; commit may need explicit long timeout). Implementers commit locally, do NOT push.

## Verified current state

Missing: graph `bfs`/`dfs`/`floydWarshall`/`bellmanFord`/`closenessCentrality`/`harmonicCentrality`/`maxFlow`/`minCut`/`astar`/`hungarian`/`graphColoring`; geometry `quaternionSlerp`/`quaternionInverse`/`quaternionToEuler`/`boundingBox`/`procrustes`; `interpn`; sets `setIsSuperset`/`setEqual`/`setDisjoint`; `Interval`. Present: `shortestPath`(Dijkstra)/`pageRank`/`adjacencyMatrix`/`convexHull`/`kdTree`/`slerp`; `solveBVP` (hardcoded n=2). CAS `factor`/`expand`/`apart`/`together` are pass-through no-ops (Phase-0 annotated).

---

### Task 1: graph traversal, all-pairs shortest paths, centralities

**Files:** `functions/src/graph/traversal-centrality.ts` (new); export `bfs`, `dfs`, `floydWarshall`, `bellmanFord`, `closenessCentrality`, `harmonicCentrality`. Test `functions/tests/graph-traversal.test.ts`.

**Spec** (graphs as adjacency matrices `number[][]`, `0`/`Infinity` = no edge; directed is the natural reading — do NOT symmetrize):

- `bfs(adj, start): number[]` / `dfs(adj, start): number[]` — visitation order from `start`.
- `floydWarshall(adj): number[][]` — all-pairs shortest path distance matrix (edge weight = adj[i][j], 0 on diagonal, Infinity for no edge). Detect negative cycles (diagonal < 0 → throw or flag).
- `bellmanFord(adj, source): { dist: number[]; hasNegativeCycle: boolean }` — single-source with negative-weight support.
- `closenessCentrality(adj): number[]` / `harmonicCentrality(adj): number[]` — per-node closeness `= (n−1)/Σd` and harmonic `= Σ 1/d` (using shortest-path distances; networkx convention).

**Oracles (VERIFIED at build):** for the path graph `0-1-2` as adjacency `[[0,1,Inf],[1,0,1],[Inf,1,0]]`, `floydWarshall` gives `d(0,2)=2`; `bfs(adj,0)=[0,1,2]`. Verify centralities vs `networkx.closeness_centrality`/`harmonic_centrality`.

- [ ] **Step 1: failing test**:

```ts
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
  it('floydWarshall d(0,2) = 2 on the path', () => {
    expect(floydWarshall(path3)[0][2]).toBe(2);
  });
  it('bellmanFord single-source distances', () => {
    const r = bellmanFord(path3, 0);
    expect(r.dist[2]).toBe(2);
    expect(r.hasNegativeCycle).toBe(false);
  });
  it('bellmanFord detects a negative cycle', () => {
    const neg = [
      [0, 1, INF],
      [INF, 0, -3],
      [1, INF, 0],
    ]; // 0->1->2->0 sums to -1
    expect(bellmanFord(neg, 0).hasNegativeCycle).toBe(true);
  });
  it('harmonicCentrality of the middle node is highest', () => {
    const h = harmonicCentrality(path3);
    expect(h[1]).toBeGreaterThan(h[0]);
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(graph): bfs/dfs/floydWarshall/bellmanFord + closeness/harmonic centrality`).

---

### Task 2: graph optimization — `maxFlow`/`minCut`/`astar`/`hungarian`

**Files:** `functions/src/graph/optimization.ts` (new); export `maxFlow`, `minCut`, `astar`, `hungarian`. Test `functions/tests/graph-optimization.test.ts`.

**Spec:**

- `maxFlow(capacity: number[][], source, sink): { maxFlow: number; flow: number[][] }` — Edmonds–Karp (BFS-augmenting). `minCut(capacity, source, sink): { value: number; partition: [number[], number[]] }` — min-cut from the residual graph (value = maxFlow).
- `astar(adj, start, goal, heuristic: (node) => number): { path: number[]; cost: number }` — A\* on a weighted adjacency matrix with an admissible heuristic.
- `hungarian(cost: number[][]): { assignment: number[]; cost: number }` — optimal assignment (Kuhn–Munkres / `scipy.optimize.linear_sum_assignment`), minimizing total cost.

**Oracles (VERIFIED at build):** `hungarian([[4,1,3],[2,0,5],[3,2,2]])` → scipy `linear_sum_assignment` cost = `5` (assignment 0→1,1→0,2→2 = 1+2+2). `maxFlow` on a small network vs networkx `maximum_flow_value`.

- [ ] **Step 1: failing test** (pin hungarian vs scipy):

```ts
import { describe, it, expect } from 'vitest';
import { maxFlow, hungarian, astar } from '../src/index.js';

describe('graph optimization', () => {
  it('hungarian minimizes assignment cost (scipy) = 5', () => {
    const r = hungarian([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]);
    expect(r.cost).toBeCloseTo(5, 8);
    expect(r.assignment).toHaveLength(3);
  });
  it('maxFlow simple network', () => {
    // 0->1 cap 3, 0->2 cap 2, 1->3 cap 2, 2->3 cap 3, 1->2 cap 1 ; max flow 0->3 = 4
    const cap = [
      [0, 3, 2, 0],
      [0, 0, 1, 2],
      [0, 0, 0, 3],
      [0, 0, 0, 0],
    ];
    expect(maxFlow(cap, 0, 3).maxFlow).toBe(4);
  });
  it('astar finds the shortest path', () => {
    const INF = Infinity;
    const adj = [
      [0, 1, 4],
      [1, 0, 1],
      [4, 1, 0],
    ];
    const r = astar(adj, 0, 2, () => 0); // Dijkstra when h=0
    expect(r.cost).toBe(2); // 0->1->2
    expect(r.path).toEqual([0, 1, 2]);
  });
});
```

(Verify the maxFlow value and hungarian cost vs networkx/scipy at build.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(graph): maxFlow/minCut + astar + hungarian assignment`).

---

### Task 3: geometry & sets — quaternion slerp/inverse/Euler, boundingBox, procrustes, kdTree kNN/radius, set ops

**Files:** `functions/src/geometry/geometry-extra.ts` (new); export `quaternionSlerp`, `quaternionInverse`, `quaternionToEuler`, `boundingBox`, `procrustes`, `kdTreeKNN`, `kdTreeRadius`, `setIsSuperset`, `setEqual`, `setDisjoint`. Test `functions/tests/geometry-sets.test.ts`. (Read the existing quaternion helpers + `kdTree` first — match conventions.)

**Spec:**

- `quaternionInverse(q: [number,number,number,number])` — `conj(q)/|q|²`. `quaternionSlerp(q1, q2, t)` — spherical linear interpolation between unit quaternions. `quaternionToEuler(q): [roll, pitch, yaw]` — ZYX Euler angles (radians).
- `boundingBox(points: number[][]): { min: number[]; max: number[] }` — axis-aligned bounding box.
- `procrustes(A: number[][], B: number[][]): { R: number[][]; scale: number; disparity: number }` — orthogonal Procrustes alignment of B onto A (via `svd` of `AᵀB`).
- `kdTreeKNN(points, query, k): number[]` (indices of k nearest) and `kdTreeRadius(points, query, r): number[]` (indices within radius r) — reuse the existing `kdTree` structure or brute force.
- `setIsSuperset(a, b)` / `setEqual(a, b)` / `setDisjoint(a, b)` — multiset-aware, complementing the existing `setIsSubset`.

**Oracles:** `quaternionToEuler([1,0,0,0])` = `[0,0,0]` (identity). `quaternionSlerp(q1,q2,0)=q1`, `t=1`→q2. `boundingBox([[1,2],[3,0],[2,5]])` = `{min:[1,0], max:[3,5]}`. `setEqual([1,2,2],[2,1,2])`=true. Verify procrustes/euler vs scipy `Rotation` at build.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import {
  quaternionToEuler,
  quaternionSlerp,
  boundingBox,
  setEqual,
  setIsSuperset,
  setDisjoint,
} from '../src/index.js';

describe('geometry + sets', () => {
  it('quaternionToEuler(identity) = [0,0,0]', () => {
    quaternionToEuler([1, 0, 0, 0]).forEach((a) => expect(a).toBeCloseTo(0, 8));
  });
  it('quaternionSlerp endpoints', () => {
    const q1 = [1, 0, 0, 0],
      q2 = [0, 1, 0, 0];
    expect(quaternionSlerp(q1, q2, 0)).toEqual(q1);
    quaternionSlerp(q1, q2, 1).forEach((v, i) => expect(v).toBeCloseTo(q2[i], 8));
  });
  it('boundingBox', () => {
    expect(
      boundingBox([
        [1, 2],
        [3, 0],
        [2, 5],
      ])
    ).toEqual({ min: [1, 0], max: [3, 5] });
  });
  it('set ops (multiset)', () => {
    expect(setEqual([1, 2, 2], [2, 1, 2])).toBe(true);
    expect(setEqual([1, 2], [1, 2, 2])).toBe(false);
    expect(setIsSuperset([1, 2, 3], [1, 2])).toBe(true);
    expect(setDisjoint([1, 2], [3, 4])).toBe(true);
    expect(setDisjoint([1, 2], [2, 3])).toBe(false);
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(geometry): quaternion slerp/inverse/euler, boundingBox, procrustes, kdTree kNN/radius, set superset/equal/disjoint`).

---

### Task 4: N-D interpolation `interpn` + general BVP `solveBVP`

**Files:** `functions/src/numeric/interpn-bvp.ts` (new); export `interpn`; **fix** the existing `solveBVP` (locate: `grep -rn "export function solveBVP" functions/src` — it's hardcoded to n=2) to handle a general first-order system. Test `functions/tests/interpn-bvp.test.ts`.

**Spec:**

- `interpn(grids: number[][], values: number[][] | number[], query: number[][]): number[]` — regular-grid N-D linear interpolation (`scipy.interpolate.interpn`). Start with 2-D bilinear (grids = [xs, ys], values = 2-D array); generalize to N-D multilinear if tractable.
- `solveBVP(odeFun, bc, mesh, y0)` — generalize the two-point boundary value problem beyond n=2: a collocation / finite-difference / shooting method for a general first-order system `y' = f(x, y)` with boundary conditions `bc(ya, yb) = 0`. Match scipy `solve_bvp` on a known problem. **Read the current implementation first; keep its signature working for the n=2 case (existing tests green), extend to general n.**

**Oracles:** bilinear `interpn` of `f(x,y)=x+y` on a grid is exact (interpn returns x+y at query points). `solveBVP` of `y'' = −y, y(0)=0, y(π/2)=1` → `y(x)=sin(x)` (as a first-order system `[y, y']`).

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { interpn } from '../src/index.js';

describe('N-D interpolation', () => {
  it('bilinear interpn is exact on a linear function f=x+y', () => {
    const xs = [0, 1, 2],
      ys = [0, 1, 2];
    const vals = xs.map((x) => ys.map((y) => x + y)); // 3x3
    const out = interpn([xs, ys], vals, [
      [0.5, 0.5],
      [1.5, 0.25],
    ]);
    expect(out[0]).toBeCloseTo(1.0, 8);
    expect(out[1]).toBeCloseTo(1.75, 8);
  });
});
```

(Add a solveBVP test pinned to sin(x) if you extend it; if the general BVP extension is too large, deliver `interpn` solidly and report solveBVP as scoped-down — do NOT regress the existing solveBVP tests.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`/`### Fixed`; commit `feat(numeric): interpn N-D grid interpolation + general solveBVP`).

---

### Task 5: interval arithmetic — `Interval` type + operations

**Files:** `functions/src/numeric/interval.ts` (new); export `Interval` (class or factory), `interval`, and arithmetic/functions. Test `functions/tests/interval.test.ts`.

**Spec:** rigorous interval arithmetic with **outward rounding** (widen bounds by one ULP after each op to guarantee containment):

- `interval(lo, hi)` → `{ lo, hi }` (an `Interval`). Arithmetic: `add`/`sub`/`mul`/`div` (interval rules: mul takes min/max of the four endpoint products; div throws or splits on intervals containing 0). Width, midpoint, contains.
- Elementary: `iexp`, `ilog`, `isqrt`, `isin`/`icos` (monotonic-segment-aware), `ipow`.
- Provide the operations as methods on `Interval` OR standalone functions `intervalAdd(a,b)` etc. — pick one, document.

**Oracle:** `interval(1,2) + interval(3,4)` = `[4,6]`. `interval(-1,2) * interval(2,3)` = `[-3,6]`. `interval(1,4).sqrt()` = `[1,2]`. Containment: the true result of any real op on points inside the inputs is inside the output.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { interval } from '../src/index.js';

describe('interval arithmetic', () => {
  it('add', () => {
    const r = interval(1, 2).add(interval(3, 4));
    expect(r.lo).toBeLessThanOrEqual(4);
    expect(r.hi).toBeGreaterThanOrEqual(6);
    expect(r.lo).toBeCloseTo(4, 10);
    expect(r.hi).toBeCloseTo(6, 10);
  });
  it('mul with mixed signs -> [-3,6]', () => {
    const r = interval(-1, 2).mul(interval(2, 3));
    expect(r.lo).toBeCloseTo(-3, 10);
    expect(r.hi).toBeCloseTo(6, 10);
  });
  it('sqrt([1,4]) = [1,2]', () => {
    const r = interval(1, 4).sqrt();
    expect(r.lo).toBeCloseTo(1, 10);
    expect(r.hi).toBeCloseTo(2, 10);
  });
  it('contains the true product for endpoints', () => {
    const r = interval(1, 2).mul(interval(3, 4)); // [3,8]
    expect(r.lo).toBeLessThanOrEqual(1 * 3);
    expect(r.hi).toBeGreaterThanOrEqual(2 * 4);
  });
});
```

(Adjust to your method/standalone API.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(numeric): interval arithmetic (Interval type, outward-rounded)`).

---

### Task 6: real CAS engine — `expand`/`factor`/`apart`/`together`

**Files:** implement in the CAS layer (locate `factor`/`expand`/`apart`/`together` — they're pass-through today; likely `functions/src/typed/cas.ts` + `functions/src/algebra/`). Test `functions/tests/cas-engine.test.ts`.

**Spec — make the pass-through no-ops actually work (resolves the Phase-0 honesty gap):**

- `expand(expr)` — distribute products/powers of polynomials: `expand('(x+1)^3')` → `x^3 + 3*x^2 + 3*x + 1`. Parse the expression (use the existing parser), recursively distribute, collect like terms, re-stringify.
- `factor(expr)` — factor a univariate polynomial over the rationals (rational-root theorem + polynomial division for linear factors; leave irreducible quadratics): `factor('x^2-1')` → `(x - 1)*(x + 1)`.
- `apart(expr)` — partial-fraction decomposition of a rational function: `apart('1/(x^2-1)')` → `1/(2*(x-1)) - 1/(2*(x+1))` (or an equivalent form).
- `together(expr)` — combine a sum of fractions over a common denominator: `together('1/x + 1/(x+1)')` → `(2*x+1)/(x*(x+1))` (or equivalent).

**Scope note:** univariate polynomial/rational CAS is the target. Multivariate factoring, symbolic integration by-parts, etc. remain future work — but `expand`/`factor`/`apart`/`together` for univariate polynomials/rationals MUST actually transform (verify against sympy). If `factor`/`apart` prove too large, deliver a correct `expand` + `together` at minimum and report which are done vs still-passthrough (and keep the Phase-0 pass-through docs accurate for any still-passthrough).

**Oracles (sympy, VERIFIED at build):** `sympy.expand('(x+1)**3')` = `x**3+3*x**2+3*x+1`; `sympy.factor('x**2-1')` = `(x-1)*(x+1)`; `sympy.apart('1/(x**2-1)')` = `-1/(2*(x+1)) + 1/(2*(x-1))`; `sympy.together('1/x+1/(x+1)')` = `(2*x+1)/(x*(x+1))`.

- [ ] **Step 1: failing test** (assert by RE-EXPANDING or numeric evaluation to avoid string-form brittleness):

```ts
import { describe, it, expect } from 'vitest';
import { expand, factor, evaluate } from '../src/index.js';

// evaluate a stringified expression at a point (test helper via the package evaluator)
const at = (e: string, x: number) => evaluate(e, { x });

describe('CAS engine (univariate)', () => {
  it('expand((x+1)^3) equals x^3+3x^2+3x+1 numerically', () => {
    const e = expand('(x+1)^3');
    for (const x of [-2, 0.5, 3]) expect(at(e, x)).toBeCloseTo((x + 1) ** 3, 8);
  });
  it('factor(x^2-1) equals (x-1)(x+1) numerically and is not the input', () => {
    const f = factor('x^2-1');
    expect(f).not.toBe('x^2-1');
    for (const x of [-2, 0.5, 3]) expect(at(f, x)).toBeCloseTo(x * x - 1, 8);
  });
});
```

- [ ] Steps 2–5. **Update the Phase-0 `cas-passthrough-documented.test.ts` characterization test** (the transforms now work, so its expectations flip — update it to assert the new correct behavior, and remove the "pass-through" annotations from `functions.md` for the functions you fixed). CHANGELOG `### Fixed` (factor/expand/apart/together were documented no-ops, now implemented for univariate polynomials/rationals). commit `feat(cas): real expand/factor/apart/together for univariate polynomials/rationals`.

---

## Release (after all tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize graph/geometry/interp/interval/CAS additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish` (wait for propagation), push tags, **verify** via `npm view` + clean-install probe of `floydWarshall`/`hungarian`/`quaternionSlerp`/`interpn`/`interval`/`expand`.
- [ ] Tick TODO Phase 8; footnote roadmap; **final roadmap-complete check-in.**

**Deferred (logged in TODO):** graph coloring/clique/Louvain/isomorphism; Katz centrality; SphericalVoronoi/alpha-shapes/halfspace-intersection; general PDE/MOL (`solvePDE` beyond 1-D heat); multivariate CAS + symbolic integration by-parts; Phase-5-ext niche special fns; matrix `eig` complex-eigenvector fix.

## Self-Review

- Task 4 and Task 6 modify existing functions (solveBVP, factor/expand) — keep existing tests green; if the general extension is too large, deliver the tractable subset and keep docs accurate. Task 6 must flip the Phase-0 characterization test for the functions it fixes.
- Every item oracle-pinned to scipy/networkx/sympy.
