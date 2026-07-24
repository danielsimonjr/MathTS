# Risch Layer 2 — Positive-Discriminant Quadratic Integration (Quadratic Surds) — Design

**Status:** approved 2026-07-21 (autonomous, under the standing "continue to completion" mandate).

**Goal:** Close the most reachable gap Layer 1 declines: rational functions whose denominator has a
**positive-discriminant irreducible quadratic** factor (irrational REAL roots, e.g. `1/(x²−2)`),
integrating them to the real-`log` form `A·log(x−r₁) + B·log(x−r₂)` with `rᵢ = (−b±√Δ)/2`. This needs
a small **quadratic-surd** arithmetic (`a + b√Δ` for one fixed radicand per factor) — NOT a full
algebraic-number field.

**Oracle:** sympy `integrate`, verified by differentiating the result (`dF/dx == f`).

---

## ADR (2026-07-21): quadratic surds now; general Rothstein–Trager / number fields later

The full Rothstein–Trager algorithm handles ANY square-free denominator, but its log-coefficients are
arbitrary algebraic numbers (roots of the resultant `Res_x(a − t·b′, b)`), requiring a general
number-field implementation the repo does not have. That is a genuine subsystem — **Layer 3+**.

A **positive-discriminant quadratic** needs only ONE quadratic surd `√Δ` (`Δ = b²−4c > 0`, non-square
since a square Δ would have split into rational linears already). Its integral is elementary and
expressible with an `a + b√Δ` type scoped to that factor. This is the tractable, high-value increment;
it reuses Layer 1's parse / polynomial-part / partial-fraction machinery and only adds a surd type +
one new `integratePFTerm` branch.

**In scope (Layer 2):** denominators factoring into linear + negative-disc quadratic (Layer 1) +
**positive-disc quadratic, power 1**. **Out of scope (Layer 3):** repeated positive-disc quadratics
(`1/(x²−2)²`), degree-≥3 irreducible denominators, and the general Rothstein–Trager / transcendental
Risch tower — these keep returning the `integral(...)` marker.

## Architecture — extend `functions/src/cas/rational-integrate.ts`

1. **`Surd` type** `{ a: Rat; b: Rat }` representing `a + b·√Δ` for a per-call fixed radicand
   `Δ: bigint` (Δ > 0, non-square). Ops (all take/return values sharing the same Δ): `surdAdd`,
   `surdSub`, `surdMul` (`(a+b√Δ)(c+d√Δ) = (ac+bdΔ) + (ad+bc)√Δ`), `surdDiv` (rationalize by the
   conjugate: divide by `(c+d√Δ)` → multiply by `(c−d√Δ)/(c²−d²Δ)`), `surdFromRat`, `surdNeg`,
   `surdRender(s, Δ, v?)` → string `a + b*sqrt(Δ)` (omit zero/unit parts for readability; a
   perfect-square Δ never occurs here).
2. **Classification:** change `DenFactor.kind` to `'linear' | 'quadratic-neg' | 'quadratic-pos'`.
   `factorDenominator` classifies a degree-2 factor by discriminant sign: `Δ < 0` →
   `'quadratic-neg'` (Layer 1 arctan path, unchanged); `Δ > 0` with **multiplicity 1** →
   `'quadratic-pos'` (new path); `Δ > 0` with **multiplicity > 1** → return `null` (Layer 3). Deg ≥ 3
   irreducible → `null` (unchanged).
3. **`integratePFTerm` new branch — `quadratic-pos`, power 1**, numerator `Dx+E` (`numer=[E,D]`):
   `Δ = b²−4c`; `r₁ = surd(−b/2, 1/2)`, `r₂ = surd(−b/2, −1/2)` (radicand Δ); `r₁−r₂ = surd(0,1)=√Δ`;
   `A = surdDiv(D·r₁+E, r₁−r₂)`, `B = surdDiv(D·r₂+E, r₂−r₁)`. Emit
   `A·log(x − r₁) + B·log(x − r₂)` — render each coefficient and each `x − rᵢ` via `surdRender`, using
   `log(abs(...))` for real-root logs (the argument can be negative). Correctness is the differentiation
   gate; the exact string form is non-contractual.

## Output & regression safety

`symbolicIntegral` gains `1/(x²−2)` etc.; everything else unchanged (the `disc ≥ 0 → decline` guard from
Layer 1's Critical fix is _replaced_ by the mult-1 pos-disc branch, mult>1 still declines). Verified by
differentiation; the Layer-1 regression suites stay green.

## Testing (TDD, differentiation-verified; sympy forms pinned)

Fixtures (all `dF/dx == f`): `1/(x²−2)`, `1/(x²−3)`, `(2x+1)/(x²−5)`, `1/(x²+x−1)` (shifted, Δ=5),
`1/(2x²−3)` (non-monic), `x/((x−1)(x²−2))` (mixed rational-linear + pos-disc quadratic), and a
`1/(x²−2)²` case that STILL returns the marker (Layer-2 boundary), plus the deg-≥3 decline. Regression:
all Layer-1 fixtures (negative-disc arctan, content>1, etc.) stay correct.

## Release

Release A — Layer 2 (`functions` minor): positive-disc quadratic integration. Differentiation-verified,
Layer-1 regression green, `symbolicIntegral` docstring + `docs/reference/functions.md` updated (the
pos-disc-quadratic exclusion becomes an inclusion; deg-≥3 + repeated-pos-disc remain marker), CHANGELOG,
adversarial whole-branch review before publish, clean-tarball verify.
