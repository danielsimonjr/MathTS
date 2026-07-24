# Phase 5 — Special Functions & Number Theory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add the highest-leverage missing special functions (hypergeometric `pFq`, polygamma, Jacobi elliptic, Gauss-quadrature nodes, orthogonal polynomials) and number-theory fills — all oracle-pinned vs mpmath/scipy/sympy.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: mpmath 1.3.0, scipy 1.17.1, sympy.

## Global Constraints

- Tests import built `dist/` — rebuild before vitest.
- **Oracle-pinned** to mpmath/scipy/sympy values (given below or verified at build time). Never round-trip.
- No new cross-package deps. Building blocks present: `gamma`, `lgamma`, `digamma`, `risingFactorial` (Pochhammer), `besselI`, `ellipticK`, `zeta`, `legendreP`, `factorial`, `gcd`/`xgcd`, `mod`. Import from source modules.
- Additive & non-breaking. strict + eslint zero. **New public exports → curated `docs/reference/functions.md` table** (docs-completeness gate) + `npm run docs:functions`/`docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms). Implementers commit locally, do NOT push.

## Verified current state

All missing: `hyp0f1`/`hyp1f1`/`hyp2f1`/`pFq`, `polygamma`/`trigamma`, `jacobiSN`/`jacobiCN`/`jacobiDN`, `rootsLegendre`/`gaussLegendreNodes`, `jacobiP`/`gegenbauerC`, `continuedFraction`, `eulerNumbers`, `stirlingS1`, `discreteLog`, `primitiveRoot`/`multiplicativeOrder`, `kroneckerSymbol`, permutation/combination generators. Present: `gamma`/`digamma`/`risingFactorial`/`besselI`/`ellipticK`/`zeta`/`legendreP`.

---

### Task 1: hypergeometric `hyp0f1` / `hyp1f1` / `hyp2f1` + generic `pFq`

**Files:** `functions/src/special/hypergeometric.ts` (new); export `hyp0f1`, `hyp1f1`, `hyp2f1`, `pFq`. Test `functions/tests/hypergeometric.test.ts`.

**Spec** (use the ascending series with Pochhammer via `risingFactorial` — import from source; sum until the term is < 1e-16·|sum| or a max-iter):

- `hyp0f1(b, z)` = `Σ_{n≥0} z^n / ((b)_n n!)` (entire).
- `hyp1f1(a, b, z)` (Kummer M) = `Σ (a)_n/((b)_n n!) z^n` (entire). For large |z| the series is ill-conditioned; document that it targets moderate |z| (test uses z=0.5).
- `hyp2f1(a, b, c, z)` = `Σ (a)_n(b)_n/((c)_n n!) z^n` — converges for |z|<1. For |z|<1 use the series; for the test (z=0.5) that suffices. If |z|≥1, throw a clear "outside convergence region (|z|<1); analytic continuation not yet implemented" error (a Pfaff/Euler transformation for |z|<1 near the boundary is a nice-to-have, not required).
- `pFq(a: number[], b: number[], z)` = generic `Σ (∏(aᵢ)_n)/(∏(bⱼ)_n · n!) z^n`.

**Oracles (mpmath, VERIFIED):** `hyp2f1(1,2,3,0.5)=1.5451774445`, `hyp1f1(1,2,0.5)=1.2974425414`, `hyp0f1(2,0.5)=1.2717234563`. Also `pFq([1,2],[3],0.5) === hyp2f1(1,2,3,0.5)`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { hyp0f1, hyp1f1, hyp2f1, pFq } from '../src/index.js';

describe('hypergeometric functions', () => {
  it('hyp2f1(1,2,3,0.5) = 1.5451774445 (mpmath)', () => {
    expect(hyp2f1(1, 2, 3, 0.5)).toBeCloseTo(1.5451774445, 8);
  });
  it('hyp1f1(1,2,0.5) = 1.2974425414 (mpmath)', () => {
    expect(hyp1f1(1, 2, 0.5)).toBeCloseTo(1.2974425414, 8);
  });
  it('hyp0f1(2,0.5) = 1.2717234563 (mpmath)', () => {
    expect(hyp0f1(2, 0.5)).toBeCloseTo(1.2717234563, 8);
  });
  it('pFq([1,2],[3],0.5) equals hyp2f1(1,2,3,0.5)', () => {
    expect(pFq([1, 2], [3], 0.5)).toBeCloseTo(1.5451774445, 8);
  });
  it('hyp2f1 throws outside |z|<1', () => {
    expect(() => hyp2f1(1, 2, 3, 1.5)).toThrow();
  });
});
```

