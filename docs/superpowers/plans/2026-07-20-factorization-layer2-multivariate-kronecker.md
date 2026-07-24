# Factorization Layer 2 — Multivariate over ℤ via Kronecker Substitution — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Steps use `- [ ]` checkboxes. See ADR in
> `docs/superpowers/specs/2026-07-20-multivariate-factorization-design.md` §5a.

**Goal:** Factor multivariate (n ≥ 2 variables) integer polynomials completely into
irreducible factors over ℤ/ℚ, by reducing to the shipped Layer 1 univariate engine
via **Kronecker substitution**.

**Architecture:** Add to `functions/src/typed/factorization/`. A `MultiPoly` (sparse
distributed, bigint) supports substitution `xₖ ↦ x^{bₖ}` to a univariate `IntPoly`,
factorization of that image by `factorUnivariateZ` (Layer 1), and recombination by
back-substitution + multivariate exact division. `algebra.ts` `factor()` routes the
≥2-variable case into it, keeping existing multivariate fast-paths.

**Tech Stack:** TypeScript strict, ESM `.js` imports, vitest, `bigint`. Oracle: sympy
`factor_list` (1.14.0).

## Global Constraints

- **bigint only** in the engine. `.js` imports, `kebab-case.ts`, strict, eslint zero,
  no `any`/`@ts-ignore`/`eslint-disable`.
- **Correctness via division:** a candidate is a factor **iff** it exactly divides
  (multivariate) — never emit an unverified factor.
- **Degree cap** `KRONECKER_MAX_DEGREE = 2000` and subset-count cap (reuse Layer 1's
  spirit): beyond the cap, return via existing fast-paths + `log()` — no silent wrong
  answer, no hang.
- **No regression:** existing `factor`/`casFactor` multivariate outputs
  (`x^2*y+x*y^2 → x*y*(x+y)`, `4*x^2-9*y^2 → (2*x-3*y)*(2*x+3*y)`, irreducibles
  unchanged) must stay correct; the `cas-multivariate`/`algebra`/`cas` suites are the
  gate (numeric + oracle based). Run before and after.
- **Oracle equality = canonical factor-SET equality** (content/sign-normalized,
  sorted), not string identity with sympy.
