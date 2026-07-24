# Phase 0 — Correctness & Honesty Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every confirmed P0 correctness bug and documentation-honesty gap surfaced by the 2026-07-15 oracle-gap survey — functions that ship today, are documented (several with worked examples that are false), and return a wrong answer, `null`, or throw.

**Architecture:** Root-cause fixes in the existing `@danielsimonjr/mathts-functions` source, each pinned by an oracle-independent test (mpmath/scipy value or closed form). No new cross-package dependencies. No feature-building — missing capabilities (highpass filters, real CAS, closed-form symbolic summation) are explicitly deferred to later phases.

**Tech Stack:** TypeScript (ESM, strict), Vitest, tsup. Oracles installed: mpmath 1.3.0, scipy 1.17.1, numpy 2.3.4 (`python -c "import mpmath"` works).

## Global Constraints

- **Tests import built `dist/`, not `src/`.** After editing a package, rebuild it (`npx turbo build --filter=@danielsimonjr/mathts-functions`) before running its vitest, or the test sees stale code. Prefer `npm run test` for the affected package which goes through turbo.
- **Every fix is oracle-pinned** to an implementation-independent reference (mpmath/scipy value or closed form) — never a round-trip or `Math.*`-vs-itself.
- **No new dependencies.** In particular `functions` must NOT gain a dep on `autograd`/`tensor`. Use the in-package symbolic `derivative` (`functions/src/algebra/derivative.ts`) or forward-mode dual (`functions/src/grad-forward.ts`).
- **Fix at root cause; touch only what the bug requires.** No scope creep into adjacent functions.
- **strict + eslint zero must hold.** `npx tsc --noEmit` in the package and `eslint .` stay clean.
- **Commit footer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- **git commit hook is slow** (lint-staged + prettier); allow ~540000ms. Push direct to `main` (no PR flow); verify local==remote after each push.
- **CHANGELOG.md** `## [Unreleased]` entry per task under `### Fixed` (or `### Changed` for doc-only); **TODO.md** Phase 0 checkbox ticked as each lands.

---

## Verified reproductions (all confirmed on the current dist, 2026-07-15)

| #   | Call                                   | Actual                                                          | Correct (oracle)                                   |
| --- | -------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| 1   | `invmod(3,11)`                         | throws `_BigNumber cannot be invoked without 'new'`             | `4`                                                |
| 2   | `lambertW(-0.3,-1)`                    | throws `Too many arguments (expected 1)`                        | W₋₁(−0.3) = `-1.781337023...`                      |
| 3   | `windowFunction(8,'kaiser')`           | `[1,1,1,1,1,1,1,1]` (silent rectangular)                        | should throw (kaiser not implemented)              |
| 4   | `stiffODESolver((t,y)=>-15*y,[0,1],1)` | `[null,null]`                                                   | `y(1)=e⁻¹⁵=3.059e-7`                               |
| 5   | `summation('k','k',1,'n')`             | `0` (silent wrong; `1..10`→`55` is correct)                     | `n(n+1)/2` (deferred) — must not silently return 0 |
| 6   | `taylor('sin(x)','x',0,7)`             | `x −0.1667x³ −1.16e-6x⁴ +0.0035x⁵ +5.78x⁶ +17209x⁷`             | `x −x³/6 +x⁵/120 −x⁷/5040`                         |
| 7   | `linprog([-1,-1],[[1,1]],[1])`         | `[1,1]` (infeasible: 1+1=2 > 1)                                 | `[1,0]`, obj −1                                    |
| 8   | docs say `betainc(x, a, b)`            | impl is `betainc(a, b, x)`; `betainc(2,3,0.5)=0.6875` ✓ correct | doc must read `betainc(a, b, x)`                   |
| 9   | `factor('x^2-1')`                      | `'x^2-1'` unchanged                                             | doc line 1328 falsely claims `'(x - 1)(x + 1)'`    |

