# Multivariate Polynomial Factorization over ℤ — Design (A-list #7)

**Status:** approved 2026-07-20. Supersedes the "OUT OF SCOPE" note in
`functions/src/typed/algebra.ts` `factor`/`factorMultivariate` docstrings.

**Goal:** Give MathTS a _complete_ polynomial factorizer over ℤ/ℚ — both
univariate and multivariate into irreducible factors — replacing today's
rational-linear-root + monomial-content-only partial factorizer.

**Oracle:** sympy `factor_list` (verified available: sympy 1.14.0). Every
factorization is checked by canonicalized factor-set equality against sympy.

---

## 1. Why this is a two-layer build

Today `functions/src/typed/algebra.ts` `factor(expr)` does:

- **Univariate:** `findRationalLinearFactors` — extracts _linear_ rational
  factors via the rational-root theorem, leaves any higher-degree remainder
  intact. So `x^4 + 1`, `(x^2+1)(x^2+2)`, cyclotomics past degree 1 are **not**
  factored.
- **Multivariate:** `factorMultivariate` — integer content + common monomial +
  monomial difference-of-squares only.

Wang's multivariate algorithm reduces a multivariate polynomial to a
**univariate image** (evaluate all but the main variable at integers), factors
that image, then Hensel-lifts the factorization back up. Its base case is a
_complete univariate factorizer over ℤ_. MathTS does not have one. Therefore #7
is two layers, built and released in order:

1. **Layer 1 — univariate factorization over ℤ** (Zassenhaus). Independently
   valuable and shipped first as its own release.
2. **Layer 2 — multivariate factorization** (Wang / EEZ), built on Layer 1,
   shipped as a follow-up release.

Starting at Layer 2 on top of the broken Layer 1 is the documented failure mode
("the middle of Wang's algorithm").

## 2. Architecture — new module; `factor` routes into it

New internal tree `functions/src/typed/factorization/`. `algebra.ts`'s `factor`
keeps its cheap fast-paths (integer content, common monomial, difference of
squares, rational-linear roots) and **routes** unresolved inputs into the new
engine — the route-don't-reimplement pattern (see memory
`project-two-decomposition-layers-prefer-matrix`). No third factorization path
is created; the engine is the single source of truth for irreducible
factorization, the fast-paths are only an optimization that must agree with it.

```
functions/src/typed/factorization/
  integer-poly.ts   Dense univariate poly over bigint. Exact add/sub/mul,
                    pseudo-division & exact division, content/primitive part,
                    bigint gcd, evaluation, mod-m reduction, Landau–Mignotte bound.
  finite-field.ts   Poly ops in 𝔽_p (p prime, machine-size): mul/divmod/gcd/
                    powmod, square-free test, distinct-degree factorization,
                    Cantor–Zassenhaus equal-degree factorization.
  square-free.ts    Yun square-free decomposition over ℤ (returns [factor, mult]).
  hensel.ts         Landau–Mignotte coefficient bound; quadratic Hensel lifting
                    of a mod-p factorization to mod-p^k with p^k > 2·bound.
  zassenhaus.ts     LAYER 1 orchestration: content → square-free → choose good
                    prime → factor mod p → Hensel lift → subset recombination by
                    exact trial division over ℤ.
  wang.ts           LAYER 2: recursive multivariate poly (main var, coeffs are
                    multivariate polys); multivariate content; evaluation-point
                    search; Wang leading-coefficient distribution; multivariate
                    (EEZ) Hensel lifting; recombination.
  index.ts          factorPolynomial(expr, vars) — string↔poly bridge, dispatch
                    to Layer 1 (1 var) or Layer 2 (≥2 vars); returns the sorted,
                    normalized factor list. Entry point algebra.ts calls.
```

## 3. Number representation — bigint, non-negotiable

