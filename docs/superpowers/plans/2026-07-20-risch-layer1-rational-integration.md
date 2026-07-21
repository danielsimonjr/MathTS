# Risch Layer 1 — Rational-Function Integration — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Steps use `- [ ]` checkboxes. See `docs/superpowers/specs/2026-07-20-risch-integration-design.md`.

**Goal:** `symbolicIntegral`/`integrate` integrate any rational function `p(x)/q(x)` over ℚ
in closed form when `q` factors into linear + irreducible-quadratic factors — producing the
rational part + `log` + `arctan` — closing the irreducible-quadratic-denominator gap. Degree-≥3
irreducible denominators keep returning the `integral(...)` marker (Layer 2).

**Architecture:** New `functions/src/cas/rational-integrate.ts` reusing the #7 factorization
engine (`factorUnivariateZ`, `IntPoly`) to factor the denominator, exact-ℚ partial fractions,
and per-factor closed-form integration. `symbolicIntegral` (`cas-integration.ts`) routes rational
functions it currently declines into it.

**Tech Stack:** TypeScript strict, ESM `.js` imports, vitest. Exact rational arithmetic
(`bigint` num/den) internally. Oracle: sympy `integrate`, **verified by differentiating the
result** (`d/dx F == f`).

## Global Constraints

- Exact rational (`bigint` numerator/denominator) through parse → division → partial-fraction
  solve; surds appear only in the final `sqrt(...)` rendering.
- `.js` imports, `kebab-case.ts`, strict, eslint zero, no `any`/`@ts-ignore`/`eslint-disable`.
- **Correctness by differentiation:** every produced antiderivative `F` must satisfy `dF/dx == f`
  (checked numerically at sample points in tests; the exact string form is NOT contractual).
- **No regression:** every input the current `symbolicIntegral` integrates must still yield a
  differentiation-correct antiderivative. The existing integration/cas suites are the gate.
- Degree-≥3 irreducible denominator ⇒ return the existing `integral(expr, v)` marker (no wrong
  answer). Non-rational input ⇒ engine declines, existing paths handle it.
