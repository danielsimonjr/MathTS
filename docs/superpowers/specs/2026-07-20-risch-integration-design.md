# Risch Integration — Design (A-list #8)

**Status:** approved 2026-07-20 (autonomous, under the standing "continue to completion" mandate).

**Goal:** Extend MathTS symbolic integration toward the Risch decision procedure.
Honest scoping (ADR below): #8 is layered, and **Layer 1 = complete integration of
rational functions over ℚ** — the rational-function foundation of Risch — closing the
documented `symbolicIntegral` gaps (irreducible-quadratic denominators → `arctan`/`log`,
repeated factors → Hermite-style rational part). Transcendental (exp/log tower) and
algebraic Risch are documented follow-ups.

**Oracle:** sympy `integrate` (verified: sympy 1.14.0). Results are verified by
**differentiating the produced antiderivative and checking it equals the integrand**
(implementation-independent, the natural oracle for integration) plus spot-comparison of
form against sympy.

---

## ADR (2026-07-20): stage #8; Layer 1 is rational-function integration

Full Risch (Bronstein) — nested transcendental _and_ algebraic extension towers with the
decision procedure that _proves_ non-elementarity — is a ~500-page, multi-week
implementation. Like #7, it decomposes, and the foundation is the **complete
rational-function algorithm**. We ship that first:

- **Layer 1 (this spec) — rational functions over ℚ, complete for linear + irreducible
  quadratic denominators.** Reuses the polynomial factorization engine shipped for #7
  (`squareFreeDecompose`, `factorUnivariateZ`) to factor the denominator, does a
  square-free partial-fraction decomposition, and integrates each factor in closed form
  (log for linear, `arctan` + `log` for irreducible quadratics via completing the square,
  with a reduction formula for repeated factors — the Hermite rational part). Denominators
  with an **irreducible factor of degree ≥ 3** fall back to the existing `integral(...)`
  marker (needs the Rothstein–Trager resultant with algebraic-number log arguments —
  Layer 2).
- **Layer 2 (follow-up) — Rothstein–Trager / Lazard–Rioboo–Trager** for the general
  square-free denominator (degree-≥3 irreducible factors, algebraic-number log
  coefficients).
- **Layer 3 (follow-up) — transcendental Risch** for exp/log extension towers (the "real"
  Risch decision procedure), then the algebraic case.

Layer 1 closes the highest-value real gap (irreducible-quadratic denominators are common
in practice and currently return unevaluated) with bounded, verifiable code that reuses
#7's engine — the same "correct-tractable-now, harder-algorithm-later" trade as #7's
Kronecker choice.

## Verified current state (2026-07-20)

`functions/src/cas-integration.ts` `symbolicIntegral(expr, variable)` handles: power rule,
linearity, `1/x`, linear-substitution of `sin`/`cos`/`exp`/`ln`/`sinh`/`cosh`,
partial-fraction integration of rational functions **with distinct rational linear
factors**, and tabular integration by parts. It **declines (returns `integral(expr, v)`)**
on: general u-substitution, full Risch, and **irreducible-quadratic denominators**. The #7
factorization engine (`functions/src/typed/factorization/`) provides `squareFreeDecompose`,
`factorUnivariateZ`, and `IntPoly` bigint polynomial machinery.

## Layer 1 algorithm — rational-function integration

Input: a rational function `f = p(x)/q(x)` in one variable, rational coefficients.

1. **Detect & normalize.** Parse `f`; if not a rational function of `x`, decline (existing
   paths handle non-rational cases). Clear denominators to integer `p, q`.
2. **Polynomial part.** Divide `p = s·q + r` (deg r < deg q). Integrate the polynomial `s`
   termwise (power rule). Continue with the proper part `r/q`.
3. **Factor the denominator.** Factor `q` over ℚ into irreducible factors with
   multiplicities via the #7 engine: `q = c·∏ qᵢ^{eᵢ}`, each `qᵢ` irreducible (linear or
   quadratic in Layer 1; degree ≥ 3 ⇒ decline to the marker).
4. **Partial fractions.** Decompose `r/q = Σ_i Σ_{k=1}^{eᵢ} A_{i,k}(x) / qᵢ^k`, where
   `deg A_{i,k} < deg qᵢ` (so `A` is a constant over a linear `qᵢ`, or linear `Dx+E` over
   a quadratic `qᵢ`). Solve the linear system for the coefficients over ℚ.
5. **Integrate each term:**
   - **Linear `qᵢ = x − a`:** `A/(x−a) → A·log|x−a|`; `A/(x−a)^k (k>1) → −A/((k−1)(x−a)^{k−1})`.
   - **Irreducible quadratic `qᵢ = x² + bx + c`** (discriminant `< 0`): write the numerator
     `Dx+E = (D/2)(2x+b) + (E − Db/2)`. Then
     `∫ (D/2)(2x+b)/(x²+bx+c) = (D/2) log(x²+bx+c)`, and
     `∫ (E − Db/2)/(x²+bx+c) = (2(E−Db/2)/√(4c−b²))·arctan((2x+b)/√(4c−b²))`.
     For `k>1`, apply the standard reduction formula
     `∫ dx/(x²+bx+c)^k` recursively down to `k=1`.
6. **Assemble** the antiderivative string (rational part + logs + arctans), rendered in the
   existing `symbolicIntegral` output style. Constant of integration omitted (convention).

Coefficients stay exact rational (`bigint` numerator/denominator) through the partial-
fraction solve; irrational surds appear only inside the final `√(4c−b²)` / `arctan`
rendering, emitted symbolically (`sqrt(...)`), matching how sympy renders them.

## Output contract & regression safety

`symbolicIntegral`/`integrate` stay string→string (or number for definite). Every input the
current engine handles must produce an equivalent antiderivative (verified by
differentiation, since exact string form is not contractual — see
`cas-passthrough-documented.test.ts`). New capability: closed-form integration of rational
functions with irreducible-quadratic and repeated factors. Degree-≥3 irreducible
denominators still return the `integral(...)` marker (documented Layer 2).

## Testing (TDD, oracle-pinned)

Verify each result by **differentiating it and checking equality to the integrand**
(numerically at sample points AND, where feasible, symbolically), plus form-comparison with
sympy `integrate`. Fixtures: `1/(x^2+1) → arctan(x)`; `1/(x^2+x+1)` (completing the square,
`sqrt(3)`); `(3x+2)/(x^2+1)` (log + arctan); `x/(x^2+1)^2` (Hermite — purely rational
result); `1/(x^3+x)` (mixed log + arctan via `x(x^2+1)`); repeated linear
`1/((x-1)^2(x+2))`; a proper-part case `x^3/(x^2+1)`; and a degree-3 irreducible denominator
that must still return the marker (Layer-2 boundary).

## Release

- **Release A — Layer 1** (`functions` minor): complete rational-function integration.
  Differentiation-verified + sympy-form-pinned, existing integration suites green,
  `symbolicIntegral` docstring + `docs/reference/functions.md` updated, CHANGELOG. Each step
  through the full dev-workflow, clean-tarball verified.
- **Release B/C — Layer 2 (Rothstein–Trager), Layer 3 (transcendental Risch)** — follow-ups.
