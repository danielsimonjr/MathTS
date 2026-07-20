# Factorization Layer 1 — Univariate over ℤ (Zassenhaus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A complete univariate polynomial factorizer over ℤ/ℚ into irreducible
factors with multiplicity, replacing the rational-linear-root-only path.

**Architecture:** New internal engine `functions/src/typed/factorization/` on a
`bigint` representation. Zassenhaus pipeline: content → Yun square-free →
factor mod p (distinct-degree + Cantor–Zassenhaus) → Hensel lift to p^k →
subset recombination by exact division over ℤ. `algebra.ts` `factor` keeps its
cheap fast-paths and **routes** unresolved univariate inputs into the engine.

**Tech Stack:** TypeScript (strict, ESM, `.js` import extensions), vitest,
`bigint` throughout the engine. Oracle: Python sympy `factor_list` (v1.14.0).

## Global Constraints

- **bigint only** inside `factorization/`. No `number`/float in the engine core;
  float64 loses correctness once `p^k > 2^53` during Hensel lift.
- **Import extensions `.js`** (ESM), files `kebab-case.ts`, `strict:true`,
  eslint zero. No `any`, no `@ts-ignore`.
- **No regression:** every input the existing `factor`/`casFactor` handles must
  produce byte-identical output. Run `npx vitest run functions/tests/algebra*`
  and any `cas` suites before and after each task that touches `algebra.ts`.
- **Oracle equality is factor-SET equality**, content/sign-normalized and sorted
  — not string identity with sympy's rendering.
- Factor-count cap `MAX_MODULAR_FACTORS = 24`; beyond it, return the
  square-free level unfactored and `log()` the cap (no silent truncation).
- Irreducible over ℚ means _returned unchanged_: `x^2+1`, `x^4+1`, `x^2+x+1`.
- Commit footer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` +
  `Claude-Session:` line. `git commit` timeout ~540000ms. Verify each push L==R.

## Verified current state (2026-07-20)

- `functions/src/typed/algebra.ts` (1753 ln): `factor` does univariate
  rational-linear roots (`findRationalLinearFactors`, ln 619) + multivariate
  content/monomial/diff-of-squares (`factorMultivariate`, ln 867). Uses
  `number[]` dense polys, `polyFromExpression`/`polyToDense`/`denseToPoly`/
  `idealPolyToString`/`variables`.
- `functions/src/typed/cas.ts` `casFactor` (ln 3079) delegates to
  `algebraFactor` (imported as `factor` from `./algebra.js`).
- Oracle available: `python -c "import sympy"` → 1.14.0.

---

### Task 1: `integer-poly.ts` — bigint dense poly core

**Files:**

- Create: `functions/src/typed/factorization/integer-poly.ts`
- Test: `functions/tests/factorization/integer-poly.test.ts`

**Interfaces — Produces:**

- `type IntPoly = bigint[]` (index = degree; `[]` = zero poly; last entry
  nonzero after `trim`).
- `trim(p: IntPoly): IntPoly`, `degree(p): number` (zero → -1), `lc(p): bigint`,
  `isZero(p): boolean`.
- `add/sub/neg(a,b)`, `mul(a,b)`, `scalarMul(p, k: bigint)`,
  `equals(a,b): boolean`, `evaluate(p, x: bigint): bigint`.
- `bigintGcd(a: bigint, b: bigint): bigint` (non-negative), `content(p): bigint`
  (gcd of |coeffs|, non-negative), `primitivePart(p): IntPoly` (content divided
  out; leading coefficient made positive).

- [ ] **Step 1: failing test** `functions/tests/factorization/integer-poly.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  trim,
  degree,
  lc,
  add,
  sub,
  mul,
  scalarMul,
  equals,
  evaluate,
  content,
  primitivePart,
  bigintGcd,
  type IntPoly,
} from '../../src/typed/factorization/integer-poly.js';

