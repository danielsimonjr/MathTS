# Phase 1 — Foundational Numeric Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the foundational numeric primitives that unlock optimization, ODE, and quadrature breadth downstream — numeric Jacobian, open root-finders, a nonlinear system solver, a scalar minimizer, adaptive Gauss–Kronrod quadrature, and exposing full SVD — all oracle-pinned.

**Architecture:** New exports in `@danielsimonjr/mathts-functions`, built on primitives already in the repo (`linsolve`/`lusolve`/`inv` for Newton steps; matrix's `svd`). Numeric `jacobian` becomes polymorphic (keeps the symbolic path); `nintegrate`'s singular case is fixed by routing through the new adaptive quadrature.

**Tech Stack:** TypeScript (ESM, strict), Vitest, tsup. Oracles installed: scipy 1.17.1, numpy 2.3.4, mpmath 1.3.0.

## Global Constraints

- **Tests import built `dist/`.** Rebuild the package (`npx turbo build --filter=@danielsimonjr/mathts-functions`) before running its vitest; prefer `npm run test` (turbo) for regressions.
- **Every new function is oracle-pinned** (scipy/numpy/mpmath value or closed form), never a round-trip.
- **No new cross-package dependencies.** `functions` already depends on `matrix` (for `svd`) and has `linsolve`/`inv` — use them. No `autograd`/`tensor` dep.
- **Additive & non-breaking.** Preserve every existing signature. Numeric `jacobian` must not break symbolic `jacobian(exprs, vars)`.
- **strict + eslint zero** must hold (`npx tsc --noEmit`, `eslint .`).
- **Commit footer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook is slow (~540000ms). Push direct to `main`; verify local==remote after each push. Implementers commit locally, do NOT push (session lead pushes after review).
- **CHANGELOG.md** `## [Unreleased]` → `### Added`/`### Fixed` per task; TODO.md Phase 1 line ticked by the session lead at phase end.

## Verified current state (probed on dist, 2026-07-15)

- `jacobian` exists but is **symbolic-only** — `jacobian(f, x0)` with a numeric fn throws `exprs.map is not a function`.
- `newton`, `secant`, `halley`, `fsolve`, `root`, `broyden`, `minimizeScalar`, `svd`, `orth` — all **undefined** in `functions`.
- `findRoot` (1-D bracketing), `gaussQuad`, `nintegrate` exist. `nintegrate(∫x^-0.5,0,1)` = `1.99999668` (want 2; ~1.7e-6 err).
- `linsolve`/`lusolve`/`inv` available in `functions`. `svd` is exported by `matrix` (async; returns `{U, S, V, rank}`, S descending).

---

### Task 1: numeric `jacobian` + `numericJacobian(f, x0)`

**Files:**

- Modify: the `jacobian` definition (locate: `grep -rn "export function jacobian\|jacobian:" functions/src` — it is the symbolic CAS one). Add a new file `functions/src/numeric/numeric-jacobian.ts` for the numeric core, export it via `functions/src/index.ts`.
- Test: `functions/tests/numeric-jacobian.test.ts`

**Interfaces:**

- Produces: `numericJacobian(f: (x: number[]) => number[], x0: number[], opts?: { h?: number }): number[][]` — central-difference Jacobian J[i][j] = ∂f_i/∂x_j at x0. Also make `jacobian` polymorphic: if the first argument is a **function**, dispatch to `numericJacobian(f, x0)`; otherwise keep the existing symbolic behavior.

**Root cause / spec:** `jacobian` only handles symbolic `(exprs, vars)`. Add a numeric path. Central difference: `J[i][j] = (f_i(x0 + h·e_j) − f_i(x0 − h·e_j)) / (2h)`, `h = max(1, |x0[j]|)·(eps)^(1/3)` with `eps ≈ 2.2e-16` (≈6e-6 relative step — good for central differences). numericJacobian must handle m≠n (F:ℝⁿ→ℝᵐ).

- [ ] **Step 1: failing test** `functions/tests/numeric-jacobian.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { numericJacobian, jacobian } from '../src/index.js';

describe('numericJacobian (F: R^n -> R^m, central differences)', () => {
  it('J of [x^2+y, x*y] at (1,2) = [[2,1],[2,1]]', () => {
    const J = numericJacobian((v) => [v[0] ** 2 + v[1], v[0] * v[1]], [1, 2]);
    expect(J[0][0]).toBeCloseTo(2, 6);
    expect(J[0][1]).toBeCloseTo(1, 6);
    expect(J[1][0]).toBeCloseTo(2, 6);
    expect(J[1][1]).toBeCloseTo(1, 6);
  });
  it('non-square: F: R^3 -> R^2', () => {
    const J = numericJacobian((v) => [v[0] + v[1] + v[2], v[0] * v[2]], [1, 2, 3]);
    expect(J.length).toBe(2);
    expect(J[0]).toHaveLength(3);
    expect(J[1][0]).toBeCloseTo(3, 6); // d(x*z)/dx = z = 3
    expect(J[1][2]).toBeCloseTo(1, 6); // d(x*z)/dz = x = 1
  });
  it('polymorphic jacobian(f, x0) dispatches to numeric', () => {
    const J = jacobian((v: number[]) => [v[0] ** 2, v[1] ** 2], [3, 4]) as number[][];
    expect(J[0][0]).toBeCloseTo(6, 6);
    expect(J[1][1]).toBeCloseTo(8, 6);
  });
  it('symbolic jacobian still works', () => {
    // adjust to the symbolic signature you find; assert it does NOT throw and returns a matrix/expr
    const r = jacobian(['x^2', 'x*y'], ['x', 'y']);
    expect(r).toBeTruthy();
  });
});
```

- [ ] **Step 2: RED** (numericJacobian undefined; `jacobian(f, x0)` throws).
- [ ] **Step 3: implement** `numericJacobian` in the new file; wire the polymorphic dispatch into `jacobian` (detect `typeof firstArg === 'function'`). Read the symbolic `jacobian` first to add the branch without disturbing it.
- [ ] **Step 4: GREEN** + regression (CAS/jacobian suites; grep tests for `jacobian`).
- [ ] **Step 5: gate + CHANGELOG `### Added` + commit.**

---

### Task 2: open scalar root-finders `newton` / `secant` / `halley`

**Files:**

- Create: `functions/src/numeric/open-root-finders.ts`; export via `index.ts`.
- Test: `functions/tests/open-root-finders.test.ts`

**Interfaces:**

- `newton(f, x0, opts?: { fprime?; tol?; maxIter? }): number` — if `fprime` omitted, use a central-difference derivative. `x_{k+1} = x_k − f(x_k)/f'(x_k)`.
- `secant(f, x0, x1, opts?): number` — no derivative; `x_{k+1} = x_k − f(x_k)(x_k−x_{k-1})/(f(x_k)−f(x_{k-1}))`.
- `halley(f, x0, opts?: { fprime?; fprime2?; ... }): number` — `x_{k+1} = x_k − 2 f f' / (2 f'^2 − f f'')` (numeric f'/f'' if omitted).
- All: converge on `|f(x)| < tol` or `|Δx| < tol` (default tol 1e-12, maxIter 100); throw a clear error on non-convergence / zero derivative.

Oracles: √2 = 1.4142135623730951, cbrt(2) = 1.2599210498948732, cos(x)=x root = 0.7390851332151607.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { newton, secant, halley } from '../src/index.js';

describe('open root-finders', () => {
  it('newton x^2-2 -> sqrt(2) (analytic derivative)', () => {
    expect(newton((x) => x * x - 2, 1, { fprime: (x) => 2 * x })).toBeCloseTo(Math.SQRT2, 10);
  });
  it('newton with numeric derivative (no fprime)', () => {
    expect(newton((x) => Math.cos(x) - x, 0.5)).toBeCloseTo(0.7390851332151607, 8);
  });
  it('secant x^2-2 -> sqrt(2)', () => {
    expect(secant((x) => x * x - 2, 1, 2)).toBeCloseTo(Math.SQRT2, 10);
  });
  it('halley x^3-2 -> cbrt(2)', () => {
    expect(
      halley((x) => x ** 3 - 2, 1, { fprime: (x) => 3 * x * x, fprime2: (x) => 6 * x })
    ).toBeCloseTo(Math.cbrt(2), 10);
  });
  it('throws on non-convergence', () => {
    expect(() => newton((x) => x * x + 1, 0, { fprime: (x) => 2 * x, maxIter: 20 })).toThrow();
  });
});
```

- [ ] **Step 2: RED.** **Step 3: implement.** **Step 4: GREEN** + regression. **Step 5: gate + CHANGELOG `### Added` + commit.**

---

### Task 3: nonlinear system solver `fsolve` / `root`

**Files:**

- Create: `functions/src/numeric/fsolve.ts`; export via `index.ts`.
- Test: `functions/tests/fsolve.test.ts`

**Interfaces:**

- `fsolve(F: (x: number[]) => number[], x0: number[], opts?: { tol?; maxIter? }): number[]` — damped Newton: `Δx = −J^{-1} F(x)` via `linsolve`, with a simple backtracking line search on `‖F‖`. Uses `numericJacobian` (Task 1) + `linsolve` (already in functions). `root` is an alias of `fsolve`.
- Converge on `‖F(x)‖∞ < tol` (default 1e-10, maxIter 100); throw on non-convergence / singular Jacobian.

Oracle (scipy.optimize.fsolve): system `[x^2 - y, x + y - 2]` from `[0.5, 0.5]` → `[1, 1]` (x²=y, x+y=2 → x²+x−2=0 → x=1). System `[x^2+y^2-25, x-y-1]` from `[5,1]` → `[4, 3]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { fsolve } from '../src/index.js';

describe('fsolve (nonlinear systems, damped Newton)', () => {
  it('[x^2 - y, x + y - 2] from [0.5,0.5] -> [1,1]', () => {
    const x = fsolve((v) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(1, 8);
  });
  it('[x^2+y^2-25, x-y-1] from [5,1] -> [4,3]', () => {
    const x = fsolve((v) => [v[0] ** 2 + v[1] ** 2 - 25, v[0] - v[1] - 1], [5, 1]);
    expect(x[0]).toBeCloseTo(4, 6);
    expect(x[1]).toBeCloseTo(3, 6);
  });
  it('residual is ~0 at the solution', () => {
    const F = (v: number[]) => [Math.exp(v[0]) + v[1] - 3, v[0] + v[1] * v[1] - 5];
    const x = fsolve(F, [1, 1]);
    const r = F(x);
    expect(Math.hypot(r[0], r[1])).toBeLessThan(1e-8);
  });
});
```

- [ ] **Step 2: RED.** **Step 3: implement** (import `numericJacobian` + `linsolve`; verify `linsolve(A, b)` signature/return by reading its export). **Step 4: GREEN** + regression. **Step 5: gate + CHANGELOG `### Added` + commit.**

---

### Task 4: scalar minimizer `minimizeScalar` (Brent)

**Files:**

- Create: `functions/src/numeric/minimize-scalar.ts`; export via `index.ts`.
- Test: `functions/tests/minimize-scalar.test.ts`

**Interfaces:**

- `minimizeScalar(f: (x: number) => number, opts?: { bracket?: [number, number]; tol?; maxIter? }): { x: number; fval: number }` — Brent's method (golden-section + parabolic interpolation). If a `bracket` [a, b] is given, minimize on it (bounded Brent); otherwise bracket automatically from a default start. Default tol 1e-8.

Oracles: min of `(x-2)^2` → x=2, f=0. Min of `x^4 - 3x^3 + 2` on [0,3]: derivative 4x³−9x²=0 → x=9/4=2.25, f=2.25⁴−3·2.25³+2 = −6.542968... Min of `sin(x)` on [0, 2π] → x=3π/2≈4.712, f=−1.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { minimizeScalar } from '../src/index.js';

describe('minimizeScalar (Brent)', () => {
  it('(x-2)^2 -> x=2, f=0', () => {
    const r = minimizeScalar((x) => (x - 2) ** 2, { bracket: [-5, 5] });
    expect(r.x).toBeCloseTo(2, 6);
    expect(r.fval).toBeCloseTo(0, 8);
  });
  it('x^4 - 3x^3 + 2 on [0,3] -> x=2.25', () => {
    const r = minimizeScalar((x) => x ** 4 - 3 * x ** 3 + 2, { bracket: [0, 3] });
    expect(r.x).toBeCloseTo(2.25, 5);
  });
  it('sin(x) on [0, 2pi] -> x=3pi/2, f=-1', () => {
    const r = minimizeScalar(Math.sin, { bracket: [0, 2 * Math.PI] });
    expect(r.x).toBeCloseTo((3 * Math.PI) / 2, 5);
    expect(r.fval).toBeCloseTo(-1, 8);
  });
});
```

- [ ] **Step 2: RED.** **Step 3: implement.** **Step 4: GREEN** + regression. **Step 5: gate + CHANGELOG `### Added` + commit.**

---

### Task 5: adaptive Gauss–Kronrod `quad` + fix `nintegrate` singular accuracy

**Files:**

- Create: `functions/src/numeric/adaptive-quad.ts`; export `quad` via `index.ts`.
- Modify: `nintegrate` (locate: `grep -rn "export function nintegrate" functions/src`) to route through the new adaptive quadrature.
- Test: `functions/tests/adaptive-quad.test.ts`

**Interfaces:**

- `quad(f: (x: number) => number, a: number, b: number, opts?: { tol?; maxDepth? }): { value: number; error: number }` — adaptive Gauss–Kronrod (G7–K15): on each interval compute the 15-point Kronrod estimate and the embedded 7-point Gauss estimate; if `|K − G| > tol·scale`, bisect and recurse (up to maxDepth). Default tol 1e-10. Use the standard G7-K15 nodes/weights (include them as constants — look them up; they are well-known QUADPACK constants).
- `nintegrate(f, a, b)` now returns `quad(f, a, b).value` (keeps its signature/return type).

**Why:** the current `nintegrate` gives 1.7e-6 error on the endpoint-singular `∫₀¹ x^{-1/2} dx = 2`. Adaptive GK concentrates points near the singularity and reaches ~1e-10.

Oracles: `∫₀¹ x^{-1/2} = 2`; `∫₀^π sin = 2`; `∫₋₁¹ 1/(1+25x²) = (2/5)·atan(5) = 0.54936...`; `∫₀¹ e^{-x²}` ... use `∫₀^1 4/(1+x²) = π`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { quad, nintegrate } from '../src/index.js';

describe('adaptive Gauss-Kronrod quad', () => {
  it('smooth: ∫_0^1 4/(1+x^2) = pi', () => {
    expect(quad((x) => 4 / (1 + x * x), 0, 1).value).toBeCloseTo(Math.PI, 10);
  });
  it('endpoint-singular: ∫_0^1 x^-0.5 = 2 (was 1.7e-6 off)', () => {
    expect(quad((x) => (x <= 0 ? 0 : 1 / Math.sqrt(x)), 0, 1).value).toBeCloseTo(2, 6);
  });
  it('oscillatory-ish: ∫_-1^1 1/(1+25x^2) = 0.4*atan(5)', () => {
    expect(quad((x) => 1 / (1 + 25 * x * x), -1, 1).value).toBeCloseTo(0.4 * Math.atan(5), 9);
  });
  it('nintegrate now hits the singular integral accurately', () => {
    expect(nintegrate((x: number) => (x <= 0 ? 0 : 1 / Math.sqrt(x)), 0, 1)).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 2: RED** (`quad` undefined; nintegrate singular ~1.99999668). **Step 3: implement** GK + reroute nintegrate. **Step 4: GREEN** + regression (grep tests for `nintegrate`/`quad`/`integration`; ensure existing integration tests stay green). **Step 5: gate + CHANGELOG (`### Added` quad, `### Fixed` nintegrate singular accuracy) + commit.**

---

### Task 6: expose full `svd` + `orth` on the `functions` surface

**Files:**

- Modify: `functions/src/index.ts` (re-export `svd` from `@danielsimonjr/mathts-matrix`); create `functions/src/linalg-svd-extra.ts` for `orth`.
- Test: `functions/tests/svd-orth.test.ts`

**Interfaces:**

- Re-export `svd` from matrix (async; `svd(A) => Promise<{ U, S, V, rank }>`, S descending).
- `orth(A: number[][], opts?: { tol?: number }): Promise<number[][]>` — orthonormal basis for the column space: `svd(A)`, keep the columns of `U` whose singular value `> tol` (default `tol = max(m,n)·max(S)·eps`). Returns an m×r matrix (columns = basis vectors).

Oracles: `svd(diag(1,2,3)).S` → `[3,2,1]`. `orth` of a rank-2 3×3 (e.g. `[[1,0,1],[0,1,1],[1,1,2]]`, rank 2) → 2 orthonormal columns (verify `Qᵀ Q ≈ I₂` and each column ⟂).

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { svd, orth } from '../src/index.js';

describe('svd + orth exposed on functions', () => {
  it('svd(diag(1,2,3)).S = [3,2,1]', async () => {
    const { S } = await svd([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ]);
    expect(S[0]).toBeCloseTo(3, 10);
    expect(S[1]).toBeCloseTo(2, 10);
    expect(S[2]).toBeCloseTo(1, 10);
  });
  it('orth of a rank-2 matrix returns 2 orthonormal columns', async () => {
    const Q = await orth([
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 2],
    ]); // rank 2
    expect(Q[0]).toHaveLength(2); // 3x2
    // columns orthonormal: Q^T Q = I2
    const dot = (i: number, j: number) => Q.reduce((s, row) => s + row[i] * row[j], 0);
    expect(dot(0, 0)).toBeCloseTo(1, 8);
    expect(dot(1, 1)).toBeCloseTo(1, 8);
    expect(dot(0, 1)).toBeCloseTo(0, 8);
  });
});
```

- [ ] **Step 2: RED** (`svd`/`orth` undefined on functions). **Step 3: implement** (re-export + orth). **Step 4: GREEN** + regression. **Step 5: gate + CHANGELOG `### Added` + commit.**

---

## Release (after all 6 tasks green)

- [ ] `npx changeset` → **minor** for `@danielsimonjr/mathts-functions` (all additive + nintegrate accuracy fix). Summarize the six primitives.
- [ ] `changeset version` → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] Commit version bump, push, `changeset publish` (npm consent granted this session), push tags, **verify via independent `npm view` + a clean-install probe** of `numericJacobian`/`fsolve`/`quad`.
- [ ] Tick TODO Phase 1; footnote roadmap Phase 1 shipped; **phase-boundary check-in**, then Phase 2.

## Self-Review notes

- Task 3 (fsolve) depends on Task 1 (numericJacobian) — order preserved.
- All new functions oracle-pinned to scipy/numpy/closed forms.
- Numeric `jacobian` is additive (polymorphic dispatch) — symbolic path preserved and tested.
- No new dependencies: `svd` from matrix (already a dep), `linsolve`/`inv` already in functions.
