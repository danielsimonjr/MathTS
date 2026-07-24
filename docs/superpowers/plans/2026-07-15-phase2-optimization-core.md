# Phase 2 — Optimization Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the optimization workhorses missing from MathTS — a BFGS quasi-Newton minimizer, non-negative / bounded least-squares, and a proper two-phase `linprog` supporting equality constraints, variable bounds, and status flags.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: scipy 1.17.1, numpy 2.3.4.

## Global Constraints

- Tests import built `dist/` — rebuild (`npx turbo build --filter=@danielsimonjr/mathts-functions`) before vitest.
- Oracle-pinned (scipy/numpy/closed form), never round-trip.
- No new cross-package deps. Numeric gradient: use `gradientAt(f, x0)` (forward-mode dual, already exported) OR a local central-difference gradient. `leastSquares(A, b): number[]` (returns coefficient vector) is available for NNLS.
- Additive & non-breaking. The `linprog` rewrite MUST keep the legacy positional signature `linprog(c, A_ub, b_ub)` working identically (return the same feasible optimum), adding new capability via an options overload.
- strict + eslint zero. **New public exports MUST be added to the curated table in `docs/reference/functions.md`** (a `docs-reference-completeness.test.ts` gate enforces it), then regenerate with `npm run docs:functions` + `npm run docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms). Implementers commit locally, do NOT push.

## Verified current state (probed on dist)

- `bfgs`/`lbfgs`/`nnls`/`boundedLeastSquares` — **undefined**.
- `minimize` (Nelder–Mead), `gradientDescent`, `levenbergMarquardt`, `curvefit`, `gradientAt`, `leastSquares`, `linprog` — exist. `linprog([-1,-1],[[1,1]],[1])` → `[1,0]` (Phase 0 feasibility fix live).

---

### Task 1: `bfgs` — BFGS quasi-Newton minimizer (optional bounds)

**Files:** Create `functions/src/numeric/bfgs.ts`; export `bfgs` from `functions/src/index.ts`. Test `functions/tests/bfgs.test.ts`.

**Spec:** `bfgs(f: (x: number[]) => number, x0: number[], opts?: { grad?: (x:number[])=>number[]; bounds?: [number, number][]; tol?: number; maxIter?: number }): { x: number[]; fval: number; iterations: number; converged: boolean }`.

- BFGS inverse-Hessian update `H_{k+1} = (I − ρ s yᵀ) H_k (I − ρ y sᵀ) + ρ s sᵀ`, `s = x_{k+1}−x_k`, `y = g_{k+1}−g_k`, `ρ = 1/(yᵀs)` (skip the update if `yᵀs ≤ 1e-12`). Search direction `d = −H g`; backtracking Armijo line search (`c1 = 1e-4`, halve step, ≤50 backtracks).
- Gradient: use `opts.grad` if given, else a central-difference gradient (`h = max(1,|x_i|)·cbrt(2.22e-16)`).
- If `opts.bounds` given, **clip** each `x_i` to `[lo, hi]` after every step (projected BFGS — a simple L-BFGS-B-lite; document this is projection, not the full active-set L-BFGS-B). Default `tol = 1e-8` (converge on `‖g‖∞ < tol`), `maxIter = 500`.

Oracles: Rosenbrock `f = (1−x)² + 100(y−x²)²` from `[-1.2, 1]` → `[1, 1]`, f=0. Quadratic `(x−3)²+(y+1)²` → `[3, −1]`. Bounded: minimize `(x−5)²` on `bounds [[0, 2]]` → x=2 (clipped).

- [ ] **Step 1: failing test** `functions/tests/bfgs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bfgs } from '../src/index.js';