- Commit footer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session:`.
  Pre-commit hook ~9min — RUN COMMITS IN BACKGROUND and confirm via `git log` before reporting.
  Verify each push L==R.

## Verified current state (2026-07-20)

- `functions/src/cas-integration.ts` `symbolicIntegral(expr, variable='x')`: power rule,
  linearity, `1/x`, linear-substitution, partial fractions **for distinct rational linear
  factors**, tabular by-parts; returns `integral(expr,v)` marker on irreducible quadratics /
  general Risch. `functions/src/typed/algebra.ts` has `apart` (line ~1306) — reference for the
  existing partial-fraction + rational rendering conventions.
- #7 engine: `functions/src/typed/factorization/zassenhaus.ts` `factorUnivariateZ(f: IntPoly):
{ constant: bigint; factors: Array<{ poly: IntPoly; mult: number }> }`; `integer-poly.ts`
  `IntPoly = bigint[]` + ops.
- Oracle (differentiation-verified): `1/(x^2+1)→atan(x)`, `(3x+2)/(x^2+1)→(3/2)log(x^2+1)+2atan(x)`,
  `1/((x-1)^2(x+2))→ -1/9 log(x-1)+1/9 log(x+2) - 1/(3(x-1))`, `x^3/(x^2+1)→ x^2/2 - (1/2)log(x^2+1)`,
  `x/(x^2+1)^2→ -1/(2(x^2+1))`.

---

### Task 1: `rational-integrate.ts` — parse, normalize, polynomial part

**Files:** Create `functions/src/cas/rational-integrate.ts`; Test
`functions/tests/rational-integrate.test.ts`.

**Produces:**

- `type Rat = { num: bigint; den: bigint }` with exact ops (`ratAdd/Mul/Div`, normalize to
  lowest terms, positive den), OR reuse an existing exact-rational helper if one is already in
  the repo (grep first; do not duplicate).
- `type RatFunc = { numer: bigint[]; denom: bigint[] }` — numerator/denominator as `IntPoly`
  (integer dense, index=degree) after clearing rational coefficients to integers.
- `parseRationalFunction(expr: string, v: string): RatFunc | null` — parse a single-variable
  expression into `numer/denom` integer polynomials; return `null` if it is not a rational
  function of `v` (contains `sin`/`exp`/etc., multiple variables, or non-integer-after-clearing).
  Reuse algebra's `polyFromExpression`/`polyToDense` where possible.
- `polynomialPart(rf: RatFunc): { quotient: bigint[]; remainder: bigint[] }` — divide
  numer by denom (integer/rational long division) so `numer = quotient·denom + remainder`,
  `deg remainder < deg denom`.
- `integratePolynomial(p: bigint[], v: string): string` — termwise power rule (`x^n → x^(n+1)/(n+1)`).

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import {
  parseRationalFunction,
  polynomialPart,
  integratePolynomial,
} from '../src/cas/rational-integrate.js';

describe('rational-integrate: parse + polynomial part', () => {
  it('parses a rational function to integer numer/denom', () => {
    const rf = parseRationalFunction('(3*x+2)/(x^2+1)', 'x')!;
    expect(rf.numer).toEqual([2n, 3n]); // 2 + 3x
    expect(rf.denom).toEqual([1n, 0n, 1n]); // 1 + x^2
  });
  it('declines non-rational input', () => {
    expect(parseRationalFunction('sin(x)/x', 'x')).toBeNull();
  });
  it('splits the polynomial part: x^3/(x^2+1) = x + (-x)/(x^2+1)', () => {
    const rf = parseRationalFunction('x^3/(x^2+1)', 'x')!;
    const { quotient, remainder } = polynomialPart(rf);
    expect(quotient).toEqual([0n, 1n]); // x
    expect(remainder).toEqual([0n, -1n]); // -x
  });
  it('integrates a polynomial termwise', () => {
    // x -> x^2/2 ; the exact rendered form is checked by the integration suite,
    // here assert a differentiation-independent structural fact:
    expect(integratePolynomial([0n, 1n], 'x')).toContain('x^2');
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `cd functions && npx tsc --noEmit` + eslint →
      commit `feat(functions): rational-function parse + polynomial-part division`.

---

### Task 2: denominator factorization into linear + quadratic factors

**Files:** Modify `rational-integrate.ts`; Test `functions/tests/rational-integrate-factor.test.ts`.

**Consumes:** Task 1, `factorUnivariateZ`. **Produces:**

- `type DenFactor = { poly: bigint[]; mult: number; kind: 'linear' | 'quadratic' };`
- `factorDenominator(denom: bigint[]): DenFactor[] | null` — factor `denom` via
  `factorUnivariateZ`; classify each irreducible factor by degree (1 → linear, 2 → quadratic
  with negative discriminant; a degree-2 with a rational root would already be split into
  linears by `factorUnivariateZ`, so a surviving degree-2 factor IS irreducible). If ANY
  irreducible factor has degree ≥ 3, return `null` (caller falls back to the marker).

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { factorDenominator } from '../src/cas/rational-integrate.js';

describe('rational-integrate: denominator factorization', () => {
  it('x^3 + x = x(x^2+1): one linear, one quadratic', () => {
    const fs = factorDenominator([0n, 1n, 0n, 1n])!; // x + x^3
    const kinds = fs.map((f) => f.kind).sort();
    expect(kinds).toEqual(['linear', 'quadratic']);
  });
  it('(x-1)^2 (x+2): repeated linear', () => {
    // (x-1)^2 (x+2) = x^3 - 3x + 2
    const fs = factorDenominator([2n, -3n, 0n, 1n])!;
    const lin = fs.find((f) => f.mult === 2)!;
    expect(lin.kind).toBe('linear');
    expect(lin.poly).toEqual([-1n, 1n]); // x - 1
  });
  it('declines a degree-3 irreducible denominator (Layer-2 boundary)', () => {
    // x^3 - 2 is irreducible over Q
    expect(factorDenominator([-2n, 0n, 0n, 1n])).toBeNull();
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + tsc + eslint → commit
      `feat(functions): classify rational denominator factors (linear/quadratic)`.

---

### Task 3: exact-ℚ partial fraction decomposition

**Files:** Modify `rational-integrate.ts`; Test `functions/tests/rational-integrate-apart.test.ts`.

**Consumes:** Tasks 1–2. **Produces:**

- `type PFTerm = { factor: bigint[]; power: number; numer: Rat[] };` — a term
  `numer(x) / factor^power`, `numer` a `Rat[]` of length `deg(factor)` (constant over a linear
  factor, `[E, D]` = `Dx+E` over a quadratic).
- `partialFractions(remainder: bigint[], factors: DenFactor[]): PFTerm[]` — set up and solve the
  exact rational linear system for the partial-fraction coefficients (`remainder/∏factorᵢ^mult`).
  Solve by equating coefficients (build the `deg denom`-square rational matrix, Gaussian
  elimination over `Rat`). Deterministic.

- [ ] **Step 1 failing test** (verify by RECONSTRUCTION — sum of PF terms == remainder/denom):

```ts
import { describe, it, expect } from 'vitest';
import {
  parseRationalFunction,
  polynomialPart,
  factorDenominator,
  partialFractions,
} from '../src/cas/rational-integrate.js';