- Commit footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` +
  `Claude-Session:`. `git commit` timeout ~540000ms; verify push L==R.

## Verified current state (2026-07-20)

- Layer 1 shipped `functions@0.58.0`: `factorUnivariateZ(f: IntPoly): { constant: bigint;
factors: Array<{ poly: IntPoly; mult: number }> }` in
  `functions/src/typed/factorization/zassenhaus.ts`; `IntPoly = bigint[]` +
  ops in `integer-poly.ts`.
- `algebra.ts`: `factorMultivariate(expr, vars)` (content/monomial/diff-of-squares,
  returns null when nothing beyond content); `factor()` routes ≥2 vars there first.
  Multivariate parse `polyFromExpression(expr, vars): Poly` (Poly = array of
  `{coeff: number; powers: number[]}`); render `idealPolyToString(poly, vars)` from
  `polynomial-ideal.ts`.
- Oracle: `python -c "import sympy"` → 1.14.0.

---

### Task 1: `multi-poly.ts` — sparse multivariate poly over bigint

**Files:** Create `functions/src/typed/factorization/multi-poly.ts`; Test
`functions/tests/factorization/multi-poly.test.ts`.

**Produces:**

- `type MultiPoly = { vars: string[]; terms: Map<string, bigint> }` — `terms` keys are
  the exponent vector encoded as a stable string (e.g. exponents joined by `,`); zero
  coefficients pruned. Provide `key(exps: number[]): string` / `unkey(k): number[]`.
- `zeroPoly(vars)`, `constPoly(vars, c: bigint)`, `fromTerms(vars, entries: Array<[number[], bigint]>)`.
- `degreeIn(p, varIndex): number`, `totalDegree(p): number`, `isZero(p): boolean`,
  `equals(a, b): boolean` (same vars).
- `addMP(a,b)`, `subMP(a,b)`, `mulMP(a,b)`, `scalarMulMP(p, k: bigint)`, `negMP(p)`.
- `integerContentMP(p): bigint` (non-negative gcd of coeffs), `primitivePartMP(p): MultiPoly`
  (divide content, make the leading term — by the canonical monomial order below —
  positive).
- `canonicalCompare(expsA, expsB): number` — a total monomial order (degree-lex:
  higher total degree first, then lexicographic by exponent vector). `leadingTerm(p)`
  uses it.

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import {
  fromTerms,
  addMP,
  mulMP,
  degreeIn,
  totalDegree,
  integerContentMP,
  primitivePartMP,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('multi-poly core', () => {
  it('adds and multiplies', () => {
    // (x + y)(x - y) = x^2 - y^2
    const a = mp([
      [[1, 0], 1],
      [[0, 1], 1],
    ]);
    const b = mp([
      [[1, 0], 1],
      [[0, 1], -1],
    ]);
    expect(
      equals(
        mulMP(a, b),
        mp([
          [[2, 0], 1],
          [[0, 2], -1],
        ])
      )
    ).toBe(true);
    expect(equals(addMP(a, b), mp([[[1, 0], 2]]))).toBe(true);
  });
  it('degrees', () => {
    const p = mp([
      [[2, 0], 1],
      [[0, 3], 1],
    ]); // x^2 + y^3
    expect(degreeIn(p, 0)).toBe(2);
    expect(degreeIn(p, 1)).toBe(3);
    expect(totalDegree(p)).toBe(3);
  });
  it('content and primitive part', () => {
    const p = mp([
      [[2, 0], 2],
      [[0, 0], -2],
    ]); // 2x^2 - 2
    expect(integerContentMP(p)).toBe(2n);
    expect(
      equals(
        primitivePartMP(p),
        mp([
          [[2, 0], 1],
          [[0, 0], -1],
        ])
      )
    ).toBe(true);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `cd functions && npx tsc --noEmit` +
      eslint → commit `feat(functions): sparse multivariate bigint poly (MultiPoly)`.

---

### Task 2: `multi-poly.ts` — exact division + string bridge

**Files:** Modify `multi-poly.ts`; Test `functions/tests/factorization/multi-poly-div.test.ts`.

**Consumes:** Task 1. **Produces:**

- `multiExactDivide(a, b): MultiPoly | null` — multivariate polynomial division; returns
  the quotient iff `b` divides `a` exactly over ℤ (using `canonicalCompare` leading
  terms and exact bigint coefficient division; return null on any non-integral step or
  nonzero remainder). This is the recombination arbiter.
- `fromAlgebraExpr(expr: string, vars: string[]): MultiPoly | null` — parse via algebra's
  `polyFromExpression`, convert each `{coeff, powers}` to a `MultiPoly` term ONLY if
  every coeff is an exact integer, else null.
- `toAlgebraString(p: MultiPoly): string` — render via the existing `polynomial-ideal`
  `polyToString`/`idealPolyToString` so output matches the multivariate factor style
  already used by `factor()`.

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import {
  fromTerms,
  mulMP,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
import { multiExactDivide, fromAlgebraExpr } from '../../src/typed/factorization/multi-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('multi-poly division + bridge', () => {
  it('divides exactly or returns null', () => {
    const xmy = mp([
      [[1, 0], 1],
      [[0, 1], -1],
    ]); // x - y
    const xpy = mp([
      [[1, 0], 1],
      [[0, 1], 1],
    ]); // x + y
    const prod = mulMP(xmy, xpy); // x^2 - y^2
    expect(equals(multiExactDivide(prod, xmy)!, xpy)).toBe(true);
    // (x^2 - y^2) / (x + 2y) is not exact
    const xp2y = mp([
      [[1, 0], 1],
      [[0, 1], 2],
    ]);
    expect(multiExactDivide(prod, xp2y)).toBeNull();
  });
  it('parses an integer multivariate expression', () => {
    const p = fromAlgebraExpr('x^2 - y^2', ['x', 'y'])!;
    expect(
      equals(
        p,
        mp([
          [[2, 0], 1],
          [[0, 2], -1],
        ])
      )
    ).toBe(true);
    expect(fromAlgebraExpr('0.5*x', ['x', 'y'])).toBeNull(); // non-integer
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + tsc + eslint → commit
      `feat(functions): multivariate exact division + algebra string bridge`.

---

### Task 3: `kronecker.ts` — substitution + back-substitution

**Files:** Create `functions/src/typed/factorization/kronecker.ts`; Test
`functions/tests/factorization/kronecker.test.ts`.

**Consumes:** Tasks 1–2, `integer-poly.ts` (`IntPoly`). **Produces:**

- `substitutionBases(p: MultiPoly): bigint[]` — `b₀=1`, `bₖ = ∏_{i<k}(degreeIn(p,i)+1)`
  as bigint (one per variable).
- `substitute(p: MultiPoly, bases: bigint[]): IntPoly` — evaluate `xₖ ↦ x^{bₖ}` producing
  a univariate `IntPoly` (sum coeff·x^{Σ expᵢ·bᵢ}).
- `backSubstitute(u: IntPoly, bases: bigint[], degBounds: number[], vars: string[]): MultiPoly | null`
  — invert: each univariate exponent `e` decomposes in mixed radix
  `(degBounds[i]+1)` to an exponent vector; **return null** if any recovered
  per-variable exponent exceeds `degBounds[i]` (invalid carry ⇒ not a genuine
  back-substitution of a factor). degBounds are the per-variable degrees of the ORIGINAL
  polynomial.
- `substitutedDegree(p): bigint` — `Σ degreeIn(p,i)·bases[i]` (the univariate degree; for
  the cap check).

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { fromTerms, equals, type MultiPoly } from '../../src/typed/factorization/multi-poly.js';
import {
  substitutionBases,
  substitute,
  backSubstitute,
} from '../../src/typed/factorization/kronecker.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('Kronecker substitution', () => {
  it('substitute then back-substitute is identity on a valid poly', () => {
    // x^2 - y^2, deg_x=2 deg_y=2 -> bases [1, 3]; F(x) = x^2 - x^6
    const p = mp([
      [[2, 0], 1],
      [[0, 2], -1],
    ]);
    const bases = substitutionBases(p);
    expect(bases.map(String)).toEqual(['1', '3']);
    const F: IntPoly = substitute(p, bases); // degree 6
    const back = backSubstitute(F, bases, [2, 2], ['x', 'y']);
    expect(back).not.toBeNull();
    expect(equals(back!, p)).toBe(true);
  });
  it('rejects a univariate factor whose back-substitution carries out of range', () => {
    // bases [1,3], degBounds [2,2]: exponent 3 -> [0,1] ok; exponent 9 -> [0,3] deg_y=3>2 -> null
    // Build F with an x^9 term to force an invalid carry.
    // (representing 9 in radix (3,3): 9 = 0 + 3*3 -> [0,3], out of range)
    const bases = [1n, 3n];
    const F: IntPoly = new Array(10).fill(0n);
    F[9] = 1n;
    F[0] = 1n;
    expect(backSubstitute(F, bases, [2, 2], ['x', 'y'])).toBeNull();
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + tsc + eslint → commit
      `feat(functions): Kronecker substitution + carry-checked back-substitution`.

---

### Task 4: `kronecker-factor.ts` — multivariate factorization orchestration

**Files:** Create `functions/src/typed/factorization/kronecker-factor.ts`; Test
`functions/tests/factorization/kronecker-factor.test.ts`.

**Consumes:** Tasks 1–3, `zassenhaus.ts` (`factorUnivariateZ`). **Produces:**

- `type MultiFactorization = { constant: bigint; factors: Array<{ poly: MultiPoly; mult: number }> }`
- `factorMultivariateKronecker(p: MultiPoly): MultiFactorization | null` — returns null
  (decline) when it cannot help (single variable, degree cap exceeded → caller keeps
  existing behavior). Pipeline:
  1. Pull integer content/sign → primitive `g`.
  2. `bases = substitutionBases(g)`; if `substitutedDegree(g) > KRONECKER_MAX_DEGREE`
     (2000n) → `log()` + return null.
  3. `F = substitute(g, bases)`; `uf = factorUnivariateZ(F)`.
  4. If `uf.factors.length ≤ 1` → `g` is irreducible → return `{constant, factors:[{g,1}]}`.
  5. **Recombination:** treat `uf.factors` as a pool (expanded by multiplicity into a
     list of univariate irreducibles). For subset sizes 1,2,…: for each subset, form the
     univariate product, `backSubstitute` (with `degBounds = deg_i(g)`); skip null
     (invalid carry); `multiExactDivide(gCur, cand)` — if it divides, record
     `primitivePartMP(cand)`, divide out repeatedly to capture multiplicity, remove the
     subset from the pool, continue. Leftover cofactor (if non-constant) is the final
     factor. Subset-count cap identical to Layer 1 (24) → beyond, return the level whole
     - log.
  6. Sort factors canonically; positive leading term.

The test file below is the contract. Values are pinned to sympy `factor_list`; compare by
canonical factor-SET equality (a helper builds expected `MultiPoly`s and checks the
multiset).

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import {
  fromAlgebraExpr,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
import { factorMultivariateKronecker } from '../../src/typed/factorization/kronecker-factor.js';

// factor-set equality up to order and per-factor sign/content normalization
function sameFactorSet(got: MultiPoly[], expectedExprs: string[], vars: string[]): boolean {
  const exp = expectedExprs.map((e) => fromAlgebraExpr(e, vars)!);
  if (got.length !== exp.length) return false;
  const used = new Array(exp.length).fill(false);
  for (const g of got) {
    let hit = -1;
    for (let i = 0; i < exp.length; i++) {
      if (!used[i] && (equals(g, exp[i]) || equals(g, negate(exp[i])))) {
        hit = i;
        break;
      }
    }
    if (hit < 0) return false;
    used[hit] = true;
  }
  return true;
}
function negate(p: MultiPoly): MultiPoly {
  return { vars: p.vars, terms: new Map([...p.terms].map(([k, v]) => [k, -v])) };
}

const F = (expr: string, vars: string[]) => {
  const r = factorMultivariateKronecker(fromAlgebraExpr(expr, vars)!);
  return { r, vars };
};

describe('factorMultivariateKronecker (sympy-pinned)', () => {
  it('x^2 - y^2 = (x-y)(x+y)', () => {
    const { r } = F('x^2 - y^2', ['x', 'y']);
    expect(r).not.toBeNull();
    expect(r!.factors.map((f) => f.mult)).toEqual([1, 1]);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x - y', 'x + y'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('(x+y+1)(x+2y+3) expanded', () => {
    const { r } = F('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3', ['x', 'y']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y + 1', 'x + 2*y + 3'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('x^2*y + x*y^2 + x + y = (x+y)(x*y+1)', () => {
    const { r } = F('x^2*y + x*y^2 + x + y', ['x', 'y']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y', 'x*y + 1'],
        ['x', 'y']
      )
    ).toBe(true);
  });
  it('(x+y)^2 (x+2y): multiplicity', () => {
    const { r } = F('x^3 + 4*x^2*y + 5*x*y^2 + 2*y^3', ['x', 'y']);
    const byMult = Object.fromEntries(r!.factors.map((f) => [f.mult, f.poly] as const));
    expect(new Set(r!.factors.map((f) => f.mult))).toEqual(new Set([1, 2]));
    expect(equals(byMult[2], fromAlgebraExpr('x + y', ['x', 'y'])!)).toBe(true);
    expect(equals(byMult[1], fromAlgebraExpr('x + 2*y', ['x', 'y'])!)).toBe(true);
  });
  it('irreducible x^2 + y^2 stays whole (single factor)', () => {
    const { r } = F('x^2 + y^2', ['x', 'y']);
    expect(r!.factors.length).toBe(1);
    expect(r!.factors[0].mult).toBe(1);
  });
  it('three variables: (x+y+z)(x-y+z)', () => {
    const { r } = F('x^2 + 2*x*z - y^2 + z^2', ['x', 'y', 'z']);
    expect(
      sameFactorSet(
        r!.factors.map((f) => f.poly),
        ['x + y + z', 'x - y + z'],
        ['x', 'y', 'z']
      )
    ).toBe(true);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + engine regression
      `npx vitest run functions/tests/factorization/` + tsc + eslint. **Extra (RFL Rule 4):**
      throwaway sympy cross-check on 6+ more multivariate polys (incl. a non-primitive
      `2*x^2*y-2*y` → `2*y*(x-1)*(x+1)`, a 3-var product, a repeated multivariate factor, and
      an irreducible) by canonical factor-set equality; delete after; report counts; BLOCKED
      if any disagree. Commit `feat(functions): multivariate factorization via Kronecker`.

---

### Task 5: `algebra.ts` routing + regression

**Files:** Modify `functions/src/typed/algebra.ts` (`factor()` multivariate branch);
possibly `functions/src/typed/factorization/index.ts` (export a string entry
`factorMultivariateString(expr, vars): string | null`); Test
`functions/tests/factorization/factor-multivariate-integration.test.ts`.

**Consumes:** Task 4. **Produces:** route `factor()`'s ≥2-variable branch: keep the
existing `factorMultivariate` fast-path output for the exact cases it already handles
(content/monomial/diff-of-squares); when it returns null OR leaves a cofactor unfactored,
run `factorMultivariateKronecker` on the primitive polynomial and render its factorization
via `toAlgebraString` if it yields >1 factor. If Kronecker declines (null), fall back to
the exact current behavior. Update the `factor` docstring + `factorMultivariate` "OUT OF
SCOPE" note.

**Regression gate:** record then re-run
`npx vitest run functions/tests/algebra.test.ts functions/tests/cas.test.ts functions/tests/cas-multivariate.test.ts functions/tests/cas-engine.test.ts functions/tests/cas-passthrough-documented.test.ts functions/tests/cov-cas.test.ts functions/tests/gap-algebra-cas-oracle.test.ts functions/tests/gap-cas-sympy-oracle.test.ts`
— ALL must stay green. These assert by numeric evaluation / sympy oracle, so a correct
new factorization passes; if any test pinned the OLD "unchanged/unfactored" multivariate
output as a hardcoded string, update it to the new correct behavior verified against
sympy (note it as an improvement). Do NOT weaken genuine correctness assertions.

- [ ] **Step 1 failing test** (new capability + regression byte-identical for fast-paths):

```ts
import { describe, it, expect } from 'vitest';
import { factor, evaluate } from '../../src/index.js';
const at = (e: string, vals: Record<string, number>) => evaluate(e, vals) as number;