describe('bfgs (quasi-Newton)', () => {
  it('Rosenbrock from [-1.2,1] -> [1,1], f~0', () => {
    const r = bfgs((v) => (1 - v[0]) ** 2 + 100 * (v[1] - v[0] ** 2) ** 2, [-1.2, 1]);
    expect(r.x[0]).toBeCloseTo(1, 4);
    expect(r.x[1]).toBeCloseTo(1, 4);
    expect(r.fval).toBeLessThan(1e-8);
    expect(r.converged).toBe(true);
  });
  it('quadratic (x-3)^2+(y+1)^2 -> [3,-1]', () => {
    const r = bfgs((v) => (v[0] - 3) ** 2 + (v[1] + 1) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(-1, 6);
  });
  it('bounded: min (x-5)^2 on [0,2] -> x=2 (clipped)', () => {
    const r = bfgs((v) => (v[0] - 5) ** 2, [0], { bounds: [[0, 2]] });
    expect(r.x[0]).toBeCloseTo(2, 4);
  });
  it('analytic gradient path (quadratic)', () => {
    const r = bfgs((v) => v[0] ** 2 + v[1] ** 2, [1, 1], { grad: (v) => [2 * v[0], 2 * v[1]] });
    expect(r.x[0]).toBeCloseTo(0, 6);
    expect(r.x[1]).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 2: RED** (undefined). **Step 3: implement.** **Step 4: GREEN** + docs-completeness (add `bfgs` to curated table, Numerical Methods → Optimization; regen) + regression. **Step 5: gate + CHANGELOG `### Added` + commit** (`feat(numeric): bfgs quasi-Newton minimizer with optional bounds`).

---

### Task 2: `nnls` + bounded least-squares `lsqBounded`

**Files:** Create `functions/src/numeric/nnls.ts`; export `nnls`, `lsqBounded` from `index.ts`. Test `functions/tests/nnls.test.ts`.

**Spec:**

- `nnls(A: number[][], b: number[], opts?: { tol?: number; maxIter?: number }): { x: number[]; residual: number }` — the Lawson–Hanson active-set algorithm for `min ‖Ax − b‖₂ s.t. x ≥ 0`. Standard active/passive set iteration; solve the unconstrained LS on the passive set via `leastSquares` (or normal equations). Return solution + residual norm `‖Ax−b‖`.
- `lsqBounded(A: number[][], b: number[], lower: number[], upper: number[], opts?): { x: number[]; residual: number }` — bounded-variable least-squares; a projected-gradient / clipped-Newton on the normal equations (simple but correct). If full BVLS is heavy, a projected-gradient descent on `½‖Ax−b‖²` with box projection is acceptable (converge on projected-gradient norm < tol).

Oracles (scipy.optimize.nnls): `nnls(I₂, [3, -2])` → `[3, 0]` (negative component clamped). `nnls(I₂, [3, 5])` → `[3, 5]`. `nnls([[1,0],[0,1],[1,1]], [1,1,0])` — verify against scipy at build time. `lsqBounded(I₂, [5, -3], [0,0], [2,2])` → `[2, 0]`.

- [ ] **Step 1: failing test** `functions/tests/nnls.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nnls, lsqBounded } from '../src/index.js';

describe('nnls (non-negative least squares)', () => {
  it('nnls(I, [3,-2]) clamps the negative -> [3,0]', () => {
    const r = nnls(
      [
        [1, 0],
        [0, 1],
      ],
      [3, -2]
    );
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(0, 6);
  });
  it('nnls(I, [3,5]) unconstrained -> [3,5]', () => {
    const r = nnls(
      [
        [1, 0],
        [0, 1],
      ],
      [3, 5]
    );
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(5, 6);
  });
  it('all solution components are non-negative', () => {
    const r = nnls(
      [
        [1, -1],
        [1, 1],
        [0, 1],
      ],
      [-1, 2, -3]
    );
    expect(r.x.every((v) => v >= -1e-9)).toBe(true);
  });
});

describe('lsqBounded', () => {
  it('box-constrained: [5,-3] on [0,2]^2 -> [2,0]', () => {
    const r = lsqBounded(
      [
        [1, 0],
        [0, 1],
      ],
      [5, -3],
      [0, 0],
      [2, 2]
    );
    expect(r.x[0]).toBeCloseTo(2, 4);
    expect(r.x[1]).toBeCloseTo(0, 4);
  });
});
```

- [ ] **Step 2: RED.** **Step 3: implement** (verify the third nnls oracle vs scipy at build). **Step 4: GREEN** + docs-completeness + regression. **Step 5: gate + CHANGELOG `### Added` + commit** (`feat(numeric): nnls + lsqBounded (non-negative / box-constrained least squares)`).

---

### Task 3: `linprog` two-phase rewrite — equality constraints, bounds, status (keep legacy signature)

**Files:** Modify `linprog` at `functions/src/typed/numeric.ts` (read it fully first). Test `functions/tests/linprog-full.test.ts`.

**Spec — additive overload, legacy path preserved:**

- Keep `linprog(c: number[], A_ub: number[][], b_ub: number[]): number[]` working EXACTLY as today (returns the feasible optimum `x` vector; all existing linprog tests must stay green).
- Add an options overload: `linprog(c: number[], opts: { A_ub?; b_ub?; A_eq?: number[][]; b_eq?: number[]; bounds?: [number|null, number|null][] }): { x: number[]; fun: number; success: boolean; status: 'optimal' | 'infeasible' | 'unbounded' }`.
- Implement a **two-phase simplex**: Phase 1 introduces artificial variables to find a basic feasible solution (handles `A_eq`/`≥`/negative RHS); Phase 2 optimizes. Support variable bounds via shifting/splitting. Return status flags. Detect infeasible (Phase 1 objective > 0) and unbounded (no leaving variable).
- Detect which overload by the 2nd argument: `Array.isArray(second)` → legacy `(c, A_ub, b_ub)`; else options object.

Oracles (verify all vs `scipy.optimize.linprog(method='highs')` at build time):

- Legacy `linprog([-1,-1], [[1,1]], [1])` → `[1, 0]` (unchanged).
- Equality: `min −x−y s.t. x+y ≤ 4, x−y = 1, x,y ≥ 0` → `x=2.5, y=1.5`, fun `−4`, status optimal.
- Infeasible: `min x s.t. x ≤ 1 and x ≥ 3 (as −x ≤ −3)` → status `infeasible`.
- Bounds: `min −x s.t. (no ub constraints), bounds x ∈ [0, 5]` → `x=5`, unbounded-guarded by the bound.

- [ ] **Step 1: failing test** `functions/tests/linprog-full.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { linprog } from '../src/index.js';

describe('linprog — two-phase (equality, bounds, status)', () => {
  it('legacy positional signature unchanged -> [1,0]', () => {
    const x = linprog([-1, -1], [[1, 1]], [1]) as number[];
    expect(x[0]).toBeCloseTo(1, 6);
    expect(x[1]).toBeCloseTo(0, 6);
  });
  it('equality constraint: x-y=1, x+y<=4 -> [2.5,1.5], fun=-4', () => {
    const r = linprog([-1, -1], { A_ub: [[1, 1]], b_ub: [4], A_eq: [[1, -1]], b_eq: [1] }) as {
      x: number[];
      fun: number;
      success: boolean;
      status: string;
    };
    expect(r.status).toBe('optimal');
    expect(r.x[0]).toBeCloseTo(2.5, 5);
    expect(r.x[1]).toBeCloseTo(1.5, 5);
    expect(r.fun).toBeCloseTo(-4, 5);
  });
  it('infeasible system -> status infeasible', () => {
    const r = linprog([1], { A_ub: [[1], [-1]], b_ub: [1, -3] }) as {
      success: boolean;
      status: string;
    };
    expect(r.status).toBe('infeasible');
    expect(r.success).toBe(false);
  });
  it('bounds: min -x with x in [0,5] -> x=5', () => {
    const r = linprog([-1], { bounds: [[0, 5]] }) as { x: number[]; status: string };
    expect(r.x[0]).toBeCloseTo(5, 5);
  });
});
```

- [ ] **Step 2: RED** (options overload undefined behavior / no status). **Step 3: implement** the two-phase simplex; keep the legacy branch. **Step 4: GREEN** + **run ALL existing linprog tests** (`grep -rn linprog functions/tests`) — they MUST stay green; if one regresses, STOP and report. Docs: `linprog` already documented; update its entry to note the options overload. Regression + docs-completeness. **Step 5: gate + CHANGELOG (`### Added` linprog equality/bounds/status overload) + commit** (`feat(numeric): linprog two-phase simplex — equality, bounds, status`).

---

## Release (after all 3 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize BFGS, NNLS/lsqBounded, linprog two-phase.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish`, push tags, **verify via `npm view` + clean-install probe** of `bfgs`/`nnls`/`linprog` options overload.
- [ ] Tick TODO Phase 2; footnote roadmap; phase-boundary check-in; then Phase 3.

## Self-Review

- Task 1 (bfgs) and Task 2 (nnls) are additive; Task 3 rewrites `linprog` but preserves the legacy signature (guarded by a regression requirement on existing tests).
- All oracle-pinned; nnls/linprog third cases verified vs scipy at build time.