The current engine uses `number[]` (float64) with `isNearInt`. Hensel lifting
raises the modulus to `p^k` where `p^k > 2·` the **Landau–Mignotte bound**; for a
degree-20 polynomial with modest coefficients that bound already exceeds `2^53`,
so float64 would silently corrupt the lift. The entire factorization engine uses
**`bigint`**.

- **Univariate poly:** `bigint[]` dense, index = degree, `poly[poly.length-1]`
  is the leading coefficient (nonzero by construction).
- **Multivariate poly:** **recursive** — a poly in the main variable whose
  coefficients are themselves multivariate polys in the remaining variables
  (leaf = `bigint`). This is the natural shape for "evaluate the other variables,
  lift back one variable at a time."
- **𝔽_p arithmetic:** `bigint` reduced mod `p` after each op. `p` is a
  machine-size prime; products stay well within bigint range.

## 4. Layer 1 algorithm (univariate over ℤ) — Zassenhaus

Input: primitive integer poly `f`, `deg f ≥ 1`.

1. **Content & primitive part.** Pull integer content `c = gcd(coeffs)`; record
   sign so the leading coefficient of the primitive part is positive. Factor `c`
   is _not_ required (it is an integer constant factor, emitted verbatim).
2. **Square-free decomposition** (Yun): `f = ∏ gᵢ^i`, each `gᵢ` square-free and
   pairwise coprime. Factor each `gᵢ` separately; raise its irreducibles to
   power `i`.
3. **Choose a prime `p`:** `p ∤ lc(gᵢ)` and `gᵢ mod p` stays square-free
   (`gcd(ḡ, ḡ') = 1` in `𝔽_p`). Try successive small primes; pick the one giving
   the fewest modular factors among the first few candidates (fewer factors →
   cheaper recombination).
4. **Factor `gᵢ mod p`:** distinct-degree split, then Cantor–Zassenhaus
   equal-degree. Yields monic irreducibles over `𝔽_p`.
5. **Hensel lift** the mod-`p` factorization to mod-`p^k` where
   `p^k > 2·B`, `B` = Landau–Mignotte bound for `gᵢ` — via quadratic (linear)
   Hensel step, maintaining the Bézout cofactors.
6. **Recombination (Zassenhaus).** Search subsets of the lifted factors; for
   each candidate subset form the product, reduce its coefficients to the
   symmetric range mod `p^k`, and test whether it **exactly divides** `gᵢ` over
   ℤ. Confirmed subsets are true irreducible factors; remove and continue.
   - **Factor-count cap:** if the number of modular factors exceeds `MAX_MODULAR
_FACTORS` (24), abandon full recombination and return the input as a single
     factor at that square-free level (correct but not fully factored), and
     `log()` that the cap was hit. van Hoeij / LLL recombination is an explicit
     out-of-scope follow-up (§7).

Output: sorted list of `[irreducible, multiplicity]` plus the integer constant.

## 5. Layer 2 algorithm (multivariate)