// Evaluate the PF decomposition numerically and compare to remainder/denom.
function pfValue(terms: ReturnType<typeof partialFractions>, x: number): number {
  let s = 0;
  for (const t of terms) {
    let n = 0;
    for (let i = t.numer.length - 1; i >= 0; i--)
      n = n * x + Number(t.numer[i].num) / Number(t.numer[i].den);
    let f = 0;
    for (let i = t.factor.length - 1; i >= 0; i--) f = f * x + Number(t.factor[i]);
    s += n / Math.pow(f, t.power);
  }
  return s;
}
const polyVal = (p: bigint[], x: number) => {
  let s = 0;
  for (let i = p.length - 1; i >= 0; i--) s = s * x + Number(p[i]);
  return s;
};

describe('rational-integrate: partial fractions (exact Q)', () => {
  it('(3x+2)/(x^2+1): single quadratic term equals the input', () => {
    const rf = parseRationalFunction('(3*x+2)/(x^2+1)', 'x')!;
    const { remainder } = polynomialPart(rf);
    const terms = partialFractions(remainder, factorDenominator(rf.denom)!);
    for (const x of [0.3, 2, -1.5])
      expect(pfValue(terms, x)).toBeCloseTo(polyVal(remainder, x) / polyVal(rf.denom, x), 8);
  });
  it('1/((x-1)^2 (x+2)) reconstructs', () => {
    const rf = parseRationalFunction('1/((x-1)^2*(x+2))', 'x')!;
    const { remainder } = polynomialPart(rf);
    const terms = partialFractions(remainder, factorDenominator(rf.denom)!);
    for (const x of [0.3, 2, 3.5])
      expect(pfValue(terms, x)).toBeCloseTo(polyVal(remainder, x) / polyVal(rf.denom, x), 8);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + tsc + eslint → commit
      `feat(functions): exact rational partial-fraction decomposition`.

---

### Task 4: per-factor closed-form integration

**Files:** Modify `rational-integrate.ts`; Test `functions/tests/rational-integrate-terms.test.ts`.

**Consumes:** Tasks 1–3. **Produces:**

- `integratePFTerm(term: PFTerm, v: string): string` — closed form:
  - **linear `x−a`, power 1:** `A·log(|x−a|)` (render `A*log(x - a)` in existing style).
  - **linear, power k>1:** `−A/((k−1)(x−a)^{k−1})`.
  - **quadratic `x²+bx+c` (disc<0), power 1:** split `Dx+E = (D/2)(2x+b) + (E−Db/2)`; emit
    `(D/2)*log(x^2+bx+c)` + `(2(E−Db/2)/sqrt(4c−b²))*atan((2x+b)/sqrt(4c−b²))`. Simplify `b=0`
    and unit coefficients for readability, but correctness (differentiation) is the gate.
  - **quadratic, power k>1:** apply the reduction formula down to power 1.
- `integrateRationalFunction(expr: string, v: string): string | null` — the full pipeline
  (Tasks 1–4): polynomial part + Σ integratePFTerm; `null` if `parseRationalFunction` or
  `factorDenominator` declines.

The test verifies by DIFFERENTIATION (numeric): parse `F = integrateRationalFunction(f)`,
numerically differentiate, compare to `f` at sample points.

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { integrateRationalFunction } from '../src/cas/rational-integrate.js';
import { evaluate } from '../src/index.js';
const f = (e: string, x: number) => evaluate(e, { x }) as number;
// central difference of the produced antiderivative
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

describe('rational-integrate: per-factor integration (differentiation-verified)', () => {
  const cases: Array<[string, string]> = [
    ['1/(x^2+1)', '1/(x^2+1)'],
    ['(3*x+2)/(x^2+1)', '(3*x+2)/(x^2+1)'],
    ['1/((x-1)^2*(x+2))', '1/((x-1)^2*(x+2))'],
    ['x^3/(x^2+1)', 'x^3/(x^2+1)'],
    ['1/(x^2+x+1)', '1/(x^2+x+1)'],
    ['x/(x^2+1)^2', 'x/(x^2+1)^2'],
  ];
  for (const [inp, integrand] of cases) {
    it(`d/dx integ(${inp}) == ${inp}`, () => {
      const F = integrateRationalFunction(inp, 'x');
      expect(F).not.toBeNull();
      for (const x of [0.4, 1.7, -0.9, 2.3]) expect(dF(F!, x)).toBeCloseTo(f(integrand, x), 5);
    });
  }
  it('declines a degree-3 irreducible denominator', () => {
    expect(integrateRationalFunction('1/(x^3-2)', 'x')).toBeNull();
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + engine tests + tsc + eslint. **Extra (RFL Rule 4):**
      throwaway differentiation-check on 6 more rational integrands (incl. `1/(x^3+x)`, a repeated
      quadratic `x/(x^2+4)^2`, a proper polynomial-part case, a pure `arctan` shift) vs the integrand;
      delete after; report. Commit `feat(functions): closed-form integration of rational-function terms`.

---

### Task 5: wire into `symbolicIntegral` + regression

**Files:** Modify `functions/src/cas-integration.ts` (route rational functions into
`integrateRationalFunction` before returning the marker); Test
`functions/tests/rational-integrate-integration.test.ts`.

**Consumes:** Task 4. **Produces:** in `symbolicIntegral`, before the code path returns the
`integral(...)` marker, try `integrateRationalFunction(expr, v)`; if non-null, return it. Preserve
all existing behavior (only cases that previously returned the marker can change). Update the
`symbolicIntegral` docstring (rational functions with irreducible-quadratic/repeated factors now
integrated; deg-≥3 irreducible denominators remain marker).

**Regression gate:** run before/after
`npx vitest run functions/tests/cas-integration*.test.ts functions/tests/cas.test.ts functions/tests/cas-passthrough-documented.test.ts functions/tests/gap-cas-sympy-oracle.test.ts functions/tests/integration*.test.ts` (adjust to the actual integration test filenames — grep first). All green; the passthrough tests verify by numeric evaluation so a correct new antiderivative passes. If a test pinned the OLD marker output as expected, update it to the new correct integral (differentiation-verified) and note it as an improvement.

- [ ] **Step 1 failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { symbolicIntegral, evaluate } from '../src/index.js';
const f = (e: string, x: number) => evaluate(e, { x }) as number;
function dF(F: string, x: number): number {
  const h = 1e-6;
  return (f(F, x + h) - f(F, x - h)) / (2 * h);
}

describe('symbolicIntegral: rational functions now integrated', () => {
  it('1/(x^2+1) is no longer a marker and differentiates back', () => {
    const F = symbolicIntegral('1/(x^2+1)', 'x');
    expect(F).not.toContain('integral(');
    for (const x of [0.4, 1.7, -0.9]) expect(dF(F, x)).toBeCloseTo(f('1/(x^2+1)', x), 5);
  });
  it('deg-3 irreducible denominator still returns the marker', () => {
    expect(symbolicIntegral('1/(x^3-2)', 'x')).toContain('integral(');
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + full regression + tsc + eslint → commit
      `feat(functions): route symbolicIntegral through rational-function integrator`.

---

### Task 6: Release

**Files:** `cas-integration.ts` docstrings; `docs/reference/functions.md` (symbolicIntegral +
apart entries); root `CHANGELOG.md`; `TODO.md`; `.changeset/*`.

- [ ] Docstrings + `docs/reference/functions.md`: rational-function integration now complete for
      linear + irreducible-quadratic denominators (log + arctan + rational part); deg-≥3 irreducible
      denominators and transcendental Risch remain future (Layer 2/3). Verify with `honest-claude`.
- [ ] Root `CHANGELOG.md` `### feat(functions)` under `[Unreleased]`.
- [ ] `TODO.md`: #8 Layer 1 shipped; Layer 2 (Rothstein–Trager) next.
- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`.
- [ ] version → build → full `functions` suite + monorepo `typecheck` + `eslint .` green.
- [ ] commit, push (L==R), `changeset publish`, **verify** `npm view` + clean-tarball probe
      integrating `1/(x^2+1)` and differentiating it back.

---

## Self-Review

- **Spec coverage:** Task 1 = parse + poly part (§алг 1–2); Task 2 = denominator factorization
  (§3); Task 3 = partial fractions (§4); Task 4 = per-factor integration (§5); Task 5 = routing
  (§ output contract); Task 6 = release. Rothstein–Trager (deg≥3) and transcendental Risch are
  explicitly NOT in scope.
- **Exact rational** stated globally and in Tasks 1/3.
- **Differentiation-verification** is the arbiter in Tasks 4/5 (implementation-independent).
- **Type consistency:** `RatFunc`/`Rat` (Task 1) → `DenFactor` (Task 2) → `PFTerm` (Task 3) →
  `integratePFTerm`/`integrateRationalFunction` (Task 4) → `symbolicIntegral` routing (Task 5).
- **Regression** is the explicit gate in Task 5 (numeric-evaluation-based existing suites).
- **Reuse:** #7 `factorUnivariateZ` for denominator factorization (no new factorizer); existing
  `polyFromExpression`/rational rendering for parse/output.