- [ ] Steps 2–5 (docs-completeness: the four names, Special Functions section; CHANGELOG `### Added`; commit `feat(special): hypergeometric hyp0f1/hyp1f1/hyp2f1 + pFq`).

---

### Task 2: `polygamma` / `trigamma` + orthogonal polynomials `jacobiP` / `gegenbauerC`

**Files:** `functions/src/special/polygamma-orthopoly.ts` (new); export `polygamma`, `trigamma`, `jacobiP`, `gegenbauerC`. Test `functions/tests/polygamma-orthopoly.test.ts`.

**Spec:**

- `polygamma(n, x)` = ψ⁽ⁿ⁾(x), the n-th derivative of digamma. For n=0 delegate to existing `digamma`. For n≥1: `ψ⁽ⁿ⁾(x) = (−1)^{n+1} n! Σ_{k=0}^∞ 1/(x+k)^{n+1}`; accelerate by recurrence — shift x up by adding `1/(x+k)^{n+1}` terms until x ≥ ~10, then use the asymptotic (Bernoulli) expansion. (Or, if `zeta` supports the Hurwitz form ζ(s,a), use `ψ⁽ⁿ⁾(x) = (−1)^{n+1} n! ζ(n+1, x)` — check the existing `zeta` signature first.) `trigamma(x) = polygamma(1, x)`.
- `jacobiP(n, alpha, beta, x)` — Jacobi polynomial P_n^{(α,β)}(x) via the three-term recurrence.
- `gegenbauerC(n, alpha, x)` — Gegenbauer/ultraspherical C_n^{(α)}(x) via its three-term recurrence.

**Oracles (VERIFIED):** `trigamma(2)=polygamma(1,2)=0.6449340668` (=ζ(2)−1); `polygamma(2,1)=−2.4041138063` (=−2ζ(3)); `jacobiP(2,1,1,0.5)=0.1875`; `gegenbauerC(2,1,x)=4x²−1` so `gegenbauerC(2,1,0.5)=0`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { polygamma, trigamma, jacobiP, gegenbauerC } from '../src/index.js';