> **ADR (2026-07-20): Layer 2 v1 uses Kronecker substitution, not Wang/EEZ.**
> The original design below specified Wang/EEZ. For the first correct, shippable
> Layer 2 we instead reduce multivariate factorization to the **already-shipped
> Layer 1 univariate engine** via **Kronecker substitution** — the same
> "correct-tractable-now, faster-algorithm-later" trade Layer 1 made with
> Zassenhaus-vs-van-Hoeij. Rationale: Wang/EEZ's multivariate Hensel lifting and
> leading-coefficient distribution are the highest-bug-risk code in CAS and
> require multivariate GCD + square-free machinery underneath; Kronecker needs
> none of that and reuses `factorUnivariateZ` directly. **Wang/EEZ (§5b) is the
> documented performance follow-up** for inputs where Kronecker's degree blowup
> (`∏(degᵢ+1)`) is prohibitive.
>
> ### 5a. Kronecker substitution (Layer 2 v1 — what ships)
>
> Input: integer poly `f` in variables `x₁..xₙ`, `n ≥ 2`.
>
> 1. **Integer content.** Pull the integer content (gcd of all bigint
>    coefficients) and sign; work on the primitive part `g`. (No multivariate
>    GCD needed — recombination + trial division recovers all structure.)
> 2. **Substitution base.** Let `dᵢ = deg_{xᵢ}(g)`. Choose bases
>    `b₁ = 1, bₖ = ∏_{i<k}(dᵢ+1)` so the map `xₖ ↦ x^{bₖ}` (with `x = x₁`) is
>    injective on the monomials of `g` and of every possible factor
>    (`deg_{xᵢ}(factor) ≤ dᵢ`). The substituted univariate degree is
>    `D = Σ dᵢ·bᵢ = ∏(dᵢ+1) − 1`.
> 3. **Degree cap.** If `D > KRONECKER_MAX_DEGREE` (e.g. 2000), skip — return
>    `g` via the existing multivariate fast-paths and `log()` the cap (no silent
>    wrong answer, no hang). This is the Kronecker analogue of Layer 1's
>    factor-count cap.
> 4. **Substitute & factor.** `F(x) = g(x, x^{b₂}, …, x^{bₙ})`; factor `F` with
>    `factorUnivariateZ` (Layer 1) into irreducibles over ℤ.
> 5. **Recombination.** Each true irreducible factor of `g` maps to a subset of
>    `F`'s irreducible factors. Enumerate subsets (increasing size); for each,
>    back-substitute the product (read univariate exponents in mixed-radix
>    `(d₁+1, d₂+1, …)` to recover the multivariate monomials — reject any subset
>    whose back-substitution has a per-variable degree `> dᵢ`, i.e. an invalid
>    "carry"), and test **multivariate exact division** into the current
>    cofactor. A subset that divides is a true irreducible factor; divide it out
>    (repeatedly, capturing multiplicity) and continue. The leftover cofactor
>    (if non-constant) is the final factor. Same cap on subset count as Layer 1.
> 6. **Output & render** factors with positive leading term, canonical order,
>    matching the existing multivariate `idealPolyToString` conventions.
>
> Correctness: division is the arbiter, so no false factor can be emitted; every
> true factor is some subset, so completeness holds up to the cap. Oracle:
> sympy `factor_list` on multivariate inputs.
>
> ### 5b. Wang / EEZ (future performance upgrade — NOT in v1)

Input: primitive multivariate integer poly `f` in variables `x₁..xₙ`, `n ≥ 2`.

1. **Content in the main variable.** Choose the main variable `x₁` (e.g. the one
   of least degree to reduce lifting work). Extract the multivariate content
   `cont_{x₁}(f)` (gcd of the `x₁`-coefficient polys, themselves multivariate)
   and factor it recursively; work on the primitive part.
2. **Evaluation point.** Pick integers `a = (a₂..aₙ)` for the non-main variables
   such that: `lc_{x₁}(f)(a) ≠ 0`, `deg_{x₁} f(x₁,a) = deg_{x₁} f`, and
   `f(x₁,a)` is square-free. Retry with fresh points on failure (bounded number
   of attempts, then fail loudly — never return a wrong factorization).
3. **Factor the univariate image** `f(x₁,a)` with Layer 1.
4. **Leading-coefficient distribution (Wang).** Factor the true multivariate
   leading coefficient `lc_{x₁}(f)`; use its evaluated numeric value and the
   distinct prime structure to assign each univariate image factor its correct
   multivariate leading coefficient before lifting. This is the step that makes
   the lift well-posed and is where naive implementations fail.
5. **Multivariate Hensel lifting (EEZ).** Lift the (LC-corrected) univariate
   factors from `x₁,a` to full multivariate factors, reintroducing
   `x₂,…,xₙ` one variable at a time (or by total degree), solving the
   multivariate diophantine equation at each step with the Bézout cofactors from
   the univariate image.