**Explicitly NOT bugs (survey mis-probes — do not "fix"):** `betainc` itself (correct for its `(a,b,x)` order; the survey passed x=3 out of range); `butter` (documented lowpass-only, no `btype` param — highpass is a Phase 6 feature); `firwin` (documented scalar-cutoff lowpass — bandpass is a Phase 6 feature).

---

### Task 1: `invmod` — BigNumber constructor called without `new`

**Files:**

- Modify: `functions/src/arithmetic/invmod.ts:85,87`
- Test: `functions/tests/invmod-correctness.test.ts` (create)

**Interfaces:**

- Consumes: public `invmod(a, b)` from `@danielsimonjr/mathts-functions`.
- Produces: nothing new; restores `invmod` for `number,number` and `BigNumber,BigNumber`.

**Root cause:** lines 85 and 87 call `BigNumber(1)` / `BigNumber(0)`. Core's `BigNumber` is a class that throws when invoked without `new`, so _every_ call throws — including the `number,number` path. The comparison helpers (`equal`/`smaller`) already coerce plain numbers (fixed earlier this session), so numeric literals are correct and simplest.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { invmod } from '../src/index.js';

describe('invmod (modular multiplicative inverse)', () => {
  it('invmod(3, 11) = 4  (3·4 = 12 ≡ 1 mod 11)', () => {
    expect(invmod(3, 11)).toBe(4);
  });
  it('invmod(7, 13) = 2', () => {
    expect(invmod(7, 13)).toBe(2);
  });
  it('invmod(15151, 15122) = 10429', () => {
    expect(invmod(15151, 15122)).toBe(10429);
  });
  it('returns NaN when a,b are not coprime (invmod(8,12))', () => {
    expect(Number.isNaN(invmod(8, 12) as number)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (`npm run test -- invmod-correctness` in `functions/`, or turbo). Expect throw `_BigNumber cannot be invoked without 'new'`.
- [ ] **Step 3: Fix** — replace `BigNumber(1)` → `1` and `BigNumber(0)` → `0` at lines 85, 87. Remove the now-unused `BigNumber` from the destructured deps and the `dependencies` array **only if** nothing else uses it (verify with a read — it is only used on 85/87). Keep the typed signatures intact.
- [ ] **Step 4: Rebuild `functions`, run — confirm GREEN.** Also run the existing arithmetic suite to catch regressions.
- [ ] **Step 5: `tsc --noEmit` + `eslint .` clean; CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 2: `lambertW` — add the documented `branch` argument (W₋₁)

**Files:**

- Modify: `functions/src/typed/special.ts:365` (`lambertWScalar`) and `:1091` (the `mathTyped` export)
- Test: `functions/tests/lambertw-branch.test.ts` (create)

**Interfaces:**

- Consumes: `lambertW(x)` and (new) `lambertW(x, branch)`.
- Produces: `lambertW(x: number, branch?: 0 | -1): number`. `branch=0` (default) unchanged principal branch; `branch=-1` the lower real branch W₋₁ on `x ∈ [−1/e, 0)`.

**Root cause:** docs (`functions.md:462,490`) promise `lambertW(x[, branch])` but the typed export only declares `number`, so a 2nd arg throws `Too many arguments`. The principal branch is already correct to 1e-16. Add W₋₁: Halley iteration seeded with the standard asymptotic `w₀ = ln(−x) − ln(−ln(−x))` for `x ∈ [−1/e, 0)`; return `NaN` outside that domain (and for `branch=-1, x≥0`).

- [ ] **Step 1: Write the failing test** (oracle via mpmath `lambertw(x,-1)`):

```ts
import { describe, it, expect } from 'vitest';
import { lambertW } from '../src/index.js';

describe('lambertW branches', () => {
  it('principal branch unchanged: lambertW(1) ≈ 0.5671432904', () => {
    expect(lambertW(1)).toBeCloseTo(0.5671432904097838, 10);
  });
  it('lower branch: lambertW(-0.3, -1) ≈ -1.7813370234', () => {
    expect(lambertW(-0.3, -1)).toBeCloseTo(-1.7813370234216279, 8);
  });
  it('lower branch: lambertW(-0.1, -1) ≈ -3.5771520640', () => {
    expect(lambertW(-0.1, -1)).toBeCloseTo(-3.577152063957297, 8);
  });
  it('W(x)·e^{W(x)} = x on the lower branch', () => {
    const w = lambertW(-0.2, -1);
    expect(w * Math.exp(w)).toBeCloseTo(-0.2, 10);
  });
  it('lower branch NaN outside [-1/e, 0)', () => {
    expect(Number.isNaN(lambertW(0.5, -1))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (throws `Too many arguments`).
- [ ] **Step 3: Fix** — add `lambertWm1Scalar(x)` (Halley, ~40 iters, converge `|Δw|<1e-15`) next to `lambertWScalar`; extend the typed export with a `'number, number'` signature dispatching branch `0`→`lambertWScalar`, `-1`→`lambertWm1Scalar`, else throw `Error('lambertW: branch must be 0 or -1')`. Keep the `number` and `Float64Array` signatures (principal branch).
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run existing special-function suite.
- [ ] **Step 5: Update the doc prose (`functions.md:490`) to state W₋₁ is `branch=-1` on `[−1/e,0)`; CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 3: `windowFunction` — throw on unknown window type (stop silent rectangular)

**Files:**

- Modify: `functions/src/typed/signal.ts:1448-1452` (the `default` case)
- Test: `functions/tests/windowfunction-unknown.test.ts` (create)

**Interfaces:**

- Consumes: `windowFunction(n, type)`.
- Produces: unchanged signature; unknown `type` now throws instead of returning ones.

**Root cause:** the `switch` `default` (shared with `'rectangular'`/`'rect'`) fills the window with `1`, so `windowFunction(8,'kaiser')` silently returns a rectangular window — a wrong result for every unimplemented type (kaiser/tukey/gaussian/blackmanharris/…). Split `rectangular`/`rect` into their own explicit case; make `default` throw. (Implementing the missing windows is Phase 6.)

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { windowFunction } from '../src/index.js';

describe('windowFunction', () => {
  it('rectangular still returns all ones', () => {
    expect(windowFunction(4, 'rectangular')).toEqual([1, 1, 1, 1]);
  });
  it('hann is correct (endpoints 0, symmetric)', () => {
    const w = windowFunction(5, 'hann');
    expect(w[0]).toBeCloseTo(0, 12);
    expect(w[2]).toBeCloseTo(1, 12);
    expect(w[4]).toBeCloseTo(0, 12);
  });
  it('throws on an unimplemented window instead of silently returning rectangular', () => {
    expect(() => windowFunction(8, 'kaiser')).toThrow(/kaiser|unknown|unsupported/i);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (`windowFunction(8,'kaiser')` returns ones, no throw).
- [ ] **Step 3: Fix** — add an explicit `case 'rectangular': case 'rect':` doing the ones fill; change `default:` to `throw new Error(\`windowFunction: unknown window type '${type}'\`)`.
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run existing signal suite (ensure no caller relied on the silent fallback — grep `windowFunction(` first).
- [ ] **Step 5: CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 4: `stiffODESolver` — route to the shipped Rosenbrock solver

**Files:**

- Modify: `functions/src/typed/numeric.ts:1319` (`stiffODESolver`)
- Test: `functions/tests/stiffodesolver-correct.test.ts` (create)

**Interfaces:**

- Consumes: `stiffODESolver(f, tspan, y0, opts?)` and `solveODE(f, tspan, y0, { method: 'Rosenbrock' })`.
- Produces: `stiffODESolver` returns the same result shape as `solveODE` (it becomes a thin wrapper selecting the Rosenbrock method).

**Root cause:** `stiffODESolver` is a fixed-step implicit-Euler implementation that returns `[null,null]` / ~71% error on `y'=−15y`. A correct L-stable stiff solver already ships: `solveODE(..., {method:'Rosenbrock'})` (ode23s). Make `stiffODESolver` delegate to it (preserving its public signature/return shape), rather than repair the dead implicit-Euler code. Read `stiffODESolver`'s current signature and return shape first; map its options onto `solveODE`'s.

- [ ] **Step 1: Write the failing test** (closed form + scipy-checked stiff system):

```ts
import { describe, it, expect } from 'vitest';
import { stiffODESolver } from '../src/index.js';

const last = (sol: { y: number[] | number[][] }) => sol.y[sol.y.length - 1];

describe('stiffODESolver', () => {
  it("scalar stiff decay y'=-15y, y(0)=1 → y(1)=e^-15", () => {
    const y1 = last(stiffODESolver((_t, y) => -15 * (y as number), [0, 1], 1)) as number;
    expect(y1).toBeCloseTo(Math.exp(-15), 8);
  });
  it("linear stiff system y'=diag(-1,-1000)y → [e^-1, ~0]", () => {
    const y = last(
      stiffODESolver((_t, s) => [-(s as number[])[0], -1000 * (s as number[])[1]], [0, 1], [1, 1])
    ) as number[];
    expect(y[0]).toBeCloseTo(Math.exp(-1), 4);
    expect(Math.abs(y[1])).toBeLessThan(1e-6);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (`[null,null]`).
- [ ] **Step 3: Fix** — reimplement `stiffODESolver` body to call the module's `solveODE` with `method:'Rosenbrock'`, forwarding `tspan`/`y0`/tolerances. If `solveODE` is not already in scope in `numeric.ts`, import it from its module (`../numeric/solveODE.js` or wherever it is exported) — verify the path. Delete the dead implicit-Euler code it replaces.
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run the ODE suites (`solveode-jspath.test.ts` + numeric).
- [ ] **Step 5: CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 5: symbolic `summation` — never silently return 0 for a symbolic bound

**Files:**

- Modify: the `summation` implementation (locate: `grep -rn "function summation\|summation:" functions/src`)
- Test: `functions/tests/summation-symbolic-bound.test.ts` (create)

**Interfaces:**

- Consumes: `summation(expr, varName, lo, hi)`.
- Produces: numeric bounds unchanged; a **symbolic** `hi`/`lo` (non-numeric) throws a clear error instead of returning `0`.

**Root cause:** `summation('k','k',1,'n')` returns `0` (a wrong answer) because the accumulation loop can't range over a symbolic bound and falls through to the initial accumulator. Numeric bounds (`1..10`→`55`) are correct. The honest Phase-0 fix is to detect a non-numeric bound and throw `Error('summation: symbolic bounds are not supported (got upper bound "n")')`. **Closed-form (Faulhaber) evaluation is deferred to Phase 8** — do NOT implement it here.

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { summation } from '../src/index.js';

describe('summation', () => {
  it('numeric bounds still work: sum k, k=1..10 = 55', () => {
    expect(summation('k', 'k', 1, 10)).toBe(55);
  });
  it('sum k^2, k=1..5 = 55', () => {
    expect(summation('k^2', 'k', 1, 5)).toBe(55);
  });
  it('throws (not 0) on a symbolic upper bound', () => {
    expect(() => summation('k', 'k', 1, 'n')).toThrow(/symbolic|not supported/i);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (returns `0`, no throw).
- [ ] **Step 3: Fix** — after resolving/parsing the bounds, guard: if either bound is not a finite number, throw the clear error before the loop.
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run the CAS suite.
- [ ] **Step 5: CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 6: `taylor` / `series` — exact coefficients via symbolic differentiation (not finite differences)

**Files:**

- Modify: `functions/src/typed/cas.ts:863` (`taylor`) and the `series` sibling if present
- Test: `functions/tests/taylor-exact.test.ts` (create)

**Interfaces:**

- Consumes: in-package `derivative` (`functions/src/algebra/derivative.ts`, exported via factories) and the expression evaluator.
- Produces: `taylor(expr, varName, x0, n)` returning the degree-`n` Taylor polynomial with coefficients exact to machine precision.

**Root cause:** `taylor` estimates `f⁽ᵏ⁾(x₀)` by **finite differences**, so coefficients past ~order 3 are garbage (`sin` x⁷ coeff off by 10⁷×). The documented example `taylor('exp(x)',…)='…x^4/24'` is false. **Fix at root: compute the k-th derivative symbolically** — repeatedly apply the in-package symbolic `derivative` to the expression AST, evaluate each at `x₀`, and divide by `k!`. `functions` already ships symbolic `derivative` and a forward-mode dual (`grad-forward.ts`); use one of those. **Do NOT add a dependency on `@danielsimonjr/mathts-autograd`** (that would be a new cross-package dep / ADR).

**Note:** decide numeric-vs-string coefficient formatting to match the existing output contract (the current fn returns a formatted string). Preserve the string-polynomial output shape; only the coefficients change from wrong to exact. Round coefficients that are within ~1e-12 of a simple rational for clean display if the existing formatter already does so — otherwise leave as evaluated floats but correct.

- [ ] **Step 1: Write the failing test** (exact known Maclaurin coefficients):

```ts
import { describe, it, expect } from 'vitest';
import { taylor } from '../src/index.js';

// helper: evaluate the returned polynomial string at a point via Function (test-only)
const evalPoly = (poly: string, x: number): number =>
  Function('x', `return ${poly.replace(/\^/g, '**')};`)(x);

describe('taylor — exact coefficients', () => {
  it('sin(x) order 7 matches x - x^3/6 + x^5/120 - x^7/5040 at several points', () => {
    const p = taylor('sin(x)', 'x', 0, 7);
    for (const x of [-0.5, 0.2, 0.9]) {
      const ref = x - x ** 3 / 6 + x ** 5 / 120 - x ** 7 / 5040;
      expect(evalPoly(p, x)).toBeCloseTo(ref, 10);
    }
  });
  it('exp(x) order 4 coefficient of x^4 is 1/24 (≈0.041667), not 0.0366', () => {
    const p = taylor('exp(x)', 'x', 0, 4);
    const ref = 1 + 0.3 + 0.3 ** 2 / 2 + 0.3 ** 3 / 6 + 0.3 ** 4 / 24;
    expect(evalPoly(p, 0.3)).toBeCloseTo(ref, 10);
  });
  it('cos(x) order 6 exact at x=1', () => {
    const p = taylor('cos(x)', 'x', 0, 6);
    const ref = 1 - 1 / 2 + 1 / 24 - 1 / 720;
    expect(evalPoly(p, 1)).toBeCloseTo(ref, 9);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (finite-difference coefficients fail the point checks).
- [ ] **Step 3: Fix** — replace the finite-difference coefficient loop with repeated symbolic `derivative` (or dual-number Taylor mode) evaluated at `x₀`, coefficient `k` = `f⁽ᵏ⁾(x₀)/k!`. Reuse the existing polynomial-string assembly.
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run the full CAS suite.
- [ ] **Step 5: Fix the false doc example (`functions.md`), CHANGELOG `### Fixed`, TODO tick, commit.**

---

### Task 7: `linprog` — stop returning infeasible optima

**Files:**

- Modify: `functions/src/typed/numeric.ts` (`linprog`, basic-variable extraction ~lines 2087-2107)
- Test: `functions/tests/linprog-feasible.test.ts` (create)

**Interfaces:**

- Consumes: `linprog(c, A_ub, b_ub)`.
- Produces: a **feasible** optimum `x` (same return shape as today).

**Root cause:** the simplex basic-variable extraction marks a column "basic" whenever it looks like a unit vector, without enforcing that each basis **row** is claimed by exactly one variable. On a degenerate optimum two structural columns share the same unit row and both read that row's RHS → both get value 1, producing an infeasible point (`linprog([-1,-1],[[1,1]],[1])`→`[1,1]`, violating `x+y≤1`). Fix: track a one-to-one **row→basic-variable** map during extraction; a variable is basic only if it owns a unique unit row, else it is nonbasic (value 0). Read the extraction loop and the tableau layout before editing.

- [ ] **Step 1: Write the failing test** (scipy `linprog(method='highs')` references):

```ts
import { describe, it, expect } from 'vitest';
import { linprog } from '../src/index.js';

const feasibleUb = (x: number[], A: number[][], b: number[]) =>
  A.every((row, i) => row.reduce((s, aij, j) => s + aij * x[j], 0) <= b[i] + 1e-9);

describe('linprog — feasibility', () => {
  it('degenerate case returns a FEASIBLE optimum (scipy: x=[1,0], obj=-1)', () => {
    const x = linprog([-1, -1], [[1, 1]], [1]) as number[];
    expect(feasibleUb(x, [[1, 1]], [1])).toBe(true); // was [1,1] (infeasible)
    expect(-(x[0] + x[1])).toBeCloseTo(-1, 6); // optimal objective
  });
  it('non-degenerate case unchanged (scipy: x=[1.8,1.4])', () => {
    const x = linprog(
      [-3, -2],
      [
        [1, 1],
        [2, 1],
      ],
      [3.2, 5]
    ) as number[];
    expect(x[0]).toBeCloseTo(1.8, 4);
    expect(x[1]).toBeCloseTo(1.4, 4);
  });
});
```

- [ ] **Step 2: Run — confirm RED** (`[1,1]`, `feasibleUb` false).
- [ ] **Step 3: Fix** — correct the extraction to a one-to-one row↔basic-var assignment (a column is basic only if it is the unique unit-vector column for its row). Do not expand scope to equality/bounds/status — that is the Phase 2 rewrite.
- [ ] **Step 4: Rebuild, run — confirm GREEN;** run the numeric/optimization suite.
- [ ] **Step 5: CHANGELOG `### Fixed`; TODO tick; commit.**

---

### Task 8: `betainc` docs — correct the argument order (impl is `(a, b, x)`)

**Files:**

- Modify: `docs/reference/functions.md:447` (and any other `betainc(x, a, b)` occurrence)
- Test: `functions/tests/betainc-order.test.ts` (create — pins the actual order so a future doc/impl drift is caught)

**Interfaces:** none changed — `betainc` is correct; only the documented signature is wrong.

**Root cause:** the function computes the regularized incomplete beta `I_x(a,b)` with signature `betainc(a, b, x)` (matching scipy), and is machine-precise (`betainc(2,3,0.5)=0.6875` = mpmath). The docs table says `betainc(x, a, b)` — a false signature that caused the survey's own mis-probe. Fix the doc; add a regression test pinning the real order.

- [ ] **Step 1: Write the test** (documents + locks the true order):

```ts
import { describe, it, expect } from 'vitest';
import { betainc } from '../src/index.js';

describe('betainc argument order is (a, b, x) — regularized I_x(a,b)', () => {
  it('betainc(2,3,0.5) = 0.6875 (mpmath)', () => {
    expect(betainc(2, 3, 0.5)).toBeCloseTo(0.6875, 12);
  });
  it('betainc(2,3,0.7) = 0.9163 (mpmath)', () => {
    expect(betainc(2, 3, 0.7)).toBeCloseTo(0.9163, 12);
  });
  it('I_x(1,1) = x (uniform)', () => {
    expect(betainc(1, 1, 0.3)).toBeCloseTo(0.3, 12);
  });
});
```

- [ ] **Step 2: Run — confirm GREEN already** (this pins current-correct behavior; the deliverable is the doc fix). If it is red, betainc regressed — stop and investigate.
- [ ] **Step 3: Fix docs** — change `betainc(x, a, b)` → `betainc(a, b, x)` at line 447 and reconcile the prose at line 482 if needed.
- [ ] **Step 4: `npm run docs:*` if functions.md feeds a generated index; verify no other doc repeats the wrong order (`grep -n "betainc(x"`).**
- [ ] **Step 5: CHANGELOG `### Fixed` (docs); TODO tick; commit.**

---

### Task 9: CAS docs — reconcile no-op functions with reality

**Files:**

- Modify: `docs/reference/functions.md` (§CAS ~L1334, §Algebra ~L1249, incl. the false `factor` example at L1328)
- No code (implementation is Phase 8); no test (doc-only) — instead add a short `functions/tests/cas-noop-documented.test.ts` that documents current behavior so Phase 8 has a red-to-green target.

**Interfaces:** none changed.

**Root cause:** `factor`/`casFactor`, `expand`/`casExpand`, `apart`, `together`, and symbolic `integrate` beyond the power rule return their **input unchanged** (or an unevaluated `integral(...)` marker), but the docs present worked examples that imply they transform the input (e.g. `factor('x^2 - 1'); // '(x - 1)(x + 1)'`). This is an honesty gap. Reconcile the docs: mark these as **not yet implemented / pass-through** with a pointer to the roadmap, and remove or clearly annotate the false worked examples. (Real implementations are Phase 8.)

- [ ] **Step 1: Add a behavior-documenting test** (asserts the _current_ pass-through so Phase 8 flips it):

```ts
import { describe, it, expect } from 'vitest';
import { factor, casExpand, apart } from '../src/index.js';

// NOTE: these functions are pass-through today (Phase 8 will implement them).
// This test documents current behavior; when Phase 8 lands, update the expectations.
describe('CAS transforms are pass-through today (documented limitation)', () => {
  it('factor is a no-op pending Phase 8', () => {
    expect(factor('x^2-1')).toBe('x^2-1');
  });
  it('casExpand is a no-op pending Phase 8', () => {
    expect(casExpand('(x+1)^3')).toBe('(x+1)^3');
  });
  it('apart is a no-op pending Phase 8', () => {
    expect(apart('1/(x^2-1)')).toBe('1/(x^2-1)');
  });
});
```

- [ ] **Step 2: Run — confirm GREEN** (documents reality).
- [ ] **Step 3: Edit the docs** — in §CAS/§Algebra, replace the false worked examples with an explicit "⚠️ pass-through — full symbolic transform planned (roadmap Phase 8)" note for `factor`/`expand`/`apart`/`together`/non-power-rule `integrate`. Keep the entries listed (they exist) but stop claiming outputs they don't produce.
- [ ] **Step 4: Regenerate any generated doc index; verify no remaining false CAS example (`grep -n "(x - 1)(x + 1)"`).**
- [ ] **Step 5: CHANGELOG `### Changed` (docs honesty); TODO tick; commit.**

---

## Release (after all 9 tasks green)

- [ ] `npx changeset` — a **patch** for `@danielsimonjr/mathts-functions` (bug fixes + doc honesty; no API break — Task 2 adds an optional arg, Task 4 preserves signature). Summarize the 9 fixes.
- [ ] `npx changeset version` → rebuild → verify full `functions` suite + `npm run typecheck` (28/28) + `eslint .` green.
- [ ] Commit the version bump; **publishing to npm requires explicit user consent** (was granted for this session) — `npx changeset publish`, push tags, verify `npm view @danielsimonjr/mathts-functions version` matches.
- [ ] **Phase boundary check-in:** report the 9 fixes + release, then proceed to Phase 1 planning.

## Self-Review notes

- **Spec coverage:** all 9 items map to the Phase 0 row in `docs/roadmap/ORACLE_GAP_INVENTORY_2026-07-15.md`. The roadmap's `betainc`/`butter`/`firwin` P0 entries were **downgraded after live re-verification** (betainc → doc-only Task 8; butter/firwin → Phase 6 features, not bugs); the roadmap will be footnoted to reflect this at phase close.
- **No placeholders:** every task has a concrete oracle-pinned test and a root cause with file:line.
- **Type consistency:** Task 4 keeps `stiffODESolver`'s return shape (`{ t, y }`); Task 2 adds an optional 2nd arg without breaking `lambertW(x)`.