const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('integer-poly core', () => {
  it('trims trailing zeros and reports degree', () => {
    expect(trim(P(1, 2, 0, 0))).toEqual(P(1, 2));
    expect(degree(P(1, 2, 3))).toBe(2);
    expect(degree(P())).toBe(-1);
    expect(lc(P(3, 0, 5))).toBe(5n);
  });
  it('adds and multiplies exactly', () => {
    // (1 + x) + (x) = 1 + 2x ; (1 + x)(1 - x) = 1 - x^2
    expect(add(P(1, 1), P(0, 1))).toEqual(P(1, 2));
    expect(mul(P(1, 1), P(1, -1))).toEqual(P(1, 0, -1));
    expect(sub(P(1, 2), P(1, 1))).toEqual(P(0, 1));
    expect(scalarMul(P(1, 2), 3n)).toEqual(P(3, 6));
  });
  it('evaluates via Horner over bigint', () => {
    // x^3 + 2 at x = 10 -> 1002
    expect(evaluate(P(2, 0, 0, 1), 10n)).toBe(1002n);
  });
  it('computes content and primitive part with positive lc', () => {
    // 6x^2 - 6 -> content 6, primitive x^2 - 1
    expect(content(P(-6, 0, 6))).toBe(6n);
    expect(primitivePart(P(-6, 0, 6))).toEqual(P(-1, 0, 1));
    // -2 - 2x -> primitive part 1 + x (lc positive)
    expect(primitivePart(P(-2, -2))).toEqual(P(1, 1));
    expect(bigintGcd(-12n, 18n)).toBe(6n);
    expect(equals(P(1, 2), P(1, 2, 0))).toBe(true);
  });
});
```

- [ ] **Step 2:** run → RED (module missing). **Step 3:** implement. **Step 4:**
      `npx vitest run functions/tests/factorization/integer-poly.test.ts` → GREEN;
      `cd functions && npx tsc --noEmit`. **Step 5:** commit
      `feat(functions): bigint IntPoly core for factorization engine`.

---

### Task 2: `integer-poly.ts` — exact division, gcd over ℤ, bounds, mod reduction

**Files:**

- Modify: `functions/src/typed/factorization/integer-poly.ts`
- Test: `functions/tests/factorization/integer-poly-div.test.ts`

**Interfaces — Consumes:** Task 1. **Produces:**

- `exactDivide(a, b): IntPoly | null` — quotient if `b` divides `a` exactly over
  ℤ, else `null` (the recombination test).
- `derivative(p): IntPoly`.
- `polyGcdZ(a, b): IntPoly` — gcd over ℤ (primitive part of the Euclidean PRS;
  positive lc). Used by square-free and image square-free checks.
- `landauMignotte(p): bigint` — Mignotte bound `⌊sqrt(deg+1)·2^deg·|lc|... ⌋`
  usable as coefficient bound of any factor (ceil, generous is fine).
- `modSymmetric(p, m: bigint): IntPoly` — reduce each coeff into `(-m/2, m/2]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import {
  exactDivide,
  derivative,
  polyGcdZ,
  landauMignotte,
  modSymmetric,
  type IntPoly,
} from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('integer-poly division/gcd/bounds', () => {
  it('divides exactly or returns null', () => {
    // (x^2 - 1) / (x - 1) = x + 1
    expect(exactDivide(P(-1, 0, 1), P(-1, 1))).toEqual(P(1, 1));
    // (x^2 + 1) / (x - 1) -> not exact
    expect(exactDivide(P(1, 0, 1), P(-1, 1))).toBeNull();
  });
  it('derivative', () => {
    // d/dx (x^3 + 2x) = 3x^2 + 2
    expect(derivative(P(0, 2, 0, 1))).toEqual(P(2, 0, 3));
  });
  it('gcd over Z is the primitive common factor', () => {
    // gcd(x^2 - 1, x^2 - 2x + 1) = x - 1
    expect(polyGcdZ(P(-1, 0, 1), P(1, -2, 1))).toEqual(P(-1, 1));
  });
  it('modSymmetric reduces into (-m/2, m/2]', () => {
    // coeffs mod 7 in symmetric range: 5 -> -2, 3 -> 3
    expect(modSymmetric(P(5, 3, 7), 7n)).toEqual(P(-2, 3, 0));
  });
  it('landauMignotte is a positive bound', () => {
    expect(landauMignotte(P(-1, 0, 1)) > 0n).toBe(true);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc --noEmit` → commit
      `feat(functions): exact division, Z-gcd, Mignotte bound for IntPoly`.

---

### Task 3: `finite-field.ts` — 𝔽_p polynomial arithmetic

**Files:**

- Create: `functions/src/typed/factorization/finite-field.ts`
- Test: `functions/tests/factorization/finite-field.test.ts`

**Interfaces — Consumes:** Task 1 (`IntPoly`). **Produces (all take a prime
`p: bigint`, keep coeffs in `[0,p)`):**

- `reduceModP(a, p)`, `addP/subP/mulP(a,b,p)`, `invModP(a: bigint, p): bigint`,
  `makeMonicP(a, p): IntPoly` (scale by `lc⁻¹`), `divmodP(a,b,p): {q,r}`,
  `gcdP(a,b,p): IntPoly` (monic), `powModPolyP(base, e: bigint, mod, p): IntPoly`
  (`base^e mod (mod, p)` by square-and-multiply).

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import {
  makeMonicP,
  mulP,
  divmodP,
  gcdP,
  invModP,
  powModPolyP,
  type IntPoly,
} from '../../src/typed/factorization/finite-field.js';
import type { IntPoly as _ } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('finite-field 𝔽_p', () => {
  it('inverse and monic mod p', () => {
    expect(invModP(2n, 5n)).toBe(3n); // 2*3=6≡1
    // 2x + 4 mod 5, monic -> x + 2
    expect(makeMonicP(P(4, 2), 5n)).toEqual(P(2, 1));
  });
  it('divmod and gcd mod p', () => {
    // (x^2 - 1) = (x+1)(x-1) mod 5 ; divide by (x-1)=(x+4)
    const { q, r } = divmodP(P(-1, 0, 1), P(-1, 1), 5n);
    expect(q).toEqual(P(1, 1));
    expect(r).toEqual(P()); // zero remainder
    // gcd(x^2-1, x^2-2x+1) mod 5 = x-1 (monic: x+4)
    expect(gcdP(P(-1, 0, 1), P(1, -2, 1), 5n)).toEqual(P(4, 1));
  });
  it('powModPolyP: x^5 ≡ x mod (x^2+1, 5) since x^2≡-1, x^4≡1, x^5≡x', () => {
    expect(powModPolyP(P(0, 1), 5n, P(1, 0, 1), 5n)).toEqual(P(0, 1));
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc` → commit
      `feat(functions): 𝔽_p polynomial arithmetic (divmod/gcd/powmod)`.

---

### Task 4: `finite-field.ts` — factor mod p (square-free + distinct/equal-degree)

**Files:**

- Modify: `functions/src/typed/factorization/finite-field.ts`
- Test: `functions/tests/factorization/factor-mod-p.test.ts`

**Interfaces — Consumes:** Task 3. **Produces:**

- `distinctDegreeFactor(f, p): Array<{ deg: number; prod: IntPoly }>` (f monic,
  square-free).
- `equalDegreeFactor(f, d, p): IntPoly[]` — Cantor–Zassenhaus split of a monic
  product of degree-`d` irreducibles. Use a **deterministic** candidate sequence
  (`x + c` for `c = 1,2,3,…`, then `x^2 + c`, …) so tests are reproducible — no
  `Math.random`.
- `factorModP(f, p): IntPoly[]` — monic irreducible factors of a square-free
  monic `f` over 𝔽_p (composes the two above).

- [ ] **Step 1: failing test** (pinned to sympy `Poly(..., modulus=p)`):

```ts
import { describe, it, expect } from 'vitest';
import { factorModP, makeMonicP, mulP } from '../../src/typed/factorization/finite-field.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);
const sortByDeg = (fs: IntPoly[]) =>
  [...fs].sort((a, b) => a.length - b.length || Number(a[0] - b[0]));

describe('factor mod p', () => {
  it('x^2+1 splits mod 5 into (x+2)(x-2)', () => {
    // sympy: modulus=5 -> (x+2)(x-2); as monic in [0,5): (x+2),(x+3)
    const fs = sortByDeg(factorModP(P(1, 0, 1), 5n));
    expect(fs).toEqual([P(2, 1), P(3, 1)]);
  });
  it('x^2+1 is irreducible mod 7', () => {
    expect(factorModP(P(1, 0, 1), 7n)).toEqual([P(1, 0, 1)]);
  });
  it('product of returned factors reconstructs the input (monic) mod p', () => {
    // x^3 + x + 1 mod 2 is irreducible; mod 3 factor and re-multiply
    const f = P(1, 1, 0, 1); // 1 + x + x^3
    const fs = factorModP(f, 3n);
    let prod = P(1);
    for (const g of fs) prod = mulP(prod, g, 3n);
    expect(makeMonicP(prod, 3n)).toEqual(makeMonicP(f, 3n));
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc` → commit
      `feat(functions): factor mod p via distinct/equal-degree (Cantor–Zassenhaus)`.

---

### Task 5: `square-free.ts` — Yun square-free decomposition over ℤ

**Files:**

- Create: `functions/src/typed/factorization/square-free.ts`
- Test: `functions/tests/factorization/square-free.test.ts`

**Interfaces — Consumes:** Tasks 1–2. **Produces:**

- `squareFreeDecompose(f: IntPoly): Array<{ factor: IntPoly; mult: number }>` —
  primitive `f`; returns pairwise-coprime square-free `factorᵢ` with
  `f = ∏ factorᵢ^multᵢ` (up to content). Each `factor` has positive lc.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { squareFreeDecompose } from '../../src/typed/factorization/square-free.js';
import {
  mul,
  scalarMul,
  primitivePart,
  type IntPoly,
} from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('Yun square-free decomposition', () => {
  it('(x-1)^2 (x+2): mult-2 part is (x-1), mult-1 part is (x+2)', () => {
    // f = (x-1)^2 (x+2) = (x^2-2x+1)(x+2) = x^3 - 3x + 2
    const f = P(2, -3, 0, 1);
    const d = squareFreeDecompose(f);
    const m1 = d.find((e) => e.mult === 1)!.factor;
    const m2 = d.find((e) => e.mult === 2)!.factor;
    expect(m2).toEqual(P(-1, 1)); // x - 1
    expect(m1).toEqual(P(2, 1)); // x + 2
  });
  it('square-free input returns itself at mult 1', () => {
    // x^2 - 1
    expect(squareFreeDecompose(P(-1, 0, 1))).toEqual([{ factor: P(-1, 0, 1), mult: 1 }]);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc` → commit
      `feat(functions): Yun square-free decomposition over Z`.

---

### Task 6: `hensel.ts` — Landau–Mignotte-bounded multifactor Hensel lift

**Files:**

- Create: `functions/src/typed/factorization/hensel.ts`
- Test: `functions/tests/factorization/hensel.test.ts`

**Interfaces — Consumes:** Tasks 1–3. **Produces:**

- `henselLift(f: IntPoly, factorsModP: IntPoly[], p: bigint, targetPk: bigint):
IntPoly[]` — given `f` ≡ ∏ factorsModP (mod p), monic factors, lift to factors
  mod `targetPk` (`= p^k ≥ 2·landauMignotte(f)+1`, `k` chosen by caller) whose
  product ≡ `f` (mod p^k). Coefficients in symmetric range mod p^k. Multifactor
  (tree or iterated linear lift), preserving `f`'s leading coefficient.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { henselLift } from '../../src/typed/factorization/hensel.js';
import { factorModP } from '../../src/typed/factorization/finite-field.js';
import { mul, modSymmetric, type IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('Hensel lifting', () => {
  it('lifts x^2-1 factors from mod 5 to mod 25 and reconstructs f', () => {
    const f = P(-1, 0, 1); // x^2 - 1 = (x-1)(x+1)
    const modp = factorModP(f, 5n);
    const lifted = henselLift(f, modp, 5n, 25n);
    let prod = P(1);
    for (const g of lifted) prod = mul(prod, g);
    expect(modSymmetric(prod, 25n)).toEqual(f); // exact over Z after symmetric reduce
  });
  it('lifted factors multiply back to f mod p^k for a larger case', () => {
    // f = x^3 - 2 (irreducible over Q but this checks the lift arithmetic,
    // product congruence mod p^k), p=5, target 125
    const f = P(-2, 0, 0, 1);
    const modp = factorModP(f, 5n);
    const lifted = henselLift(f, modp, 5n, 125n);
    let prod = P(1);
    for (const g of lifted) prod = mul(prod, g);
    expect(modSymmetric(prod, 125n)).toEqual(f);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc` → commit
      `feat(functions): Hensel lifting of mod-p factorization to p^k`.

---

### Task 7: `zassenhaus.ts` — univariate factorization over ℤ (orchestration)

**Files:**

- Create: `functions/src/typed/factorization/zassenhaus.ts`
- Test: `functions/tests/factorization/zassenhaus.test.ts`

**Interfaces — Consumes:** Tasks 1–6. **Produces:**

- `type Factorization = { constant: bigint; factors: Array<{ poly: IntPoly; mult: number }> }`
- `factorUnivariateZ(f: IntPoly): Factorization` — full pipeline:
  content/sign → Yun square-free → for each square-free part: pick prime
  (`p ∤ lc`, image square-free, fewest factors among first candidates) → factor
  mod p → choose `k` with `p^k ≥ 2·landauMignotte + 1` → Hensel lift → subset
  recombination by `exactDivide` (cap `MAX_MODULAR_FACTORS=24`; on cap, keep the
  square-free part whole and `log()`). `factors` sorted by (degree, coeffs),
  each with positive lc.

- [ ] **Step 1: failing test** (values pinned to sympy `factor_list`):

```ts
import { describe, it, expect } from 'vitest';
import { factorUnivariateZ } from '../../src/typed/factorization/zassenhaus.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);
const shape = (f: ReturnType<typeof factorUnivariateZ>) => ({
  constant: f.constant,
  factors: f.factors.map((e) => ({ poly: e.poly, mult: e.mult })),
});

describe('factorUnivariateZ (Zassenhaus)', () => {
  it('x^4 - 1 = (x-1)(x+1)(x^2+1)', () => {
    // sympy: (1, [(x-1,1),(x+1,1),(x^2+1,1)])
    expect(shape(factorUnivariateZ(P(-1, 0, 0, 0, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-1, 1), mult: 1 },
        { poly: P(1, 1), mult: 1 },
        { poly: P(1, 0, 1), mult: 1 },
      ],
    });
  });
  it('x^4 + 1 is irreducible over Q', () => {
    expect(shape(factorUnivariateZ(P(1, 0, 0, 0, 1)))).toEqual({
      constant: 1n,
      factors: [{ poly: P(1, 0, 0, 0, 1), mult: 1 }],
    });
  });
  it('(x^2+1)(x^2+2) = x^4 + 3x^2 + 2', () => {
    expect(shape(factorUnivariateZ(P(2, 0, 3, 0, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(1, 0, 1), mult: 1 },
        { poly: P(2, 0, 1), mult: 1 },
      ],
    });
  });
  it('6x^2 - 6 = 6(x-1)(x+1)', () => {
    expect(shape(factorUnivariateZ(P(-6, 0, 6)))).toEqual({
      constant: 6n,
      factors: [
        { poly: P(-1, 1), mult: 1 },
        { poly: P(1, 1), mult: 1 },
      ],
    });
  });
  it('(x-1)^3 (x+2): multiplicity preserved', () => {
    // f = (x-1)^3 (x+2) = x^4 - x^3 - 3x^2 + 5x - 2
    expect(shape(factorUnivariateZ(P(-2, 5, -3, -1, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-1, 1), mult: 3 },
        { poly: P(2, 1), mult: 1 },
      ],
    });
  });
  it('x^8+x^6+x^4+x^2+1 = (x^4-x^3+x^2-x+1)(x^4+x^3+x^2+x+1)', () => {
    const r = shape(factorUnivariateZ(P(1, 0, 1, 0, 1, 0, 1, 0, 1)));
    expect(r.factors).toEqual([
      { poly: P(1, -1, 1, -1, 1), mult: 1 },
      { poly: P(1, 1, 1, 1, 1), mult: 1 },
    ]);
  });
});
```

- [ ] **Steps 2–5:** RED → implement → GREEN + `tsc` → commit
      `feat(functions): univariate factorization over Z (Zassenhaus pipeline)`.

---

### Task 8: `index.ts` + `algebra.ts` routing + oracle cross-check

**Files:**

- Create: `functions/src/typed/factorization/index.ts`
- Modify: `functions/src/typed/algebra.ts` (`factor` routes univariate remainder
  into the engine; docstring updated)
- Test: `functions/tests/factorization/factor-univariate-integration.test.ts`,
  and a regression run of `functions/tests/algebra*`.

**Interfaces — Consumes:** Task 7 + existing `algebra.ts` helpers
(`polyFromExpression`, `polyToDense`, `variables`, `idealPolyToString`,
`formatLinearFactor`). **Produces:**

- `factorPolynomialUnivariate(expr: string, v: string): string | null` in
  `index.ts` — parse to `IntPoly` (fail → null for non-integer/non-poly),
  `factorUnivariateZ`, render factors with existing formatters (linear via
  `formatLinearFactor`, higher via `(${idealPolyToString})`), constant prefix.
- `algebra.ts` `factor`: after the existing rational-linear extraction, if a
  higher-degree remainder remains, route it through
  `factorPolynomialUnivariate` and splice the irreducible factors in. Fast-path
  outputs for already-handled cases unchanged.

- [ ] **Step 1: failing test** — string contract + a sympy-oracle cross-check
      helper (spawns `python`), plus the regression assertion that prior outputs are
      unchanged:

```ts
import { describe, it, expect } from 'vitest';
import { factor } from '../../src/typed/algebra.js';

describe('factor() — univariate irreducible factorization', () => {
  it('now factors what the old path left whole', () => {
    expect(factor('x^4 - 1')).toBe('(x - 1)*(x + 1)*(x^2 + 1)');
    expect(factor('x^4 + 3*x^2 + 2')).toBe('(x^2 + 1)*(x^2 + 2)');
  });
  it('leaves Q-irreducibles unchanged', () => {
    expect(factor('x^4 + 1')).toBe('x^4 + 1');
    expect(factor('x^2 + x + 1')).toBe('x^2 + x + 1');
  });
  it('regression: existing linear/content outputs are byte-identical', () => {
    expect(factor('x^2 - 1')).toBe('(x - 1)*(x + 1)'); // unchanged contract
  });
});
```

> The exact rendered strings (spacing, `*` joins, factor order) MUST match the
> existing `idealPolyToString`/`formatLinearFactor` conventions — the
> implementer confirms by running the existing `algebra` suite and adjusting the
> renderer wiring, NOT by loosening these assertions. If a chosen ordering
> differs from the literal above, update the literal to the engine's
> deterministic (degree, coeff) order — but never to sympy's rendering.

- [ ] **Step 2:** RED. **Step 3:** implement routing + renderer. **Step 4:**
      GREEN; then **regression gate** `npx vitest run functions/tests/algebra` (all
      green, no diffs) + `cd functions && npx tsc --noEmit` + `npx eslint src/typed/factorization src/typed/algebra.ts`.
      **Step 5:** commit `feat(functions): route factor() into univariate Z engine`.

---

### Task 9: Release A — docs, CHANGELOG, changeset, publish, verify

**Files:** `functions/src/typed/algebra.ts` + `cas.ts` docstrings;
`docs/api/functions.md` (`factor`/`casFactor` entry); root `CHANGELOG.md`;
`TODO.md`; `.changeset/*`.

- [ ] Update `factor`/`casFactor` docstrings: univariate is now **complete over
      ℤ/ℚ** (Zassenhaus); multivariate still the partial subset (Layer 2 pending).
- [ ] `docs/api/functions.md`: expand the `factor`/`casFactor` description +
      examples (`x^4-1`, `x^4+1` irreducible). Verify with `honest-claude` that the
      claims match behavior. Do not hand-edit generated indexes.
- [ ] Root `CHANGELOG.md` `### Added` under `[Unreleased]`.
- [ ] `TODO.md`: note Layer 1 shipped; #7 Layer 2 remains.
- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`.
- [ ] version → build → full `functions` suite + monorepo `npm run typecheck` +
      `eslint .` green.
- [ ] commit, push (verify L==R), `changeset publish`, **verify** `npm view
@danielsimonjr/mathts-functions version` + clean-tarball install probe per
      `reference-npm-is-the-release-record`.

---

## Self-Review

- **Spec coverage:** Tasks 1–2 = `integer-poly.ts` (§2); Task 3–4 =
  `finite-field.ts` factor-mod-p (§4 step 4); Task 5 = square-free (§4 step 2);
  Task 6 = Hensel (§4 step 5); Task 7 = Zassenhaus orchestration + cap (§4);
  Task 8 = routing + output contract (§2, §6); Task 9 = release A (§9). Layer 2
  (§5) is a separate follow-up plan — out of scope here, by design.
- **bigint constraint** stated in Global Constraints and every engine task.
- **Regression contract** (§6) is the explicit gate in Task 8.
- **Type consistency:** `IntPoly` defined in Task 1, imported everywhere;
  `Factorization` defined in Task 7, consumed in Task 8. `factorModP` (Task 4)
  consumed by Hensel test (Task 6) and Zassenhaus (Task 7). Names align.
- **Oracle values** in Tasks 4/7 are pinned to actual sympy 1.14.0 output.
- **No placeholders**: each task has a concrete failing test; the one soft spot
  (exact rendered strings in Task 8) carries an explicit resolution rule rather
  than a TODO.