6. **Recombination / trial division.** Confirm lifted factors by exact division
   over ℤ; combine leftover factors as needed (an image may correspond to a
   product of true factors when the evaluation caused a "false" split).

Output: sorted list of `[irreducible, multiplicity]` plus the integer constant.

## 6. Output contract & regression safety

`factor(expr)` and `casFactor(expr)` remain **string → string**. Two hard
requirements:

- **No regression on already-handled cases.** Every input the current `factor`
  handles must produce byte-identical output. The existing `algebra` /
  `cas` test suites are the regression gate, run before and after each task.
  The cheap fast-paths that produce those exact strings are preserved and run
  first; the engine is only consulted when they don't fully resolve.
- **Canonical form for new outputs.** Irreducible factors are content/sign
  normalized (positive leading coefficient, integer content pulled to the
  front), sorted by (degree, then lexicographic monomial order), rendered via
  the existing `idealPolyToString`. Deterministic across runs.

Correct irreducibility over ℤ/ℚ means `x^2+1`, `x^4+1`, `x^2+x+1` come back
**unchanged** (irreducible over ℚ) — matching sympy, not "failed to factor".

## 7. Scope boundaries (YAGNI)

**In scope:** factorization over ℤ (equivalently ℚ after clearing content),
univariate and multivariate, into irreducible factors with multiplicity.

**Explicitly out of scope (documented follow-ups, not silent gaps):**

1. **Factoring over ℝ, ℂ, or algebraic number fields** (`x^2+1` stays
   irreducible). No `extension=` option.
2. **van Hoeij / LLL recombination.** Layer 1 uses Zassenhaus with a
   factor-count cap; pathological many-modular-factor inputs (e.g. large
   Swinnerton-Dyer polynomials) beyond the cap return partially factored with a
   logged notice. van Hoeij is the future upgrade path.
3. **Finite-field factorization as a public API.** `𝔽_p` machinery is internal
   to the engine only.
4. **Rational-function / partial-fraction changes.** This spec is polynomial
   factorization only; the existing `apart`/`together` are untouched.

## 8. Testing strategy (TDD, oracle-pinned)

Per layer, RED→GREEN with sympy as oracle. A shared test helper expands a
known factored form, feeds the expansion to our `factor`, and asserts the
**canonicalized factor set** equals sympy's `factor_list`.

**Layer 1 fixtures:** linear products; repeated factors (`(x-1)^3(x+2)`);
irreducibles that must stay whole (`x^2+1`, `x^4+1`, `x^2+x+1`); cyclotomic
polynomials; a moderate Swinnerton-Dyer polynomial (recombination stress, under
the cap); content + primitive (`6x^2-6`); negative leading coefficient.

**Layer 2 fixtures:** `x^2 - y^2` → `(x-y)(x+y)`; `x^2*y + x*y^2 + x + y` →
`(x+y)(x*y+1)` (verified against sympy); nontrivial LC distribution
(`(x*y+1)(x+y+1)` expanded); three-variable case; content extraction
(`2*x^2*y - 2*y`); repeated multivariate factor; an irreducible multivariate
poly that must stay whole.

**Regression:** the full existing `functions` `algebra`/`cas` suites green
before and after every task.

## 9. Release plan

- **Release A — Layer 1** (`functions` minor): complete univariate factorization
  over ℤ. Oracle-pinned, existing suites green, `factor`/`casFactor` docstrings
  updated, `docs/api/functions.md` factor entry updated, CHANGELOG.
- **Release B — Layer 2** (`functions` minor): multivariate Wang/EEZ on top of
  Layer 1. Same gates. Removes the "OUT OF SCOPE" docstring notes.

Each release goes through the full dev-workflow (TDD → review → simplify →
re-verify → docs → CHANGELOG → commit → push → Changeset → npm), verified
published by clean-tarball install, per `reference-npm-is-the-release-record`.