describe('polygamma + orthogonal polynomials', () => {
  it('trigamma(2) = polygamma(1,2) = 0.6449340668 (=zeta(2)-1)', () => {
    expect(trigamma(2)).toBeCloseTo(0.6449340668, 8);
    expect(polygamma(1, 2)).toBeCloseTo(0.6449340668, 8);
  });
  it('polygamma(2,1) = -2.4041138063 (=-2*zeta(3))', () => {
    expect(polygamma(2, 1)).toBeCloseTo(-2.4041138063, 7);
  });
  it('polygamma(0,x) matches digamma: polygamma(0,1) = -0.5772156649', () => {
    expect(polygamma(0, 1)).toBeCloseTo(-0.5772156649, 8);
  });
  it('jacobiP(2,1,1,0.5) = 0.1875', () => {
    expect(jacobiP(2, 1, 1, 0.5)).toBeCloseTo(0.1875, 8);
  });
  it('gegenbauerC(2,1,x) = 4x^2-1, so at 0.5 -> 0', () => {
    expect(gegenbauerC(2, 1, 0.5)).toBeCloseTo(0, 8);
    expect(gegenbauerC(2, 1, 1)).toBeCloseTo(3, 8);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: the four names; CHANGELOG `### Added`; commit `feat(special): polygamma/trigamma + Jacobi/Gegenbauer orthogonal polynomials`).

---

### Task 3: Jacobi elliptic `jacobiSN`/`jacobiCN`/`jacobiDN` + Gauss–Legendre `rootsLegendre`

**Files:** `functions/src/special/jacobi-elliptic.ts` and `functions/src/numeric/gauss-nodes.ts` (new); export `jacobiSN`, `jacobiCN`, `jacobiDN`, `rootsLegendre`. Test `functions/tests/jacobi-elliptic-gauss.test.ts`.

**Spec:**

- `jacobiSN(u, m)` / `jacobiCN(u, m)` / `jacobiDN(u, m)` — the Jacobi elliptic functions with **parameter m = k²** (scipy/mpmath convention). Compute via the **descending Landen / AGM** transformation (the standard algorithm: build the sequence of moduli, forward recurrence to get φ, then sn=sin φ, cn=cos φ, dn=sqrt(1−m·sn²)). Handle m=0 (sn=sin u, cn=cos u, dn=1) and m=1 (sn=tanh u, cn=dn=sech u).
- `rootsLegendre(n): { nodes: number[]; weights: number[] }` — n-point Gauss–Legendre nodes and weights on [−1,1]. Compute nodes as roots of the Legendre polynomial Pₙ (Newton's method with the initial guess `cos(π(i−0.25)/(n+0.5))`, using `legendreP` and its derivative), and weights `wᵢ = 2 / ((1−xᵢ²)·P'ₙ(xᵢ)²)`. Nodes ascending.

**Oracles (VERIFIED):** `jacobiSN(0.5,0.3)=0.4742156227`, `jacobiCN(0.5,0.3)=0.8804087364`, `jacobiDN(0.5,0.3)=0.9656789647`. `rootsLegendre(3)` → nodes `[−0.7745966692, 0, 0.7745966692]`, weights `[0.5555555556, 0.8888888889, 0.5555555556]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { jacobiSN, jacobiCN, jacobiDN, rootsLegendre } from '../src/index.js';

describe('Jacobi elliptic + Gauss-Legendre nodes', () => {
  it('jacobiSN/CN/DN(0.5, 0.3) match mpmath', () => {
    expect(jacobiSN(0.5, 0.3)).toBeCloseTo(0.4742156227, 8);
    expect(jacobiCN(0.5, 0.3)).toBeCloseTo(0.8804087364, 8);
    expect(jacobiDN(0.5, 0.3)).toBeCloseTo(0.9656789647, 8);
  });
  it('identity sn^2 + cn^2 = 1', () => {
    const s = jacobiSN(0.7, 0.4),
      c = jacobiCN(0.7, 0.4);
    expect(s * s + c * c).toBeCloseTo(1, 10);
  });
  it('m=0: sn=sin, cn=cos, dn=1', () => {
    expect(jacobiSN(0.5, 0)).toBeCloseTo(Math.sin(0.5), 10);
    expect(jacobiDN(0.5, 0)).toBeCloseTo(1, 10);
  });
  it('rootsLegendre(3) matches scipy', () => {
    const { nodes, weights } = rootsLegendre(3);
    expect(nodes[0]).toBeCloseTo(-0.7745966692, 8);
    expect(nodes[1]).toBeCloseTo(0, 8);
    expect(nodes[2]).toBeCloseTo(0.7745966692, 8);
    expect(weights[0]).toBeCloseTo(0.5555555556, 8);
    expect(weights[1]).toBeCloseTo(0.8888888889, 8);
  });
  it('rootsLegendre integrates a polynomial exactly: ∫_-1^1 x^2 = 2/3', () => {
    const { nodes, weights } = rootsLegendre(3);
    const I = nodes.reduce((s, x, i) => s + weights[i] * x * x, 0);
    expect(I).toBeCloseTo(2 / 3, 10);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: the four names; CHANGELOG `### Added`; commit `feat(special): Jacobi elliptic sn/cn/dn + Gauss-Legendre nodes/weights`).

---

### Task 4: number-theory fills

**Files:** `functions/src/numbertheory/extra.ts` (new); export `continuedFraction`, `eulerNumbers`, `stirlingS1`, `discreteLog`, `primitiveRoot`, `multiplicativeOrder`, `kroneckerSymbol`, `permutationsGen`, `combinationsGen`. Test `functions/tests/numbertheory-extra.test.ts`.

**Spec:**

- `continuedFraction(x: number, maxTerms?: number): number[]` — simple continued-fraction expansion `[a0; a1, a2, …]` via the Euclidean/floor algorithm (stop on maxTerms, default 20, or when the remainder is ~0).
- `eulerNumbers(n: number): number[]` — the Euler numbers E_0..E_n (secant-series recurrence; E_odd = 0, E_0=1, E_2=−1, E_4=5, …).
- `stirlingS1(n, k): number` — **signed** Stirling number of the first kind via the recurrence `s(n,k) = s(n−1,k−1) − (n−1)·s(n−1,k)`, `s(0,0)=1`.
- `discreteLog(g, h, p): number` — baby-step giant-step: smallest x with `g^x ≡ h (mod p)`; return −1 if none. (Use `mod`/BigInt for the modular exponentiation to avoid overflow.)
- `primitiveRoot(p: number): number` — smallest primitive root modulo a prime `p` (test candidate g: `g^(φ/q) ≢ 1` for each prime factor q of φ=p−1). `multiplicativeOrder(a, n): number` — smallest k>0 with `a^k ≡ 1 (mod n)` (requires gcd(a,n)=1).
- `kroneckerSymbol(a, n): number` — the Kronecker symbol (a|n), generalizing Jacobi to all integers n (handle n=0, n=−1, the factor 2 via (a|2), and sign).
- `permutationsGen(arr, k?): T[][]` and `combinationsGen(arr, k): T[][]` — ENUMERATE the actual tuples (lexicographic), not just counts.

**Oracles (VERIFIED):** `stirlingS1(5,2) = −50`; `eulerNumbers(4) = [1,0,−1,0,5]` (E_4=5); `continuedFraction(3.245)` starts `[3,4,…]` (3.245 = 3 + 0.245, 1/0.245≈4.08); `discreteLog(2,3,5)=3` (2³=8≡3 mod5); `primitiveRoot(7)=3`; `multiplicativeOrder(2,7)=3` (2³=8≡1); `kroneckerSymbol(2,3)=−1`; `combinationsGen([1,2,3],2)` = `[[1,2],[1,3],[2,3]]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import {
  continuedFraction,
  eulerNumbers,
  stirlingS1,
  discreteLog,
  primitiveRoot,
  multiplicativeOrder,
  kroneckerSymbol,
  combinationsGen,
  permutationsGen,
} from '../src/index.js';

describe('number theory fills', () => {
  it('stirlingS1(5,2) = -50 (signed)', () => {
    expect(stirlingS1(5, 2)).toBe(-50);
  });
  it('eulerNumbers(4) = [1,0,-1,0,5]', () => {
    expect(eulerNumbers(4)).toEqual([1, 0, -1, 0, 5]);
  });
  it('continuedFraction(3.245) starts [3,4,...]', () => {
    const cf = continuedFraction(3.245, 5);
    expect(cf[0]).toBe(3);
    expect(cf[1]).toBe(4);
  });
  it('discreteLog(2,3,5) = 3', () => {
    expect(discreteLog(2, 3, 5)).toBe(3);
  });
  it('primitiveRoot(7) = 3', () => {
    expect(primitiveRoot(7)).toBe(3);
  });
  it('multiplicativeOrder(2,7) = 3', () => {
    expect(multiplicativeOrder(2, 7)).toBe(3);
  });
  it('kroneckerSymbol(2,3) = -1', () => {
    expect(kroneckerSymbol(2, 3)).toBe(-1);
  });
  it('combinationsGen([1,2,3],2) enumerates tuples', () => {
    expect(combinationsGen([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });
  it('permutationsGen([1,2,3],2) has 6 tuples', () => {
    expect(permutationsGen([1, 2, 3], 2)).toHaveLength(6);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: all nine names, Combinatorics & Number Theory section; CHANGELOG `### Added`; commit `feat(numbertheory): continuedFraction, Euler numbers, stirlingS1, discreteLog, primitiveRoot, kroneckerSymbol, generators`).

---

## Release (after all 4 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize the special-function/number-theory additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish` (wait for npm propagation), push tags, **verify** via `npm view` + clean-install probe.
- [ ] Tick TODO Phase 5; footnote roadmap; phase-boundary check-in; then Phase 6.

**Deferred to a later Phase-5 extension (lower-priority niche):** polylog/Lerch Φ, Struve H/L, Kelvin ber/bei, Barnes-G, Coulomb/Mathieu/parabolic-cylinder, Riemann–Siegel Z. Logged in TODO.

## Self-Review

- All additive; oracle-pinned to mpmath/scipy/sympy.
- hyp2f1 restricted to |z|<1 (throws otherwise — documented); analytic continuation is future work.