describe('factor() — multivariate irreducible factorization', () => {
  it('factors what the old path left whole (numeric-verified)', () => {
    const f = factor('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3'); // (x+y+1)(x+2y+3)
    expect(f).not.toBe('x^2 + 3*x*y + 4*x + 2*y^2 + 5*y + 3');
    for (const [x, y] of [
      [2, 3],
      [-1, 4],
      [0.5, -2],
    ]) {
      expect(at(f, { x, y })).toBeCloseTo((x + y + 1) * (x + 2 * y + 3), 6);
    }
  });
  it('regression: existing multivariate fast-paths byte-identical', () => {
    expect(factor('x^2*y + x*y^2')).toBe('x*y*(x + y)');
    expect(factor('4*x^2 - 9*y^2')).toBe('(2*x - 3*y)*(2*x + 3*y)');
  });
  it('irreducible multivariate returned unchanged', () => {
    expect(factor('x^2 + y^2')).toBe('x^2 + y^2');
  });
});
```

> If a fast-path literal above differs from the engine's actual byte output, first
> confirm the CURRENT `factor()` output by running it, and pin the literal to the CURRENT
> value (this test guards no-regression). Never weaken to a non-string check to dodge a
> mismatch — match the real current output.

- [ ] **Steps 2–5:** RED → implement → full regression GREEN + engine suite + tsc +
      eslint → commit `feat(functions): route factor() into multivariate Kronecker engine`.

---

### Task 6: Release Layer 2

**Files:** `algebra.ts`/`cas.ts` docstrings; `docs/reference/functions.md` factor entry;
root `CHANGELOG.md`; `TODO.md`; `.changeset/*`.

- [ ] Docstrings + `docs/reference/functions.md`: multivariate factorization is now
      **complete over ℤ/ℚ via Kronecker** (note the degree cap + Wang/EEZ as future perf
      work). Verify claims with `honest-claude`.
- [ ] Root `CHANGELOG.md` `### feat(functions)` under `[Unreleased]`.
- [ ] `TODO.md`: #7 COMPLETE (both layers); update the A-list banner.
- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`.
- [ ] version → build → full `functions` suite + monorepo `typecheck` + `eslint .` green.
- [ ] commit, push (verify L==R), `changeset publish`, **verify** `npm view` + clean
      tarball probe factoring `(x+y+1)(x+2y+3)`.

---

## Self-Review

- **Spec coverage:** Tasks 1–2 = MultiPoly + exact division + bridge (§5a steps 1,5,6);
  Task 3 = substitution/back-substitution (§5a steps 2,4); Task 4 = orchestration +
  recombination + caps (§5a steps 3–5); Task 5 = routing (§2, §6 regression); Task 6 =
  release (§9). Wang/EEZ (§5b) is explicitly NOT in scope.
- **bigint** stated globally and per engine task.
- **Correctness-by-division** is the arbiter in Tasks 2 & 4 — no unverified factor.
- **Caps** (degree 2000, subset 24) prevent blowup/hang with a logged notice.
- **Type consistency:** `MultiPoly` (Task 1) used throughout; `multiExactDivide` (Task 2)
  consumed by recombination (Task 4); `substitute`/`backSubstitute` (Task 3) consumed by
  Task 4; `factorMultivariateKronecker` (Task 4) consumed by Task 5.
- **Oracle values** in Task 4 pinned to sympy 1.14.0 output.
- **Regression** is the explicit gate in Task 5 (numeric/oracle-based existing suites).
