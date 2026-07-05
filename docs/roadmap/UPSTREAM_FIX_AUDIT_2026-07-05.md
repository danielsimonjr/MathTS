# Upstream mathjs fix audit (B-5) — 2026-07-05

**Scope.** All 61 commits of upstream-fork drift (`danielsimonjr/Mathjs`, local clone at
`C:\Users\danie\Github\Mathjs`) since the last sync `55dea0d71` (2026-04-02), audited for
applicability to MathTS's activated code. The `.ts→.ts` sync model is dead (upstream
TS-split `e62bcd749`), so every applicable fix was evaluated against MathTS's own
implementations and ported/re-fixed by hand.

## Verdict summary

| Upstream commit                                                 | What it fixed       | MathTS verdict                                                                                                                 |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `3c355ade9` (6 CRITICAL, 6 HIGH)                                | fork's JS CAS layer | **MathTS implementations are INDEPENDENT rewrites** — same names, different code. Audited each bug CLASS behaviorally (below). |
| `ece1aab0f` (astronomical/nautical/typography units)            | fork Unit.js        | **PORTED** to `core/src/types/unit/Unit.ts` (10 units + aliases + NIST/IAU pins).                                              |
| `5f360326b` (tighten ly/pc prefixes; drop `au`)                 | fork Unit.js        | **PORTED** (SHORT_UP_ONLY prefix table; `mly`/`mpc` throw; lowercase `au` stays undefined — Bohr-radius collision).            |
| `4d94b080d` (version resync), CI/build/test-harness fixes (~10) | mathjs repo infra   | N/A — repo-specific.                                                                                                           |
| ~45 `chore(deps)` / docs commits                                | mathjs deps/docs    | N/A.                                                                                                                           |

## Per-bug-class verdicts for `3c355ade9` against MathTS's implementations

Probed behaviorally (correct APIs) on 2026-07-05:

| Bug class (upstream)                         | MathTS function                           | Verdict                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| groebnerBasis fabricated output for >2 polys | `typed/cas.ts groebnerBasis`              | **WORSE BUG FOUND + FIXED**: no Buchberger at all (returned inputs "normalized"), and the evaluation-based parser couldn't distinguish x from x² — ⟨x²+y²−1, x−y⟩ came back containing x+y−1, which does not vanish on the variety. **Rewritten**: exact AST-parsed polynomials + real Buchberger with honest caps (`typed/polynomial-ideal.ts`). 3-poly systems now work (better than upstream, which throws). |
| eliminate silent fallback                    | `typed/algebra.ts eliminate`              | **FAKE FOUND + FIXED**: returned decorative strings (`"(A) - (B) [x eliminated]"`), echoed garbage. **Rewritten** as the real elimination ideal (lex Gröbner basis, eliminated variable first); garbage throws.                                                                                                                                                                                                 |
| laplacian variables validation               | `typed/cas.ts laplacian`                  | **PORTED**: empty array / empty-string / missing-scope variables now throw clear errors (previously silent 0).                                                                                                                                                                                                                                                                                                  |
| discriminant div-by-zero + constants         | `typed/algebra.ts discriminant(coeffs[])` | **CLEAN**: trims trailing zero coefficients (deg-1 disc = 1 convention), throws on constants; −4 / −256 pins verified.                                                                                                                                                                                                                                                                                          |
| piecewise truthy-string on failed condition  | `typed/cas.ts piecewise`                  | **CLEAN**: failed/false conditions skip the branch (returns null when nothing matches).                                                                                                                                                                                                                                                                                                                         |
| toRadicals double inversion                  | `typed/cas.ts toRadicals`                 | N/A — different semantics (numeric root-finder, not radical rewriting); ±√2 case verified correct.                                                                                                                                                                                                                                                                                                              |
| fullSimplify swallowed all-strategy failure  | `typed/algebra.ts fullSimplify`           | N/A — different design (cosmetic regex passes, no strategy-catch chain).                                                                                                                                                                                                                                                                                                                                        |
| complexExpand regex escaping                 | `typed/algebra.ts complexExpand`          | N/A — fixed regexes only, no user input interpolated into patterns.                                                                                                                                                                                                                                                                                                                                             |
| reduce nonpositive filter                    | `typed/algebra.ts reduce`                 | N/A — entirely different function (expression reducer; no domain filters).                                                                                                                                                                                                                                                                                                                                      |
| rowReduce unused deps                        | `typed/matrix-ops.ts rowReduce`           | N/A — independent implementation.                                                                                                                                                                                                                                                                                                                                                                               |
| assume global-state JSDoc                    | `typed/cas.ts assume`                     | N/A-docs.                                                                                                                                                                                                                                                                                                                                                                                                       |

## Tests

- `functions/tests/gap-groebner-eliminate-oracles.test.ts` — 12 oracle pins (ideal-membership
  vanishing at hand-computed solutions; elimination-ideal correctness; validation throws).
- `functions/tests/algebra.test.ts` — the two stale pins of the fake `eliminate` replaced
  with mathematical assertions.
- `core/tests/types/unit-external-reference.test.ts` — 17 new IAU/NIST-pinned unit
  conversions + prefix-direction + `au`-absence pins.

Gates: build 22/22, test 44/44 (functions 147 files / 3302+, core 485), typecheck 28/28.

**B-5 is closed.** Future upstream fixes require the same manual audit — there is no sync.
