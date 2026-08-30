# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Risch Layer 3** (`functions/src/cas/layer3.ts`): Hermite reduction + Rothstein–Trager /
  residue-formula integration for rational functions with degree-≥3 irreducible denominators
  (and repeated positive-discriminant quadratics). `1/(x^3-2)` and `1/(x^3+x+1)` now return
  closed forms that differentiate back to the integrand. `1/(x log x) → log(log x)`.
- **Spheroidal wave functions**: `spheroidalLambda` / `spheroidalAngular` / `spheroidalRadial`
  / `ferrersP` (prolate angular characteristic values and `S_mn(c, η)` via the
  associated-Legendre expansion).
- **Workbook `--expect-hash`**: `mtsw run --expect-hash <sha256>` is an optimistic lock —
  refuse to execute if the file's SHA-256 does not match.
- **SVG math typesetting**: `mathMLToSVG` wraps MathML in an SVG `foreignObject`.
- **Public-API smoke coverage**: representative (and heuristic) calls across the functions,
  core, matrix, workbook, expression, tensor, autograd, plot, gpu, parallel, and compat
  export surfaces so `test:coverage` exercises nearly every published function.

### Fixed

- **Root vitest aggregate no longer crashes on VERSION-bearing packages.** `npx vitest run`
  and `test:coverage` import `core`/`plot`/`workbook` source directly; without the per-package
  tsup `define` those modules threw `ReferenceError: __PKG_VERSION__ is not defined` (20 test
  files). Root `vitest.config.ts` now applies a small transform plugin that injects each
  package's version from its nearest `package.json`, matching the per-package vitest configs.

### Security

- **Workbook code cells: regression tests for the expression sandbox.** `executor.test.ts` now
  asserts that `import(...)` and `f(x) = …` assignments are rejected when evaluated through the
  workbook executor (the path `.mtsw` notebooks actually use).

### Fixed

- **The weekly dev-dependencies PR is no longer permanently red.** Every group PR pulled
  typescript 7.x, which `npm ci` rejects with ERESOLVE because
  `@typescript-eslint/eslint-plugin` (8.68.0, current stable) still declares
  `peer typescript ">=4.8.4 <6.1.0"`. One blocked package held back the other 19 updates in the
  group (PR #265). Dependabot now ignores **major** typescript updates only; 6.x minor and patch
  updates still flow. Remove that ignore when typescript-eslint raises its ceiling, and bump
  typescript and typescript-eslint together in one PR.

- **Architecture Verification claims refreshed after the #263 release.** `totalTypeScriptFiles`
  1880 -> 1881 and `totalLinesOfCode` 332049 -> 332379 across six documents. `totalExports` was
  already correct at 7620.

### Fixed

- **Architecture Verification blocks were stale; the drift gate is green again.** Six documents
  claimed `totalTypeScriptFiles` 1824, `totalExports` 7564 and `totalLinesOfCode` 333583, against
  an actual 1880 / 7620 / 332049 — about 56 files of real growth since the blocks were last
  written. Checked rather than assumed: running discovery both by git file list and by filesystem
  walk gives 1880 and 1882, so the gap is code drift and not a change of instrument.
  Regenerate with `npm run docs:deps`; check with
  `repo_map.py check . --docs docs/Architecture`.

### Fixed

- **The Release workflow could not create a version PR** — `@changesets/cli` bumped to
  `^3.0.0`. `changesets/action` had been upgraded to v2.0.0 while the CLI stayed on
  `^2.27.0`, and action v2 refuses CLI v2 outright: *"This version of the Changesets action
  is designed to work with Changesets CLI v3."* The Release job therefore failed on every
  push to `main`, which is why the standing `chore: release packages` PR (#209) went stale.
  A companion-version pair upgraded on one side only — bump both together.
- **Branch protection on `main` required two status checks that no longer exist.**
  `Build & Test (20.x)` / `Build & Test (22.x)` were renamed to `Test (20.x)` / `Test (22.x)`
  by `104a1c90`, but the protection rule was never updated, so two required contexts could
  never report and **every pull request was permanently `BLOCKED`** — which is the real
  explanation for the 41-PR backlog. Required contexts now match the emitted job names, and
  `Compile & Lint` was added: typecheck and lint were previously **not gating merges at all**.

- **`derivative()`'s `order` option was silently removed, along with the test that proved it
  worked.** `{ order: 0 }`, `{ order: 2 }` and `{ order: 3 }` all returned the **first**
  derivative, and a negative or non-integer `order` was accepted instead of throwing. Both
  the loop and the `TypeError('Option "order" must be a non-negative integer')` guard are
  restored.
  - **`simplify` also regressed.** `options.simplify !== false` had become a truthiness test,
    so any options object omitting `simplify` — including `{ order: 2 }` — silently returned
    an unsimplified tree (`3 * 1 * x ^ (3 - 1)` rather than `3 * x ^ 2`), contradicting the
    `{ simplify: true }` default used when no options are passed.
  - **Root cause, and why CI never caught it:** both entered in `d25f00a9` — *"Fix dynamic
    code execution vulnerability in CAS evaluator"* — a 56-file commit (+3,059/−4,492) whose
    only parent is PR #153's merge commit and which **deleted 6 test files**, including
    `functions/tests/derivative.test.ts`. The capability and its evidence were removed
    together, so the suite stayed green. Three of those six test files were restored weeks
    later by PRs #203/#204/#205; the remaining three are restored here
    (`derivative.test.ts`, `matrix/tests/backends/ParallelBackend.test.ts`,
    `matrix/tests/parallel-matrix.test.ts` — 426 lines).
  - `ParallelBackend.ts` (370 lines) and `parallel-matrix.ts` (1,078 lines) had **no test
    coverage at all** in the interim: the commit deleted their tests but kept the source,
    which continued to ship.
  - The restored `derivative.test.ts` fails against the regressed implementation and passes
    against the fix, so it gates the behaviour rather than merely documenting it. The genuine
    security fix from that commit (`functions/src/typed/cas.ts`, removing an
    `evaluate(tensorDef, scope)` dynamic-evaluation path) is untouched.

- **`Complex.fromPolar(Infinity, 0)` is `Infinity+0i`, not `NaN`.** IEEE 754 makes
  `Infinity * 0` a NaN, so `fromPolar` (and therefore `z^w` for a denormal positive
  real raised to a negative power) returned `NaN` on the imaginary part. Restore the
  signed-zero trig component when the magnitude is infinite and `cos`/`sin` is
  exactly 0. Pinned by the CI counterexample
  `pow(Complex(5e-324, 0), -0.953…)` that was failing `toBeCloseTo(NaN, NaN)` on
  `main`.

### Security

- **Expression object literals go through `setSafeProperty` at parse and compile.**
  `{__proto__: …}` assigned into a plain object during parse, which sets
  `[[Prototype]]` rather than creating an own key. `ObjectNode._compile` also wrote
  `obj[key] =` directly, bypassing the sandbox helper the tree-walking compiler
  already used. Both paths now fail closed.
- **Workbook chart-spec YAML uses the pollution guard.** `validate` / SVG render
  parsed visualization-cell YAML without walking for `__proto__`/`constructor`/
  `prototype`. New `parseYamlSafe` is the fail-closed entry; `importWorkbook` now
  rejects polluted input before the serialize round-trip.

### Changed

- **CI is a compile gate plus parallel test/coverage/browser.** Coverage and the
  browser smoke no longer wait for the full Node 20+22 test matrix. Workflows pin
  `actions/checkout` / `setup-node` / `codecov-action` to SHAs, run with
  `contents: read`, and add `docs:functions:check`,
  `check:browser-safety`, and `npm audit --audit-level=high`. Dependabot no longer
  targets the phantom `/packages/{core,matrix,workbook}` directories (the real
  packages live at the repo root; those jobs were failing weekly).

### Removed

- Deleted 13 stale source files that sat on disk, were never in any commit, and had made the
  repo **uncommittable**: the `check:file-census` pre-commit hook correctly rejected every
  commit while they were present, which is how a routine lockfile bump surfaced them.

  They are leftovers from two *completed* consolidations, not lost work:

  - `expression/src/{error/MathjsError,utils/switch,utils/bignumber/formatter}.ts`,
    `functions/src/{error/MathjsError,utils/bignumber/formatter}.ts` and their three tests
    predate the move onto `@danielsimonjr/mathts-core/internal`. `core/src/switch.ts`,
    `core/src/bignumber-formatter.ts` and `core/src/error/MathjsError.ts` are the tracked
    canonicals, **no file under `expression/src` or `functions/src` imports the local
    copies**, and the census flagged three of them as orphans outright. The repo says so in
    its own words — `functions/tests/dedup-bucketB-equivalence.test.ts` records that these
    copies "became thin re-export shims of core and were deleted".
  - `docs/Architecture/Workbook/*.ts` is an earlier prototype of the tracked `workbook/`
    package (25 files; its `cli.ts` is 1,471 lines against the prototype's 676).

  Committing them would have resurrected code that was deliberately removed. Also drops three
  tracked `.d.ts.map` files whose `.ts` sources were never in git — generated artifacts swept
  in by a build step, which is the tell that first exposed the whole inconsistency.

### Security

- `js-yaml` 4.3.0 -> 4.3.1 in the ROOT lockfile, clearing the last open alert here. PR #207
  patched only `tools/create-dependency-graph/package-lock.json`; the same advisory applied
  to both manifests and the root one was left behind.


### Added

- **Architecture docs are now drift-gated.** Every authored document under `docs/Architecture/`
  carries a `## Verification` block naming the metrics it depends on, so `repo_map.py check`
  fails when the code moves underneath them. Nothing verified these documents before.

  **Reachability metrics are deliberately absent from those blocks.** `repo_map` treats this repo
  as a single package and finds **0 entry-point roots** for the workspace umbrella, so
  `reachableFiles`, `dormantFiles`, `orphanedFiles` and `testOnlyFiles` would be artifacts of that
  empty root set rather than measurements — it emits a warning saying exactly that. CDG runs in
  monorepo mode with per-package roots and remains authoritative for reachability; the blocks say
  so and point at `FILE_INVENTORY.md`. The two tools disagree by scope, not correctness.

  `COVERAGE_POLICY.md` and `duplicate-backlog.md` carry an explicit
  `<!-- repo-map:no-verification -->` opt-out instead: a policy document and a working list make
  no repo-wide metric claim. The opt-out is visible in the source, never inferred from a missing
  section.

- **`npm run docs:deps:full`** — regenerates every report including `TEST_COVERAGE.md`, which
  needs `--include-tests`. Plain `docs:deps` silently omits it, so that file could only be
  refreshed by a manual invocation nobody would guess: a staleness trap in itself.

### Changed

- **CDG now emits a do-not-edit banner** at the top of all eight generated Markdown reports
  (`DEPENDENCY_GRAPH`, `FILE_INVENTORY`, `TEST_COVERAGE`, `duplicate-symbols`, `unused-analysis`,
  `wasm-pairing`, `parallel-pairing`, `webgpu-pairing`), carrying the drift gate's
  `<!-- repo-map:no-verification -->` marker and naming the regeneration command. Emitted by the
  generator rather than added by hand: a hand-added marker survives only until the next
  regeneration, and then the gate fails a cycle later looking like a new bug.


### security: clear the vitest critical — a stale LOCK, not a loose range

Four open advisories, all resolved in the lockfiles rather than by loosening anything:
**`@vitest/browser`** (critical — arbitrary file read/execute while the Vitest UI server listens),
**`postcss`** (high), and **`tar`** in both `tools/*/package-lock.json` (medium).

**The manifests already permitted the fix.** Root declared `@vitest/browser ^4.1.7`, which admits
4.1.10 — the lock had simply resolved 4.1.8 and npm will not move a resolution that still satisfies
its range. Same shape as the json-render strand: *manifest fixed, lock not*, and reading the manifest
would have reported the repo healthy.

Neither `npm update` nor `npm audit fix` could move it, and the reason is worth recording:
**`@vitest/browser@4.1.10` peers on `vitest@4.1.10` exactly**, so the whole `@vitest/*` set has to
move in lockstep — and any one of the 23 workspaces holding a lower floor pins the entire tree.
Raising the root alone produced `ERESOLVE`. The floor is now `^4.1.10` across the root and all 23
workspaces, which is the only state npm can satisfy.

Verified against **installed** `node_modules`, not the lock: `vitest` 4.1.10, `@vitest/browser`
4.1.10, `postcss` 8.5.25; `tar` 7.5.16 → 7.5.22 in both tool lockfiles.

⚠ Noted, not changed: `docs/Architecture/Workbook/package.json` declares `vitest ^3.2.6` and is
**not** a declared workspace — the globs are `packages/*` plus named directories and it matches
neither. It is a documentation fixture that the dependency graph will index like a real manifest.
See `reference_doc_fixture_manifests_alert_forever`.

### ci(release): make the Release workflow versioning-only — it must never publish

`release.yml` ran `changesets/action` with `publish: npx changeset publish` on every push to
`main`. That input makes the action dual-purpose: with pending changesets it opens the version PR,
but with **none** pending it runs the publish command — so an ordinary commit tried to push all 24
packages to npm.

It failed **every single time it had something to publish** — 4 runs, each one a version-bump
commit (2026-07-16, two on 07-21, 07-27); the other 176 runs were "green" only because the
registry already had those versions and `changeset publish` no-op'd. On 2026-07-27 it also **raced
a local publish** for the same version numbers.

The failure was not simply a missing secret. `NPM_TOKEN` was empty, but the workflow also granted
`id-token: write`, so changesets **skipped the empty token and fell back to npm trusted publishing
over OIDC** (`No NPM_TOKEN found, but OIDC is available`) before dying `ENEEDAUTH`. A permission
granted "just in case" selected a different, equally dead code path.

Publishing is deliberately a **local, manual step** — only one machine holds a valid npm token, and
that is where releases are cut and verified against the registry. CI's job is the gate, not
delivery.

- **Removed** the `publish:` input, `NODE_AUTH_TOKEN`/`NPM_TOKEN` env, `id-token: write`, and
  `setup-node`'s `registry-url` (which exists only to write a publish-time `.npmrc`).
- **Removed** the build step — `changeset version` only rewrites `package.json` + `CHANGELOG.md`;
  building was for the publish that no longer happens here. `ci.yml` remains the workflow that
  builds and tests.
- **Kept** the half that is genuinely in use: opening the `chore: release packages` PR from pending
  `.changeset/*.md` files.
- Job renamed `Release` → `Version`, and a header comment records why re-adding a publish step
  would be a regression.

### feat(functions): positive-discriminant quadratic integration (Risch Layer 2)

- **`symbolicIntegral` / `integrate`** now integrate rational functions whose denominator has a
  **positive-discriminant irreducible quadratic** factor (irrational real roots, e.g. `1/(x^2-2)` →
  `√2/4·log|x-√2| − √2/4·log|x+√2|`), which Layer 1 declined. Covers non-monic (`1/(2x^2-3)`), shifted
  (`1/(x^2+x-1)`), non-trivial numerators, and denominators mixing negative- and positive-discriminant
  quadratics.
- **Method:** a small exact **quadratic-surd** type (`a + b√Δ`, one radicand per factor) factors the
  quadratic over ℝ and emits `A·log|x-r₁| + B·log|x-r₂|` with `rᵢ = (−b±√Δ)/(2a)`. Reuses Layer 1's
  parse / partial-fraction machinery; only a surd type + one `integratePFTerm` branch were added.
  Differentiation-verified. **Repeated** positive-discriminant quadratics and degree-≥3 irreducible
  denominators still return the marker (general Rothstein–Trager / transcendental Risch — future
  layers, which need algebraic-number-field arithmetic).

### fix(functions): Landau–Mignotte bound — use the coefficient 2-norm, not the leading coefficient

- **Critical correctness fix to the polynomial factorizer** (`factorUnivariateZ`, shipped in 0.58.0):
  the Landau–Mignotte factor-coefficient bound used only `|lc|` instead of the polynomial's Euclidean
  coefficient norm, so a polynomial whose interior/constant coefficients dwarf its leading one was
  **wrongly reported irreducible** — `factorUnivariateZ(x^2-10000)` returned it whole (lc=1, but the
  true factors `x±100` have coefficient 100, far above the ~8 bound), because the Hensel lift target
  `p^k` came out too small and recombination missed the factors. Now uses `2^deg·‖f‖₂`.
- **Impact:** corrects univariate factorization, the multivariate Kronecker path, and rational-function
  integration for any large-coefficient input. Was masked in the public `factor()` by its rational-root
  fast path, but live for `casFactor` and direct engine consumers. Found by the Risch Layer 2
  adversarial review; regression: `x^2-10000`/`x^2-10^6` split, `x^2-9999` stays irreducible.

### feat(functions): complete rational-function integration (Risch Layer 1)

- **`symbolicIntegral` / `integrate`** now integrate any rational function `p(x)/q(x)` over ℚ whose
  denominator factors into linear + irreducible-quadratic factors, in closed form: `1/(x^2+1)` →
  `atan(x)`, `(3x+2)/(x^2+1)` → `(3/2)·log(x^2+1) + 2·atan(x)`, `1/((x-1)^2(x+2))` (repeated linear),
  `x^3/(x^2+1)` (improper → polynomial part + log), content>1 denominators (`1/(2x^2+2)`). Previously
  these returned an unevaluated `integral(...)` marker.
- **Method (the rational-function case of Risch):** parse → polynomial-part division → factor the
  denominator via the #7 engine (`factorUnivariateZ`) → exact-ℚ partial fractions (Gauss–Jordan over
  bigint rationals) → per-factor closed form (log for linear, `arctan`+`log` via completing the square
  for irreducible quadratics, reduction formula for repeated quadratics). Exact rational arithmetic
  throughout; surds appear only in the final `sqrt(...)` rendering.
- **Honestly bounded (ADR):** denominators with a **degree-≥3 irreducible factor** or a
  **positive-discriminant quadratic** (real irrational roots → real `log`/`atanh`, e.g. `1/(x^2-2)`)
  still return the marker — those need the Rothstein–Trager / transcendental Risch layers (documented
  follow-ups). A final adversarial review caught and fixed a Critical case here: irreducible-over-ℚ
  does **not** imply negative discriminant, so a discriminant guard was added rather than emit a wrong
  `arctan` answer.
- **Verified by differentiation** (the implementation-independent oracle: `d/dx F == f`) plus sympy
  form-comparison; existing `symbolicIntegral` behavior preserved (345-test regression), one gap test
  upgraded from a stale marker assertion to differentiation-verified integration.

### feat(functions): complete multivariate polynomial factorization over ℤ/ℚ (Kronecker) — completes #7

- **`factor(expr)` / `casFactor(expr)`** now factor **multivariate** integer polynomials completely
  into irreducible factors over ℤ/ℚ, not just the previous content/monomial/difference-of-squares
  subset: `x^2 - y^2` → `(x-y)*(x+y)`, `(x+y+1)(x+2y+3)` expanded → its two linear factors,
  `(x+y)^2*(x+2y)` with multiplicity, three-variable products, non-primitive inputs
  (`2*x^2*y-2*y` → `2 * y*(x-1)*(x+1)`). Irreducible multivariate polynomials (`x^2 + y^2`) are
  returned unchanged. Together with the univariate Zassenhaus engine, this **completes A-list #7 —
  polynomial factorization over ℤ/ℚ, univariate and multivariate**.
- **Method — Kronecker substitution** (ADR: chosen over Wang/EEZ for v1). Each variable `xₖ` is mapped
  to `x^{bₖ}` with `bₖ = ∏_{i<k}(degᵢ+1)`, reducing the multivariate polynomial to a **univariate**
  image factored by the shipped Layer-1 `factorUnivariateZ`; true factors are recovered by
  **recombination** — enumerate subsets of the univariate factors, back-substitute (mixed-radix, with
  an invalid-carry reject), and keep a candidate **iff it exactly divides** over ℤ (`multiExactDivide`
  is the sole arbiter, so no unverified factor is ever emitted). Multiplicity is captured by repeated
  division. This reuses Layer 1 rather than adding the multivariate-Hensel / leading-coefficient
  machinery Wang/EEZ needs — correct and self-contained; Wang/EEZ is the documented future
  performance upgrade.
- **`bigint` throughout** the new engine (`functions/src/typed/factorization/{multi-poly,kronecker,kronecker-factor}.ts`);
  a `MultiPoly` sparse-distributed representation with exact multivariate division.
- **Caps:** a substituted-degree cap (2000) and a 24-factor recombination cap; beyond either, `factor`
  returns via the existing fast path and logs — never a wrong answer or a hang.
- **Routing:** `factor()`'s ≥2-variable branch keeps the content/monomial/difference-of-squares fast
  path **byte-identical**, and supersedes it with the complete Kronecker factorization only when the
  latter yields strictly more irreducible factors (a reducible cofactor left whole). 346-test
  algebra/cas regression unchanged.
- Oracle-pinned against **sympy `factor_list`** (unit tests + a 320-case randomized adversarial review
  with exact bigint reconstruction: 0 soundness failures, 0 reducible-emitted-whole, 0 missed
  multiplicity).

### feat(functions): complete univariate polynomial factorization over ℤ/ℚ (Zassenhaus)

- **`factor(expr)` / `casFactor(expr)`** now factor any single-variable integer polynomial
  **completely into irreducible factors over ℤ/ℚ**, replacing the previous rational-linear-root-only
  path. New capability: `factor('x^4-1')` → `'(x - 1)*(x + 1)*(x^2 + 1)'`, `factor('x^4+3*x^2+2')`
  → `'(x^2 + 1)*(x^2 + 2)'`, repeated factors and irreducible higher-degree factors are captured, and
  polynomials irreducible over ℚ (`x^4 + 1`, `x^2 + x + 1`) are returned unchanged — matching sympy.
- **Engine — the Zassenhaus algorithm** (`functions/src/typed/factorization/`, `bigint`-only):
  integer content + **Yun square-free decomposition** → factor **mod a good prime** (distinct-degree +
  deterministic **Cantor–Zassenhaus** equal-degree, no `Math.random`) → **Hensel lift** to `pᵏ >
  2·Landau–Mignotte` via a multifactor factor tree → **subset recombination** by exact division over
  ℤ. Non-monic inputs use the **leading-coefficient method** (`4*x^2-9` → `(2*x-3)*(2*x+3)`).
- **bigint throughout** by necessity: `pᵏ` exceeds 2⁵³ during Hensel lifting for moderate degrees, so
  float64 would silently corrupt the lift. Coefficients are exact at every step.
- **Cap:** recombination is bounded at 24 modular factors (Zassenhaus is worst-case exponential in the
  factor count); beyond it the square-free level is returned whole and a notice is logged — never a
  silently dropped factor. van Hoeij/LLL recombination is a documented future upgrade.
- **Routing:** `algebra.ts`'s `factor` keeps its cheap fast-paths (content, monomial, rational-linear)
  and routes only the residual higher-degree work into the engine, so all previously-correct outputs
  stay byte-identical (346-test algebra/cas regression suite unchanged). A rational-root-plus-irreducible
  remainder now renders without redundant unit coefficients (`(x^2 + x + 1)`, not `(1*x^2 + 1*x + 1)`).
- **Multivariate** factorization (Wang/EEZ) is unchanged — the follow-up Layer 2 effort.
- Oracle-pinned against **sympy `factor_list`** (v1.14.0) throughout: cyclotomics, Swinnerton-Dyer-style
  recombination stress, repeated factors, non-monic multi-factor inputs, irreducible polynomials.

### feat(functions): halfspace intersection — vertex enumeration of a bounded polytope

- **`halfspaceIntersection(halfspaces, interiorPoint)`** — given halfspaces `A·x + b ≤ 0` and a
  strictly **interior** point, returns the `vertices` of the bounded polytope plus `incidences`
  (which halfspaces are tight at each vertex). Completes the computational-geometry engine: the
  V-representation ⇢ H-representation direction was the one piece the hull/Delaunay/Voronoi sweep
  left unshipped.
- **Convention** matches `scipy.spatial.HalfspaceIntersection`: each row is `[a_1, …, a_d, b]`
  denoting `a·x + b ≤ 0` (SciPy's stacked `[A | b]`). To express `a·x ≤ c`, pass `[a…, −c]`.
- **Method — the dual-hull route.** With a strictly interior `x₀`, each halfspace maps to a dual
  point `yᵢ = aᵢ / −(aᵢ·x₀ + bᵢ)`. The convex hull of `{yᵢ}` is the polar dual, so **each dual-hull
  facet corresponds to a primal vertex** — recovered by solving the `d × d` system `aᵢ·x = −bᵢ` over
  the `d` halfspaces spanning that facet. Redundant halfspaces map to interior dual points and
  contribute no vertex, exactly as SciPy discards them. Reuses the maintained `convexHull`
  (monotone-chain / QuickHull) — no new hull engine.
- **Boundedness** is decided structurally: the polytope is bounded **iff** the dual-space origin lies
  strictly inside `conv{yᵢ}` (equivalently, the normals `aᵢ` positively span `ℝᵈ`). Unbounded input
  throws, mirroring SciPy's `QhullError`; 2-D vertices are returned counter-clockwise.
- **Scope: 2-D and 3-D.** `d > 3` throws a clear error naming what the general case needs (an n-D
  hull or the double-description method) rather than half-shipping a wrong answer.
- **All tolerances are relative, and the dual cloud is normalised to unit scale.** A halfspace row
  `[a, b]` may be multiplied by any positive constant without changing the inequality, and polytope
  coordinates carry units — so every threshold is applied to a scale-free quantity: the facet
  singularity test compares against the **Hadamard bound** (product of row norms); the boundedness
  test divides each facet's cross/dot product by its edge length / normal magnitude, making it a true
  **geometric distance** (a merely *thin* facet — a legitimate near-degenerate vertex — no longer
  reads as "unbounded"); tightness and vertex dedup are scaled to the term and coordinate
  magnitudes. Code review caught the absolute-epsilon versions of all five: rows scaled by `1e-8`
  silently returned an **empty** vertex list, a 3-D cube of side 2000 threw a false `unbounded`, and
  side `1e6` collapsed the dual points enough to break the hull step itself. Pinned by regression
  tests across coordinate scales `1e-4 … 1e6` and row scales `1e-8 … 1e8`.
- Oracle-pinned against `scipy.spatial.HalfspaceIntersection`
  (`functions/tests/geometry-halfspace-oracle.test.ts`, 14 tests) — vertex sets matched
  order-independently, plus the implementation-independent invariant that every returned vertex
  satisfies all halfspaces and is tight on at least `d` of them. The regular-hexagon vertex set was
  verified **byte-identical** to scipy's.

### docs(functions): curated computational-geometry reference

- Added a **Computational geometry structures** table to `docs/api/functions.md` covering
  `convexHull` / `delaunay` / `voronoi` / `sphericalVoronoi` / `alphaShape` / `halfspaceIntersection`
  — these had only ever appeared in the generated index, never in a curated user-facing section.
- **Fixed a wrong signature**: `convexHull` was documented as `(pts) => number[][]`; it actually
  returns a structured `ConvexHullResult` (`{vertices, simplices, area, volume}`).

### feat(functions): Mathieu functions — characteristic values + angular functions

- **`mathieuA(n, q)` / `mathieuB(n, q)`** — the characteristic values `a_n(q)` (even, `ce_n`) and
  `b_n(q)` (odd, `se_n`, `n ≥ 1`) of the Mathieu equation `y'' + (a − 2q·cos 2x)·y = 0`, i.e. the
  values of `a` admitting a `2π`-periodic solution. **`mathieuCe(n, q, x)` / `mathieuSe(n, q, x)`** —
  the angular Mathieu functions `ce_n(x, q)` / `se_n(x, q)` (`x` in radians), summed from their
  Fourier coefficients.
- **Method — the symmetric tridiagonal eigenvalue problem.** Expanding the periodic solutions in a
  Fourier series yields a three-term recurrence among the coefficients — a symmetric tridiagonal
  eigenproblem in each of the four parity classes (`ce_{2m}`, `ce_{2m+1}`, `se_{2m+1}`, `se_{2m+2}`;
  DLMF §28.4). Eigenvalues (ascending) are the characteristic values; eigenvectors are the Fourier
  coefficients. Truncated at N=50 (coefficients decay super-exponentially) and solved by **reusing
  the maintained symmetric eigensolver in `@danielsimonjr/mathts-matrix` (`eig`)** — no new
  eigensolver.
- **Normalization / sign** — standard DLMF / Abramowitz & Stegun convention (identical to `mpmath`/
  `scipy`): `(1/π)∫₀^{2π} ce_n² = 1` (so `ce_0(x,0) = 1/√2`, `ce_n(x,0) = cos nx`, `se_n(x,0) =
  sin nx` for `n ≥ 1`), global sign fixed so the dominant Fourier coefficient is positive.
- **Oracle-pinned** against `scipy.special` (the installed `mpmath` 1.3.0 does not ship the Mathieu
  family; scipy uses the identical DLMF normalization, verified `mathieu_cem(0,0,0)=1/√2`):
  `a_n`/`b_n` relative error ≤ 1.2e-14, `ce_n`/`se_n` absolute error ≤ 7.8e-15 over `n ∈ 0..6`,
  `q ∈ {0.5, 1, 2, 5, 10}`; the `q → 0` limits `a_n, b_n → n²` and `ce_n → cos nx`, `se_n → sin nx`;
  and an implementation-independent ODE-residual check (`f'' + (a − 2q·cos 2x)·f ≈ 0`, residual
  ≤ 2e-7, finite-difference-limited). `functions/tests/gap-special-mathieu-oracle.test.ts`.

### feat(functions): constant-delay DDE solver `solveDDE` (method of steps + continuous extension)

- **`solveDDE(f, tspan, history, delays, options?)`** — solves the constant-delay **delay
  differential equation** `y'(t) = f(t, y(t), [y(t−τ₁), y(t−τ₂), …])` on `t ∈ [t0, T]` with a
  **history function** `φ(t)` giving `y(t)` for `t ≤ t0` (initial state `y(t0) = φ(t0)`) and one or
  more positive constant delays `τ_k`. Method: the standard **method of steps** — the adaptive
  **BS23** (Bogacki–Shampine 3(2)) embedded RK pair (the pair MATLAB `dde23` uses) with a
  **cubic-Hermite continuous extension** (C¹, O(h⁴) dense output built from the stored per-step
  `(t, y, y')`) as the history interpolant. Each delayed argument `y(t − τ_k)` is read from `φ` when
  `t − τ_k ≤ t0`, else from the dense output of the already-computed solution.
- **Step cap (the standard MOS constraint):** each step is capped at `h ≤ min(τ)`, which guarantees
  every delayed argument lies in already-accepted history — the method stays fully **explicit** (no
  implicit self-coupling). Adaptive local-error control still chooses `h` freely within that cap.
- **Discontinuity propagation:** `y'` generically jumps at `t0` (the history need not satisfy the
  DDE) and that low-order discontinuity propagates to `t0 + τ_k, t0 + 2τ_k, …`, smoothing one order
  at each. The integrator **lands exactly on each `t0 + m·τ_k` breakpoint** (steps are trimmed never
  to cross one), so no dense-output interval straddles a derivative jump.
- Supports **multiple constant delays** and **vector state**; `history` may be a function or a
  constant. Returns `{ t, y[t], yInterp }` where `yInterp` is the dense-output evaluator over
  `[t0, T]`; `y` is unwrapped to `number[]` for a scalar DDE, else `number[][]`. Plain-number state
  only. Lives in `functions/src/numeric/solveDDE.ts`; re-exported from `functions/src/typed/numeric.ts`.
- **Oracle-pinned (scipy has no DDE; Julia `DelayDiffEq` / MATLAB `dde23` are references), all
  implementation-independent** — `functions/tests/dde.test.ts` (14 cases): method-of-steps EXACT
  piecewise-polynomial solutions of `y'=−y(t−1)` over 3 delay intervals (max abs err **4.996e-16**,
  machine precision — cubic Hermite reproduces the piecewise polynomials exactly); growing
  `y'=y(t−1)` and two-delay `y'=−y(t−1)−y(t−2)` closed forms (~1e-7); linear-DDE **characteristic
  roots** of `s = a·e^{−sτ}` — real dominant root decay rate of `y'=−0.25 y(t−1)` matched to
  **−0.357403** and the complex principal-root period **4.698** / decay **−0.31818** of `y'=−y(t−1)`
  extracted from the dense output; breakpoint landing + C⁰ continuity + the `y″` jump at `t=1`;
  ODE-degeneration (τ=100 never bites → reduces to a plain ODE, cross-checked vs `solveODESystem`,
  Δ **2.4e-10**); callable-history and vector cases; input validation. All exact-form derivations
  independently verified (fine fixed-step MOS reference + scipy root solves).
- Part 3 (final) of the surfaced PDE/DAE/DDE ODE-family sub-projects — the trio is now complete
  (part 1 `solveParabolicPDE`, part 2 `solveDAE`).

### feat(functions): semi-explicit index-1 DAE solver `solveDAE` (BDF + coupled Newton)

- **`solveDAE(f, g, tspan, y0, z0?, options?)`** — solves the semi-explicit **index-1**
  differential-algebraic system `y' = f(t, y, z)` (differential `y`), `0 = g(t, y, z)` (algebraic
  `z`) on `t ∈ [t0, T]`. "Index-1" means `∂g/∂z` is nonsingular. Method: a **variable-step,
  variable-order (1–2) BDF** discretisation of `y'` (variable-step coefficients from the
  Lagrange-basis derivative, so BDF1/BDF2 work on the non-uniform adaptive grid); each step solves
  the **combined** nonlinear system — the BDF equation for `y` AND `g(t_{n+1}, y_{n+1}, z_{n+1}) = 0`
  — for `(y_{n+1}, z_{n+1})` by **Newton**, with the block iteration matrix
  `[[c₀I − ∂f/∂y, −∂f/∂z], [∂g/∂y, ∂g/∂z]]` (finite-differenced by default, or built from analytic
  blocks via `options.jacobian`) LU-solved through the shared matrix-package factorisation
  (`_factorSolver`, reused from `solveODE.ts`). Adaptive step size via a predictor/corrector local
  error estimate. The initial `z0` is treated as a **guess** and Newton-refined onto the constraint
  manifold `g(t0, y0, z0) = 0` (or solved from scratch when omitted). A **higher-index** input is
  detected as a singular `∂g/∂z` and reported (it is not silently integrated to garbage). Returns
  `{ t, y[t], z[t] }` (`y`/`z` unwrapped to scalars when the initial value was scalar). Plain-number
  state only. Lives in `functions/src/numeric/solveDAE.ts`.
- **Oracle-pinned** (scipy has no DAE solver, so every oracle is implementation-independent).
  Manufactured coupled DAE `y' = z − 2y`, `0 = z − (t+y)` (reduces to `y' = t − y`,
  `y = t − 1 + 2e^{−t}`): over `t ∈ [0,3]` at `tol=1e-9`, max abs error **2.35e-7** (both `y` and
  `z`). **Constraint residual `|g(t,y,z)|` ≤ 8.9e-16 at every output step** (machine zero — the
  defining DAE invariant; the algebraic block is solved exactly each step). Reduce-to-ODE
  cross-check vs an independent RK4 integration of `y' = t − y`: Δ **2.13e-7**. Classic **RC-circuit**
  index-1 DAE (`C·V' = i`, `i·R = Vs − V` → `V = 1 − e^{−t}`, `i = e^{−t}`), a **vector** system with
  non-identity `∂g/∂z = diag(2,1)`, consistent-`z0` auto-solve, inconsistent-`z0` refinement,
  analytic-vs-FD Jacobian agreement, and higher-index (singular `∂g/∂z`) detection all pinned. Tests
  in `functions/tests/dae.test.ts` (11 cases).
- Part 2 of the surfaced PDE/DAE/DDE sub-projects (part 1 was `solveParabolicPDE`; DDE remains).

### feat(functions): general 1-D parabolic PDE solver `solveParabolicPDE` (method-of-lines + BDF)

- **`solveParabolicPDE({ diffusion, advection?, source?, x0, x1, T, nx, u0, bcLeft, bcRight, tol?, maxStep?, times? })`**
  — solves the general 1-D parabolic PDE `u_t = D(x)·u_xx + c(x)·u_x + f(x, t, u)` on `x ∈ [x0, x1]`,
  `t ∈ [0, T]` by the **method of lines**: a uniform `nx`-point grid with the second-order central
  second/first differences semi-discretises the PDE into a **stiff** ODE system in the nodal values,
  integrated with the variable-order **BDF** stiff solver (`bdfSolve`) — implicit, so no explicit-Euler
  CFL step cap. Supports **Dirichlet** (`u = g(t)`) and **Neumann** (`u_x = g(t)`, second-order
  ghost-node closure) boundary conditions at each end; `D`/`c` may be constants or functions of `x`,
  `g` constant or a function of `t`. Returns `{ x, t, u[t][x] }` (full grid including boundary nodes);
  optional `times` interpolates the solution onto explicit output times. Lives in
  `functions/src/numeric/solveParabolicPDE.ts`.
- **Oracle-pinned.** Exact heat `u_t = u_xx`, `u(x,0)=sin(πx)`, Dirichlet 0 → `u = e^{−π²t}sin(πx)`:
  max relerr **1.27e-4** at `nx=81`, with **exactly O(h²)** spatial convergence (measured rate **2.000**
  across two grid halvings, 21→41→81→161). Manufactured reaction-diffusion (`u=e^{−t}sin(πx)`, derived
  source): relerr **1.19e-4**. Neumann insulated ends (`u=e^{−π²t}cos(πx)`): relerr **1.27e-4**.
  Cross-checked vs `scipy.integrate.solve_ivp(method='BDF')` on the identical MOL semi-discretisation
  (advection-diffusion): agreement to **≤ 1.0e-12** — confirming the MOL + BDF pipeline is wired
  correctly. Tests in `functions/tests/parabolic-pde.test.ts`.
- The legacy explicit-Euler heat-only **`solvePDE` is unchanged** (a shipped function's numerics are
  ADR-level); `solveParabolicPDE` is a distinct, additive public entry point.

### feat(functions): irregular Coulomb wave function `coulombG` (+ `coulombFG` bundle)

- **`coulombG(L, eta, rho)`** — the irregular Coulomb wave function `G_L(η, ρ)`, the second solution
  of the Coulomb radial equation, completing the `coulombF` (regular) sibling. Implemented by
  **Steed's continued-fraction method** (Barnett 1982 / DLMF §33.8): CF1 for `u = F′_L/F_L`
  (DLMF 33.8.1, real modified-Lentz), CF2 for `(G′+iF′)/(G+iF) = p+iq` (DLMF 33.8.2, complex
  modified-Lentz), then Steed recovery of `{F, F′, G, G′}` via the Wronskian `F′G − FG′ = 1`
  (DLMF 33.8.4–5). The sign of the regular solution is taken from the existing `coulombF` series.
- **`coulombFG(L, eta, rho)`** — returns the whole bundle `{ F, Fp, G, Gp }` in one pass (the four
  values satisfy `F′G − FG′ = 1` to machine precision by construction).
- Both live in `functions/src/special/wave-functions.ts`. Oracle-pinned vs `mpmath.coulombg`
  (dps=30): over a 192-point corpus (L ∈ {0,1,2,3}, η ∈ {−5,…,5}, ρ ∈ {0.5,…,20}) the Wronskian
  residual is **≤ 6.7e-16** and, at/above the turning point `ρ_tp = η + √(η²+L(L+1))`, the relative
  error is **≤ 6.9e-13**. Accuracy holds below 1e-6 down to ρ ≈ 0.15·ρ_tp; **validated domain**
  excludes the deep-sub-turning-point corner (large positive η with ρ ≪ ρ_tp, e.g. η = 5, ρ ≤ 1),
  where CF2 degrades — the well-known limit of Steed's method deep in the classically-forbidden
  region (documented in the `coulombG` docstring). Special value `G_0(0, ρ) = cos ρ` at machine
  precision. `G` is singular at `ρ = 0`, so `coulombG`/`coulombFG` throw for `ρ ≤ 0`.

### feat(functions): stiff-ODE breadth — BDF + Radau IIA methods for `solveODE`, adaptive `solveODESystem`

- **`solveODE(func, tspan, y0, { method: 'BDF' })`** — variable-order (1–5) variable-step backward
  differentiation, scipy `solve_ivp`'s default stiff method (NDF-enhanced). Faithful port of
  `scipy.integrate.BDF`: the difference-array representation `D`, quasi-constant step size
  (`change_D`), and simplified-Newton on the implicit `(I − c·J)` system. The general-purpose stiff
  workhorse, robust across a wide tolerance range.
- **`solveODE(func, tspan, y0, { method: 'Radau' })`** — 3-stage, 5th-order, L-stable Radau IIA
  implicit Runge-Kutta (scipy's `method='Radau'`). Real-arithmetic simplified-Newton on the full
  3n×3n collocation system (the matrix package's dense LU is real; scipy's complex-eigenvalue
  transform is an efficiency-only variant), with scipy's exact third-order embedded error estimate.
  High-order accuracy on very stiff systems.
- Both new methods live in `functions/src/numeric/solveODE.ts` (`bdfSolve`/`radauSolve`, module-level
  like `rosenbrockSolve`/`rodasSolve`), finite-difference the Jacobian by default or use an analytic
  one via `jac`, and reuse the matrix-package LU `_factorSolver`. Plain-number state only.
  Oracle-pinned vs `scipy.integrate.solve_ivp` (1.17.1): Robertson kinetics t=40 — BDF Δ≤2.2e-8,
  Radau Δ≤3e-10 (mass invariant `y1+y2+y3=1` exact); Van der Pol μ=1000 t=3000 — BDF Δ=9.5e-7,
  Radau Δ=3.3e-9; linear stiff exact closed forms (`e^-10`, `e^-1`) to <1e-6.
- **`solveODESystem`** gained an **adaptive** embedded RK45 (Dormand-Prince) default path with
  local-error control (scaled-RMS error under `tol`); passing an explicit `dt` still selects the
  legacy fixed-step RK4 (back-compat — the BVP shooting driver is unaffected). Pinned vs the exact
  harmonic oscillator and scipy RK45 Lotka-Volterra (~1e-6).
- Surfaced (scoped designs, not started): general 1-D parabolic PDE via method-of-lines onto the new
  BDF (`solvePDE` is explicit-Euler heat-only — ADR-level to change its method); index-1 DAE via BDF;
  DDE via continuous extension + history buffer. See `TODO.md`.

### feat(functions): computational-geometry engine — convex hull (2-D/3-D), Delaunay, Voronoi, spherical Voronoi, alpha shapes

- **`convexHull(points)`** — public, structured 2-D/3-D convex hull returning
  `{ vertices, simplices, area, volume }` (fields mirror `scipy.spatial.ConvexHull`:
  2-D `area` = perimeter, `volume` = enclosed area; 3-D `area` = surface area, `volume` = volume).
  2-D via Andrew's monotone chain (hull-vertex indices in CCW order); 3-D reuses the QuickHull
  kernel. Pinned vs `scipy.spatial.ConvexHull`: 2-D random-30 vertex set + area/perimeter to **1e-10**;
  3-D random-40 vertex set (20 verts) + volume/surface-area to **1e-8**; unit cube (vol 1, area 6)
  and tetrahedron exact.
- **`delaunay(points)`** — 2-D Delaunay triangulation → `{ simplices }`. Pinned by
  implementation-independent invariants (every input point is a vertex; triangles partition the hull
  to **1e-10**; the **empty-circumcircle** property holds for every triangle) plus a triangle-count
  cross-check vs `scipy.spatial.Delaunay` (31 on the general-position set).
- **`voronoi(points)`** — 2-D Voronoi diagram (dual of Delaunay) → `{ vertices, simplices, regions }`.
  Pinned by invariants: one Voronoi vertex per Delaunay triangle (= its circumcenter, equidistant to
  its 3 generators to **1e-9**), and the dual empty-circumcircle (a vertex's generators are its
  nearest generators).
- **`sphericalVoronoi(points[, radius, center])`** — Voronoi diagram of points on a sphere via the
  3-D hull → `{ vertices, regions, areas }`. Pinned vs `scipy.spatial.SphericalVoronoi`: vertex count
  `= 2N − 4` (46 for N=25), vertices on the sphere, geodesic cell **areas sum to `4πr²`** to **1e-8**
  (and `4πr²` under a radius change), spherical empty-cap property.
- **`alphaShape(points, alpha)`** — 2-D alpha shape → `{ triangles, edges }` (Delaunay triangles with
  circumradius `≤ 1/alpha`; boundary = edges in exactly one kept triangle). Pinned on a general-position
  annulus: the right `alpha` recovers the hole (exactly **two** boundary loops, all boundary vertices
  degree 2).
- All five are pure `number[][]`-in / structured-out functions in `functions/src/geometry/`
  (`hull.ts`, `delaunay.ts`, `voronoi.ts`, `spherical-voronoi.ts`, `alpha-shape.ts`), exported from
  `functions/src/index.ts` and documented in the curated Geometry table of `docs/reference/functions.md`.
  Oracle tests in `functions/tests/geometry-{hull,delaunay,consumers}-oracle.test.ts` (27 tests).
- **Bug fixed at root (preexisting):** the `delaunay_wasm` acceleration kernel returned a bogus
  triangle count (1363 vs 197 true triangles for a 119-point set), reading past its output buffer and
  yielding garbage — never correctness-tested. Its dispatch in `delaunayTriangulation` is now
  **disabled** (always uses the correct JS Bowyer–Watson path); the internal test-only 2-D
  coordinate hull was renamed `convexHull` → `convexHull2D` to free the public name.
- **Surfaced, not shipped:** (1) **halfspace-intersection / vertex-enumeration** — needs a
  double-description or LP-based vertex enumeration engine (design in `TODO.md`); (2) the Bowyer–Watson
  Delaunay does not resolve **perfectly cocircular** inputs (a joggle/symbolic-perturbation problem,
  as in Qhull) — documented as a known limitation; (3) fixing/replacing the `delaunay_wasm` kernel.

### feat(functions): advanced niche special functions — Riemann–Siegel Z, Lerch Φ, parabolic-cylinder D_ν, Coulomb F_L

- **`siegelZ(t)` / `riemannSiegelZ(t)`** — the Riemann–Siegel Z-function
  `Z(t) = e^{iθ(t)} ζ(1/2 + it)`, real-valued on the critical line (its real zeros are the
  imaginary parts of the non-trivial ζ zeros). Computed by evaluating ζ(1/2 + it) via a
  self-contained Borwein-accelerated series in explicit complex arithmetic (the same algorithm the
  factory `zeta` uses, specialized to `Re(s) = 1/2` so it needs no Complex constructor) and the
  theta function **exactly** through a complex Lanczos log-gamma — the exact-θ path stays accurate at
  the small `t` of the first few zeros, where the classical Riemann–Siegel asymptotic series does
  not. Even in `t`; `Z(0) = ζ(1/2)`. Pinned vs `mpmath.siegelz` (dps=30): max rel err **4.3e-15**
  for O(1) values, abs err **2.0e-15** near the first zeros (t ≈ 14.13, 21.02, 25.01), |t| ≤ 40.
- **`lerchPhi(z, s, a)`** — the Lerch transcendent `Φ(z, s, a) = Σ_{k≥0} z^k/(a+k)^s` by its
  defining series (converges for `|z| < 1`, `a > 0`; `|z| ≥ 1` throws, analytic continuation out of
  scope). Cross-checked by the polylog relation `Li_s(z) = z·Φ(z, s, 1)`. Pinned vs
  `mpmath.lerchphi`: max rel err **1.0e-14**.
- **`parabolicCylinderD(nu, x)`** — the parabolic-cylinder function `D_ν(x)` (Whittaker form) via the
  even/odd confluent-hypergeometric representation (reusing `hyp1f1`), valid for any real ν and
  moderate `|x|`. Pinned vs `mpmath.pcfd`: max rel err **6.4e-15**.
- **`coulombF(L, eta, rho)`** — the regular Coulomb wave function `F_L(η, ρ)` via its ascending power
  series (DLMF 33.6) with the exact normalization constant `C_L(η)` from the complex log-gamma.
  Special case `F_0(0, ρ) = sin ρ` (a zero-term early-break bug that truncated the η = 0 case was
  caught and fixed). Pinned vs `mpmath.coulombf`: max rel err **3.6e-13** (L ∈ {0..3}, |η| ≤ 5,
  ρ ≤ 10).
- All four are pure real-valued `number`-in/`number`-out functions in
  `functions/src/special/wave-functions.ts`, following the `niche.ts`/`hypergeometric.ts` pattern;
  oracle-pinned in `functions/tests/gap-special-wave-oracle.test.ts` (45 tests). Documented in the
  curated Special Functions table of `docs/reference/functions.md`.
- **Surfaced, not shipped (documented as out of scope):** the *irregular* Coulomb wave `coulombG`
  (needs a numerically-delicate asymptotic/continued-fraction treatment, not the simple series);
  and the **Mathieu** (`ce_n`/`se_n`, characteristic values `a_n`/`b_n`) and **spheroidal** wave
  functions (eigenvalue continued-fraction / infinite-recurrence problems). See `TODO.md` for the
  scoped designs.

### feat(functions): CAS breadth — multivariate `expand`/`factor`, wired `casExpand`/`casFactor`, partial-fraction + by-parts integration

- **`casExpand`/`casFactor` are no longer pass-through stubs.** They were crude string
  manipulators (`casExpand('(x+1)^2')` → `'x*x + x*1 + 1*x + 1*1'`; `casFactor` did integer-GCD
  only, leaving `x^2-1` unchanged). Both now **delegate to the real `expand`/`factor` engines**
  (`typed/algebra.ts`): `casExpand('(x+1)^2')` → `'1*x^2 + 2*x + 1'`, `casFactor('x^2-1')` →
  `'(x - 1)*(x + 1)'`. The batch-array overload keeps its `Promise<string[]>` signature but runs
  in-process (the polynomial engine can't be serialised to a worker), so batch results are always
  identical to the per-element single call. The dead worker-fanout kernels were removed.
- **`expand` now handles MULTIVARIATE polynomials exactly**, collecting like terms via the exact
  `polyFromExpression`/`polyToString` engine: `(x+y)^2` → `1*y^2 + 2*x*y + 1*x^2`,
  `(x+y)*(x-y)` → `-1*y^2 + 1*x^2` (the `x*y` terms cancel), `(x+y+z)^2` exact. Non-polynomial
  pieces (function calls, non-integer exponents) still fall back to the regex distributor.
- **`factor` gains a multivariate tractable subset**: integer-content + common-monomial extraction
  and monomial difference-of-squares — `x^2*y + x*y^2` → `x*y*(1*y + 1*x)`,
  `4*x^2 - 9*y^2` → `(2*x - 3*y)*(2*x + 3*y)`, `3*x^3*y - 3*x*y^3` → `3*x*y*(x - y)*(x + y)`.
  Full multivariate factorization into irreducibles (Wang/Zassenhaus/EEZ) is documented OUT OF SCOPE
  and returns the partially-factored or unchanged expression rather than a wrong answer.
- **`symbolicIntegral` gains two extension methods** (`cas-integration.ts`): **partial-fraction
  integration** of single-variable rational functions (composes the CAS `apart` decomposition with
  term-wise `A/(x−r)` → `A·ln|x−r|` integration — `1/(x^2-1)`, `(x+3)/(x^2-x-2)`, improper
  `x^3/(x^2-1)`) and **tabular integration by parts** for polynomial·{`exp`,`sin`,`cos`}
  (`∫ x·eˣ = (x−1)·eˣ`, `∫ x·sin x = sin x − x·cos x`, `∫ x²·e^x`, `∫ x³·e^x`, `∫ x²·sin(3x)`).
  General u-substitution / a full Risch integrator, non-linear inner arguments, and
  irreducible-quadratic denominators remain out of scope (return the `integral(…)` marker).
- Oracle-pinned against **sympy** (`sympy.expand`/`sympy.factor` for the algebra transforms;
  differentiate-back `d/dx(∫f) ≡ f` for every integral, verified with sympy/numpy — max residual
  ~3e-9): `functions/tests/cas-multivariate.test.ts` (new, 22 tests), plus new partial-fraction and
  by-parts case tables in `functions/tests/gap-symbolic-integral.test.ts`. Existing CAS
  characterization tests updated from the old crude behavior to the new real behavior (pinned by
  implementation-independent numeric evaluation). Full functions suite: 4285 passing.

### feat(functions): Gaussian-process regression (`gaussianProcessRegression` / `gpRegression`)

- New stats-breadth public API: fit a zero-mean GP to training `(X, y)` under i.i.d. Gaussian noise
  `α`, and predict the **posterior mean AND variance** (the GP's key output) at test points. Kernels:
  **RBF/squared-exponential** plus **Matérn 3/2** and **Matérn 5/2**, each with `lengthScale` (ℓ) and
  `signalVariance` (σ_f²) hyperparameters. Standard Rasmussen & Williams Alg. 2.1: `K = k(X,X)+αI`,
  `L = chol(K)`, `ᾱ = Lᵀ\(L\y)`, `mean = k(X*,X)·ᾱ`, `var = k(X*,X*) − vᵀv` with `v = L\k(X,X*)`; also
  exposes the marginal log-likelihood `log p(y|X)`. The Cholesky routes to the maintained,
  oracle-pinned matrix-package primitive (native-accel "prefer the matrix decomposition" pattern);
  triangular solves are local forward/back substitution.
- Oracle-pinned (`functions/tests/gp-regression-oracle.test.ts`, 15 tests) against
  `sklearn.gaussian_process.GaussianProcessRegressor` with the matching `ConstantKernel(σ_f²)·RBF(ℓ)`
  / `·Matern(ℓ, ν)` kernel and `alpha=α` (`optimizer=None`, `normalize_y=False`): posterior mean and
  std match to **machine precision** (max |Δ| mean 5.6e-16, std 1.9e-15). Implementation-independent
  limits also pinned: a noiseless GP interpolates the training targets (mean → y, variance → 0), and
  far from the data the posterior returns to the prior (mean → 0, variance → σ_f²).

### feat(functions): Dirichlet + Wishart sampling (`dirichletSample` / `dirichletPdf` / `wishartSample`)

- New multivariate sampling beyond MVN. **Dirichlet** draws use the Gamma-normalization method
  (`gᵢ ~ Gamma(αᵢ,1)`, `xᵢ = gᵢ/Σⱼgⱼ`); **Wishart** draws use the Bartlett decomposition
  (`W = (L·A)(L·A)ᵀ`, `L = chol(scale)`, lower-triangular `A` with `√χ²(df−i)` diagonal + N(0,1)
  below). Both accept a `seed` for reproducible draws via the package's seeded RNG (matching
  `mvnSample`). `dirichletPdf(x, α)` provides the closed-form density via `lgammaNumber`.
- The Marsaglia & Tsang gamma sampler is now shared (`functions/src/probability/util/gammaSample.ts`,
  `gammaSampleRng`/`normalSampleRng`); the distribution objects (`typed/dist-objects.ts`) were
  refactored to delegate to it, removing the two pre-existing in-file copies (no behavior change —
  235 distribution tests still green).
- Oracle-pinned (`functions/tests/multivariate-sampling-oracle.test.ts`, 9 tests): `dirichletPdf`
  matches `scipy.stats.dirichlet.pdf` on fixed simplex points to ~1e-12. Being random, the samplers
  are pinned by implementation-independent invariants + seeded determinism: Dirichlet draws lie on
  the simplex with sample mean → αᵢ/Σα (within ~1 SE over 200k draws) and sample covariance → the
  Dirichlet closed-form covariance; Wishart draws are SPD with sample mean → df·scale (within ~2 SE)
  and E[tr(W)] → df·tr(scale).

### fix(functions): `qz` QZ-hardening — route the Schur step to the Francis double-shift `matrixSchur`

- `qz(A, B)` (generalized/QZ Schur of the pencil `(A, B)`) built its Schur factor with a homegrown
  **single-shift** QR iteration that ran on the *full* `B⁻¹A` (no Hessenberg reduction). It stalled and
  **threw** "realSchur: QR iteration failed to converge to (quasi-)triangular form" on non-symmetric
  pencils with an all-real spectrum — e.g. `A=[[1,2,0],[0,3,1],[1,0,4]]`, `B=diag(2,1,3)`. Root-caused
  and fixed by delegating the Schur step to the matrix package's hardened `matrixSchur` (Householder →
  upper Hessenberg → **Francis double-shift** implicit QR with exceptional-shift stall breaking) — the
  maintained, oracle-pinned matrix-layer primitive (the native-accel "prefer the matrix decomposition"
  pattern). The dead single-shift QR + its `identityArr` helper were removed.
- Verified (`functions/tests/qz-hardening.test.ts`): `qz` no longer throws on that pencil and satisfies
  the decomposition contract (`A = Q·AA·Zᵀ`, `B = Q·BB·Zᵀ` to 9 digits; orthogonal `Q`/`Z`;
  quasi-triangular `AA`/upper-triangular `BB`; generalized eigenvalues `diag AA / diag BB` = scipy's
  `[0.758963, 1, 3.07437]`). `generalizedEig` (which already routed through the hardened `eig`) is now
  locked to `scipy.linalg.eig(A, B)` across real, complex-pair (`±i`) and clustered (`[2, 2, 2.0001]`)
  spectra, with the implementation-independent `det(A − λB) ≈ 0` oracle.
- Scoped follow-up (not blocking): `generalizedEig` still forms `B⁻¹A`, which is adequate for a
  nonsingular `B` (scipy-matched) but breaks down for a *singular / near-singular* `B`. Extracting the
  pencil eigenvalues directly from the `qz` factors (`diag AA / diag BB`, with 2×2-block handling for
  complex pairs) is the future enhancement for that regime.

### feat(functions): ILU(0) / IC(0) preconditioners for the Krylov solvers

- The `cg`/`gmres`/`bicgstab`/`minres` solvers now accept `preconditioner: 'ilu'` (ILU(0) — incomplete
  LU with zero fill on `A`'s sparsity pattern, for general `A`) and `'ic'` (IC(0) — incomplete
  Cholesky, for SPD `A`), alongside the existing `'jacobi'` and custom-callback options. Like
  `'jacobi'`, both read `A`'s entries and so require a dense matrix (they throw a clear error for a
  matvec-only operator).
- The factorizations are also exported directly: `incompleteLU(A) → { L, U }` and
  `incompleteCholesky(A) → { L }`, each reproducing `A` on its sparsity pattern (dropping fill outside
  it). `incompleteCholesky` throws on a non-positive pivot (SPD precondition failed).
- Verified (`functions/tests/krylov-preconditioners.test.ts`): factor correctness `(L·U)ᵢⱼ = Aᵢⱼ` /
  `(L·Lᵀ)ᵢⱼ = Aᵢⱼ` on the pattern (2D Poisson, which has fill-in) and exactly for a tridiagonal (no
  fill); on the ill-conditioned Poisson SPD system IC(0)-CG converges in 12 iterations vs 22
  unpreconditioned/Jacobi, and ILU(0)-BiCGSTAB in 7 vs 15 — same solution (residual pinned < 1e-7).

### feat(functions): `svds` — sparse / partial SVD (top-`k` singular triplets via Lanczos)

- New `svds(A, k)` returns the `k` **largest** singular values and their left/right singular vectors
  of a dense `m × n` matrix, for large/sparse problems where the full `svd` (which factors the whole
  matrix) is wasteful. Runs the Lanczos iteration (via `eigsh`) on the smaller normal operator —
  `AᵀA` (`n×n`) when `m ≥ n`, else `A Aᵀ` (`m×m`) — never forming that product (each matvec is a
  matvec by `A` then by `Aᵀ`); singular values are `√λ` of the Ritz eigenvalues, complementary
  vectors from `A vⱼ = σⱼ uⱼ` / `Aᵀ uⱼ = σⱼ vⱼ`. Result `{ U (m×k), s (descending), V (n×k) }`, vectors
  as columns.
- Singular values are returned **descending** (matching this library's `svd`), the opposite of
  `scipy.sparse.linalg.svds` (ascending) — documented. Pinned to `numpy.linalg.svd`/scipy `svds`: top-k
  values to 7–8 digits, the SVD defining relation `A vⱼ = σⱼ uⱼ` (implementation-independent) to < 1e-6,
  orthonormal `U`/`V` columns, and the Eckart–Young rank-`k` truncation error `‖A − UΣVᵀ‖_F =
  √(Σ_{i>k} σᵢ²)`; covers both the tall (`AᵀA`) and wide (`AAᵀ`) paths (`functions/tests/svds.test.ts`).

### perf(functions): `minres` short-recurrence rewrite — O(k³) → O(k·n)

- `minres` (Krylov solver for symmetric indefinite `A`) was reformulated from the "re-solve the
  growing `(k+1)×k` tridiagonal least-squares each iteration" form (O(k³) per step) to the classic
  **Paige–Saunders short recurrence** (Lanczos tridiagonalization + incrementally updated
  Givens-rotation QR, advancing the solution through a running 3-term `w`-recurrence). Each iteration
  now does a fixed number of length-`n` vector ops and O(1) scalar work — one matvec per step, no
  growing matrix ever formed — so the whole solve is **O(k·n)** for `k` iterations. The unused dense
  `solveLeastSquaresQR` helper was removed.
- Behaviour preserved: pinned to `scipy.sparse.linalg.minres` on the 4×4 indefinite pencil (solution
  to 9 digits) and a 30×30 indefinite system (relres < 1e-10). A structural test asserts exactly one
  matvec per iteration (`calls == iterations + 2`), confirming the O(1)/iteration cost
  (`functions/tests/krylov.test.ts`). With a preconditioner the loop gates on the `M⁻¹`-norm relative
  residual (what MINRES minimizes); the reported `residual`/`converged` remain the true Euclidean
  residual.

### feat(functions): `solveODE` event detection (`events` option) — scipy `solve_ivp` parity

- `solveODE(f, tspan, y0, { events })` now locates zero crossings of event functions `g(t, y)`,
  scipy-`solve_ivp`-style. `events` is one function or an array; each function may carry `terminal`
  (`true` → stop at the first crossing, a positive integer → stop after that many, else record all)
  and `direction` (`+1` → only `−`→`+` crossings, `−1` → only `+`→`−`, `0` → either) — as properties
  on the function or via the `{ event, terminal, direction }` object form.
- Crossings are located by cubic-Hermite dense interpolation of the accepted step + bisection, run
  as a **method-agnostic post-pass** over the trajectory (explicit RK and stiff Rosenbrock/RODAS
  alike). Results gain `tEvents`/`yEvents` — one list per event function of crossing times/states
  (states unwrapped to scalars for a scalar `y0`); a `terminal` event truncates `t`/`y` at its
  crossing. Requires plain-number state. Absent the `events` option the result shape is unchanged.
- Pinned to `scipy.integrate.solve_ivp(..., events=)`: terminal projectile ground-hit to 4e-15,
  direction-filtered harmonic up-crossings to ~3e-13, multi-event sin/cos crossings to ~4e-9, and
  `terminal` counts (`functions/tests/solveode-events.test.ts`).

### feat(matrix): `luSolve` primitive + stiff-ODE per-step solve routed onto it

- New `luSolve(fac, b)` in `@danielsimonjr/mathts-matrix` — solves `A·x = b` from a precomputed
  `lu()` factorisation (`P·A = L·U`: permute `b`, forward-solve unit-lower `L`, back-solve `U`).
  O(n²) per RHS, so factor once and solve many. Pinned to `numpy.linalg.solve`
  (`matrix/tests/operations/lu-solve.test.ts`).
- `solveODE`'s stiff methods (`Rosenbrock`/ode23s and `RODAS`) previously hand-rolled a dense
  Gaussian-elimination solve of the iteration matrix, **re-factorising on every one of the 3–6 RHS
  a step solves**. They now factor once per step and route via a **threshold hybrid** (`_factorSolver`):
  inline elimination below n=8, the matrix `lu()`+`luSolve` primitive at n≥8. The threshold is
  measured — for the tiny iteration matrices real stiff systems use (n=1–3 across the whole test
  corpus) inline is 1.8×–8× faster (the `DenseMatrix`/`lu()` allocation overhead dwarfs the trivial
  O(n³) work); factor-once via the matrix primitive only overtakes it at n≈8 (up to 4× faster by
  n=40), the same crossover the `matrix/native-accel.ts` `det`/`inv` fast-paths use.
- **Behaviour is unchanged on the small path** (identical inline code — verified bit-for-bit on the
  full stiff corpus: linear stiff, Van der Pol μ=1000, Robertson) and correct on the large path
  (n=12 heat-equation MOL system pinned to the exact decaying mode: RODAS to 1e-8, Rosenbrock to
  ~5e-7). `functions/tests/solveode-jspath.test.ts`.

### feat(functions): `buttord` — bandpass/bandstop array form

- `buttord` now accepts `[low, high]` frequency pairs for `wp`/`ws` and returns the `[low, high]` natural
  frequency array `Wn`, covering bandpass and bandstop specs in addition to the existing scalar
  lowpass/highpass. Bandstop reproduces scipy's passband-edge order-minimization exactly — ports
  `scipy.signal.band_stop_obj` plus `optimize.fminbound` (bounded Brent) into `iir-design.ts`.
- Filter-type selection follows scipy (`_validate_wp_ws`): scalar `wp<ws` lowpass / `wp>ws` highpass;
  array `wp[0]>ws[0]` bandpass / `wp[0]<ws[0]` bandstop. Order matches scipy **exactly**; `Wn` to ~1e-8
  (`functions/tests/iir-design.test.ts`, bandpass + bandstop cases). Scalar behavior is unchanged.

### feat(functions): `remez` — exact Parks-McClellan replacing the Lawson-IRLS approximation

- `remez` (optimal equiripple FIR design) now runs the **exact** Parks-McClellan / Remez exchange
  algorithm — a faithful TypeScript port of the McClellan-Parks-Rabiner program that `scipy.signal.remez`
  wraps (scipy's `_sigtoolsmodule.cc`: `pre_remez` + `remez`), in `functions/src/signal/remez-exchange.ts`.
  It replaces the previous Lawson-IRLS approximation (documented as approximate).
- **API now matches `scipy.signal.remez` exactly** (a convention change from the old signature): band
  edges are normalized to `[0, 0.5]` (`fs = 1`, `0.5 = Nyquist`); `desired` and the new optional `weight`
  carry **one value per band** (`bands.length / 2`), not per edge; the new optional `type` is `'bandpass'`
  (default, symmetric), `'differentiator'`, or `'hilbert'` (antisymmetric). Note this differs from `firls`,
  which keeps scipy's `firls` convention (`1 = Nyquist`, per-edge desired) — mirroring scipy's own
  inconsistency between the two.
- Taps match `scipy.signal.remez` to **machine precision (~1e-16)** for all four linear-phase families
  (Type I/II symmetric; Type III/IV antisymmetric), pinned in `functions/tests/remez-pm.test.ts`
  (lowpass, highpass, bandpass, weighted multiband, Type II even, hilbert, differentiator).

### fix(functions): resolve the care/dare eigenvector-routing TODO — measured, sign-function/SDA retained

- Follow-up to matrix `eig` gaining complex eigenvectors (`vectorsIm`, 2026-07-16), which unblocked the
  classical **Hamiltonian-eigenvector** construction for `care` (`X = U₂U₁⁻¹` over the stable invariant
  subspace). Prototyped that path and **measured it against the retained matrix-sign-function `care`**
  (RFL R4 — measure before deciding) on a corpus including complex-Hamiltonian-eigenvalue cases
  (double-integrator −0.87±0.5i, oscillator −0.68±0.98i, 3×3 companion −0.48±0.58i) and ill-conditioned
  ones (near-uncontrollable, lightly-damped chain).
- **Result: the eigenvector path is strictly LESS accurate on every case, never better.** Both are
  machine-precision on well-conditioned inputs, but the Riccati residual gap widens on ill-conditioned
  Hamiltonians — near-uncontrollable **3.3e-10** (eig) vs **2.3e-13** (sign); chain5×5 **7.1e-13** vs
  **3.7e-14**. Eigenvector-basis subspace extraction is the numerically inferior classical method (why
  LAPACK/scipy use ordered Schur, not eigenvectors). Per the task's own rule ("keep/improve accuracy;
  if equal prefer the codebase pattern"), the self-contained **sign-function `care` / SDA `dare` are
  retained** — routing to eigenvectors would be a robustness regression for no gain.
- Corrected the now-**stale** `control-equations.ts` docstring (it claimed `eig` "only returns real
  eigenvector columns … so a Hamiltonian-eigenvector approach isn't usable here" — false since
  `vectorsIm`) to state the accurate, measured reason the sign function is kept.
- **+3 oracle+residual-pinned tests** (`control-equations.test.ts`, 6 total) locking in the retained
  solvers on complex-spectrum cases: `care` oscillator (−0.68±0.98i) & 3×3 companion (−0.48±0.58i),
  `dare` rotation (open-loop 0.9±0.3i) — each pinned to `scipy.linalg.solve_{continuous,discrete}_are`
  (relerr ≤1e-15) AND the implementation-independent Riccati residual (<1e-10) + symmetry.

### test(functions): lock in `funm`/`cosm`/`sinm` on complex-spectrum defective matrices

- Closed the last untested `funm` coverage gap (functions@0.39.0 follow-up): the **complex-spectrum
  defective** case — a repeated complex-conjugate eigenvalue pair with geometric multiplicity < algebraic,
  where the confluent Hermite branch evaluates `f` (and its derivatives) at **complex** eigenvalue nodes.
  The minimal such matrix is 4×4 (a 2×2 real-Jordan block `[[C,I],[0,C]]`, `C=[[a,b],[-b,a]]`); also
  pinned a 6×6 multiplicity-3 block to exercise the 2nd-derivative confluent path.
- **Measured, not assumed (RFL R4):** the previously-untested real-direction finite-difference derivative
  path was verified against `scipy.linalg.{expm,cosm,sinm}` and is well within its documented ~1e-6 budget —
  `funm(·, exp)` numeric FD: maxErr **6.6e-11** (4×4) / **1.1e-8** (6×6); analytic-derivative `cosm`/`sinm`
  and `funm(·, exp, expDerivs)`: **~2e-16** (machine precision). Imag parts of `f(real matrix)` cancel to
  <1e-8 as required. **No bug found** — coverage-lock only; the impl was already correct on this case.
- +8 oracle-pinned tests in `functions/tests/gap-funm-defective-oracle.test.ts` (15 total in the file).

### docs(test): correct fft-wasm-mock header + resolve the WASM-FFT-retire decision (KEEP)

- Re-verified the "retire the dead WASM FFT kernel" TODO before acting: the premise was half-wrong. The AS
  binary **does** export `fft`/`rfft`/`powerSpectrum`, a matrix wrapper (`backends/wasm/fft-wasm.ts`) consumes
  them, and a **live passing 24-test suite** (`matrix/tests/wasm/fft-wasm.test.ts`) exercises the real kernel as
  the `__new`-allocator regression guard. Decision: **KEEP** — a functional, correctness-tested internal
  accelerator whose 6× slowness never bites (nothing in `src` routes to it); retiring a tested coherent
  subsystem is a destructive ADR, not an auto-purge. Fixed the doc-drift the audit surfaced:
  `fft-wasm-mock.test.ts`'s header wrongly claimed the AS artifact "does not export fft/rfft/powerSpectrum".

### fix(core): update physical constants CODATA-2018 → CODATA-2022 (oracle-pinned to scipy.constants)

- MathTS's physical `constants` (`functions/src/type/unit/physicalConstants.ts`) were CODATA-2018, one
  cycle behind `scipy.constants` (CODATA-2022). Updated the **27 measured constants that genuinely
  shifted** to their CODATA-2022 values, copied verbatim from `scipy.constants`:
  `electronMass` 9.1093837015e-31 → 9.1093837139e-31, `protonMass` 1.67262192369e-27 → 1.67262192595e-27,
  `neutronMass` 1.6749271613e-27 → 1.67492750056e-27, `deuteronMass` 3.3435830926e-27 → 3.3435837768e-27,
  `atomicMass` 1.66053906660e-27 → 1.66053906892e-27, `fineStructure` 7.2973525693e-3 → 7.2973525643e-3,
  `rydberg` 10973731.568160 → 10973731.568157, `bohrRadius` 5.29177210903e-11 → 5.29177210544e-11,
  `bohrMagneton` 9.2740100783e-24 → 9.2740100657e-24, `nuclearMagneton` 5.0507837461e-27 → 5.0507837393e-27,
  `hartreeEnergy` 4.3597447222071e-18 → 4.359744722206e-18, `classicalElectronRadius` 2.8179403262e-15 →
  2.8179403205e-15, `thomsonCrossSection` 6.6524587321e-29 → 6.6524587051e-29, `quantumOfCirculation`
  3.6369475516e-4 → 3.6369475467e-4, `magneticConstant` 1.25663706212e-6 → 1.25663706127e-6,
  `electricConstant` 8.8541878128e-12 → 8.8541878188e-12, `vacuumImpedance` 376.730313667 → 376.730313412,
  `coulomb`/`coulombConstant` 8.987551792261171e9 → 8.987551786170797e9, `planckCharge` 1.87554603778e-18 →
  1.8755460384151476e-18, `sackurTetrode` -1.16487052358 → -1.16487052149, `weakMixingAngle` 0.2229 →
  0.22305, `molarMass` 0.99999999965e-3 → 1.00000000105e-3, `molarMassC12` 11.9999999958e-3 →
  12.0000000126e-3, `planckMass` 2.176435e-8 → 2.176434e-8, `planckTime` 5.391245e-44 → 5.391247e-44,
  `planckTemperature` 1.416785e32 → 1.416784e32. Also refined `wienDisplacement` and `stefanBoltzmann`
  literals to scipy's fuller precision (both SI-exact — value physically unchanged between cycles).
- The **5 SI-fixed constants** (`speedOfLight`, `planckConstant`, `elementaryCharge`, `boltzmann`,
  `avogadro`) and every constant derived purely from them (`faraday`, `gasConstant`, `klitzing`,
  `josephson`, `conductanceQuantum`, `magneticFluxQuantum`, `molarPlanckConstant`, `firstRadiation`,
  `secondRadiation`, `loschmidt`, `molarVolume`, `reducedPlanckConstant`, …) were left **untouched** —
  identical in CODATA-2018 and 2022. `gravitationConstant` and `fermiCoupling` also unchanged in 2022.
- Added a standing oracle guard `functions/tests/physical-constants-codata2022.test.ts` that pins every
  exported physical constant to its `scipy.constants` CODATA-2022 value (relative tolerance 1e-13), so
  they can no longer silently drift a CODATA cycle behind. Updated the 3 stale expectations in
  `functions/tests/physical-constants.test.ts` to CODATA-2022.

### fix(tools): wire the file-census gate into pre-commit + regenerate on any `.ts` change

- The file census (`file-inventory.json`) tracks EVERY tracked `.ts`, but `docs:deps` (which rebuilds it)
  was gated on `src/`/`assembly/` changes only, and `check:file-census` was never wired into the hook — so a
  `docs/`/`tests/`/`tools/` `.ts` add/delete left the census stale and the commit succeeded anyway (caught
  when the Workbook-snapshot deletion above left the census at 1705 vs disk 1700). Fixed both: the pre-commit
  hook now regenerates `docs:deps` on **any** `.ts` change (not just `src/`), and runs `check:file-census`
  (maximal-walk self-check, <1s) on **every** commit as the loud backstop. A stale or incomplete census now
  fails the commit.

### chore(cleanup): delete stale docs/Architecture/Workbook/*.ts snapshots

- Removed 5 rotted snapshot files under `docs/Architecture/Workbook/` (`cli.ts`, `executor.ts`, `graph.ts`,
  `index.ts` — a 446-line stale copy of the YAML parser, not an index — and `types.ts`). They were stale
  copies of `workbook/src/`, referenced by nothing (only listed in the file-census inventory), unbuilt, and
  had already drifted from the real source. File census 1705 → 1700; self-check gate green.

### feat(tools): complete file census (FILE_INVENTORY) + maximal-walk self-check gate in CDG

- Added a **complete file census** to `tools/create-dependency-graph` (`buildFileInventory`): EVERY tracked `.ts`
  in the repo — package `src/` + `tests/`, PLUS the repo-ROOT cross-package `tests/`, `tools/`, build/test
  `*.config.ts`, `examples/`, and `docs/` reference sources — enumerated with a disposition (`reachable`,
  `build-entry`, `test-only`, `orphan`, `test`, `tool`, `config`, `example`); src dispositions come from the
  existing module-graph reachability/root data (no second graph). Emits `docs/Architecture/FILE_INVENTORY.md`
  (summary + per-disposition/per-area/per-package counts + alphabetized `file | package | area | disposition`
  table) and `file-inventory.json`. Wired into `npm run docs:deps` (+ prettier-formatted). **Census: 1705 files**
  (== the git-tracked `.ts` set; excludes only `node_modules`/`dist`/`*.d.ts`/dot-dirs) = 1091 `src` (1055
  reachable + 33 build-entry + 3 test-only + 0 orphan) + 550 `test` + 25 `tool` + 29 `config` + 10 `example`.
- Added a **self-check gate** (`verifyFileCensus`) whose ground truth is a MAXIMAL, location-agnostic repo walk
  (`walkRepoTsFiles`) — deliberately BROADER than the census's enumerated discovery, so it catches a scoping gap
  the census would miss (a `.ts` in a new/unenumerated top-level dir), plus any `orphan`. It HARD-FAILS
  `npm run docs:deps` (throws → non-zero exit; top-level `.catch` now `process.exit(1)`s), and a standing no-regen
  gate `npm run check:file-census` (`--check-census`, analogous to `check:duplicates:fast`) fails if a `.ts` was
  added anywhere in the repo since the last `docs:deps`. Proven both classes: a temp `parallel/src/__censusprobe.ts`
  (src) fails `docs:deps` naming it as an orphan; a temp `tests/integration/__probe.test.ts` (OUT of the old
  per-package scope) fails `check:file-census` naming it as unaccounted-on-disk; both pass once deleted.
- **Defect fixed (independent review):** the first cut scoped BOTH the census and its self-check walk per-package
  `src/`+`tests/`, so the gate shared the census's blind spot and silently missed 11 repo-root cross-package
  tests (`tests/integration/*`, `tests/wasm/*`, `tests/benchmark/*`) while the gate passed — a false
  "avoid-missing-anything" guarantee. The gate now walks the whole repo maximally and the census enumerates all
  source roots, so maximal-walk count == census totalFiles (1705) with zero unaccounted files.

### fix(tools): CDG reads config-driven `tsup.config.ts` entries — repairs a build-root regression

- CDG's build-root detection parsed only the package.json build/dev **script string** for `tsup src/*.ts` args.
  When `plot`/`workbook` moved their multi-entry lists into `<pkg>/tsup.config.ts` (bare `tsup` script — a
  side effect of the VERSION-derive change that made those configs read `package.json` at build time),
  CDG could no longer see `plot/src/render-file.ts` and `workbook/src/run-worker.ts`, silently dropping them
  from the module graph (**1088 → 1086**). Added `tsupConfigEntries`: when a `build`/`dev` script invokes `tsup`
  with no explicit `src/*.ts` arg, also parse `tsup.config.ts`'s `entry:[…]` array and seed each as a build root.
  Both files return to the graph (**module total 1086 → 1088**) and drop off the orphan/dormant lists in
  `unused-analysis.md` (orphaned 1 → 0, dormant 5 → 3). Also deduped `entryPoints` (config-driven configs re-list
  `index.ts`/`cli.ts`).

### fix(test): repair cov-numeric `cond` import broken by the dedup

- The matrix-domain dedup slice (`a99029c2`) removed the shadowed power-iteration `cond` from
  `functions/src/typed/numeric.ts` (redundant with the canonical SVD `cond` in `typed/matrix-ops.ts`), but its
  "no caller" check missed a direct *test* import: `functions/tests/cov-numeric.test.ts` imported `cond` from
  `numeric.ts`, so 3 tests threw "cond is not a function." Removed the obsolete `cond` import + the 3 tests that
  covered the deleted shadow (the public SVD `cond` is oracle-pinned in `gap-matrix-domain-dedup-parity.test.ts`).
  `cov-numeric` 48/48 green. Found while sweeping dedup leftovers — a regression the campaign introduced and never
  caught because the full-suite failure was mislabeled "pre-existing."

### chore(cleanup): retire dead-ship dedup leftover copies (switch/formatter), migrate coverage to core

- Retired three **dead-ship** Bucket-B consolidation leftovers — package-local copies/shims that were kept alive
  only by their own unit tests, with no runtime consumer (unreachable from any package `src/index.ts`, and every
  live caller already imports the `@danielsimonjr/mathts-core` canonical):
  - `expression/src/utils/switch.ts` (full local copy of `core/src/switch.ts`'s `_switch`).
  - `expression/src/utils/bignumber/formatter.ts` and `functions/src/utils/bignumber/formatter.ts` (thin re-export
    shims of `core/src/bignumber-formatter.ts` — museum pieces once redirected).
- **No coverage lost.** Core had no dedicated unit test for `_switch` or the BigNumber formatter, so their tests
  were migrated (retargeted at core's canonical imports) into new `core/tests/switch.test.ts` (8 cases) and
  `core/tests/bignumber-formatter.test.ts` (28 cases, merged from `expression`'s two formatter test files).
- Deleted the now-redundant package-local direct tests: `expression/tests/utils-switch.test.ts`,
  `expression/tests/utils-bignumber-formatter.test.ts`, `expression/tests/utils-bignumber-formatter-extra.test.ts`.
- Retired the `bignumber/formatter` section of `functions/tests/dedup-bucketB-equivalence.test.ts` (it pinned the
  now-deleted shims ≡ core — a museum piece); the `factory`/`string` sections stay (they still protect the live
  `factory.ts`/`string.ts` copies).
- **KEPT (reported, not deleted): `expression/src/error/DimensionError.ts`** — although also a re-export shim of
  core, it has a *live* consumer beyond its unit test: the frozen slice-2 snapshot
  `functions/tests/fixtures/dedup-bucketB-slice2/expression-array-original.ts` imports it. Deleting it would break a
  protected fixture, so it stays. `unused-analysis.md` test-only dormant count 7 → 4; orphaned unchanged at 1.

### chore(cleanup): delete dedup-orphaned MathjsError.ts copies

- Removed `expression/src/error/MathjsError.ts` and `functions/src/error/MathjsError.ts` — dead orphans left by
  the Bucket-B error consolidation (the canonical `MathjsError` lives in `@danielsimonjr/mathts-core`, re-exported
  via `core/internal`; these package-local copies had no importer in src or tests and were reachable from nothing).
  Confirmed by the regenerated `unused-analysis.md` (orphaned files 3 → 1; the remaining one,
  `workbook/src/run-worker.ts`, is a `worker_threads` build entry the graph can't trace, not dead). No shipped
  behavior change — the files were never reachable from any package entry, so they were never in any bundle.

### fix(core,plot,workbook): derive VERSION from package.json (was drifted)

- The exported `VERSION` constant in `core`, `plot`, and `workbook` was a hardcoded literal that Changesets never
  bumped, so it had silently drifted from each package's real published version: **core `0.1.0` → 0.13.0**, **plot
  `0.2.0` → 0.3.29**, **workbook `0.1.0` → 0.3.3**. Workbook's is user-facing — `mtsw version` printed the wrong
  number (`mtsw version 0.1.0` instead of `0.3.3`), as did `capabilities`/`introspect`.
- Root-cause fix (not a re-hardcode): `VERSION` is now injected at build time from each package's own
  `package.json` via a new per-package `tsup.config.ts` (esbuild `define: { __PKG_VERSION__ }`, read Node-side so
  `package.json` is never bundled into `dist`). The source declares `export const VERSION: string = __PKG_VERSION__`.
  Build scripts changed to `tsup` (load the config). The same `define` is mirrored in each package's
  `vitest.config.ts` so source-importing tests resolve the global. `core/tests/version.test.ts` now pins `VERSION`
  to `package.json` instead of a literal (the literal was exactly what let it drift). VERSION can no longer drift.

### docs: comprehensive API reference expansion

- `docs/Architecture/API.md` expanded 456 → 1088 lines: verified method-level signatures for all 24 packages
  (numeric-type methods, class APIs, domain function maps, typed-dispatch mechanism), extracted from the built
  `.d.ts` files. Added full sections for `gpu` and `plot`, promoted `tensor`/`autograd` from stubs, and added a
  focused-re-export-packages table. Header reworded as hand-maintained (was "Generated").
- New per-package API references under `docs/api/`: `gpu.md`, `tensor.md`, `autograd.md`, `expression.md`,
  `workbook.md`, `plot.md` (the six packages that lacked one); `docs/api/README.md` index updated to list all 11.
  The generator-owned "Complete export index" appendix in the existing 5 files is untouched (`docs:functions:check`
  passes).

### docs: add COMPONENTS.md component reference

- New `docs/Architecture/COMPONENTS.md` — a per-package component reference (purpose, key exported types,
  dependencies) for all 24 workspace packages, modeled on the MemoryJS COMPONENTS.md style (layered overview
  diagram, per-component API blocks, dependency tree). Linked from `docs/README.md`.

### docs: deduplication-campaign milestone sync

- Marked the cross-package deduplication campaign **COMPLETE (`TRUE_DUPLICATE` 253 → 0)** across the repo docs:
  `TODO.md` (campaign banner), `docs/Architecture/duplicate-backlog.md` (header → historical disposition record).
- `docs/api/compat.md` — corrected the `zeros` / `ones` signatures to `(n) => number[]` (vector, mathjs parity)
  vs `(rows, cols) => Matrix`, matching the compat behavior fix below.
- `CLAUDE.md` — documented the now-permanent `check:duplicates` pre-commit gate and CDG's duplicate-symbol
  detection under Tools; updated the **WASM SHA-384 security invariant** to point at the new canonical
  `core/src/wasm-loader.ts` (the hash logic moved there this milestone — was `functions/src/wasm/WasmLoader.ts`).
- `docs/Architecture/ARCHITECTURE.md` — §6b (WASM Bridge Layer) now describes the shared `core/src/wasm-loader.ts`
  (single-sourced SHA-384 integrity + artifact resolution, injected paths, browser-safe) alongside the
  per-package `WasmLoader` classes.
- `tools/create-dependency-graph/duplicate-allowlist.json` — refreshed the compat `zeros`/`ones` reason
  (was "n×n square — SURFACED"; now the shipped mathjs-parity vector fix) and the `bitXor` reason (dropped the
  stale "stays TRUE_DUPLICATE pending" note — all three definers are resolved); report regenerated.

## [2026-07-18] — Cross-package deduplication campaign (`TRUE_DUPLICATE` 253 → 0)

Released across `ad45a7c5` (core@0.12.0 · functions@0.43.1 + 14-pkg cascade) and `6d7a9df4`
(compat@0.4.0 · core@0.13.0 · functions@0.43.2 · matrix@0.6.3 + cascade); earlier slices shipped in
core@0.11.0 / functions@0.43.0. The classification-aware CDG finder + the `check:duplicates` pre-commit
gate drove every cross-package duplicate to eliminated / allowlisted-with-reason / executed-keep-decision,
and the oracle audits fixed 7 real public-API correctness bugs along the way. All entries below are
released and live on npm.

### fix(compat): `zeros(n)` / `ones(n)` return a length-`n` vector (mathjs parity)

- **compat** — `zeros(n)` / `ones(n)` (single-arg) now return a length-`n` **vector** matching mathjs
  (`math.zeros(3)` → `[0,0,0]`, size `[3]`), instead of the former **n×n square** matrix (`cols ?? rows`).
  Two-arg `zeros(r,c)` / `ones(r,c)` is unchanged (an r×c DenseMatrix). matrix's DenseMatrix is strictly
  2-D, so the single-arg vector is returned as a `number[]`. This is a **public behavior change** for
  compat's mathjs-compatibility surface → warrants a **compat release**. Guarded by
  `compat/tests/parity-oracle.test.ts` (the test that previously pinned the square bug now asserts mathjs
  parity). No other package/consumer relied on the square behavior (only the migration example, which uses
  the 2-arg form).

### Dedup — floor-decisions slice (`TRUE_DUPLICATE` 12 → 0)

Daniel took the 4 remaining HUMAN-DECISION calls and they were executed here; **`TRUE_DUPLICATE` is now 0**
(baseline re-seeded to empty). No runtime behavior change beyond the compat fix above; 0 cycles;
`check:browser-safety` 23/23.

- **WasmLoader security cluster (7 → 0)** — the byte-identical SHA-384 integrity logic
  (`sha384OfBuffer`/`loadWasmManifest`/`verifyWasmIntegrity`) and packaged-artifact resolution
  (`resolvePackagedWasm`/`defaultWasmLocation`) consolidated into **`core/src/wasm-loader.ts`**, exported
  via `@danielsimonjr/mathts-core/internal` (reachable from both `functions` and `matrix` without a cycle).
  Each package's `wasm/integrity.ts` + `wasm/resolve.ts` now re-export the shared logic and inject their own
  `import.meta.url`. **SHA-384 verify-before-instantiate preserved byte-for-byte** (Security Invariant #1);
  node `fs`/`crypto` stays behind lazy dynamic `import()` so core's `.` entry remains browser-safe. The
  `WasmLoader` class + `wasmLoader` singleton stay per-package (allowlisted) — genuinely different
  allocation models (simple single-pointer vs AS managed-runtime header+data handle). Guarded by both
  packages' `tests/security/wasm-integrity.test.ts`.
- **`qr` (1 → 0)** — KEPT both bodies (routing would drop the mathjs Matrix contract + `qr_wasm` fast path);
  allowlisted as a distinct-contract dispatch-variant, guarded by new `functions/tests/gap-qr-parity.test.ts`
  (functions ≡ matrix ≡ NumPy on |diag R| + A=Q·R + Qᵀ·Q=I; no divergence to full double precision).
- **workerpool caps (4 → 0)** — `canUseWasm`/`canUseSharedMemory` allowlisted as an intra-workerpool
  node/browser-shim dispatch-variant; `initializePool`/`terminatePool` allowlisted as distinct-by-target
  (functions' wrap a `ComputePool` from `parallel`, workerpool's wrap a `MathWorkerPool` — verified: they
  are different pool singletons, so the original "delegate" hypothesis would have been a regression).

### Dedup — closing tail slice (`TRUE_DUPLICATE` 89 → 12 = the floor)

Classified and dispositioned **every** remaining non-ADR cluster; the 12 that remain are exactly the
three already-surfaced HUMAN-DECISION clusters (WasmLoader SHA-384 security ×7, workerpool caps / #27
×4, `qr` keep-vs-route ×1) — the irreducible floor. No user-facing behavior change; no release warranted.

- **Consolidated `_switch`** (the one genuine merge): `functions/src/utils/switch.ts`'s byte-equivalent
  2-D transpose helper now re-exports the canonical `core/src/switch.ts` body via
  `@danielsimonjr/mathts-core/internal` (functions → core, no cycle). `cumsum`'s call site casts to
  `unknown[][]`; all cumsum coverage green.
- **Allowlisted the rest as legitimate independence**, each with a documented reason and, where they are
  independent reimplementations of the same semantics, a **parity guard**:
  - factory-layer scalar/array ops (`addScalar`/`subtractScalar`/`multiplyScalar`/`divideScalar`/
    `isNumeric`/`isInteger`/`factorial`/`concat`/`filter`/`flatten`/`forEach`/`map`/`reshape`/`resize`/
    `squeeze`) — new guard `functions/tests/gap-factory-core-parity.test.ts` pins functions ≡ core ≡ oracle.
  - compat homonyms (`zeros`/`ones`/`size`/`matrix`/`identity`/`transpose`/`bignumber`/`fraction`/`sparse`/
    `complex`/`e`/`pi`/`phi`/`tau`) — `compat/tests/parity-oracle.test.ts` extended with oracle pins.
  - hot-path type guards (`is*`/`typeOf`), distinct-by-domain homonyms (`scatter`/`area`/`histogram`/
    `line`/`derivative`/`jacobian`/`topologicalSort`/`dispatch`/`get`/`clone`/`format`/`reduce`/`norm2`/
    `round`/`fix`/`equal`/`compareText`/…), framework variants (`factory`/`create`/`createChain`/
    `getOperator`/`properties`/`printTemplate`), unit ops (`to`/`toBest`), and `bitXor`'s BigNumber body.
  - the coherent-but-unreferenced matrix WASM-FFT bridge (`fft`/`ifft`/`rfft`/`convolve`) kept as
    accelerator scaffolding rather than deleted (`feedback-dont-auto-delete-coherent-api`).
- **Surfaced (not changed):** `compat.zeros(n)`/`compat.ones(n)` return an **n×n square** matrix
  (`cols ?? rows`), diverging from mathjs's size-`n` vector semantics (`functions.zeros(3)` is the correct
  `[0,0,0]`). Pinned as compat's own contract in the parity test; a real fix would be an outward-facing
  behavior change (confirm-first).
- Baseline re-seeded to 12; `check:duplicates:fast` passes; 0 dependency cycles.

### Dedup — matrix-domain routing slice (`TRUE_DUPLICATE` 104 → 89)

Classified all 16 matrix-domain symbols defined in both `functions` and `matrix` (by reading BOTH
bodies) and resolved 15 (only `qr` remains, surfaced for a human keep-vs-route decision):

- **Routed `functions` cholesky to the matrix DenseMatrix primitive** (native-accel,
  `project-two-decomposition-layers-prefer-matrix`). `functions/src/typed/matrix-ops.ts`'s `number[][]`
  Cholesky now delegates to `matrix`'s maintained primitive, keeping only a symmetry pre-check (the
  primitive reads the lower triangle only) and a `DenseMatrix → number[][]` conversion. A pre-routing
  NumPy audit (`np.linalg.cholesky`, SPD corpus) confirmed both bodies were already correct to full
  double precision — **no behavior change, no bug**. Public signature/throws unchanged.
- **Removed a dead, shadowed `cond`.** The power-iteration `cond` in `functions/src/typed/numeric.ts`
  was unreachable via the public barrel (an `export *` collision with the SVD-based matrix-ops `cond`,
  explicitly overridden) and had no internal caller. Deleted at root; the public `cond` (SVD-based,
  delegates to the matrix primitive) is unchanged.
- **Allowlisted the dispatch-variant matrix primitives** for `pinv`, `singularValues`, `normFro`,
  `lowRankApprox`, `cond`, `matrixExpm`, `matrixLogm`, `matrixSqrtm` — the `functions` typed wrappers
  already route to them (verified by call chain), so `matrix` owns the single canonical body.
- **Allowlisted `trace`/`diag`/`dotMultiply`/`row`/`column`/`subset` as independent-by-design** — the
  `functions` mathjs-factory bodies (mathjs `Matrix`/`number[][]` contract) vs the `matrix`
  `DenseMatrix` typed-ops are different type surfaces across two packages, pinned together by a parity
  guard rather than merged.

New `functions/tests/gap-matrix-domain-dedup-parity.test.ts` (16 tests) pins cholesky + the six
factory ops to the NumPy oracle AND to the matrix primitives (per `feedback-allowlist-needs-parity-guard`).
Baseline re-seeded to 89; `check:duplicates:fast` passes, 0 cycles. `qr` (mathjs factory + WASM path vs
DenseMatrix primitive) left on the backlog as a keep-vs-route ADR — see `docs/Architecture/duplicate-backlog.md` §1.

### Fixed — two BigNumber/Complex correctness bugs found by the transcendental dedup audit

Oracle-auditing (mpmath / NumPy) the rich-type cases of the 12 transcendental scalars whose names
collide between `core` and `functions` (`sinh cosh tanh asinh acosh atanh cbrt log2 log10 log1p
expm1 sign`) surfaced two real, public-API correctness bugs — both fixed at root in `core`:

- **`BigNumber.divide` returned 0 / lost precision when the divisor coefficient had more digits than
  the scaled dividend.** The naive `10^(precision+10)` dividend scaling is only sufficient when the
  divisor has no more digits than the dividend; an un-rounded large product (e.g. `g*g` in Newton
  iteration) as divisor collapsed the integer-division quotient toward — or all the way to — zero.
  **Impact: catastrophic** — `cbrt(bignumber(2))` returned `~4.6e-18` instead of `1.2599…`, and
  `sqrt`/`asinh(BigNumber)` degraded to ~11 significant digits. Fix widens the scale by the digit
  deficit `max(0, bDigits - aDigits)`; when `bDigits ≤ aDigits` it is bit-identical to before, so no
  previously-correct division changes. `cbrt`/`sqrt`/`asinh(BigNumber)` now reach full precision
  (~50–63 digits, ln-dependent ones bounded by the ~50-digit LN2/LN10 constants); `asinh(BigNumber)`
  is once again an odd function (negative-argument cancellation resolved).
- **`Complex.acosh` returned the wrong branch (negative real part) for `Re(z) < 0`**, and the wrong
  sign of π on the `z < -1` real-axis cut. The principal value (C99 Annex G / DLMF 4.37 / NumPy) has
  `Re ≥ 0`. Fix uses the factored `ln(z + √(z-1)·√(z+1))` instead of `ln(z + √(z²-1))`, which selects
  the correct Riemann sheet. E.g. `acosh(-1+0.5i)`: `(-0.733, -2.467)` → `(0.733, 2.467)`.

New `functions/tests/gap-transcendental-richtype-oracle.test.ts` pins every BigNumber/Complex/Fraction
rich-type case of all 12 against the mpmath/NumPy oracle (relative tolerance `1e-40`…`1e-50` for
BigNumber, `1e-12` for Complex), plus IEEE-754 `sign` edges (`-0`, `NaN`) and regression guards for
both core fixes. This is the parity guard justifying the dedup allowlist below.

### Dedup — allowlist transcendental hot-path-inline collisions (`TRUE_DUPLICATE` 116 → 104)

The 12 transcendental name-collisions are **not** accidental duplicates: `functions` inlines `Math.*`
in the `number` case (V8 hot-path guard, kept local per `project-all-libraries-build-on-core`), while
`core/src/number.ts` exports the scalar `number→number` primitive for cold consumers. The functions
definer is already auto-tagged `DISPATCH_VARIANT` (a `mathTyped` registration); allowlisting the sole
remaining `core/src/number.ts` `PLAIN` definer flips all 12 to `ALLOWLISTED`. Guarded by the oracle
parity test above (not a bare allowlist). `duplicate-baseline.json` re-seeded to 104;
`check:duplicates:fast` passes; 0 cycles.

### Dedup — compat-parity guard + bitwise/fft allowlisting (`TRUE_DUPLICATE` 135 → 116)

Tail slice of the cross-package deduplication campaign. Two adversarial reviewers (Gemini + OpenAI)
converged on the classification; this executes their endorsed conclusions.

- **fftshift/ifftshift consolidated onto one roll algorithm** (real DRY elimination, wire-not-delete).
  `functions/src/signal/fft.ts` now defines a single generic `rollBy<T>`; the generic `fftshift<T>`/
  `ifftshift<T>` (complex-FFT toolkit) and the public `number[]` surfaces in
  `functions/src/signal/fft-helpers.ts` (package `index.ts` exports) both delegate to it — one algorithm,
  two thin typed surfaces, no behavior change. New `functions/tests/signal/fftshift-parity.test.ts`
  asserts the two surfaces produce identical rolls on a shared even/odd/empty/single corpus + the numpy
  floor/ceil convention.
- **compat parity guards** (`compat/tests/parity-oracle.test.ts`). `compat/src/shims.ts` REIMPLEMENTS
  several homonyms independently of the `functions`/`core` twins to pin mathjs semantics (`std`/`variance`
  default 'unbiased'; self-contained `det`; `Math.*` trig wrappers; `Complex`-method `conj`/`re`/`im`/`arg`).
  Rather than allowlist blindly ("a divergent compat impl is exactly how a past 10⁶× variance bug hid"),
  each is now guarded by a test that anchors it to the **numpy oracle** AND cross-checks `compat.X ≡
  functions.X`. **Finding: no divergence — compat, functions, and numpy agree to full double precision**
  (variance `[1,2,3,4,5,8,13]` = 17.142857142857142; det `[[6,1,1],[4,-2,5],[2,8,7]]` = −306; etc.); the
  compat bodies are independent implementations that converge, which the guard now protects.
- **Allowlisted three verified-intentional categories** in
  `tools/create-dependency-graph/duplicate-allowlist.json`, each with a concrete reason:
  compat reimplementing homonyms (`variance`/`std`/`det`/`conj`/`re`/`im`/`arg`/`acos`/`asin`/`atan`/
  `atan2`, guarded by the parity test); `functions`+`parallel` **bitwise** dispatch-variants
  (`bitAnd`/`bitOr`/`bitNot`/`leftShift`/`rightArithShift`/`rightLogShift` — verified by reading both:
  `parallel` = chunked `Int32Array` worker kernel, `functions` = scalar/BigNumber `mathTyped` dispatch;
  `bitXor` stays flagged pending its 3rd BigNumber definer); and `fftshift`/`ifftshift` (public wrapper
  allowlisted so `fft.ts`'s generic is the single canonical body).
- **Runtime `TRUE_DUPLICATE` 135 → 116** (19 flipped: 11 compat + 6 bitwise + 2 fft);
  `duplicate-baseline.json` re-seeded to 116; `check:duplicates:fast` passes; 0 cycles.
- **Honest remaining-work inventory:** new `docs/Architecture/duplicate-backlog.md` groups the 116 residual
  eliminations (matrix-domain routing — with the already-routed dispatch-variants distinguished from the
  genuine independent bodies like `cholesky`; transcendental temperature-split; and two **HUMAN-DECISION**
  clusters: the WasmLoader SHA-384 security ADR and the workerpool `#27`-paused caps).

### Added — wire `check:duplicates` into the pre-commit hook (the "resolve forever" capstone)

`npm run check:duplicates` (added earlier, see "`check:duplicates` prevention gate" below) is now
wired into `.husky/pre-commit`: every commit fails if it introduces a NEW cross-package
`TRUE_DUPLICATE` beyond `docs/Architecture/duplicate-baseline.json` (the campaign's current 135
runtime accepted names), naming the offending symbol, its defining files, and the remediation
(consolidate onto the canonical, add to `duplicate-allowlist.json` if legitimately independent, or
re-run `gen-duplicate-baseline.mjs` if it's an accepted new backlog item).

- `tools/create-dependency-graph/check-duplicates.mjs` gained a `--no-regen` flag that skips the
  full CDG re-scan and reads the already-written `docs/Architecture/duplicate-symbols.json`
  as-is — new `check:duplicates:fast` npm script (`check:duplicates --no-regen`).
- `.husky/pre-commit` runs `check:duplicates:fast` on every commit, placed after the existing
  gated `docs:deps` regen step (which already refreshes `duplicate-symbols.json` whenever a
  commit touches package `src/`) and before `lint-staged` — so the gate reads fresh data without
  ever triggering a second `docs:deps`/`build:wasm` run. Cost: well under a second (measured
  ~0.3-0.4s), vs. minutes for a full CDG re-scan.
- Verified: a normal commit passes silently; injecting a synthetic duplicate
  (`export function __gateProbe()` in `core/src/constants.ts` + `matrix/src/config.ts`) and
  running the hook end-to-end (`sh -e .husky/pre-commit`, matching husky's actual invocation)
  correctly aborted the commit at the `check:duplicates:fast` step (exit 1, before `lint-staged`
  ever ran), naming `__gateProbe` and both files. The synthetic addition was then reverted.

### Dedup — cross-package TYPE declarations (core, expression, functions, matrix, parallel, tensor)

Triage + consolidation pass over the `docs/Architecture/duplicate-symbols.json` **`types`**
section (68 flagged `TRUE_DUPLICATE` type/interface names — distinct from the runtime-symbol dedup
passes above/below). Every declaration was read and structurally compared before deciding
consolidate vs. allowlist; the `is.ts`-guard-adjacent types found here follow the same
already-established "hot-path, kept local" rule as the runtime `is*` guards.

- **Consolidated onto a single canonical declaration + type-only re-export shims** (14 names,
  verified byte-identical or safely reconcilable before merging):
  - `FactoryMeta` (`expression`/`functions` → re-export from `@danielsimonjr/mathts-core/internal`;
    the surrounding header comment already *claimed* this was consolidated but the interface was
    still redeclared locally — fixed to match the claim).
  - `RangeForEachCallback`/`RangeMapCallback`/`RangeFormatOptions`/`RangeJSON` (`functions` → core's
    public `.` export). The callback pair differed only in `index: [number]` vs. core's
    `index: number[]` — a tuple is always assignable to the wider array type, so every real call
    site keeps type-checking under core's version.
  - `NestedArray` (`functions`, `tensor` → thin wrappers over core's generic `NestedArray<T>`;
    `functions` keeps its `T = MatrixValue` default via a local alias, `tensor` specializes to
    `NestedArray<number>` since Tensor is Float64Array-backed).
  - `MatrixDimensions` (`matrix` → re-export from core's public `.` export).
  - `ComplexValue` (`functions/src/numeric/matrix-functions.ts` → re-export from
    `@danielsimonjr/mathts-core/internal`; verified core's `ComplexValue` is the same minimal
    `{re, im}` shape, not a richer class as first assumed).
  - `ImportOptions` (`functions/src/core/create.ts` → import from the sibling
    `function/import.ts`, which the file already imported `importFactory` from).
  - `PoolOptions`/`ExecOptions`/`PoolStats` (`parallel/src/index.ts` → re-export from
    `@danielsimonjr/mathts-workerpool`, replacing a local copy whose own comment said "locally
    defined to avoid type resolution issues" — the re-export compiles cleanly).
  - `LoadingMetrics`/`WasmManifest` (`functions`, `matrix` → new shared home
    `core/src/types/wasm-loader.ts`, exported via `@danielsimonjr/mathts-core/internal`; both WASM
    loaders bind the same `mathts-as.wasm` binary and had byte-identical perf-metrics/manifest
    shapes despite the packages' documented functions↔matrix import-cycle constraint — core is
    reachable from both without recreating that cycle. `WasmModule` itself stays local per package:
    each declares a genuinely different subset of the AssemblyScript export surface.
- **Allowlisted as genuinely distinct** (`tools/create-dependency-graph/duplicate-allowlist.json`,
  ~40 names across ~20 entries): the AST-node/collection duck-type guards living beside the
  hot-path `is*` functions in `expression/src/utils/is.ts` + `functions/src/utils/is.ts`
  (`Node`/`AccessorNode`/…/`SymbolNode`/`PartitionedMap`/`ResultSet`/`Help`, plus
  `BigNumber`/`Complex`/`Fraction`/`Unit`/`Matrix`/`DenseMatrix`/`SparseMatrix`/`Range`/
  `IndexDimension`/`Index` and their additional per-consumer minimal-view copies in
  `functions/src/{types.ts,type/**,matrix/**,algebra/solver/**}`); `FactoryFunction`/
  `CreateFunction` (proven-incompatible generic constraints on `TDeps`, already documented in each
  file, PLUS a third unrelated `FactoryFunction` shape living in `core/src/factory/factory.ts`);
  `TypeDef`/`ConversionDef` (byte-identical shapes in `core/src/typed/mathts-typed.ts` and
  `packages/typed-function`, but core has no dependency edge onto the workspace typed-function
  package — it depends on the external `typed-function` github fork instead — so there is no valid
  import path without adding an unrelated coupling); `BackendType`/`MatrixBackend`,
  `BigNumberConstructor`, `ComplexConstructor`, `BigNumberValue`, `UnitDef`, `UnitInstance`,
  `ConfigOptions`, `WasmModule`, `CholeskyResult`, `FFTResult`, `ExecutionMode`,
  `MatrixConstructor`, `TypedFunction`, `TypeTest`, `SymbolicAnalysis`, `SparseMatrixData`,
  `MathNode`, `ParallelResult` (each independently verified structurally different — see the
  allowlist file for the exact shape comparison behind each verdict).
- **One diverged-but-unmerged finding, reported rather than forced:** `CompiledExpression`
  (`expression/src/compiler/compile.ts` vs. `expression/src/node/Node.ts`) — `compile.ts`'s
  `evaluate()` genuinely accepts `Record<string, unknown> | Scope` at runtime (used when
  `userScope` is a `Scope` map), while `Node.ts`'s declared type only allows
  `Record<string, unknown>`. `compile.ts` already imports `Node.ts`'s `MathNode`, so merging onto
  `Node.ts`'s (narrower) type would either need to widen `Node.ts` or silently narrow
  `compile.ts`'s real accepted input — left as a flagged, allowlisted divergence for a follow-up
  rather than forced in this type-only pass.

Type `TRUE_DUPLICATE` count: **68 → 0** (0 type duplicates remain; `duplicate-baseline.json`
regenerated down from 203 combined runtime+type entries to 135, all runtime). Runtime dedup is
unaffected (135, unchanged). `npm run typecheck` clean (32/32 tasks), `eslint` clean on all touched
packages (core/expression/functions/matrix/parallel/tensor), full `core`/`expression`/`functions`/
`matrix`/`tensor`/`parallel`/`typed-function`/`workerpool` suites green (functions alone: 4048
passed / 94 skipped, including `tests/is-guards-local.test.ts`), and `npm run check:duplicates`
passes (135 current == 135 baselined, 0 new).

### Dedup — math constants + DEFAULT_CONFIG cluster (core, compat, functions)

Cross-package dedup pass over the `docs/Architecture/duplicate-symbols.json` math-constant +
config cluster (starting point: 142 runtime `TRUE_DUPLICATE` names).

- **Math constants** (`LN2`/`LN10`/`LOG2E`/`LOG10E`/`SQRT2`/`SQRT1_2`): `compat/src/shims.ts` was
  redefining all six from `Math.*` directly instead of re-exporting `@danielsimonjr/mathts-core`'s
  canonical `core/src/constants.ts` copies. Confirmed byte-identical values (both derive from the
  same `Math.*` globals) before switching `compat` to import + re-export core's constants
  (alias-delegation form, matching the file's existing `add`/`sub`/… delegation pattern). The
  AssemblyScript mirror in `assembly/src/ops/scalar.ts` is untouched (separate compilation target,
  already allowlisted). `E`/`PI`/`PHI`/`TAU` were not flagged — compat's `e`/`pi`/`phi`/`tau` are
  lowercase mathjs-style names, not the same symbol as core's uppercase constants.
- **`functions/src/core/config.ts`**: was a byte-for-byte copy of `core/src/config.ts`'s
  `ConfigOptions`/`MathJsConfig`/`DEFAULT_CONFIG` (confirmed identical). Consolidated: added these
  to `@danielsimonjr/mathts-core/internal` (new export, no existing collision) and turned
  `functions/src/core/config.ts` into a thin re-export shim, so all ~50 existing
  `../core/config.js` import sites across `functions/src/` keep working unchanged.
- **`DEFAULT_CONFIG` verdict — package/module-specific, allowlisted (not consolidated).** After the
  above fix, three distinct `DEFAULT_CONFIG` definitions remain, each a genuinely different shape
  for a different subsystem: `core/src/config.ts`'s `ConfigOptions` (mathjs-style
  relTol/absTol/matrix/number/predictable tolerance config, internal-only), `core/src/factory/
  factory.ts`'s `MathTSConfig` (the public factory-registry/backend-routing config — precision/
  preferredBackend/wasmThreshold/gpuThreshold/parallelEnabled), and `matrix/src/config.ts`'s
  `MatrixConfig` (backend enable/preference/threshold + adaptive-tuning + profiling, matrix-only
  fields). Added all three to `tools/create-dependency-graph/duplicate-allowlist.json` with reason
  "package/module-specific default config" and regenerated `docs/Architecture/duplicate-
  baseline.json` accordingly.

Runtime `TRUE_DUPLICATE` count: **142 → 135** (all 7 targeted names — the 6 constants +
`DEFAULT_CONFIG` — now `ALLOWLISTED`). `npm run check:duplicates` passes (203 current == 203
baselined, 0 new). Full `core`/`functions`/`matrix`/`compat` suites green (functions: 4048 passed /
94 skipped), `npx tsc --noEmit` clean and `eslint` clean on all four touched packages.

### Guarded — remaining scalar arithmetic ops (Bucket C, slice 2) (functions)

Extends the Bucket-C "temperature split" equivalence sweep (slice 1, below) to the rest of the
inventory: every scalar op that exists BOTH as a plain primitive in `core/src/arithmetic/scalar.ts`
AND as a `mathTyped` dispatcher case in `functions/src/typed/arithmetic.ts` — `add`/`subtract`/
`multiply`/`divide`/`abs` (`pow`/`round`/`fix`/`equal` were slice 1).

**No divergence found.** Unlike slice 1 — where the typed dispatcher's rich-type cases
re-implemented DISTINCT policy that had silently drifted from core (three real bugs) — inspection
and a fast-check equivalence sweep confirm every case in these five ops is a direct one-liner
forward to the SAME shared instance method in both files (`a.add(b)`, `x.abs()`, same-type cases;
order-preserving `asComplex`/`asFraction`/`asBigNumber` promotion for the cross-type number+Complex/
Fraction/BigNumber cases — verified explicitly for the non-commutative `subtract`/`divide`, since
getting promotion order wrong is exactly the class of bug slice 1 found in `pow`). There is only one
implementation of the underlying policy being called from two sites, so **no delegation was made** —
delegating would add a redundant cross-module call with zero divergence-safety benefit.

**Rule applied:** DELEGATE to core when two call sites embody distinct branching/algorithm choices
that can drift apart (slice 1's case); GUARD BY TEST ONLY when both call sites are a direct forward
to the same shared method (this slice) — the equivalence test is the safety net that fires if that
ever stops being true. Hot `number`/`bigint` cases are untouched (still inline).

Added 24 fast-check properties + an edge corpus (±0, NaN, ±Infinity, denormals, negative inputs) to
`functions/tests/dedup-bucketC-arithmetic-equivalence.test.ts` (44 tests total, all green), covering
same-type and cross-type (number+rich-type, both operand orders) cases for all five ops. Full
`functions` suite green (4041 passed); the one failure seen in a full-suite run
(`gap-stats-breadth-oracle.test.ts`'s `tTestPower` `solveFor: 'nobs'`, a 5000ms vitest timeout) is
pre-existing and unrelated — reproduced identically on the clean `main` baseline via `git stash`, not
touched here. `npm run docs:deps` TRUE_DUPLICATE count unchanged (142 runtime / 69 types) — confirms
these are `DISPATCH_VARIANT`, not `TRUE_DUPLICATE`; the win is divergence-safety, not the count.

### Fixed — three live `pow`/`round`/`equal` bugs on BigNumber/Fraction/float (functions)

Three public-API correctness bugs, all from the typed dispatchers in
`functions/src/typed/arithmetic.ts` re-implementing scalar policy that had DIVERGED from the
correct, oracle-pinned version in `core/src/arithmetic/scalar.ts`:

- **`pow(bignumber(2), 0.5)` returned `1`** (should be `1.4142…`). The `BigNumber` case called
  `a.pow(b)` unguarded; a non-integer exponent of an exact decimal silently collapsed to 1. Core
  guards non-integer exponents and falls back to double-precision `Math.pow`. `pow(fraction(3),
  2.9)` had the same class of bug via `a.pow(Math.floor(b))` — it **silently floored the exponent**
  (returned `27` instead of `24.19…`).
- **`round(bignumber(-2.5))` returned `-3`** (should be `-2`). The `BigNumber` case used
  `a.round()` (half-away-from-zero); core uses `x.round(0, 'halfCeil')` so BigNumber rounding is
  type-consistent with `number`/`Fraction` (`round(-2.5) = -2` everywhere).
- **`equal(0.1 + 0.2, 0.3)` returned `false`** (should be `true`). The `number,number` case used
  strict `===`; mathjs parity (and core's `equal`) is **tolerance-based** via `nearlyEqual`
  (`relTol`/`absTol`). Floats are almost never bit-equal after arithmetic, so strict `===` was the
  wrong policy for a public math `equal`.

Fixed at root via the **Bucket-C "temperature split"**: the rich-type / policy dispatch cases
(`BigNumber`/`Fraction`/`Complex` for `pow`/`round`/`fix`/`equal`, plus the tolerance-based
`number,number` `equal`) now **delegate to core's scalar primitive** instead of carrying a
divergent copy, while the hot `number`/`bigint` arithmetic cases **stay inline** (delegating them
would route the hottest path through core's polymorphic ladder → type-feedback pollution). All
values cross-checked against numpy (`2**0.5`, `3**2.9`, `np.isclose(0.1+0.2, 0.3)`). A new
equivalence guard (`functions/tests/dedup-bucketC-arithmetic-equivalence.test.ts`) proves the
typed dispatcher's rich-type output ≡ core's primitive over a fast-check generator + an explicit
edge corpus, so the copies can never silently drift again. Microbench: the hot `number` path is
unchanged (inline); the delegation adds only ~0.13–0.41 µs/call on the inherently-slow rich-type
(BigNumber/Fraction) cases, negligible against those exact-arithmetic operations and justified by
fixing three wrong answers.

### Changed — CDG `duplicate-symbols` detector is now classification-aware (alias/dispatch/allowlist/true)

The `duplicate-symbols` detector's name-grouping over-counted: it flagged legitimate
typed-dispatch variants, const-alias delegations, deliberately-kept hot-path guards, and
AssemblyScript/`VERSION`-string false positives alongside real merge targets, reporting a flat
253 runtime "duplicates". `detectDuplicateSymbols` (`tools/create-dependency-graph/create-dependency-graph.ts`)
now classifies every flagged name into one of four `DupEntryTag`s: **ALIAS_DELEGATION** (a
definer whose body is `export const X = Y` where `Y` resolves to an imported symbol — e.g.
`compat/src/shims.ts`'s `export const abs = _abs` — excluded as a forward, not an independent
body; if <2 real bodies remain the whole name is dropped into this bucket); **DISPATCH_VARIANT**
(>=2 `export const X = mathTyped('X', {...})` registrations of the same public name across
packages — e.g. `abs`/`add` in `functions` vs `matrix` — distinct dispatch surfaces, Bucket C
delegation candidates, not copy-paste duplicates); **ALLOWLISTED** (matches the new
`tools/create-dependency-graph/duplicate-allowlist.json`, seeded with the hot-path `is*` guard
family kept local per `project-all-libraries-build-on-core`, the AssemblyScript `assembly/src/**`
mirror layer that can't import `core`, and the three per-package `VERSION` strings); and
**TRUE_DUPLICATE** — the actionable remainder. `duplicate-symbols.{json,md}` now report a
per-category summary line plus the existing per-name detail (each definer annotated with its
own sub-tag/reason); the runtime **TRUE_DUPLICATE count dropped from 253 to 142**
(17 DISPATCH_VARIANT, 7 ALIAS_DELEGATION, 87 ALLOWLISTED explain the rest).

### Added — `check:duplicates` prevention gate (baseline-diff, not yet hook-wired)

`npm run check:duplicates` (`tools/create-dependency-graph/check-duplicates.mjs`) regenerates
the duplicate-symbol analysis and fails on any `TRUE_DUPLICATE` name beyond
`docs/Architecture/duplicate-baseline.json` (the campaign's current, shrinking backlog — seeded
at 142 runtime + 69 type = 211 accepted names via the new one-off
`tools/create-dependency-graph/gen-duplicate-baseline.mjs` generator), naming the new
duplicate's defining files and suggesting reuse of the canonical definer (or an
`duplicate-allowlist.json` entry if it's legitimately independent). Verified to PASS on the
current tree and FAIL when a synthetic same-name duplicate is injected. Not yet wired into the
pre-commit hook — a deliberate follow-up so the full CDG re-scan doesn't slow down every commit
during the in-flight consolidation campaign.

### Changed — cross-package dedup, Bucket B slice 1: `factory`/`string`/`bignumber-formatter` utils → core/internal

`expression` and `functions` each carried duplicate mathjs-derived cold-utility copies (dead
`.ts→.ts` sync residue) for `factory` helpers, generic-value string formatting, and BigNumber
formatting. Consolidated the PROVEN-equivalent subset onto `@danielsimonjr/mathts-core/internal`
(alongside the existing `number.ts`/`object.ts` canonicals), following the
`project-all-libraries-build-on-core` principle. New `core/tests/helpers/equivalence.ts` —a reusable
fast-check property harness (`assertEquivalent`: structural/numeric comparison + input-mutation
detection via deep-freeze + snapshot diffing) — proved (or disproved) equivalence per function before
any redirect; see `functions/tests/dedup-bucketB-equivalence.test.ts` (18 property/regression tests).

**Consolidated** (redirected to core, re-exported under original names — zero API changes):
`isFactory`, `assertDependencies`, `isOptionalDependency`, `stripOptionalNotation` (+ `LegacyFactory`/
`DependencyName` types); `format`/`stringify`/`compareText`/`escape` (generic-value string
formatting, core exports as `formatGeneric` internally — `number.ts` already owns `format` for plain
numbers in the same barrel); `format`/`toEngineering`/`toExponential`/`toFixed` (BigNumber/decimal.js
formatting, core exports as `*BigNumber` internally, same collision-avoidance reason). `endsWith` in
`expression`'s `utils/string.ts` was ALSO redirected — it was already identical to (and redundant
with) `core/shared.ts`'s canonical `endsWith`.

**NOT consolidated — two divergences found and reported, not silently resolved:**
- `factory()`/`FactoryFunction`/`CreateFunction`: core's `CreateFunction<TDeps extends
  Record<string, unknown>, TResult>` constraint is measurably INCOMPATIBLE with real call sites —
  redirecting it broke `tsc --noEmit` (expression: dozens of TS2345 errors; functions has 259+
  `factory()` call sites in the activated mathjs-factory layer and would fail the same way). Both
  packages' local `CreateFunction` already carry an `any`-based workaround for exactly this
  (pre-existing, documented eslint-disable comments) — core's stricter version cannot be swapped in
  without a further type-level design change, which is out of this slice's scope. Kept fully local
  in both packages, unchanged.
- `sortFactories`/`create`: core's `sortFactories` THROWS on any circular dependency, direct or
  indirect (`core/tests/factory-sort.test.ts` pins this intentionally — commit `32fe7051`,
  "detect circular references in dependencies"). Both packages' local copies only special-case direct
  2-cycles (silently preserving input order) and otherwise break longer cycles via a visited-set
  guard WITHOUT throwing — proven via a dedicated property test
  (`functions/tests/dedup-bucketB-equivalence.test.ts`, "PROVEN DIVERGENCE" block: a direct A↔B cycle
  and an indirect A→B→C→A cycle both throw in core, don't throw in either package). `expression` and
  `functions` agree with each other; core's behavior is a later, deliberate fix that never propagated.
  Kept fully local in both packages pending adjudication.

**Side effect found (not fixed — flagged for a future slice):** with `assertDependencies` redirected,
`expression/src/error/MathjsError.ts` and `functions/src/error/MathjsError.ts` lost their only
in-package caller and are now unreferenced dead code (confirmed independently by
`docs/Architecture/unused-analysis.md`, which now lists both). `MathjsError` is itself a 3-way
mathjs-derived duplicate (core/expression/functions all define an identical class) — a natural Bucket
B follow-up, deliberately not folded into this slice.

`docs/Architecture/duplicate-symbols.json` runtime-duplicate count: **287 → 280** (types: 71 → 70).
`npm run typecheck` 32/32, `eslint` clean on touched files, full `core`/`expression`/`functions` test
suites green (760 / 1977 / 3942 passing, no regressions) plus the new equivalence suite (18/18).

### Changed — cross-package dedup, Bucket B slice 2: `array`/`collection`/`map` utils → core/internal

The big cold-util cluster: `expression` and `functions` each carried a full duplicate copy of
mathjs-derived `array.ts` (~1030 lines), `collection.ts` (~240 lines), and `map.ts` (~270 lines) —
`deepMap`/`deepForEach`/`flatten`/`reshape`/`resize`/`squeeze`/`map`/`forEach`/`filter`/`reduce`/
`concat`/`scatter`/`get`/`createMap`/`ObjectWrappingMap`/`PartitionedMap`, etc. Unlike slice 1, core
had NONE of these — the canonical bodies were newly relocated into `core/src/{array,collection,map}.ts`
and re-exported from `core/src/internal.ts` (aliased where needed: array.ts's `clone`/`get` collide
with `object.ts`'s generic `clone`/`get`; array.ts's and collection.ts's own `deepMap`/`deepForEach`
collide with each other). `IndexError`/`DimensionError` (thrown by array.ts/collection.ts) and the
sandbox helpers `getSafeProperty`/`setSafeProperty`/`isSafeProperty` (needed by map.ts's
`ObjectWrappingMap`) got internal-only, non-exported mirror copies in core (`core/src/error/
IndexError.ts`, `core/src/error/DimensionError.ts`, `core/src/customs.ts`, `core/src/switch.ts` for
collection's private `_switch`) — the packages' own copies of these remain untouched (they have many
other call sites; a future dedup slice), and are NOT part of this slice's public surface. The security
invariant is unaffected: `expression`'s real sandbox call sites (compiler, node accessors) still import
`getSafeProperty`/`setSafeProperty`/`getSafeMethod` from `expression/src/utils/customs.ts` unchanged.

Every shared function was proven equivalent via `core/tests/helpers/equivalence.ts`'s fast-check
harness against a FROZEN pre-redirect snapshot of both packages' original bodies (`functions/tests/
fixtures/dedup-bucketB-slice2/*-original.ts`, `git show`-captured before the redirect) — see the new
`functions/tests/dedup-bucketB-slice2-equivalence.test.ts` (43 tests: property-based for the pure
array/value functions, representative-example-based for the handful requiring Matrix/Index/
SparseMatrix-shaped mocks).

**Divergences found, reconciled, and reported (not silently merged):**
- `[Symbol.iterator]` on `ObjectWrappingMap`/`PartitionedMap` — expression's copy assigned it
  dynamically in the constructor via a type-erasing cast (`(this as unknown as {...})[Symbol.iterator]
  = this.entries`), which worked at runtime but was a latent `implements Map<K, V>` type-soundness
  bug: TS2420 ("incorrectly implements interface 'Map'... '[Symbol.iterator]' is missing") downstream
  under `skipLibCheck: false`. functions's copy had ALREADY fixed this with a real, correctly-typed
  method (`MapEntryIterator<K, V>` derived from the installed TS lib). core adopts functions's fix —
  this redirect actively FIXES the latent bug in expression, it doesn't just relocate it.
- `createEmptyMap`/`createMap` generic default — expression used `<K = string, V = unknown>`, functions
  used `<K = unknown, V = unknown>`. Compile-time-only (erased at runtime, no behavioral difference);
  reconciled to `K = string`, matching `ObjectWrappingMap`/`PartitionedMap`'s own `K = string` default
  already shared by both packages, and the semantically sensible default for a variable-name-keyed
  "scope" map. Verified the one real call site relying on inference (`functions/src/algebra/
  simplify.ts`'s `Map<string, unknown> = createEmptyMap()` parameter default) is satisfied directly.
- `initial()` (get-all-but-last-element) existed ONLY in expression's `array.ts` copy — and was dead
  code even there (unused outside its own definition). Re-exported from expression's shim only;
  functions never had it and doesn't get it in its own shim (back-compat, not an invented new surface).
- `toObject()` (unwrap a `Map`/`ObjectWrappingMap` to a plain object) existed ONLY in expression's
  `map.ts` copy, consumed by `expression/src/Parser.ts`. Re-exported from expression's shim only.
- `collection.ts`'s two copies were already functionally IDENTICAL (comment-only diff + one redundant
  cast) — straight consolidation, no reconciliation needed.
- Found (not fixed, out of scope, noted in `core/src/map.ts`'s header): `entries()` on
  `ObjectWrappingMap`/`PartitionedMap` returns a plain `{ next }` object via the shared `mapIterator`
  helper that is a real `Iterator` but was never decorated with `[Symbol.iterator]`, so
  `[...m.entries()]` throws — identically across all three copies (pre-existing, not a divergence).

`docs/Architecture/duplicate-symbols.json` runtime-duplicate count: **280 → 256** (types: 70 → 69).
`npm run typecheck` 32/32, `eslint`
clean on touched files, full `core`/`expression`/`functions` test suites green (760 / 1977 / 3985
passing [+94 skipped], no regressions) plus the new slice-2 equivalence suite (43/43).

### Changed — cross-package dedup, Bucket B commit 1: `MathjsError`/`DimensionError`/`IndexError` → core/internal

The error-class follow-up flagged in slice 1 (`MathjsError` was found unreferenced-in-package once
`assertDependencies` redirected, and is itself a 3-way duplicate) plus the internal-only mirror copies
`core` picked up in slice 2 for `array.ts`/`collection.ts` to throw correctly-shaped errors
(`core/src/error/{DimensionError,IndexError}.ts`) are now the single canonical classes for the whole
monorepo, exported from `@danielsimonjr/mathts-core/internal`. `expression/src/error/{MathjsError,
DimensionError,IndexError}.ts` and `functions/src/error/{MathjsError,DimensionError,IndexError}.ts`
are now thin re-export shims — every original exported name is preserved, including functions'
`createIndexError`/expression's `createIndexError` back-compat factory (both packages already had it;
core's canonical `IndexError.ts` gained it too).

Verified all three prior copies were behaviorally IDENTICAL before redirecting — same constructor
signatures, same message formats, same `actual`/`expected`/`relation` (DimensionError) and `index`/
`min`/`max` (IndexError) fields; the only differences were cosmetic (`captureStackTrace` destructured
vs. cast-and-check style). No divergence to reconcile, unlike slice 1's `sortFactories` finding.

**instanceof identity confirmed across package boundaries**: a `DimensionError`/`IndexError` thrown
deep in `functions` (e.g. `matrix/concat.ts`, the `matAlgo*` matrix kernels) or `expression`
(`transform/utils/errorTransform.ts`) is now `instanceof` the SAME class as core's, functions', and
expression's — there is only one class definition left. Full `core`/`expression`/`functions` test
suites re-verified green after the redirect (760 / 1977 / 3985 passing, no regressions), including the
packages' own direct-import unit tests (`expression/tests/{DimensionError,IndexError,
errorTransform}.test.ts`) which keep passing unchanged since they import from the same `../src/error/
*.js` paths, now shims.

`docs/Architecture/duplicate-symbols.json` runtime-duplicate count: **256 → 254** (types: 69 → 69,
unchanged — these are runtime classes). Note the detector only ever flagged `IndexError` (3 definers)
and `DimensionError` (2 definers — core + functions; expression's copy wasn't independently flagged by
the heuristic) as duplicates; `MathjsError` was already unreferenced-in-package on both sides post
slice-1 and never appeared in the detector's runtime-duplicate list even before this commit, so it
doesn't move the count further — it's still consolidated for identity/DRY reasons.

### Fixed — cross-package dedup, Bucket B commit 2: `sortFactories`/`create` — expression/functions adopt core's throw-on-cycle fix

Slice 1 found and deliberately did NOT redirect `sortFactories`/`create`: core's `sortFactories`
throws on ANY circular factory dependency (direct or indirect — `core/tests/factory-sort.test.ts`,
commit `32fe7051`), while `expression`'s and `functions`' local copies only special-cased a direct
2-cycle (silently preserving input order) and otherwise broke longer cycles via a visited-set guard
WITHOUT throwing — a real, if latent, correctness bug in both packages (an indirect A→B→C→A cycle
would silently produce a nonsensical load order instead of failing loudly).

**Safety verified before adopting (Rule 4) — no real cycle in either package's live factory graph.**
`sortFactories`/`create` are dead/unused machinery in BOTH packages today: neither is called from any
production code path (only from their own module and unit tests) — every real factory in both
packages is wired by hand with an explicit dependency object (`expression/tests/helpers/bootstrap.ts`
manually calls `createAccessorNode({ subset, Node })` etc.; `functions/src/factories/index.ts` +
`scope.ts` do the equivalent for the 251 activated mathjs factories), never through a name-sorted DAG
load. A static extraction of every `factory(name, dependencies, ...)` registration in each package
(regex over `const name =` / `const dependencies =` pairs, 46 in `expression`, 251 in `functions`) and
a from-scratch cycle-detection pass found **zero cycles in `functions`**. `expression`'s naive
whole-package extraction DID surface ~24 same-name self-loops (e.g. `and.transform.ts` intentionally
registers itself as `fn: 'and'` with `dependencies: ['and']`, referring to the BASE `and` factory that
lives in a different array entirely) — this is mathjs's known "transform factory shares its base
function's public name" pattern, not a real defect: it only self-loops because the synthetic
whole-package array never includes the base factory it's meant to resolve against (real bootstrap
code never assembles a factories array this way). Confirmed no real invocation anywhere combines these
name-colliding factories into one `sortFactories`/`create` call.

**Implementation:** both packages' `sortFactories`/`create` are now pure re-exports of core's
(`export { sortFactories as sortFactories, create as create } from
'@danielsimonjr/mathts-core/internal'` — internal.ts's existing `export * from './factory.js'`
already surfaced them, packages just didn't import them before). `factory()`/`FactoryFunction`/
`CreateFunction` remain local per slice 1's separate, still-valid finding (core's `CreateFunction`
generic constraint breaks real call sites) — only `sortFactories`/`create` moved, since they operate
solely on already-constructed `FactoryFunction`/`LegacyFactory` values and don't touch that generic.

**Tests added/updated:** `expression/tests/utils-factory.test.ts` and
`utils-string-object-factory-extra.test.ts`'s direct-2-cycle tests flipped from `.not.toThrow()` to
`.toThrow(/Circular dependency/)`; added an indirect 3-cycle throw test in both files. New
`functions/tests/utils-factory.test.ts` (functions had no dedicated test file for this module before)
covers the same direct/indirect-cycle-throws + non-cyclic-ordering-still-works cases.
`functions/tests/dedup-bucketB-equivalence.test.ts`'s "PROVEN DIVERGENCE (reported, not redirected)"
block is renamed "FIX ADOPTED" and its three tests flipped from asserting silent (non-throwing)
agreement to asserting all three packages throw identically on both direct and indirect cycles.

`docs/Architecture/duplicate-symbols.json` runtime-duplicate count: **254 → 253** (types: 69 →
69, unchanged). `sortFactories` drops off the list entirely (was 3 definers: core + both packages'
local copies — now 2 pure re-export forwards, 1 real definition). `create`'s count also drops (from 5
definers to 3): the 2 remaining `create`-named definitions left in the list
(`functions/src/core/create.ts`, `compat/src/index.ts`) are unrelated mathjs bootstrap functions, not
this dedup's target. `npm run typecheck` 32/32, `eslint` clean (`src` + touched `tests`), full
`core`/`expression`/`functions` test suites green (760 / 1979 / 4004 passing [+94 skipped] — +2 / +19
over the previous commit from the new/updated cycle tests).

### Added — CDG duplicate-symbols detector (`docs/Architecture/duplicate-symbols.{md,json}`)

`tools/create-dependency-graph/create-dependency-graph.ts` adds `detectDuplicateSymbols`: groups
every file's OWN-defined `functions`/`constants`/`classes` (runtime) and `interfaces`/`types`/`enums`
(type) exports by name across the whole monorepo, keeping only names with >=2 independent defining
files. A name landing in a file's `exports.reExported` (any `export { x } from './y'` /
`export type { x } from './y'` / workspace-scoped equivalent) is a re-export FORWARD, not an
independent body, and is excluded — this is the whole value of the detector, not a filter bolted on
after. The public-surface check that resolves each definer's canonical-candidate hint is refactored
out of `detectUnused` into a shared `computePublicSurface` (per-FILE, not per-package-name-union —
needed to correctly disambiguate two same-package same-name definitions like `fftshift`, which is
own-defined in both `functions/src/signal/fft.ts` and `functions/src/signal/fft-helpers.ts` but only
the latter is named-re-exported by `functions/src/index.ts`). Emits
`docs/Architecture/duplicate-symbols.json` + `.md` (runtime + type sections, sorted by definer count)
via `npm run docs:deps` (new `docs:duplicates` alias); found 287 runtime + 71 type duplicate names on
the current tree (the `is*` type-guard family, `format`/`create`/`transpose`/`abs`/`add` duplicated
across typed/factory/compat/core layers, the `fft`/`fftshift`/`ifftshift` family) — the measurement
that scopes the dedup campaign and seeds a future `check:duplicates` CI gate. Does NOT detect
typed-dispatch polymorphism (out of scope — call-graph analysis); each entry records defining files +
public flags for human triage instead.

### Added — kill-able worker-thread run timeout (`runWorkbookWithTimeout`, `mtsw run --timeout`)

`WorkbookExecutor#runReport` had no time budget — a runaway cell (e.g. an unbounded numeric
computation) hung the process forever. `workbook/src/timeout-runner.ts` adds
`runWorkbookWithTimeout(source, { timeoutMs })`: it runs the whole executor (parse + `runReport`)
inside a `worker_threads` Worker (`workbook/src/run-worker.ts`, now a third tsup build entry
alongside `index.ts`/`cli.ts`) and forcibly `terminate()`s it if it exceeds the budget, rejecting
with a `WorkbookTimeoutError`. Termination kills the worker's V8 isolate outright, so it interrupts
even a synchronous, CPU-bound runaway cell — something a same-thread `Promise.race`/`setTimeout`
budget cannot do (a blocking loop never yields back to the event loop for the timer to fire). Cell
outputs cross the worker boundary pre-formatted to strings (via the existing `formatResult`) since
class instances (Complex, matrices, …) don't survive `postMessage`'s structured clone. Wired as
`mtsw run --timeout <ms>` (routes through the worker; incompatible with `-c`/`-v`); the default
in-process path is unchanged when no timeout is given. Verified in
`workbook/tests/gap-worker-timeout.test.ts` (imports the **built** `dist/` — the worker's
`new URL('./run-worker.js', import.meta.url)` only resolves off a real on-disk file, so this suite
can't run against `src/` like its siblings) with a genuinely long CPU-bound cell (`isPrime` trial
division to the largest prime below 2^53, chained ×10 — MathTS's expression sandbox has no loop or
recursion constructs, so this is the sanctioned "very long computation" fallback for an
un-expressible `while(true)`): confirms the run is killed within the budget (not merely outraced by
a fast finish), the error message names the budget, and a normal fast run through the worker path
matches the in-process `runReport` result.

### Added — `mtsw export --format ipynb` (Jupyter notebook export)

`workbook/src/ipynb.ts` adds `toIpynb(doc)`, a sibling of the existing `toHTML`/`toTeX`/`toPDF`
exporters: renders the same `RenderDoc`/`RenderCell` model (built by the CLI's `buildRenderDoc`)
to a structurally conformant **nbformat v4** JSON document. `markdown` cells map to notebook
markdown cells; `code`/`equation`/`test`/`data`/`visualization` cells map to notebook code cells —
a computed result becomes an `execute_result` output, an error an `error` output, and a chart a
`display_data` output (inline SVG). Wired as `mtsw export --format ipynb` (alongside `html`/`tex`/
`json`/`pdf`), sharing the same run-then-render pipeline (`--no-run`, `--json`, `-o`). Covered by
`workbook/tests/gap-ipynb-export.test.ts` (structural conformance: JSON parses, nbformat v4
top-level shape, valid `cell_type`s, code cells carry `outputs`/`execution_count`, round-trips
through `JSON.parse(JSON.stringify(...))`) plus CLI export tests.

### Changed — reframe the mathjs-derived factory layer as owned first-party code

Comment/doc-only cleanup, no behavior change. The former `.ts→.ts` mathjs sync is dead (see
"Syncing from mathjs" in `CLAUDE.md`); `functions/src/factories/` and `functions/src/typed/` are
first-class active code, wired into the live graph via `factories/index.ts`. The remaining inline
comments still called this code a "synced factory"/"synced layer," misleadingly implying a
read-only mirror. Reframed ~30 comments across `functions/src/factories/index.ts`,
`matrix-bridge.ts`, `scope.ts`, `functions/src/typed/relational.ts`, `string.ts`, `bitwise.ts`,
`probability.ts`, `typed-bridge.ts`, and the top-level `functions/src/index.ts` as
"activated"/"owned" — preserving useful provenance ("mathjs-derived" as historical origin) while
dropping the live-mirroring implication. Resolves the "own the synced-mathjs layer" strategic
decision item in `TODO.md`.

### Added — B-spline fit/eval, Monte-Carlo/QMC integration

Two additive numeric routines (`functions/src/numeric/bspline.ts`, `functions/src/numeric/monte-carlo.ts`):

- **`bsplineFit(x, y, opts?)`** / **`bsplineEval(spline, xnew)`** — fit a B-spline of degree `k`
  (default cubic) to tabulated data, returned in scipy's `tck` tuple shape (`{t, c, k}`), and
  evaluate it via de Boor's algorithm (Piegl & Tiller `FindSpan`/`BasisFuns`). `s=0` (default) is
  the standard de Boor collocation construction — one basis function per data point, passing
  through every point exactly; `s>0` (or an explicit `nknots`) is a least-squares smoothing spline
  with fewer interior knots, solved via the existing `leastSquares` primitive. Distinct from the
  existing `bspline(controlPoints, degree, t)` control-point curve evaluator, which fits no data.
  Oracle-pinned: interpolation exactness (tol 1e-9), `sin` approximation at intermediate points
  (tol 1e-3), and a cross-check against scipy `splrep`/`splev` (`splev(1.0)` ≈ 0.84144992, tol 1e-4
  — knot conventions differ slightly between constructions, hence the looser tolerance).
- **`monteCarloIntegrate(f, bounds, opts?)`** — Monte-Carlo / quasi-Monte-Carlo integration over an
  axis-aligned box. `method: 'uniform'` (default) uses the package's existing seeded RNG
  (`createRng`) and returns a genuine sample-variance `stderr`; `'halton'` is a dimension-general
  low-discrepancy sequence; `'sobol'` is a genuine Antonov-Saleev (Gray-code) Sobol sequence
  restricted to 1-2 dimensions — the only two whose direction numbers are fully forced by the
  Sobol recurrence with no external Joe-Kuo lookup table (verified point-for-point against
  `scipy.stats.qmc.Sobol(d=2, scramble=False)`). QMC methods report `stderr: 0` (documented: their
  points aren't independent, so a variance-based CI isn't meaningful). Oracle-pinned: `∫_0^1 x² dx`
  and the unit-disk-indicator integral both land within a 4-sigma band of their known values, and
  Halton/Sobol both converge faster than uniform MC at matched `n`
  (`functions/tests/gap-numerics-bspline-mc-oracle.test.ts`, 18 tests).

Scope note: general PDE/method-of-lines (`solvePDE` remains 1-D-heat-only), BDF/Radau stiff solvers
(RODAS already covers tight-tolerance stiffness), `solveODESystem` error control, and DAE/DDE
support remain out of scope — a substantially larger sub-project each, deliberately deferred.

### Added — niche special functions: polylog, Struve H/L, Kelvin ber/bei, Barnes-G

Six additive `@danielsimonjr/mathts-functions` special functions (`functions/src/special/niche.ts`),
following the plain-exported-function pattern already used by `hypergeometric.ts` /
`polygamma-orthopoly.ts` (no typed-function array/WASM dispatch overloads):

- **`polylog(s, z)`** — polylogarithm `Li_s(z)` via its defining series (converges for `|z| < 1`);
  analytic continuation to `|z| >= 1` is out of scope and throws.
- **`struveH(v, z)`** / **`struveL(v, z)`** — Struve H and modified Struve L functions via their
  power series (DLMF 11.2.1), evaluated by a term-recurrence ratio seeded from two `lgamma` calls
  (avoids recomputing Gamma per order / overflow from large individual Gamma values).
- **`kelvinBer(x)`** / **`kelvinBei(x)`** — Kelvin functions ber(x), bei(x) (order 0) via their
  power series (DLMF 10.65.1).
- **`barnesG(z)`** — Barnes G-function for real `z > 0`, via the functional equation
  `G(z+1) = Γ(z)·G(z)` to shift `z` up until the DLMF 5.17.5 asymptotic expansion of `ln G`
  converges to machine precision, then unwinding the shift.

All six oracle-pinned against `mpmath` (dps=25): relative error < 1e-11 across every reference
value, most well under 1e-12 (`functions/tests/gap-special-niche-oracle.test.ts`, 23 tests). Lerch
Φ, Coulomb wave functions, Mathieu functions, parabolic-cylinder functions, spheroidal wave
functions, and the Riemann-Siegel Z function remain — highly specialized, deliberately deferred to
a future chunk.

### Added — stats breadth: GLM (Poisson/Gamma), multivariate-normal PDF/sampling, t-test power

Three additive `@danielsimonjr/mathts-functions` statistics primitives:

- **`glm(X, y, opts)`** (`functions/src/ml/glm.ts`) — generalized linear models via IRLS/Fisher
  scoring, generalizing the existing `logisticRegression` IRLS (whose Newton step is only equivalent
  to Fisher scoring because the logit link is canonical for Bernoulli) to `family: 'poisson'` (log
  link) and `family: 'gamma'` (log or inverse/canonical link). Same `opts.intercept` convention as
  `ols`. Mustart initialization matches R's `glm.fit`/statsmodels (`y + 0.1` for Poisson, `y` for
  Gamma). Oracle-pinned against `statsmodels.GLM.fit`: Poisson coefficients match to 1e-4, Gamma
  (both links) to 1e-4.
- **`mvnPdf(x, mean, cov)`** / **`mvnSample(mean, cov, n, opts?)`** (`functions/src/stats/mvn.ts`) —
  multivariate-normal density and Cholesky-based sampling (`x = mean + L·z`), handling both the 1-D
  scalar case and the general k-D case. `mvnPdf` is a thin wrapper over the existing
  `multivariateNormal` distribution object; `mvnSample` reuses that module's Cholesky factorization
  (now exported as `cholesky` from `typed/dist-objects.ts`) and the package's existing seeded-RNG
  infrastructure (`probability/util/seededRNG.ts`) for reproducible draws. `mvnPdf` pinned to `scipy
  multivariate_normal.pdf` (1e-6); `mvnSample`'s empirical mean/covariance over 20000 seeded draws
  matches the input parameters to ~0.1.
- **`tTestPower(effectSize, nobs, alpha, opts?)`** (`functions/src/stats/power-analysis.ts`) —
  two-sample t-test power via the existing `noncentralTCDF` (Phase 4) and `studentTQuantile`
  building blocks; no distribution math duplicated. `opts.solveFor: 'nobs'` solves (by bisection) for
  the per-group sample size needed to reach a target power. Matches
  `statsmodels.stats.power.tt_ind_solve_power` to 1e-3 (power) / 1e-1 (nobs).

Covered by `functions/tests/gap-stats-breadth-oracle.test.ts`. Follow-ups (Gaussian-process
regression; Dirichlet/Wishart and other multivariate-distribution sampling) are larger, separate
chunks — not part of this one.

### Added — stiff `solveODE`: 4th-order RODAS method + analytic Jacobian option

`@danielsimonjr/mathts-functions` `solveODE` gains `method: 'RODAS'` — Hairer & Wanner's 4th-order,
6-stage, L-stable, stiffly-accurate Rosenbrock method (`functions/src/numeric/solveODE.ts`,
`rodasSolve`). It reuses the existing linearly-implicit structure (form `E = I/(γh) − J`, one LU
factorisation per step solved against each stage), extended to six stages with 4th-order weights
and an embedded 3rd-order error estimate (the last stage increment `k6`). Being 4th order it reaches
tight tolerances in far fewer steps than the 2nd-order `Rosenbrock` (ode23s) — e.g. the linear stiff
`y'=-1000y` to `y(0.01)` at `tol=1e-8` takes **256 steps vs 1487** (≈5.8× fewer). The published
coefficient tableau is verified numerically (halving `h` drops the fixed-step error ≈16×, confirming
4th order) and against scipy Radau on the Robertson problem. RODAS retains the `h·d_i·∂f/∂t` term so
it stays 4th order on non-autonomous systems.

New `jac?: (t, y) => number[][]` option on `ODEOptions`: when supplied, the stiff methods
(`Rosenbrock` and `RODAS`) use this analytic Jacobian instead of the finite-difference one (faster,
more accurate); its shape is validated (n×n) with a clear throw on mismatch. When omitted the
finite-difference path is unchanged — fully backward compatible. RK23/RK45/Rosenbrock behaviour and
the default `RK45` method are unchanged. Covered by `functions/tests/gap-stiff-rodas-oracle.test.ts`
(linear-stiff exact, Robertson vs scipy with analytic jac, step-count improvement over ode23s,
jac-vs-FD consistency, shape-mismatch throw). Follow-ups (event detection, reusing the matrix
package's LU) remain separate.

### Added — linear-algebra extension: pivoted QR, RQ/QL/LQ, condest

Five new `@danielsimonjr/mathts-matrix` `DenseMatrix` primitives in
`matrix/src/operations/`: `qrPivoted` (`qr-pivoted.ts`, column-pivoted rank-revealing QR via
Householder reflections — Businger-Golub pivoting, guarantees `|diag(R)|` non-increasing and
returns a numerical `rank`), `rq`/`ql`/`lq` (`qr-family.ts`, the three QR-family variants, each
reduced to the existing Gram-Schmidt `qr()` via the standard row/column-flip-and-transpose
identities from Golub & Van Loan §5.2 — `lq` needs no flips, `rq`/`ql` reverse rows/columns then
un-flip the factors), and `condest` (`condest.ts`, Hager/Higham 1-norm condition-number
**estimator** — power iteration over `A⁻¹`/`A⁻ᵀ` applied via the existing `lu()` triangular
solves, O(n²) per iteration, never forming `A⁻¹`).

Along the way, found and worked around a latent bug in the shared `matrix/src/operations/common.ts`
`householder()` helper: its degenerate branch (`sigma === 0 && x[0] < 0`, i.e. a column already
antiparallel to `e₁`) defaults `beta = -2`, which is **not** an orthogonal reflection for a
length-1 sub-column (`(1-beta)² ≠ 1` unless `beta ∈ {0, 2}`) — `qrPivoted` hits this on its last
pivot step and now passes `degenerateBeta = 2` explicitly (matching `schur.ts`'s existing
override) rather than patching the shared default, since `eig.ts`/`svd.ts` never exercise a
length-1 sub-column and a shared-file change wasn't re-verified against their suites in this pass;
flagged as a follow-up.

Verified in `matrix/tests/gap-linalg-extension-oracle.test.ts` (22 tests) via
implementation-independent oracles (orthogonality `QᵀQ=I`/`QQᵀ=I`, exact triangularity,
reconstruction to 1e-9, rank on a full-rank vs. rank-deficient 3×3, and `condest` bracketed
against `numpy.linalg.cond(A, 1) = 133.0`, `condest(I) ≈ 1`, and a near-singular 2×2 `> 1e6`) —
never pinned to raw Q/R/L entries or exact pivot order, since those vary by tie-breaking
convention. `docs/api/matrix.md`'s generated export index updated via `npm run docs:functions`.

### Added — geometry breadth: quaternion exp/log/pow + 3-D ray/segment intersections

Closes part of the "Geometry breadth" follow-up logged from the Phase 8 oracle-gap roadmap.
Added `quaternionLog`/`quaternionExp`/`quaternionPow` to `functions/src/geometry/geometry-extra.ts`
(scalar-first `[w,x,y,z]` convention, matching the existing `quaternionInverse`/`quaternionSlerp`):
`log(q) = (0, θ·û)` with `θ = atan2(|v|, w)`; `exp(q) = eʷ·(cos|v|, sin|v|·v̂)`; `pow(q,t) =
exp(t·log(q))`. Also added a new `functions/src/geometry/intersect3d.ts` with
`rayTriangleIntersect` (Möller–Trumbore), `rayPlaneIntersect`, and `segmentSegmentClosest`
(Ericson's `ClosestPtSegmentSegment`), all operating on plain 3-element `number[]` points/vectors
matching `../typed/geometry.ts`'s convention.

Oracle-pinned in `functions/tests/gap-geometry-breadth-oracle.test.ts` (15 tests): `quaternionPow`
verified against `scipy.spatial.transform.Rotation`'s rotvec scaling (90°-about-z quaternion
halved/doubled/held/zeroed to 45°/180°/90°/identity, tol 1e-8/1e-9); `quaternionExp`/`quaternionLog`
round-trip to 1e-10 across five sampled unit quaternions plus the identity edge case;
`rayTriangleIntersect`/`rayPlaneIntersect`/`segmentSegmentClosest` pinned against hand-derived
closed-form hit points, misses, and a parallel-plane/parallel-ray null case. Documented in
`docs/reference/functions.md` (3 new quaternion rows + a new "3-D ray/segment intersections"
section); `SphericalVoronoi`, alpha-shapes, and halfspace-intersection remain — each needs a
Delaunay-triangulation/convex-hull engine MathTS doesn't have yet, a separate follow-up.

### Added — graph breadth: coloring, maxClique, Louvain, Katz centrality, isomorphism

Five new graph functions in `functions/src/graph/community-coloring.ts`, closing the "Graph
breadth" follow-up logged from the Phase 8 oracle-gap roadmap: `graphColoring` (greedy
Welsh-Powell proper vertex coloring, deterministic degree-descending/index-ascending tie-break),
`maxClique` (exact maximum clique via Bron-Kerbosch with pivoting), `louvainCommunities`
(Louvain modularity community detection — deterministic local-moving tie-break, no RNG),
`katzCentrality(adj, alpha[, beta=1])` (solves `x=(I-alpha·Aᵀ)⁻¹(beta·1)` then L2-normalizes,
matching `networkx.katz_centrality_numpy` exactly), and `isIsomorphic` (backtracking +
degree-sequence-pruned graph isomorphism test). Also added a `normalized` option (American
spelling) to the existing `betweennessCentrality` as an alias for `normalise`. Confirmed
`adjacencyMatrix`'s `directed` option (already present, default `false`) already produces an
asymmetric matrix for directed edge lists — no code change needed there, just test coverage;
the TODO note claiming it "still symmetrizes" was stale.

**Root-cause fix surfaced while oracle-pinning:** `betweennessCentrality`'s undirected
normalization divided by `(n-1)(n-2)/2` instead of `(n-1)(n-2)`, making normalised undirected
betweenness exactly 2x too large vs `networkx.betweenness_centrality(G, normalized=True)` — the
raw Brandes accumulation already double-counts each undirected unordered pair (BFS from both
`s` and `t`), so no extra `/2` belongs in the normalized divisor (matches networkx's `_rescale`
for both directed and undirected). Fixed in `functions/src/typed/graph.ts`.

Oracle-pinned vs networkx 3.6.1 in `functions/tests/gap-graph-breadth-oracle.test.ts` (18 tests):
exact match for `katzCentrality` and the fixed `betweennessCentrality` (tol 1e-5/1e-6),
exact boolean match for `isIsomorphic` (K3≅C3, P4≇star4, relabeled-G≅G, mismatched vertex
counts), and property-based checks for the heuristic algorithms — `graphColoring` verified as a
proper coloring using ≤3 colors on the test graph and exactly 3 on K3; `maxClique` verified as an
actual clique of size 3 with a brute-force check that no size-4 clique exists; `louvainCommunities`
verified as a valid partition reaching modularity ≥0.35 on Zachary's karate club graph (networkx
Louvain reaches ~0.42; this implementation reaches ~0.445). Documented in
`docs/reference/functions.md` (5 new curated rows + prose in the Graph Theory section).

### Added — `dwt`/`wavedec` support db1-4, sym2-4, coif1-2 wavelet families

`functions/src/typed/signal.ts`'s `dwt` and `functions/src/signal/wavelets.ts`'s `idwt` previously
implemented only the Haar/db1 2-tap wavelet (hardcoded closed-form; any other name threw). Both now
route through a new general orthogonal filter bank with **periodization** boundary handling
(`functions/src/signal/wavelet-filters.ts`), supporting 9 families: `haar`, `db1`-`db4`, `sym2`-`sym4`,
`coif1`-`coif2`. Each family's decomposition low-pass filter (`dec_lo`) is pinned bit-for-bit against
PyWavelets 1.8.0; the other three orthogonal filters (`dec_hi`/`rec_lo`/`rec_hi`) are derived by the
standard QMF relations and verified against pywt to 1e-14. The periodization phase alignment was
derived empirically against `pywt.dwt(..., mode='periodization')` / `pywt.idwt(...)` and verified
bit-for-bit across multiple signal lengths and every filter. `haar`/`db1` keep their dedicated
WASM-accelerated fast path (verified to reproduce the general filter bank's result exactly, so no
behavior change for existing callers); the other 7 families run the new pure-TypeScript path.
`wavedec`/`waverec` pass the wavelet name through unchanged and now support all 9 families with
perfect reconstruction. `cwt` (ricker/morlet) is unchanged. Oracle-pinned in new
`functions/tests/gap-wavelet-families-oracle.test.ts` (55 tests): all 4 filters for all 9 families vs
pywt (1e-9), single-level `dwt` vs pywt periodization for db2/db3/db4/sym2/sym3/sym4/coif1/coif2
(1e-8), perfect reconstruction `waverec(wavedec(x, w, L), w) ≈ x` for every family at levels 1 and 2
(1e-10), vanishing-moment annihilation of sampled polynomials (dbN/symN kill degree < N, coifN kills
degree < 2N) away from the periodization wrap boundary, and a Haar/db1 regression confirming the new
code reproduces the old hardcoded closed-form results. Documented in `docs/reference/functions.md`
(curated `dwt`/`idwt`/`wavedec`/`waverec` rows + prose).

### Added — `funm` supports defective / repeated-eigenvalue matrices

`functions/src/numeric/matrix-functions.ts`'s `funm(A, f)` previously threw on defective /
non-diagonalizable matrices (repeated or numerically clustered eigenvalues that are not diagonal),
because a matrix function of such a matrix depends on `f` AND its derivatives at each repeated
eigenvalue (for a Jordan block `J = λI + N`, `f(J) = Σ_k f^(k)(λ)/k! · N^k`). It now evaluates these
via **confluent Hermite interpolation** — Newton divided differences over the confluent node list
(each distinct eigenvalue repeated to its multiplicity), where a run of equal nodes contributes the
Taylor coefficient `f^(L)(z)/L!`. This subsumes the existing distinct-spectrum Lagrange-Sylvester
path (kept bit-for-bit as a fast branch, so distinct-eigenvalue results are unchanged). Derivatives
of `f` come from a new optional third argument `fDerivs` (`fDerivs[k] = f^(k+1)`, machine precision —
additive/non-breaking) or, when omitted, from finite-difference stencils (~1e-6). `cosm`/`sinm` now
pass exact analytic derivatives (`cos^(m)(z) = cos(z + mπ/2)`, likewise `sin`), so they are
machine-precise (~1e-16) on defective matrices instead of throwing. `funm` still throws — with a
clear message — only when `f` or a derivative is genuinely singular at a repeated eigenvalue (e.g.
`sqrt`/`log` at 0) or when a needed numerical derivative order exceeds the built-in stencils
(multiplicity > 5, no analytic derivatives). Oracle-pinned in new
`functions/tests/gap-funm-defective-oracle.test.ts` vs the Jordan-block closed forms and
scipy `expm`/`sqrtm`: `funm([[2,1],[0,2]], exp) = e²·[[1,1],[0,1]]`, `…, sqrt) = √2·[[1,0.25],[0,1]]`,
the 3×3 Jordan `exp`, `cosm`/`sinm` on a defective block, and `funm(A, exp) ≈ expm(A)` for a mixed
defective matrix (analytic path 1e-10, numerical path measured ~3–5e-11 but asserted at the honest
1e-6 bound). Note: scipy's own `funm` is wrong on exact Jordan blocks and was NOT used as an oracle.
Documented in `docs/reference/functions.md` (curated `funm` row) and the module docstring.

### Added — `quantileSeq` interpolation modes (lower/higher/nearest/midpoint)

`functions/src/statistics/quantileSeq.ts` gains an optional trailing `mode` string that selects how
the quantile interpolates between adjacent order statistics, matching numpy's `method=`: `'linear'`
(the default — unchanged), `'lower'`, `'higher'`, `'nearest'` (ties round-half-to-even, matching
numpy), and `'midpoint'`. The mode threads through the scalar-probability, probability-array, and
evenly-spaced-`N` paths and works with the existing `sorted` flag. New typed signatures
(`…, string` / `…, boolean, string`) are strictly additive; every existing call behaves identically.
Oracle-pinned vs numpy on `[1..10]` at `q ∈ {0.25, 0.5, 0.75}` in new
`functions/tests/gap-quantile-modes-oracle.test.ts` (`lower→[3,5,7]`, `higher→[4,6,8]`,
`nearest→[3,5,8]`, `midpoint→[3.5,5.5,7.5]`, `linear→[3.25,5.5,7.75]`), including unsorted input, a
`q`-array with a mode, and the round-half-to-even tie behavior. An unknown mode throws. Documented in
`docs/reference/functions.md` (curated `quantileSeq` row).

### Fixed — `besselK` uniform machine precision (continued fraction)

`functions/src/typed/special.ts`'s `besselKScalar` previously split K0/K1 into an ascending series
(`x ≤ 8`) and an asymptotic expansion (`x > 8`). Both cancel/diverge near the crossover, flooring the
relative error at ~1.3e-10 in the band `x ∈ [8, 11]` (measured at `K0(8)`). K0/K1 now use the
uniformly-accurate Numerical Recipes `bessik` method specialized to integer order (fractional part
`mu = 0`): Temme's power series for `x < 2` and Steed's continued fraction CF2 for `x ≥ 2`, with K1
from the same recurrence. Relative error is now `< 8e-16` across the whole range `x ∈ [0.1, 50]` vs
mpmath (dps=30) — band worst-case `5.3e-16` (down from ~1.3e-10). The `K_{n+1} = (2n/x)K_n + K_{n-1}`
upward order recurrence for `n ≥ 2` is unchanged. New oracle test
`functions/tests/gap-besselk-precision-oracle.test.ts` pins K0/K1 to mpmath at 15 points (tight in
the `[8,11]` band) plus K2/K3 via recurrence. The retired `besselKAsym`/`besselK0Series`/
`besselK1Series` helpers are removed.

### Added — `eig` exposes complex eigenvectors via `vectorsIm`

`matrix/src/operations/eig.ts`'s JAMA-derived `orthes`/`hqr2` solver already computes complex
eigenvectors internally (EISPACK convention: real/imaginary parts share two adjacent columns of the
real transform `V`), but the assembly loop dropped them, emitting an all-zero column for every
complex-conjugate eigenvalue pair. `EigResult` gained a new additive field `vectorsIm: number[][]`
(imaginary parts, same shape as `vectors`); for a complex-conjugate pair at indices `j`/`j+1`,
`vectors[j]` holds the real part and `vectorsIm[j]`/`vectorsIm[j+1]` the `+`/`-` imaginary parts,
unit-normalized by the complex 2-norm. `vectors[j]` (real eigenvalues unaffected) now carries the
real part instead of an all-zero column for complex eigenvalues — strictly additive/more-informative,
not a behavior change for any existing real-spectrum consumer. New
`matrix/tests/eig-complex-eigenvectors-oracle.test.ts` pins the implementation-independent complex
residual `‖A v − λ v‖ ≈ 0` (not component values, since eigenvectors are only defined up to a complex
scalar) for `{i,−i}` and `{i,−i,3+i,3−i}` spectra, plus unit-norm/non-triviality and symmetric
back-compat checks. Full `matrix`/`tensor`/`autograd`/`functions` suites re-verified green (no
downstream consumer needed changes — `sqrtm`/`logm`/`matrixPower`/`jordanForm` all throw on complex
eigenvalues before touching `.vectors`). Unblocks a clean `funm`/`care` off the eigenvector basis
(not wired up in this change).

### Changed — unified duplicate `multipleComparison`/`multipleTest` implementation

`multipleComparison` (`functions/src/typed/hypothesis.ts`) and `multipleTest`
(`functions/src/stats/inference-extra.ts`) were two independent implementations of the identical
Bonferroni/Holm/Benjamini-Hochberg p-value correction. Verified no import cycle (`inference-extra.ts`'s
transitive closure — `distribution-functions.ts` → `typed/dist-objects.ts` — never reaches
`typed/hypothesis.ts`), so `multipleComparison` now delegates to `multipleTest`; both public names
and signatures are unchanged, and both always return identical results (locked by
`functions/tests/gap-multiple-testing-consolidation.test.ts`, including a pinned BH result on
`[0.01, 0.02, 0.03, 0.04, 0.05]` — all ties at 0.05). Added cross-reference docs (both directions)
noting the alias pair, and clarified `chiSquareTest`'s 2D form vs `chi2Contingency` are
complementary (goodness-of-fit + plain independence test vs the `scipy`-parity contingency test with
Yates correction/expected counts/Cramér's V), not redundant. `docs/reference/functions.md` gained a
`multipleComparison` row (previously undocumented in the curated table) and both descriptions were
updated; `npm run docs:functions` regenerated `functions.html` accordingly.

### Added — implementation-independent invariants for `csd`/`coherence`

`csd`/`coherence` (`functions/src/signal/spectral-peaks.ts`) had no hard-pinned tests. New
`functions/tests/gap-csd-coherence-oracle.test.ts` pins mathematical invariants instead of exact
numbers (a seeded numpy RNG won't reproduce JS's PRNG stream): coherence values lie in `[0, 1]`;
coherence of a noiseless scaled copy (`y = 3x`) is ~1 at the signal's frequency bins; `csd(x,x)`
matches the package's independent `welchPSD` estimator up to the well-known one-sided PSD doubling
convention (interior bins ×2, DC/Nyquist bins ×1); and `csd(x,y)`/`csd(y,x)` have equal magnitude
with `|Re(Pxy)| <= |Pxy|` verified via the polarization identity
`Re(Pxy) = (P(x+y,x+y) - Pxx - Pyy) / 2` across four independently-computed `csd` calls. All four
invariants passed on the first run — no bug found; this closes the "not hard-pinned" follow-up.

### Added — scipy-pinned oracle for `linprog`'s free-variable (lower=null) bounds path

`linprog`'s options form (`functions/src/typed/numeric.ts`) splits a variable whose bounds lower is
`null` (unbounded below) into `x = x⁺ - x⁻` in `linprogTwoPhase` — this free-variable path had no
direct test. New `functions/tests/gap-linprog-freevar-oracle.test.ts` pins it against scipy 1.17.1:
minimizing `c=[1,0]` subject to `A_ub=[[0,1]] <= [3]`, `A_eq=[[1,1]] = [1]` with `x0` free reaches
`fun=-2, x=[-2,3]` (x0 negative at the optimum — only reachable via the split path), while the same
constraints under the default `x>=0` bounds give `fun=0`. Both matched scipy on the first run — the
free-variable path was already correct; this closes the untested-gap follow-up as a regression guard.

### Removed — dead WASM `statsVariance`/`statsStd` type declarations

The `AsModule` interfaces in `functions/src/wasm/WasmLoader.ts` and `matrix/src/backends/WasmLoader.ts`
still declared `statsVariance`/`statsStd` kernel signatures whose JS call paths were retired 2026-07-15
(the corrected two-pass `variance`/`std` in core beat the WASM kernels on accuracy and were not slower,
being memory-bound). No live caller referenced them — only retirement comments in
`functions/src/statistics/{variance,std}.ts`. Removed the four dead type declarations. TS-only change:
the `.wasm` binary and its SHA-384 manifest are unaffected (the AS source never exported these names;
the general-library `array_variance`/`array_stddev` kernels are retained). Broader dead-`stats*`-decl
audit against actual binary exports remains a separate follow-up.

### Added — real univariate symbolic rational cancellation for `cancel`

`cancel(expr)` (`functions/src/typed/algebra.ts`) previously only handled numeric integer fractions
(`a/b`, compound `(a/b)/(c/d)`) plus an identical-string short-circuit, returning symbolic input
unchanged. It now performs real univariate integer-coefficient rational cancellation via polynomial
GCD, matching `sympy.cancel`: `cancel('(x^2-1)/(x-1)')` → `1*x + 1` (numerator/denominator divided by
`polynomialGCD(N, D)`); `cancel('(2*x^2-2)/(2*x-2)')` also cancels the shared numeric content down to
`1*x + 1`; `cancel('(x^3-1)/(x^2-1)')` → `(1*x^2 + 1*x + 1)/(1*x + 1)` (degree reduces but a
nontrivial denominator remains, so the result stays a fraction). Falls back unchanged to the
pre-existing numeric-only paths for multivariate expressions, non-integer coefficients, and inputs
whose numerator/denominator share no non-trivial polynomial factor — the existing numeric fraction
and identical-string tests are unaffected. New test:
`functions/tests/gap-cancel-symbolic-oracle.test.ts` (implementation-independent value-preservation
oracle, sampled away from poles, plus the numeric regression cases).

### Fixed — real `expand`/`factor`/`together`/`apart` for univariate polynomials/rationals (Phase 8 Task 6, final task)

`expand`/`factor`/`apart`/`together` (`functions/src/typed/algebra.ts`) were documented no-ops
(Phase 0's `docs/reference/functions.md` ⚠️ pass-through annotations + the
`cas-passthrough-documented.test.ts` characterization test) for the exact inputs these tests
exercise. All four now perform real transforms for the **univariate** case, verified against
sympy 1.14.0: `expand('(x+1)^3')` → `1*x^3 + 3*x^2 + 3*x + 1` (sympy: `x**3 + 3*x**2 + 3*x + 1`);
`factor('x^2-1')` → `(x - 1)*(x + 1)` (sympy: `(x-1)*(x+1)`); `together('1/x+1/(x+1)')` →
`(1 + 2*x)/((x)*((x+1)))` (sympy: `(2*x+1)/(x*(x+1))`); `apart('1/(x^2-1)')` →
`1/(2*(x - 1)) - 1/(2*(x + 1))` (sympy: `-1/(2*(x+1)) + 1/(2*(x-1))`) — same value, term order
differs. `expand`/`factor` route through the existing exact-polynomial parser
(`polyFromExpression`/`polyToString` in `functions/src/typed/polynomial-ideal.ts`); `factor` adds a
rational-root-theorem search (candidates ±divisors(constant)/divisors(leading), each confirmed root
divided out exactly via `polynomialQuotient`/`polynomialRemainder`); `together` combines a sum of
rational terms over the product of their denominators; `apart` decomposes a proper rational function
whose denominator factors into **distinct** rational linear factors via the cover-up/residue method
(`Aᵢ = N(rᵢ)/D'(rᵢ)`, computed in exact rational arithmetic). Inputs outside this scope (multiple
variables, non-integer coefficients, function calls, a denominator with a repeated or irreducible
higher-degree factor) fall back unchanged to each function's original implementation (`factor`'s
integer-GCD extraction, `together`/`apart`'s numeric-only fraction arithmetic), so none of the
pre-existing multivariate/numeric pinned tests changed. Flipped the Phase-0 pass-through
characterization test (`functions/tests/cas-passthrough-documented.test.ts`) to assert the new
numeric behavior for these four (implementation-independent — evaluated at sample points, not pinned
to a specific string form) and removed their stale ⚠️ doc annotations; `casExpand`/`casFactor`
(the separate worker-batchable kernels in `functions/src/typed/cas.ts`) are unchanged and remain
documented pass-throughs (out of this task's scope). New test: `functions/tests/cas-engine.test.ts`.
Multivariate symbolic expansion/factorization and symbolic integration remain future work. This
closes out Phase 8.

### Added — Interval arithmetic (Phase 8 Task 5)

Added `functions/src/numeric/interval.ts`, exported from `@danielsimonjr/mathts-functions`:
`interval(lo, hi)` / the `Interval` class — rigorous interval arithmetic with outward-rounded
`add`/`sub`/`mul`/`div`/`neg`, `width`/`mid`/`contains`, and monotonic-aware `sqrt`/`exp`/`log`/`pow`.
Since JavaScript has no directed-rounding-mode control, every result's `lo` is nudged down and `hi`
nudged up by a relative epsilon (`Number.EPSILON`) plus one ULP (`Number.MIN_VALUE`) so the true
real-valued result is always contained — the first verified-bounds numeric type in the library (the
`mpmath.iv` / INTLAB analogue). Pinned: `interval(1,2).add(interval(3,4))` = `[4,6]`,
`interval(-1,2).mul(interval(2,3))` = `[-3,6]`, `interval(1,4).sqrt()` = `[1,2]`; `div` throws when
the divisor interval contains zero.

### Added — N-D regular-grid interpolation `interpn` (Phase 8 Task 4)

Added `functions/src/numeric/interpn.ts`, exported from `@danielsimonjr/mathts-functions`:
`interpn(grids, values, query)` — regular-grid multilinear interpolation matching
`scipy.interpolate.interpn` (default `method='linear'`, `bounds_error=True`). Generalizes past the
1-D/2-D spec to arbitrary dimension `n`: locates the bracketing cell per axis via binary search and
takes the weighted average of the `2^n` corner values. Exact on any function affine in each
coordinate; throws on a non-increasing grid axis, a `values` shape mismatch, or an out-of-bounds
query (no extrapolation). Pinned against `scipy.interpolate.interpn` for 1-D/2-D/3-D cases and
out-of-bounds behavior (exact match).

### Fixed — `solveBVP` generalized beyond the hardcoded 2-state case (Phase 8 Task 4)

`solveBVP(f, bc, mesh)` (`functions/src/typed/numeric.ts`) hardcoded its shooting-method unknowns to
a 2-element state vector (`const n = 2`), so it could only solve BVPs cast as the 2-state
`[y, y']` system (the common single-2nd-order-ODE shape) — a coupled 3+-state first-order system
threw or silently produced garbage. Added an optional 4th parameter, `y0Guess: number[] = [0, 0]`,
whose length now sets the state dimension `n`; the core shooting/Newton loop was already
dimension-agnostic, so this is a pure additive fix with no behavior change for existing 3-argument
call sites (identical default `[0, 0]`). Verified with a new pinned 3-state decoupled-system test
(`y_i' = -i·y_i`, exact solution `y_i(t) = exp(-i·t)`) alongside the required `y'' = -y` (→ `sin`)
regression test; all pre-existing `solveBVP` tests remain green unchanged.

### Added — Geometry & sets: quaternion slerp/inverse/Euler, boundingBox, procrustes, kdTree kNN/radius, multiset ops (Phase 8 Task 3)

Added `functions/src/geometry/geometry-extra.ts`, exported from `@danielsimonjr/mathts-functions`:
quaternion `slerp`/inverse/Euler conversion, an axis-aligned `boundingBox`, orthogonal `procrustes`
alignment (via `@danielsimonjr/mathts-matrix`'s `svd`), brute-force kd-tree `kNN`/radius queries, and
multiset `setIsSuperset`/`setEqual`/`setDisjoint` (complementing the existing `setIsSubset`).

- `quaternionInverse(q)` — multiplicative inverse `conj(q) / |q|²` (order `[w,x,y,z]`, matching the
  repo-wide convention in the existing `geometry-extra.ts`).
- `quaternionSlerp(q1, q2, t)` — spherical linear interpolation between unit quaternions; takes the
  shortest arc (negates `q2` when the dot product is negative) and falls back to normalized lerp
  when the inputs are nearly parallel.
- `quaternionToEuler(q)` — ZYX intrinsic Euler angles `[roll, pitch, yaw]`; pinned against
  `scipy.spatial.transform.Rotation.as_euler('xyz')` across 5 random rotations (exact match to
  1e-8).
- `boundingBox(points)` — per-dimension axis-aligned `{ min, max }`.
- `procrustes(A, B)` — orthogonal Procrustes alignment mapping `B` onto `A`: center + unit-normalize
  both, `M = A0ᵀB0 = UΣVᵀ`, `R = VUᵀ`, `scale = ΣΣᵢ`, `disparity = ‖A0 − scale·B0·R‖²`. Pinned
  against `scipy.spatial.procrustes` disparity (exact-rotation and unrelated-point-set cases both
  match to float precision).
- `kdTreeKNN(points, query, k)` / `kdTreeRadius(points, query, r)` — brute-force Euclidean k-nearest
  and radius queries (the existing `kdTree`/`kdTreeNearest` in `typed/geometry.ts` has no radius
  method).
- `setIsSuperset(a, b)` / `setEqual(a, b)` / `setDisjoint(a, b)` — multiset comparisons built on the
  existing `setIsSubset`/`setMultiplicity`.

### Added — Graph optimization: maxFlow/minCut, astar, hungarian (Phase 8 Task 2)

Added `functions/src/graph/optimization.ts`, exported from `@danielsimonjr/mathts-functions`:
`maxFlow`/`minCut` (Edmonds-Karp), `astar` (heuristic pathfinding), and `hungarian` (Kuhn-Munkres
optimal assignment) — combinatorial-optimization algorithms complementing the existing graph
traversal/shortest-path/centrality functions.

- `maxFlow(capacity, source, sink)` — Edmonds-Karp max-flow (Ford-Fulkerson with BFS
  shortest-augmenting-path selection on the residual graph); returns `{ maxFlow, flow }`. Pinned
  against `networkx.maximum_flow_value` — the initially-drafted oracle value of 4 for the sample
  4-node network was wrong; the verified value is 5.
- `minCut(capacity, source, sink)` — the induced minimum s-t cut via the max-flow-min-cut theorem:
  reuses `maxFlow`'s residual graph, BFS from `source` gives the `S`/`T` partition, and `value`
  equals the max-flow value.
- `astar(adj, start, goal, heuristic)` — heuristic-guided shortest path on a weighted adjacency
  matrix; reduces to Dijkstra with `heuristic = () => 0`. Returns `{ path: [], cost: Infinity }`
  when unreachable.
- `hungarian(cost)` — Kuhn-Munkres optimal assignment minimizing total cost on a square cost
  matrix via the classical O(n³) potential/shortest-augmenting-path formulation; returns
  `{ assignment, cost }`. Pinned against `scipy.optimize.linear_sum_assignment` (3x3 and 4x4).

### Added — Graph traversal, all-pairs shortest paths, and distance centrality (Phase 8 Task 1)

Added `functions/src/graph/traversal-centrality.ts`, exported from `@danielsimonjr/mathts-functions`:
`bfs`/`dfs` (visitation-order traversal), all-pairs `floydWarshall`, single-source `bellmanFord`
(negative-weight/cycle-aware), and `closenessCentrality`/`harmonicCentrality` — complementing the
existing Dijkstra `shortestPath`/`graphDistance` in `typed/graph.ts`.

- `bfs(adj, start)` / `dfs(adj, start)` — visitation order over a directed adjacency-matrix reading
  (any finite, nonzero off-diagonal `adj[i][j]` is an edge i → j; neighbors visited in ascending
  index order; the matrix is never symmetrized).
- `floydWarshall(adj)` — all-pairs shortest-path distances via the standard O(V³) triple loop;
  tolerates negative edge weights (both `Infinity` and `0` off-diagonal mean "no edge").
- `bellmanFord(adj, source)` — single-source shortest paths, negative-weight-aware: relaxes all
  edges `|V|-1` times then one more pass to detect a negative-weight cycle reachable from the
  source, returning `{ dist, hasNegativeCycle }`.
- `closenessCentrality(adj)` / `harmonicCentrality(adj)` — distance-based centrality built on
  `floydWarshall`, pinned against `networkx.closeness_centrality`/`harmonic_centrality`. Matches
  networkx's directed-graph default of summing *incoming* distances to a node; `closenessCentrality`
  applies the Wasserman–Faust disconnected-graph scaling `(r-1)/(n-1) · (r-1)/Σd`.

### Added — Control-theory matrix equations: dlyap/care/dare (Phase 7 Task 5)

Added `functions/src/numeric/control-equations.ts`, exported from `@danielsimonjr/mathts-functions`:
`dlyap` (discrete Lyapunov), `care`/`dare` (continuous/discrete algebraic Riccati) — the matrix
equations underlying LQR (linear-quadratic regulator) and Kalman-filter design, complementing the
existing continuous `sylvester`/`lyap`.

- `dlyap(A, Q)` — solves `A X Aᵀ − X + Q = 0` by building the Kronecker-product linear system
  `(I − A⊗A) vec(X) = vec(Q)` explicitly (practical for the `n ≲ 20` this targets) and solving it
  with the existing `linsolve`.
- `care(A, B, Q, R)` — solves the continuous Riccati equation `AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0` via
  Newton iteration for the matrix sign function of the Hamiltonian `H = [[A, −BR⁻¹Bᵀ], [−Q, −Aᵀ]]`,
  then extracts `X = U₂U₁⁻¹` from the stable-eigenspace projector `½(I − sign(H))`. Chosen over a
  Kleinman/Newton iteration (which needs a stabilizing initial gain — `X₀ = 0` isn't stabilizing
  for e.g. the classic double-integrator `A = [[0,1],[0,0]]`) and over a Hamiltonian-eigenvector
  construction (this codebase's `eig` only returns real eigenvector columns for complex
  eigenvalues, per `matrix-functions.ts`).
- `dare(A, B, Q, R)` — solves the discrete Riccati equation
  `AᵀXA − X − AᵀXB(R + BᵀXB)⁻¹BᵀXA + Q = 0` via the structure-preserving doubling algorithm (SDA),
  the discrete-time analogue of `care`'s sign-function method — likewise needs no stabilizing
  initial gain.

Pinned vs scipy: `care([[0,1],[0,0]], [[0],[1]], [[1,0],[0,1]], [[1]])` → `[[√3, 1], [1, √3]]`
(matches `scipy.linalg.solve_continuous_are`); `dare([[1,1],[0,1]], [[0],[1]], [[1,0],[0,1]], [[1]])`
→ `[[2.94712297, 2.36920541], [2.36920541, 4.61313426]]` (matches `scipy.linalg.solve_discrete_are`,
independently residual-checked in-test to <1e-6); `dlyap([[0.5,0],[0,0.5]], [[1,0],[0,1]])` →
`(4/3)·I`.

Documented in `docs/reference/functions.md` under Linear Algebra (main table + new "Control-Theory
Matrix Equations" section). `npm run docs:functions` / `npm run docs:deps` regenerated;
docs-completeness gate green. `functions/tests/control-equations.test.ts` (3 tests). Full
`functions` regression: 3694 passed, 94 skipped, 0 failed. `tsc --noEmit` and targeted `eslint`
both 0 problems.

### Added — Complex matrix functions: funm/cosm/sinm (Phase 7 Task 4)

Added `functions/src/numeric/matrix-functions.ts`, exported from `@danielsimonjr/mathts-functions`:
`funm(A, f)` — a general matrix function returning a complex-valued matrix `{ re, im }` — plus
`cosm`/`sinm` built on it, so indefinite and complex-spectrum inputs work where the existing
`sqrtm`/`matrixLogm` only handle real positive spectra.

- `funm(A, f)` — diagonal matrices are handled exactly (elementwise, any multiplicity);
  otherwise the eigenvalues are computed via `@danielsimonjr/mathts-matrix`'s `eig` and, when
  pairwise distinct, the Lagrange–Sylvester interpolation formula for a diagonalizable matrix
  with simple spectrum is applied in complex arithmetic:
  `f(A) = Σ_i f(λ_i) · Π_{j≠i} (A − λ_j I) / (λ_i − λ_j)` — needing only eigenvalues, not
  eigenvectors. Throws for non-diagonal matrices with repeated/numerically-indistinguishable
  eigenvalues (defective/non-diagonalizable case) — a documented limitation; a full
  Schur–Parlett block recurrence would lift it but isn't required by current call sites.
- `cosm(A)` / `sinm(A)` — `funm(A, complexCos)` / `funm(A, complexSin)`, with
  `cos(z) = cos(re)cosh(im) − i·sin(re)sinh(im)` and `sin(z) = sin(re)cosh(im) + i·cos(re)sinh(im)`.

Pinned vs scipy: `cosm([[0,1],[-1,0]])` = `diag(cosh 1)` = `diag(1.5430806348)` (eigenvalues
±i); `funm(diag(-4,-9), sqrt)` = `diag(2i, 3i)`.

Documented in `docs/reference/functions.md` under Linear Algebra → "Decompositions & matrix
functions". `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/matrix-functions.test.ts` (4 tests: rotation-matrix cosm vs `cosh(1)`,
`funm` sqrt of a negative diagonal, diagonal cosm, zero-matrix sinm). Full `functions`
regression: 3691 passed, 94 skipped, 0 failed. `tsc --noEmit` and targeted `eslint` both 0
problems.

### Added — Structured & indefinite solvers: thomasSolve/solveBanded/toeplitzSolve/ldl (Phase 7 Task 3)

Added `functions/src/numeric/structured-solvers.ts`, exported from `@danielsimonjr/mathts-functions`:
four direct solvers that exploit matrix structure to beat a general dense factorization
(`lusolve`), or — for `ldl` — to factor matrices `cholesky` can't (symmetric but not
positive-definite, e.g. KKT / saddle-point systems).

- `thomasSolve(sub, diag, sup, d)` — the Thomas algorithm, O(n) tridiagonal solve.
- `solveBanded(l, u, A, b)` — banded-aware Gaussian elimination touching only the O(n(l+u))
  entries inside the band (`A` passed as a full dense matrix with `l` lower / `u` upper nonzero
  diagonals). Like `thomasSolve`, no pivoting is performed.
- `toeplitzSolve(c, r, b)` — O(n²) solve of a Toeplitz system via Levinson–Durbin, given only
  the first column `c` and first row `r` (`c[0] === r[0]`). Order-recursively tracks the
  solution together with two mutually-coupled predictor vectors (one for `T`, one for `Tᵀ`,
  related via the persymmetry `J T J = Tᵀ` every Toeplitz matrix has) — the trick that makes a
  general (non-symmetric) Toeplitz system solvable in O(n²) rather than O(n³).
- `ldl(A)` — Bunch–Kaufman-pivoted `LDLᵀ` factorization of a symmetric (possibly indefinite)
  matrix, with 1x1/2x2 diagonal blocks. Returns `{ L, D, perm }`; reconstruction identity
  `L·D·Lᵀ = P·A·Pᵀ` where `(P·A·Pᵀ)[i][j] = A[perm[i]][perm[j]]`.

Pinned vs scipy: `thomasSolve([-1,-1],[2,2,2],[-1,-1],[1,0,1])` → `[1,1,1]`;
`toeplitzSolve([2,1],[2,1],[1,2])` → `[0,1]` (matches `scipy.linalg.solve_toeplitz`);
`ldl([[1,2,3],[2,1,4],[3,4,1]])` reconstructs `A` per the identity above (matches
`scipy.linalg.ldl`, including its exact pivot sequence for this matrix — verified by symbolic
derivation and numeric cross-check against scipy/numpy).

Documented in `docs/reference/functions.md` under Linear Algebra, new "Structured & Indefinite
Solvers" subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness
gate green. `functions/tests/structured-solvers.test.ts` (4 tests: thomasSolve tridiagonal,
toeplitzSolve vs scipy, solveBanded vs dense solve, ldl reconstruction identity). Full `functions`
regression: 3687 passed, 94 skipped, 0 failed. `tsc --noEmit` and `eslint .` both 0 problems.

### Added — Iterative symmetric eigensolver: eigsh (Phase 7 Task 2)

Added `functions/src/numeric/eigsh.ts`, exported from `@danielsimonjr/mathts-functions`:
`eigsh(A, k = 1, opts?)` — a Lanczos iteration returning the `k` largest (`which: 'LM'`, default)
or smallest (`which: 'SM'`) eigenpairs of a **symmetric** matrix, for large problems the dense
`eigs` (full eigendecomposition) can't handle. Accepts `A` as a dense matrix or a matvec callback
(`(x: number[]) => number[]`, matching `krylov.ts`'s LinearOperator convention; `opts.n` is
required for the matvec form). Builds the orthonormal Krylov basis with full reorthogonalization
against every prior Lanczos vector (numerical stability at small/medium sizes), forms the small
tridiagonal projection `T`, solves `T`'s eigenproblem via cyclic Jacobi rotations, and lifts the
result back through the basis (Rayleigh-Ritz). Eigenvectors are returned as columns of an
`n x k` matrix. Pinned: for tridiag `[[2,1,0],[1,2,1],[0,1,2]]`, largest = `2 + √2 ≈ 3.41421356`,
smallest = `2 − √2 ≈ 0.58578644`.

Documented in `docs/reference/functions.md` under Linear Algebra, new "Iterative Eigensolver"
subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/eigsh.test.ts` (5 tests: pinned largest/smallest eigenvalues, k=2 largest,
`Av = λv` residual check, matvec-operator input with explicit `n`). Full `functions` regression:
3682 passed, 94 skipped, 0 failed.

### Added — Iterative Krylov solvers: cg/gmres/bicgstab/minres (Phase 7 Task 1)

Added `functions/src/numeric/krylov.ts`, exported from `@danielsimonjr/mathts-functions`:
iterative Krylov solvers `cg` (SPD), `minres` (symmetric indefinite), `gmres` (restarted),
`bicgstab` (nonsymmetric) — each accepting a dense matrix OR a matvec callback
(`(x: number[]) => number[]`, LinearOperator style) plus an optional Jacobi preconditioner
(`M⁻¹ = diag(1/A_ii)`, dense-matrix only, or a custom `(r) => M⁻¹r` function), for the large
sparse systems dense factorization (`lusolve`/`qr`/…) can't handle. Convergence is measured on
the relative residual `‖b − A x‖₂ / ‖b‖₂ < tol` (default `tol=1e-10`,
`maxIter=min(10n, 1000)`). Pinned: `cg([[4,1],[1,3]],[1,2])` = `[1/11, 7/11]`.

Documented in `docs/reference/functions.md` under Linear Algebra, new "Iterative Solvers"
subsection. `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green. `functions/tests/krylov.test.ts` (10 tests: the pinned SPD oracle, larger SPD/nonsymmetric/
indefinite systems verified by direct residual, matvec-operator input, Jacobi + custom
preconditioners, and the matvec-only-Jacobi error path). Full `functions` regression: 3678
passed, 94 skipped, 0 failed.

### Added — Spectral estimation + peak analysis: csd/coherence/findPeaks/peakWidths/stft/istft/decimate (Phase 6 Task 5)

Added `functions/src/signal/spectral-peaks.ts`, exported from `@danielsimonjr/mathts-functions`
(the fifth and final Phase 6 signal-processing task):

- `findPeaks(x[, opts])` — strict local-maxima peak indices (`x[i-1] < x[i] > x[i+1]`), optionally
  filtered by `opts.height` (min value), `opts.distance` (min index separation, greedily keeping
  the taller of any too-close pair — `scipy`'s tallest-first sweep), and/or `opts.prominence`
  (min topographic prominence, walking outward from each peak to the nearest taller sample or
  boundary in each direction). Pinned to `scipy.signal.find_peaks([0,2,0,3,0,1,0])` = `[1,3,5]`.
- `peakWidths(x, peaks[, relHeight=0.5])` — width (in samples) of each peak at `relHeight` down
  from the peak toward its topographic base, with linearly-interpolated crossing points. Pinned
  bit-for-bit against `scipy.signal.peak_widths` (`peakWidths([0,1,3,1,0], [2])` = `[1.5]`).
- `csd(x, y[, opts])` / `coherence(x, y[, opts])` — cross-spectral density / magnitude-squared
  coherence via Welch's overlapped-segment-averaging method (segment, window, FFT, average
  `X·conj(Y)`), reusing the package's own object-array `fft` (`signal/fft.ts`, the same internal
  FFT `signal/conv.ts` already builds on) and `windowFunction`. `opts = { nperseg, noverlap,
  window, fs }`.
- `stft(x[, opts])` / `istft(S[, opts])` — short-time Fourier transform (windowed overlapping
  frames, each independently FFT'd) and its inverse via overlap-add, normalized by the running sum
  of squared window values (constant-overlap-add). This normalization makes reconstruction exact
  in the interior for *any* window (not just COLA-satisfying ones) wherever the overlap-sum is
  nonzero — verified via `istft(stft(x))` on a 64-sample signal (Hann window, 16/8 frame/overlap),
  matching to 3 decimal places over the fully-overlapped interior region.
- `decimate(x, q)` — anti-aliased downsampling by integer factor `q`: a Butterworth lowpass
  (order 4, cutoff `min(0.8/q, 0.99)` of Nyquist) applied zero-phase via the existing
  `butter`/`filtfilt`, then every `q`-th sample kept.

Documented in `docs/reference/functions.md` under Signal Processing (new "Peak detection"
subsection + additions to "Spectral estimation" and the main table). `npm run docs:functions` /
`npm run docs:deps` regenerated; docs-completeness gate green. This completes the Phase 6
signal-processing breadth plan (`docs/superpowers/plans/2026-07-16-phase6-signal-breadth.md`).

### Added — Wavelet transforms: idwt/wavedec/waverec + cwt (Phase 6 Task 4)

Added `functions/src/signal/wavelets.ts`, exported from `@danielsimonjr/mathts-functions`. The
existing `dwt` (`typed/signal.ts`) was forward, single-level only — this closes the loop with an
inverse, multilevel decomposition/reconstruction, and a continuous transform:

- `idwt(approx, detail[, wavelet])` — inverse single-level DWT. Matches `dwt`'s Haar convention
  exactly (`s = 1/sqrt(2)`, `approx[i] = s*(x[2i]+x[2i+1])`, `detail[i] = s*(x[2i]-x[2i+1])`);
  Haar's synthesis filters are the time-reverse of its analysis filters, a no-op for a symmetric
  2-tap filter, giving the closed-form inverse `x[2i] = s*(approx[i]+detail[i])`,
  `x[2i+1] = s*(approx[i]-detail[i])`. Pinned by `idwt(dwt(x).approx, dwt(x).detail) === x`.
- `wavedec(x[, wavelet, level])` — multilevel decomposition: repeatedly `dwt`s the approximation
  coefficients, returning `[cA_level, cD_level, cD_{level-1}, …, cD_1]` (pywt order).
- `waverec(coeffs[, wavelet])` — inverse of `wavedec`: repeatedly `idwt`s from the coarsest level
  up. Pinned by `waverec(wavedec(x, w, L), w) === x` (perfect reconstruction).
- `cwt(x, scales[, wavelet])` — continuous wavelet transform: convolves `x` (via `convDirect`'s
  `'same'` mode) with a discretized, normalized Ricker (Mexican-hat, `(1-t²)e^(-t²/2)`, default) or
  Morlet (`cos(5t)e^(-t²/2)`) wavelet at each scale → `scales.length x x.length` matrix.

Only `'haar'`/`'db1'` are supported (matching `dwt`, which throws for any other wavelet name).

Documented in `docs/reference/functions.md` under Signal Processing. `npm run docs:functions` /
`npm run docs:deps` regenerated; docs-completeness gate green.

### Added — FIR bandpass + LS/equiripple design + smoothing/deconvolution (Phase 6 Task 3)

Added `functions/src/signal/fir-smoothing.ts`, exported from `@danielsimonjr/mathts-functions`:

- `firwinBandpass(numtaps, [f1, f2])` — FIR bandpass tap design by the windowed-sinc method
  (Hamming window): `h[n] = (f2·sinc(f2·(n−M/2)) − f1·sinc(f1·(n−M/2)))·hamming[n]`. This is the
  array-cutoff case the scalar-only `firwin` (`signal-filter-extra.ts`) didn't support — resolves
  the Phase-0 note. `sinc` is now exported from `signal-filter-extra.ts` for reuse.
- `firls(numtaps, bands, desired)` — least-squares linear-phase FIR design: a genuine
  (non-approximate) LS fit via dense trapezoid-quadrature sampling of the specified bands plus a
  cosine-basis normal-equations solve (Type I/II symmetric filter representation).
- `remez(numtaps, bands, desired)` — Parks-McClellan-style equiripple FIR design. **Documented as
  approximate**: implements Lawson's algorithm (iteratively reweighted least squares over the
  `firls` normal equations), not the exact Remez-exchange algorithm — converges toward but does not
  guarantee a true minimax/equiripple solution.
- `savgol(x, windowLength, polyorder)` — Savitzky-Golay smoothing: per-window degree-`polyorder`
  polynomial fit via the normal equations over a Vandermonde of window offsets; edges reuse the
  nearest boundary window's fit evaluated at the edge point's offset (scipy's `mode='interp'`).
  Exact on polynomials of degree <= `polyorder`; pinned bit-for-bit against
  `scipy.signal.savgol_filter` (interior and both boundary regions, multiple window/order pairs).
- `wiener(x[, mysize])` — Wiener adaptive filter: local mean/variance over a sliding window
  (`convDirect`'s zero-padded `'same'` convention), output
  `m + max(0, v−noise)/max(v, noise)·(x−m)`.
- `deconvolve(signal, divisor)` — FIR/polynomial deconvolution via synthetic long division
  (`signal = conv(divisor, quotient) + remainder`); pinned bit-for-bit against
  `scipy.signal.deconvolve`, including the non-exact-division remainder case.

Documented in `docs/reference/functions.md` under Signal Processing → "Digital filter design &
application". `npm run docs:functions` / `npm run docs:deps` regenerated; docs-completeness gate
green.

### Added — Chebyshev/elliptic IIR design (Phase 6 Task 2)

Added `functions/src/signal/iir-design.ts`, exported from `@danielsimonjr/mathts-functions`:

- `cheby1(N, rp, Wn, btype?)` / `cheby2(N, rs, Wn, btype?)` — Chebyshev Type I (equiripple
  passband) / Type II (equiripple stopband, monotone passband) IIR design, built on the
  existing `butter` analog-prototype → frequency-transform → bilinear pipeline (now shared via
  `signal-filter-extra.ts`'s `analogToDigital`).
- `ellip(N, rp, rs, Wn, btype?)` — elliptic (Cauer) IIR design: a full port of scipy's
  closed-form nome-based algorithm (Orfanidis, "Lecture Notes on Elliptic Filter Design") —
  the degree equation and the elliptic root-finding are both solved analytically (theta-function
  series / descending Landen transformation), no numerical optimizer — reusing the repo's
  existing AGM-based `ellipticKScalar` and `jacobiSN`/`jacobiCN`/`jacobiDN` (Phase 5). This is
  the exact algorithm, not an approximation.
- `bilinear(b, a, fs)` — analog → digital bilinear (Tustin) transform of a transfer function.
- `buttord(wp, ws, gpass, gstop)` — minimum Butterworth order + natural frequency (scalar
  lowpass/highpass case) → `{ N, Wn }`.
- `zpk2sos(z, p, k)` / `sosfilt(sos, x)` — group zeros/poles/gain into cascaded second-order
  sections and apply them (direct-form-II transposed per biquad).

### Changed — `butter` now honors `btype`

`butter(N, Wn, btype?)` now accepts `'low' | 'high' | 'bandpass' | 'bandstop'` (`Wn` becomes
`[low, high]` for the last two); the original 2-arg lowpass call is unchanged (`btype` defaults
to `'low'`). Resolves the Phase-0 note that `butter` was lowpass-only. The zpk-domain
lp2lp/lp2hp/lp2bp/lp2bs + bilinear + zpk2tf pipeline is now shared (`analogToDigital` in
`signal-filter-extra.ts`) across `butter`/`cheby1`/`cheby2`/`ellip`.

Every coefficient set (cheby1, cheby2, butter high/bandpass/bandstop, ellip, bilinear, buttord)
verified against `scipy.signal` 1.17.1. Documented in `docs/reference/functions.md` under
Signal Processing → "Digital filter design & application".

### Added — FFT helpers (Phase 6 Task 1)

Added `functions/src/signal/fft-helpers.ts`, exported from `@danielsimonjr/mathts-functions`:

- `rfft(x)` / `irfft(spec, n)` — real FFT built on the package's own exported `fft`/`ifft`:
  `rfft` keeps the non-redundant first `floor(n/2)+1` bins of the full transform; `irfft`
  rebuilds the conjugate-symmetric length-`n` spectrum and inverse-FFTs it.
- `fftshift(x)` / `ifftshift(x)` — roll the zero-frequency component to center / undo it.
- `fftfreq(n[, d])` / `rfftfreq(n[, d])` — DFT sample frequencies for `fft`/`rfft` output.
- `fftn(x)` — 2-D FFT (FFT each row, then each column), delegating to the existing
  N-dimensional `fft`.

Pinned vs numpy (`numpy.fft.rfft([1,2,3,4])` → `re=[10,-2,-2]`, `im=[0,2,0]`;
`numpy.fft.fftfreq(4)` = `[0,0.25,-0.5,-0.25]`; `numpy.fft.rfftfreq(4)` = `[0,0.25,0.5]`;
`numpy.fft.fftshift([0,1,2,3])` = `[2,3,0,1]`). Documented in `docs/reference/functions.md`
under Signal Processing.

### Added — number-theory fills (Phase 5 Task 4)

Added `functions/src/numbertheory/extra.ts`, exported from `@danielsimonjr/mathts-functions`:

- `continuedFraction(x, maxTerms?)` — simple continued fraction expansion `[a0, a1, ...]`.
- `eulerNumbers(n)` — Euler numbers `E_0..E_n` via the standard secant-number recurrence.
- `stirlingS1(n, k)` — signed Stirling number of the first kind (DP recurrence), complementing
  the existing unsigned `stirlingS2`.
- `discreteLog(g, h, p)` — discrete logarithm via baby-step giant-step (`BigInt` modular
  exponentiation/inversion to avoid overflow).
- `primitiveRoot(p)` — smallest primitive root modulo a prime, via prime-factorization of `p-1`.
- `multiplicativeOrder(a, n)` — multiplicative order of `a` mod `n` (`-1` if `gcd(a,n) !== 1`).
- `kroneckerSymbol(a, n)` — Kronecker symbol, generalizing the existing `jacobiSymbol` to all
  integer `n` (even, negative, zero).
- `permutationsGen(arr, k?)` / `combinationsGen(arr, k)` — lexicographic tuple *enumerators*
  complementing the existing `permutations`/`combinations`, which only return counts.

Pinned vs sympy (`stirling(5,2,kind=1,signed=True)=-50`; `euler(6)=-61`;
`discrete_log(5,3,2)=3` i.e. `2^3≡3 mod 5`; `primitive_root(7)=3`; `n_order(2,7)=3`;
`jacobi_symbol(2,3)=-1`). Documented in `docs/reference/functions.md` under
Combinatorics & Number Theory.

### Added — Jacobi elliptic sn/cn/dn + Gauss–Legendre nodes/weights (Phase 5 Task 3)

Added `functions/src/special/jacobi-elliptic.ts` and `functions/src/numeric/gauss-nodes.ts`,
exported from `@danielsimonjr/mathts-functions`:

- `jacobiSN(u, m)` / `jacobiCN(u, m)` / `jacobiDN(u, m)` — the Jacobi elliptic functions
  (parameter convention `m = k²`, matching scipy/mpmath), the elliptic *functions* complementing
  the existing elliptic *integrals* (`ellipticK`/`ellipticF`/etc.). Computed via the descending
  Landen transformation / arithmetic-geometric mean (AGM) method (Abramowitz & Stegun 16.4), with
  closed-form fast paths at `m = 0` (circular functions) and `m = 1` (hyperbolic functions).
- `rootsLegendre(n)` — `n`-point Gauss–Legendre quadrature nodes and weights on `[-1, 1]`, found
  by Newton's method on the Legendre three-term recurrence from the standard asymptotic initial
  guess, for custom quadrature (complements the existing fixed-order `gaussQuad`).

Pinned vs mpmath/scipy (`jacobiSN/CN/DN(0.5, 0.3) = 0.4742156227 / 0.8804087364 / 0.9656789647`;
`rootsLegendre(3)` nodes `[-0.7745966692, 0, 0.7745966692]`, weights `[0.5555555556, 0.8888888889,
0.5555555556]`). Documented in `docs/reference/functions.md` under Special Functions
(`jacobiSN`/`CN`/`DN`) and Numerical Integration (`rootsLegendre`).

### Added — polygamma/trigamma + Jacobi/Gegenbauer orthogonal polynomials (Phase 5 Task 2)

Added `functions/src/special/polygamma-orthopoly.ts`, exported from `@danielsimonjr/mathts-functions`:

- `polygamma(n, x)` — the polygamma function `ψ^(n)(x)` (n-th derivative of digamma). `n === 0`
  delegates to the existing `digamma`; `n >= 1` shifts `x` upward via the standard digamma
  recurrence until it is large enough for the Bernoulli asymptotic expansion (DLMF 5.15.8, four
  terms) to converge to machine precision.
- `trigamma(x)` — the trigamma function `ψ'(x)`, equivalent to `polygamma(1, x)`.
- `jacobiP(n, alpha, beta, x)` — the Jacobi polynomial `P_n^(alpha,beta)(x)` via the standard
  stable three-term recurrence (DLMF 18.9.2).
- `gegenbauerC(n, alpha, x)` — the Gegenbauer (ultraspherical) polynomial `C_n^(alpha)(x)` via the
  standard stable three-term recurrence (DLMF 18.9.1), generalizing the existing
  `chebyshevT`/`hermiteH`/`laguerreL`/`legendreP` family.

Pinned vs mpmath/scipy (`polygamma(1,2) = trigamma(2) = 0.6449340668`, `polygamma(2,1) =
-2.4041138063`, `jacobiP(2,1,1,0.5) = 0.1875`, `gegenbauerC(2,1,1) = 3`); agrees with mpmath to
12+ significant digits and scipy's `eval_jacobi`/`eval_gegenbauer` exactly. Documented in
`docs/reference/functions.md` under Special Functions.

### Added — hypergeometric functions: `hyp0f1`/`hyp1f1`/`hyp2f1` + generic `pFq` (Phase 5 Task 1)

Added `functions/src/special/hypergeometric.ts`, exported from `@danielsimonjr/mathts-functions`:

- `hyp0f1(b, z)` — confluent hypergeometric limit function `0F1(; b; z)`, entire in `z`.
- `hyp1f1(a, b, z)` — Kummer's confluent hypergeometric function `1F1(a; b; z)` (Kummer's M),
  entire in `z` (ascending series targets moderate `|z|`; large `|z|` is not yet optimized).
- `hyp2f1(a, b, c, z)` — Gauss's hypergeometric function `2F1(a, b; c; z)`; the ascending series
  converges only for `|z| < 1` and throws otherwise (analytic continuation not yet implemented).
- `pFq(a[], b[], z)` — the generic generalized hypergeometric series engine (ascending
  Pochhammer-ratio method) that the three above delegate to.

These are the hypergeometric **master functions** from which Bessel, Legendre, the error
function, and the incomplete gamma/beta functions all derive as special cases. Pinned vs mpmath
(`hyp2f1(1,2,3,0.5) = 1.5451774445`, `hyp1f1(1,2,0.5) = 1.2974425414`, `hyp0f1(2,0.5) =
1.2717234563`). Documented in `docs/reference/functions.md` under Special Functions.

### Added — noncentral CDFs, circular statistics, McNemar/Cochran-Q (Phase 4 Task 4)

Added `functions/src/stats/inference-extra2.ts`, exported from `@danielsimonjr/mathts-functions`:

- `noncentralChi2CDF(x, df, nc)` / `noncentralFCDF(x, dfn, dfd, nc)` — Poisson-mixture series
  over the existing `chiSquaredCDF`/`fCDF`, truncated once the cumulative Poisson mass covers
  `1 − 1e-12`; matches `scipy.stats.ncx2.cdf`/`ncf.cdf` (pinned: `noncentralChi2CDF(10,3,2) =
  0.8985649635`, `noncentralFCDF(2,3,10,4) = 0.4663642160`).
- `noncentralTCDF(t, df, nc)` — Simpson-quadrature evaluation of the mixture representation
  `F(t) = E_V[Φ(t·sqrt(V/ν) − δ)]`, `V ~ χ²_ν`; matches `scipy.stats.nct.cdf` to ~3 digits
  (pinned: `noncentralTCDF(1.5,10,2) = 0.3047854474`).
- `circmean`/`circstd`/`circvar` — circular mean/std/variance via `atan2(Σsinθ, Σcosθ)` and the
  mean resultant length `R`; matches `scipy.stats.circmean`/`circstd`/`circvar` (pinned:
  `circmean([0.1,0.2,6.2]) = 0.0723638036`).
- `vonMisesPDF(theta, mu, kappa)` — von Mises (circular normal) PDF using the shared
  `besselIScalar` special-function primitive; matches `scipy.stats.vonmises.pdf` (pinned:
  `vonMisesPDF(0,0,2) = 0.5158854120`).
- `mcnemar(table[, opts])` — McNemar's test on a 2×2 paired table (continuity correction default
  on); matches `statsmodels` `mcnemar`.
- `cochranQ(data)` — Cochran's Q test (McNemar generalized to `k > 2` matched binary
  treatments); matches `statsmodels` `cochrans_q`.

Documented in `docs/reference/functions.md`: noncentral CDFs under Probability Distributions →
Standalone CDF/PDF/quantile surface, a new "Circular Statistics" subsection, and `mcnemar`/
`cochranQ` under Hypothesis Tests.

### Added — time-series inference: `pacf`, `ljungBox`, `durbinWatson`, `adfuller` (Phase 4 Task 3)

Added `functions/src/stats/timeseries.ts`, exported from `@danielsimonjr/mathts-functions`:

- `pacf(x, nlags)` — partial autocorrelation via the Levinson-Durbin recursion on the existing
  biased `acf`; matches `statsmodels.tsa.stattools.pacf(..., method='ldb')` (pinned:
  `[1,2,3,2,1,2,3,2,1,2,3,2]`, nlags=3 → `[1, 0, -0.8333..., 0]`).
- `ljungBox(x, lags)` — portmanteau test for residual autocorrelation, `Q =
  n(n+2)Σρ_k²/(n−k)`, `pValue = 1 − chiSquaredCDF(Q, lags)`; matches
  `statsmodels.stats.diagnostic.acorr_ljungbox` (pinned: `[1,2,1,2,...]` (n=10), lags=3 →
  `Q=28.8`).
- `durbinWatson(residuals)` — `Σ(eₜ−eₜ₋₁)²/Σeₜ²`; matches
  `statsmodels.stats.stattools.durbin_watson` exactly (verified: alternating `[1,-1,...]`,
  n=6 → `10/3`, **not** the textbook asymptotic "~4" bound, which only holds as n→∞).
- `adfuller(x[, maxlag])` — Augmented Dickey-Fuller unit-root test (constant-only model) via
  OLS of `Δxₜ` on `[1, xₜ₋₁, Δxₜ₋₁, …]` (reusing `ols`); default `maxlag =
  floor(12(n/100)^0.25)`, auto-clamped downward when the design is ill-posed (insufficient
  observations or a near-singular/NaN-producing fit). `pValue` uses a small built-in
  MacKinnon (1994)-style critical-value table with linear interpolation — an **approximate**
  p-value, documented as such (not the exact MacKinnon response-surface method).

Documented in `docs/reference/functions.md` under Statistics → new "Time-series inference"
subsection.

### Added — `kendallTauTest` (Phase 4 Task 2)

Added `kendallTauTest(x, y)` — Kendall's τ_b rank-correlation test returning `{ tau, pValue }`
(the p-value via the normal approximation `z = τ/√(2(2n+5)/(9n(n−1)))`). It delegates to the
pre-existing `kendalltau` (already implementing this exact formula, algebraically identical to
`z = 3τ√(n(n−1))/√(2(2n+5))`) and only renames `coefficient` → `tau` to match the `*Test`
result-object naming convention used by `mannWhitneyTest`/`kolmogorovSmirnovTest`/etc.

### Fixed — exact small-n Mann-Whitney p-value, now the default (Phase 4 Task 2b)

`mannWhitneyTest` now returns the **exact** small-sample Mann-Whitney U-distribution
two-sided p-value (the standard rank-sum null-distribution recurrence) whenever
`n1·n2 ≤ 400` and no ties are present — matching `scipy.stats.mannwhitneyu(...,
method='exact')` (pinned: `[1,2,3,4]` vs `[5,6,7,8]` → `p=0.02857142857142857`;
`[1,2,3]` vs `[4,5,6]` → `p=0.1`). This was materially wrong before: the prior default
(the normal approximation) put the second case's p in `(0.04, 0.055)`, ~2× off from the
true exact value. Falls back to the normal approximation for `n1·n2 > 400` or when ties
are present (matching scipy's own fallback). The one pinned oracle assertion this
supersedes (`functions/tests/gap-hypothesis-oracle.test.ts`) is updated to the exact value.

### Added — `kolmogorovSmirnov2Test` opt-in exact p-value (Phase 4 Task 2b)

`kolmogorovSmirnov2Test` gains an optional third argument `{ method?: 'auto' | 'exact' |
'asymp' }`. The default (`opts` omitted, or `'asymp'`) is byte-for-byte the prior
asymptotic `kstwobign` behavior — the pre-existing, deliberately-pinned oracle test
(`functions/tests/gap-stats-completeness.test.ts`) is untouched and stays green.
`'exact'` computes the exact lattice-path p-value (Kim & Jennrich 1970), matching
`scipy.stats.ks_2samp(..., method='exact')` (verified: n=5,5 → `p=0.873015873015873`;
n=8,8 → `p=0.6601398601398599`). `'auto'` picks exact for `n1·n2 ≤ 10000`.

### Added — `fitDistribution` MLE parameter fitting (Phase 4 Task 1)

Added `fitDistribution(name, data)` — maximum-likelihood parameter fitting for `'normal'` |
`'exponential'` | `'lognormal'` | `'poisson'` | `'gamma'`, returning `{ params, logLikelihood }`.
Normal/exponential/poisson use closed-form MLEs (population std, `1/mean`, `mean`); lognormal fits a
normal to `ln(data)` (throws if any value ≤ 0); gamma has no closed form for the shape parameter, so
it solves the 1-D shape equation `ln(k) − ψ(k) = ln(x̄) − mean(ln x)` (ψ = `digamma`) via the secant
method, starting from the Choi & Wette (1969) initial guess, then recovers `scale = x̄/k`. Verified
vs `scipy.stats.gamma.fit(d, floc=0)` on a 10-point sample: shape/scale matched to ~1e-13
(`6.42273918932...`, `0.29582393804...`).

### Added — `chi2Contingency` + `multipleTest` (Phase 3 Task 6)

Added `chi2Contingency(table, opts?)` — chi-square test of independence on a contingency table:
expected counts `E_ij = rowSum_i · colSum_j / total`, the Yates continuity correction
`(|O_ij − E_ij| − 0.5)²/E_ij` applied on 2×2 tables by default (`opts.correction !== false`,
matching scipy's default), `dof = (rows−1)(cols−1)`, `pValue = 1 − chiSquaredCDF(chi2, dof)`, and
Cramér's V `sqrt(chi2 / (total · min(rows−1, cols−1)))` as an effect-size companion. Pinned vs
`scipy.stats.chi2_contingency([[10,20],[30,40]], correction=False)`: chi2 = 0.7937, p = 0.373,
expected[0][0] = 12. Added `multipleTest(pValues, method)` — multiple-testing p-value adjustment
(`'bonferroni'` / `'holm'` step-down / `'bh'` Benjamini–Hochberg step-up FDR), returned in the
original input order; matches `statsmodels.stats.multitest.multipletests`.

### Added — `gaussianKDE` kernel density estimation (Phase 3 Task 5)

Added `gaussianKDE(samples, { bandwidth? })` — 1-D Gaussian kernel density estimation with
Silverman's rule-of-thumb default bandwidth (`h = 0.9 · min(σ, IQR/1.34) · n^(−1/5)`, falling back
to `0.9·σ·n^(−1/5)` when the IQR is 0, and throwing when σ is also 0); the first nonparametric
density estimator in the library. Returns `{ evaluate, bandwidth }`, where `evaluate(xs)` sums a
standard-normal bump per sample, scaled by the bandwidth. Pinned: a symmetric sample's estimated
density integrates to ~1 over a wide grid and peaks near the sample center, well above the tail.

### Added — `dbscan` clustering + `knnClassify`/`knnRegress` (Phase 3 Task 4)

Added `dbscan(points, eps, minPts)` — density-based clustering (DBSCAN): a point is a core point
if its ε-neighborhood (including itself) has at least `minPts` members; clusters grow by expanding
outward from core points, and points never reached are labeled noise (`-1`). ε-neighborhoods are
computed by brute-force Euclidean distance (O(n²) but correct) since the exported `kdTree` has no
radius-query method — a kd-tree range-search speedup is future work. Added `knnClassify(train,
labels, query, k)` — k-nearest-neighbour classifier by majority vote among the `k` closest training
points (Euclidean), ties broken by the single nearest point's label. Added `knnRegress(train,
targets, query, k)` — k-nearest-neighbour regressor (mean of the `k` closest training targets).
Pinned: two well-separated blobs plus a far outlier resolve to 2 clusters and the outlier labeled
noise; kNN assigns queries to the geometrically correct cluster.

### Added — `logisticRegression(X, y)` binary classifier via IRLS (Phase 3 Task 3)

Added `logisticRegression(X, y, opts?)` — binary logistic regression (`y ∈ {0,1}`) fit by
iteratively reweighted least squares (Newton-Raphson on the Bernoulli log-likelihood): each step
solves `(XᵀWX) Δ = Xᵀ(y - p)` for the Newton update, `W = diag(p(1-p))` (floored at `1e-9`), via
`linsolve`. Returns `{ coefficients, intercept, predict, predictProba }` — the first
classifier/GLM in the library. A small ridge term (`1e-8`) on `XᵀWX`'s diagonal keeps the solve
stable when predictors are exactly or near-collinear (a rank-deficient design would otherwise abort
IRLS on its first step), and the Newton step is capped at a max-norm of 25 to keep perfectly
separable data (where the unconstrained MLE diverges) from overshooting into NaN. Pinned: separable
1-D data gives a positive slope and `predictProba([[0]]) ≈ 0.5` at the symmetric boundary; a 2-D
collinear-but-separable case still classifies both sides correctly.

### Added — `ridge`/`lasso`/`elasticNet` regularized regression (Phase 3 Task 2)

Added `ridge(X, y, alpha, opts?)` — closed-form L2-penalized regression (`β = (XᵀX + αI)⁻¹Xᵀy` on
centered data). Added `lasso(X, y, alpha, opts?)` — L1-penalized regression via cyclic coordinate
descent with soft-thresholding on standardized columns, giving exact sparsity for large `alpha`.
Added `elasticNet(X, y, alpha, l1Ratio, opts?)` — combined L1/L2 via the same coordinate descent
(`l1Ratio` mixes lasso and ridge penalties). All three center X/y so the intercept is never
penalized, and recover `intercept = ȳ − x̄·β` on the original scale. Verified directionally vs
scikit-learn 1.8.0 (`Ridge`/`Lasso`): `alpha=0` recovers the OLS slope (`y=2x` -> `2.0`); large
`alpha` shrinks ridge toward 0 and drives lasso exactly to 0.

### Added — `ols(X, y)` multiple regression with inference (Phase 3 Task 1)

Added `ols(X, y, opts?)` — multiple/multivariate linear regression over a general design matrix
(rows = observations, cols = predictors), the general case `linearRegression` (single predictor)
didn't cover. Solves the normal equations `β = (XᵀX)⁻¹Xᵀy` (`opts.intercept` default `true` prepends
a column of ones) and returns full inference: `coefficients`, `stderr`, `tValues`/`pValues` (via
`studentTCDF`), `r2`/`adjR2`, the overall model `fStat`, and `residuals`. Pinned: exact fit
`y = 1 + 2·x1 + 3·x2` -> coefficients `[1, 2, 3]`, `r2 = 1`.

### Added — `linprog` two-phase simplex: equality constraints, bounds, status (Phase 2 Task 3)

`linprog` now accepts an options overload `linprog(c, { A_ub, b_ub, A_eq, b_eq, bounds })` returning
`{ x, fun, success, status }` — a two-phase simplex (Phase 1 artificial variables find a basic
feasible solution, handling equality constraints and negative-RHS rows; Phase 2 optimizes the real
objective) supporting equality constraints, per-variable `bounds` (default `[0, null]`), and
infeasible/unbounded detection (`status: 'optimal' | 'infeasible' | 'unbounded'`). The legacy
positional signature `linprog(c, A_ub, b_ub)` is unchanged. Pinned vs `scipy.optimize.linprog`:
`linprog([-1,-1], A_ub=[[1,1]], b_ub=[4], A_eq=[[1,-1]], b_eq=[1]) -> x=[2.5,1.5], fun=-4`; an
infeasible case (`x<=1` and `x>=3`); and a bounds-only case (`x∈[0,5]`, minimize `-x` -> `x=5`).

### Added — `nnls` + `lsqBounded` constrained least squares (Phase 2 Task 2)

Added `nnls(A, b, { tol?, maxIter? })` — Lawson–Hanson active-set non-negative least squares
(`min ||Ax - b||_2 s.t. x >= 0`), solving each restricted passive-set subproblem via the existing
`leastSquares`. Added `lsqBounded(A, b, lower, upper, { tol?, maxIter? })` — box-constrained least
squares via projected-gradient descent with backtracking. Both return `{ x, residual }`
(`residual = ||Ax - b||_2`). Pinned: `nnls(I, [3,-2]) -> [3,0]`, `nnls(I, [3,5]) -> [3,5]` (both
exact-recoverable cases), a 3x2 case checked against `scipy.optimize.nnls` (`[0.5, 0]`, matched
exactly), and `lsqBounded(I, [5,-3], [0,0], [2,2]) -> [2,0]`.

### Added — BFGS quasi-Newton minimizer (Phase 2 Task 1)

Added `bfgs(f, x0, { grad?, bounds? })` — BFGS quasi-Newton minimization with the classic
inverse-Hessian update (`H ← (I − ρ s yᵀ) H (I − ρ y sᵀ) + ρ s sᵀ`, skipped when `yᵀs ≤ 1e-12`) and
Armijo backtracking line search (`c1 = 1e-4`, starting step `α = 1`). Uses `opts.grad` if supplied,
else a local central-difference gradient; `opts.bounds` clips each accepted step into `[lo, hi]` per
coordinate (a lightweight projected BFGS, not the full active-set L-BFGS-B). The smooth-optimization
workhorse complementing derivative-free Nelder–Mead (`minimize`/`nelderMead`). Pinned: Rosenbrock
`[-1.2,1] -> [1,1]` (f~0), quadratics to exact minima, and a bounded case clipping to the box edge.

### Added — full `svd` + `orth` on the functions surface (Phase 1 Task 6)

The `matrix` package's full `svd(A) -> { U, S, V, rank }` was only reachable from `functions` through
its `singularValues`/`pinv` wrappers; re-exported it directly (`@danielsimonjr/mathts-matrix`'s `svd`
is synchronous, not async — verified against source before writing tests). Added `orth(A[, opts])` —
an orthonormal basis for the column space: computes `svd(A)`, takes the numerical rank `r` as the
count of singular values above `tol` (default `max(m, n) · S[0] · 2.22e-16`), and returns the leading
`r` columns of `U`. Handles the all-zero matrix (`r = 0` → an `m × 0` basis). Pinned:
`svd(diag(1,2,3)).S = [3,2,1]`; `orth` of a rank-2 3×3 matrix returns an orthonormal 3×2 `U` block.

### Added — adaptive Gauss-Kronrod quadrature: `quad` (Phase 1 Task 5)

Added `quad(f, a, b[, opts])` — QUADPACK-style adaptive Gauss-Kronrod (G7-K15) quadrature. On each
subinterval, a 15-point Kronrod estimate is compared against its embedded 7-point Gauss estimate
(both reuse the same 15 evaluation points); `|K − G|` is the panel's error estimate, and a panel
exceeding `tol · |K|` (default `tol = 1e-10`) is bisected and refined recursively (default
`maxDepth = 50`). Returns `{ value, error }`. G7-K15 node/weight constants sourced from QUADPACK's
`dqk15.f` (Piessens et al. 1983). Pinned against closed forms: `∫₀¹ 4/(1+x²) = π`,
`∫₀^π sin = 2`, `∫₋₁¹ 1/(1+25x²) = 0.4·atan(5)`.

### Fixed — `nintegrate` endpoint-singular accuracy

`nintegrate` now routes through the new adaptive `quad` (G7-K15) instead of its former fixed
5-point Gauss-Legendre panel with Richardson-extrapolation adaptivity. That scheme converged
slowly on endpoint singularities — `∫₀¹ x^-1/2 dx = 2` was off by ~1.7e-6 — because the error
estimate (Richardson difference between whole- and half-panel Gauss-Legendre) underestimated the
true error near a singular endpoint. G7-K15's embedded Kronrod/Gauss comparison resolves it
directly, to ~1e-10. `nintegrate`'s public signature and return type are unchanged.

### Added — scalar minimizer: `minimizeScalar` (Phase 1 Task 4)

No 1-D minimizer existed (only the vector Nelder–Mead `minimize` and root-finders). Added
`minimizeScalar(f, { bracket, tol, maxIter })` — Brent's method (golden-section search combined
with parabolic interpolation), returning `{ x, fval }`. Distinct from root-finding: minimizes
`f(x)` rather than solving `f(x) = 0`. If `bracket` is omitted, defaults to `[-10, 10]`. Defaults
`tol = 1e-8`, `maxIter = 100`. Pinned against closed-form minima: `(x-2)^2` → `x=2, f=0`;
`x^4 - 3x^3 + 2` on `[0,3]` → `x=2.25`; `sin(x)` on `[0,2pi]` → `x=3pi/2, f=-1`.

### Added — nonlinear system solver: `fsolve` / `root` (Phase 1 Task 3)

No solver existed for `F(x) = 0` where `F: ℝⁿ → ℝⁿ` (only scalar root-finders). Added
`fsolve(F, x0[, opts])` — damped Newton with a backtracking line search, reusing
`numericJacobian` (Task 1) for `J = numericJacobian(F, x)` and `linsolve` (`typed/numeric.ts`) to
solve the Newton step `J·Δ = −F(x)`. At each iterate, tries `λ ∈ {1, 1/2, 1/4, …}` (up to ~20
halvings) for the largest `λ` improving `‖F(x + λΔ)‖₂`, falling back to a full Newton step
(`λ = 1`) if none improves. Converges when `max_i |F_i(x)| < tol` (default `tol = 1e-10`,
`maxIter = 100`); throws a clear `Error` on a singular Jacobian or non-convergence. `root` is an
alias. Pinned against scipy.optimize.fsolve (`[x²−y, x+y−2]` from `[0.5,0.5]` → `[1,1]`;
`[x²+y²−25, x−y−1]` from `[5,1]` → `[4,3]`).

### Added — open scalar root-finders: `newton`, `secant`, `halley` (Phase 1 Task 2)

Only bracketing root-finding (`findRoot`, bisection/Brent) existed; added three classic open
(non-bracketing) scalar root-finders that iterate from a starting point instead of requiring a
sign-changing bracket: `newton(f, x0[, opts])` (Newton–Raphson, `x_{k+1} = x_k − f(x_k)/f'(x_k)`,
with an optional analytic `fprime` else a central-difference estimate), `secant(f, x0, x1[, opts])`
(no derivative required), and `halley(f, x0[, opts])` (`x_{k+1} = x_k − 2 f f' / (2 f'^2 − f f'')`,
cubic convergence, optional analytic `fprime`/`fprime2` else central differences). All default to
`tol = 1e-12`, `maxIter = 100`, and throw a clear `Error` on non-convergence or a (near-)zero
denominator/derivative. Pinned against √2, cbrt(2), and the cos(x)=x fixed point.

### Added — numeric Jacobian: `numericJacobian(f, x0)` + polymorphic `jacobian` (Phase 1 Task 1)

`jacobian` was symbolic-only (`jacobian(exprs, vars, scope)`) and threw `exprs.map is not a
function` when passed a numeric function. Added `numericJacobian(f, x0[, opts])` —
central-difference Jacobian of `f: ℝⁿ → ℝᵐ` (non-square OK; per-coordinate relative step
`h = max(1, |x0[j]|) * cbrt(2.22e-16)`) — and made `jacobian` polymorphic: when the first
argument is a function it dispatches to `numericJacobian`, leaving the symbolic
`jacobian(exprs, vars, scope)` path unchanged. Pinned against analytic Jacobians (square and
non-square). Foundation for numeric root-finding (`fsolve`, Phase 1 Task 3).

### Changed — corrected `betainc` documented argument order; annotated pass-through CAS/algebra transforms (docs honesty)

`betainc`'s implementation was always correct (`betainc(a, b, x)` = regularized incomplete beta
`I_x(a,b)`, scipy order; verified vs mpmath: `betainc(2,3,0.5)=0.6875`, `betainc(2,3,0.7)=0.9163`,
`betainc(1,1,0.3)=0.3`) but `docs/reference/functions.md` documented the signature as
`betainc(x, a, b)` — the wrong order. Corrected the doc and pinned the real order with a regression
test (`functions/tests/betainc-order.test.ts`).

Separately, probing the CAS/algebra transform functions on the built `dist/` found that
`factor`/`expand`/`apart`/`together` (and their CAS-layer counterparts `casFactor`/`casExpand`) are
currently **pass-through** — they return their input expression unchanged — despite being
documented with false worked examples (e.g. `factor('x^2 - 1') // '(x - 1)(x + 1)'`, which does not
happen). Annotated all six as `⚠️ pass-through (not yet implemented; planned)` in the Algebra/CAS
tables, replaced the false worked examples with their actual output, and softened overclaiming prose
(`factor` "works over the rationals", `apart`/`together` "are inverses"). Added a characterization
test (`functions/tests/cas-passthrough-documented.test.ts`) pinning current pass-through behavior so
a future Phase 8 implementation trips these tests and the docs get updated alongside the fix. No
implementation code changed — `betainc` needed no fix, and the transform functions are intentionally
out of scope here (full symbolic transforms are planned for Phase 8).

### Fixed — `linprog` could return an INFEASIBLE optimum on degenerate cases

The simplex iteration solved correctly, but the solution-extraction loop marked a structural
column "basic" whenever its tableau column had unit-vector shape, without enforcing a one-to-one
mapping between constraint rows and basic variables. On a degenerate optimum
(`linprog([-1,-1], [[1,1]], [1])` — minimize `-x-y` s.t. `x+y<=1`) both `x1`'s and `x2`'s columns
reduced to the unit vector on row 0, so both were marked basic and both read row 0's RHS (`1`),
returning `[1,1]` — which violates `x+y<=1` (scipy returns `[1,0]`, objective `-1`). Extraction now
tracks claimed constraint rows (excluding the objective row) and assigns each row to exactly one
basic variable, so the returned optimum is feasible; pinned vs scipy on the degenerate case above
plus a non-degenerate case (unchanged) and a second degenerate/redundant-constraint case. Equality
constraints, bounds, and status flags remain out of scope — planned for a later two-phase-simplex
rewrite.

### Fixed — `taylor`/`series`/`seriesCoefficient` produced garbage coefficients past ~order 3

All three computed the k-th derivative via a recursive finite-difference `numericalDerivative`,
whose error explodes with order — `taylor('sin(x)','x',0,7)`'s `x^7` coefficient came out as
`17209` instead of `-1/5040` (off by ~10⁷×), corrupting every term past cubic. Replaced with exact
Cauchy-integral coefficient extraction on a complex contour (`taylorCoefficients`, new private
helper in `functions/src/typed/cas.ts`), reusing the expression evaluator's existing complex
support (sin/cos/exp/log/sqrt/pow already have complex overloads) — machine-precise vs known
Maclaurin series (sin/cos/exp verified to 1e-9 at multiple points). `casDerivative` (the in-package
symbolic differentiator) was ruled out as the fix vehicle — it breaks on iteration past order 2 —
and no dependency on `@danielsimonjr/mathts-autograd` was added. `series` is unaffected code-wise
(it already delegated to `taylor`) and inherits the fix; `multivariateTaylor` is out of scope and
unchanged.

### Fixed — `summation`/`symbolicProduct` silently returned `0`/`1` on symbolic bounds

Both are finite counting loops (`for (let k=a; k<=b; k++)`); a non-numeric bound (e.g. `'n'`)
makes the loop condition (`k <= 'n'`) false immediately, so they silently returned the initial
accumulator — `summation('k', 'k', 1, 'n')` returned `0`, and the analogous call to
`symbolicProduct` returned `1` — instead of a wrong-answer error. Both now throw a clear error
when either bound is not a finite number. The `summation` doc comment no longer claims a
symbolic/closed-form (Faulhaber) fallback that never existed; closed-form summation is planned
for a later phase.

### Fixed — `stiffODESolver` diverged on stiff systems (fixed-point implicit Euler)

`stiffODESolver` was fixed-step implicit Euler solved by fixed-point iteration, which cannot
converge when `h·|∂f/∂y|` is large — exactly the stiff regime it targets: 71% error on
`y'=-15y` (`5.23e-7` vs the exact `e⁻¹⁵=3.06e-7`), and `null` on the stiff (`-1000`) mode of
`diag(-1,-1000)`. It now delegates to the proven L-stable Rosenbrock (ode23s) engine, which was
extracted from `createSolveODE`'s factory closure to a shared module-level `rosenbrockSolve`
(`functions/src/numeric/solveODE.ts`) so both `solveODE(..., {method:'Rosenbrock'})` and
`stiffODESolver` run the same one engine. Pinned: `y'=-15y → e⁻¹⁵`; `diag(-1,-1000)` fast mode
decays to `e⁻¹` with the stiff mode finite and ≈0.

### Fixed — `windowFunction` silently returned a rectangular window for unknown types

`windowFunction(n, type)`'s `switch` `default` case was shared with `'rectangular'`/`'rect'` and
filled the window with ones, so every unimplemented window type (`kaiser`/`tukey`/`gaussian`/
`blackmanharris`/…) silently returned a rectangular window instead of an error. `rectangular`/
`rect` now have their own explicit case; `default` throws `windowFunction: unknown window type
'<type>'`. Implementing the missing window types is a later phase.

### Fixed — `lambertW`'s documented `branch` argument was unimplemented

The docs promised `lambertW(x[, branch])` (`branch = 0` for the principal branch, `branch = -1`
for the lower real branch), but the implementation only accepted a single `number` — calling
`lambertW(-0.3, -1)` threw `Too many arguments in function lambertW (expected: 1, actual: 2)`.
Added `lambertWm1Scalar`, the lower branch W₋₁ (Halley's iteration seeded from the asymptotic
`ln(-x) - ln(-ln(-x))`, `x ∈ [-1/e, 0)`, `NaN` outside), and a `(number, number)` dispatch
signature. Principal branch unchanged. Pinned to mpmath: `W₋₁(-0.3) = -1.781337023421628`.

### Fixed — `invmod` threw on every call (`_BigNumber` invoked without `new`)

`invmod` threw `_BigNumber cannot be invoked without 'new'` on every call (class constructor
invoked without `new`); now uses numeric literals, restoring modular inverse for number and
BigNumber inputs (pinned by `invmod(3,11)=4`, `invmod(15151,15122)=10429`).

### Added — stiff ODE solver `solveODE(..., { method: 'Rosenbrock' })` (functionality)

`solveODE` had only explicit methods (RK23/RK45), which stall or blow up on stiff systems (chemical
kinetics, circuits, control — core engineering modeling). Added the linearly-implicit **ode23s**
Rosenbrock method (Shampine & Reichelt): 2nd-order, L-stable, adaptive (FD Jacobian + one LU solve of
`I−h·γ·J` per step). Verified vs a linear stiff system's exact solution and vs `scipy` BDF on stiff
Van der Pol (μ=1000). Plain-number state; RK45 stays the default for non-stiff problems.

### Fixed — `solveODE` was fully broken on its JS path; add initial-step selection (functionality)

`solveODE`'s JavaScript reference path threw `multiply(Array, Array) requires two 2-D matrices` on
every call — the RK stage combination used mathjs `multiply(h, a[i], k)` (vector·matrix semantics
MathTS's typed `multiply` rejects). It only stayed green because CI loads a WASM kernel; scalar ODEs
and WASM-less consumers always hit the broken path. Stages are now combined term-by-term via
scalar-broadcasting `multiply`/`add` (`stageCombo`), so scalar and vector systems both work (verified
vs closed forms: `y'=-y→e⁻¹`, logistic, harmonic oscillator, backward integration; RK23 + RK45). Also
added a Hairer initial-step heuristic (`h₀≈0.01·‖y0‖/‖f‖`) replacing the whole-interval first step,
which had let RK23 silently accept `1/3` instead of `e⁻¹` on `y'=-y`.

### Fixed — `zeta` negative arguments (~1.5e-7 → 1.9e-14) and `besselK` transition band

A fresh mpmath/SciPy sweep of the whole special-function + distribution surface found it
overwhelmingly machine-precision already (gamma/erf/digamma/elliptic/besselJ·I and every distribution
CDF/quantile, even deep in the tails — `normalCDF(-10)=7.6e-24` correct to 14 digits). Two fixes:
`zeta` at negative real `s` now reflects via the functional equation (the direct Borwein series
cancels for `Re(s)<0`), fixing `zeta(-3)` from 1.5e-7 off to ~1.9e-14; and `besselK`'s series→asymptotic
crossover moved to x=8, capping the transition-band peak from ~5.3e-9 to ~1.6e-9.

### Fixed — `variance` / `std` were ~10⁶× less accurate than NumPy on large-mean data

Continuing the audit: `variance`/`std` lost ~7 digits when the mean is large. Variance of
1e9-pedestal samples came out **relErr ~1e-7** where `np.var` is ~1e-13 and the exact value is
representable — the small deviations sit on a huge pedestal, so mean error rides into every squared
term. The public typed path used **Welford** (`m2OfArray`), the parallel path a **naive mean +
uncorrected two-pass**, and the factory/`std` paths naive **WASM** kernels.

New `sumSquaredDeviations` core primitive — the **corrected two-pass** `Σd² − (Σd)²/n` (pairwise
mean; the correction cancels the residual mean-bias exactly) — now backs every path (typed,
`ComputePool.variance`, factory, `std = √variance`); the naive WASM `statsVariance`/`statsStd` fast
paths are retired (also not faster — memory-bound). Now **machine-precision (relErr ~0), beating
NumPy**; verified against exact rationals and live NumPy. `std`/`zscore`/`corr` and every
variance-derived statistic inherit the fix.

### Fixed — `corr` returned |correlation| > 1, and a class of BigNumber correctness bugs

Continuing the NumPy/SciPy accuracy audit, `corr` was found returning **52** (mathematically
impossible) for a true correlation of **−1** on large-mean data. It used the one-pass computational
formula `n·ΣXY − ΣX·ΣY`, which catastrophically cancels — two ~1e28 quantities subtracted. Rewritten
to the stable **two-pass** form; now matches `np.corrcoef`. Pinned by the implementation-independent
invariant `|corr| ≤ 1`.

Chasing a reported `cumsum(BigNumber[])` crash uncovered a systematic incompatibility: the
mathjs-lineage factory layer assumed a **decimal.js BigNumber API** (`plus`/`minus`/`lte`/`gte`/
`eq`/`cmp`) that MathTS core's BigNumber does not implement (it uses `add`/`sub`/`lessThanOrEqual`/
`equals`/`compareTo`). Two root causes fixed:

- **Core** — BigNumber comparison methods (`equals`/`lessThan`/`lessThanOrEqual`/`greaterThan`/
  `greaterThanOrEqual`/`compareTo`) now **coerce a number/string argument** like `add`/`gt` do.
  Before, `bignumber(8).lessThanOrEqual(3)` returned `true`.
- **functions** — method-name fixes across `addScalar`, `subtractScalar`, `nearlyEqual`, `compare`,
  `smaller`/`smallerEq`/`largerEq`/`equalScalar`, `cumsum`, `quantileSeq`, `factorial`, `gamma`, and
  `isPrime` (whose Miller-Rabin path, and `gamma`'s factorial, also dropped an unnecessary decimal.js
  precision-clone — core is bigint-backed and exact). Plus a non-idempotent `bignumber()` conversion:
  `bignumber(aBigNumber)` returned `Infinity`. This restores `sort`/`median`/`min`/`max`/`cumsum`/
  `corr`/`quantileSeq`/`factorial`/`gamma`/`isPrime` on BigNumber inputs — all previously crashed or
  silently mis-ordered.

These BigNumber paths were previously **untested**, which is why they stayed broken under a green
suite; regression coverage added (`core/tests/bignumber-comparison-coercion.test.ts`,
`functions/tests/bignumber-operations.test.ts`). Verified against live NumPy 2.3.4; full functions
suite and core suite green.

### Added / Fixed — stable `dot`, `distance`, `cumsum` (NumPy/SciPy audit follow-up)

Continuation of the reduction-accuracy work below. Three new stable primitives in
`@danielsimonjr/mathts-core` (`core/src/numeric/stable.ts`), wired into every public path:

- **`dot`** summed naively (`s += aᵢ·bᵢ`) — measured ~18× worse than `np.dot` on an
  ill-conditioned dot (n = 10⁶, relErr 6.6e-15 vs 3.7e-16). New `pairwiseDot` closes it to NumPy
  parity for the same flop count; fixed on both the `number[]` and `Float64Array` paths.
- **`distance`** was `sqrt(Σ(aᵢ−bᵢ)²)` — the same square-before-sum bug as `norm`: `Infinity` for
  large inputs and a **silent `0`** for tiny ones. New `scaledDistance` (BLAS `dnrm2` over the
  difference) gives `2e200` / `2e-200` exactly where naive squaring — and NumPy's `linalg.norm` —
  give `inf` / `0`.
- **`cumsum`** accumulated naively like `np.cumsum` (relErr ~1.3e-11 over 10⁶ terms). A prefix scan
  is sequential so pairwise doesn't apply; new `neumaierCumsum` carries a running compensation for
  exact prefixes — a strict improvement over NumPy for a few extra flops per element.

Fixed on **every reachable layer**, not just the typed one. The public `distance`/`cumsum` a caller
imports resolve to the mathjs *factory* implementations (`geometry/distance.ts`,
`statistics/cumsum.ts`) — separate naive paths from the typed `parallelStat*` ones (the same
"wrong-layer" trap that first bit `sum`). A behavior probe against the built package confirmed the
gap (`distance([1e200]×4) → Infinity`, `cumsum` relErr `1.3e-11`) and the fix
(`2e200`, relErr `0`); both factory paths now route flat plain-number inputs through the stable
primitives, retiring two naive WASM scans that shared the overflow bug. `BigNumber`/`Complex`/
multi-dim paths are unchanged.

All three verified against live NumPy 2.3.4 / SciPy 1.17.1; pinned in `core/tests/stable.test.ts`
and `functions/tests/numeric-accuracy.test.ts` (typed and public-factory paths).

### Fixed — `sum` / `mean` were ~46,000× less accurate than NumPy

`sum` accumulated naively (`s += x`), so the running total grew large while the addends stayed
small and each addition rounded off a little more of it: error grows as **O(n)·ε**. NumPy uses
pairwise summation — error **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer 100000):

| accumulation | relative error |
| ------------ | -------------- |
| naive (what shipped) | **1.3e-11** |
| **pairwise (now)** | **2.9e-16** — identical to `np.sum` |
| `fsum` (new) | **0** — exact |

`mean`, `std` and `variance` all inherit `sum`'s error, so this was the largest accuracy defect in
the library. **Pairwise costs the same number of additions** — measured **1.03× faster** than the
naive loop (eight independent accumulators break the serial dependency chain). There was no
speed/accuracy trade to make; the naive version was simply worse.

Fixed on every path a caller can reach: `sum`/`mean` (`Array` and `Float64Array`),
`ComputePool.sum`, and the factory `sum`.

### Fixed — `norm(x, 2)` overflowed and underflowed (NumPy still does)

`sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. Now uses
LAPACK's `dnrm2` scaling:

```ts
norm([1e200, 1e200, 1e200, 1e200], 2);     // 2e200    (np.linalg.norm: inf + overflow warning)
norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0)
```

The **underflow** case was the dangerous one: it returned a plausible `0` rather than an obvious
`inf`.

### Added — `fsum(x)`, exactly-rounded summation (`math.fsum` equivalent)

Pairwise summation is accurate to ~machine epsilon and free, but it cannot recover a value that
catastrophic cancellation has already destroyed:

```ts
sum([1e16, 1, -1e16]);  // 0   (np.sum gives 0.0 too)
fsum([1e16, 1, -1e16]); // 1   (exact; math.fsum gives 1.0)
```

Neumaier compensation, ~2–4× slower, so opt-in. For conservation checks, residuals, and
long-running accumulators.

### Added — stable numeric primitives in `@danielsimonjr/mathts-core`

`pairwiseSum`, `neumaierSum`, `norm2` are exported directly. `@danielsimonjr/mathts-parallel` now
depends on `core` for them (0 new cycles) and uses them in `ComputePool`'s sequential reductions.

### Added — GPU FFT (Stockham autosort, f32); `parallelFFT` routes to it

Radix-2 **Stockham autosort**: *self-sorting*, so each pass scatters into a second buffer and the
output arrives in natural order with **no bit-reversal pass** (a pure memory shuffle is the one
thing a GPU is worst at). All log₂(n) passes ride in one encoder and one submit.

Measured against `fftCoreFloat64` — the flat f64 core `parallelFFT` runs on this thread — warm JIT,
Chrome / NVIDIA Pascal. Regenerate with `functions/tests/gpu-fft-bench.browser.test.ts`:

| n         | CPU f64  | GPU f32  | speedup   |
| --------- | -------- | -------- | --------- |
| 65,536    | 16.8 ms  | 14.4 ms  | 1.17×     |
| 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |
| 524,288   | 87.8 ms  | 30.5 ms  | **2.88×** |
| 1,048,576 | 253.1 ms | 79.7 ms  | **3.18×** |
| 2,097,152 | 399.9 ms | 116.3 ms | **3.44×** |

**~2.2–3.4× above the threshold.** The ratio is genuinely noisy run to run, so there is no single
hero number to quote. f32 error is ~4e-7 peak-relative even across 20 stages — error growth per
stage was the risk that could have killed this kernel, and Stockham turned out to be well-behaved.

**The FFT's threshold is 262,144, deliberately higher than `GPU_MIN_ELEMENTS` (65,536).** At 65,536
the GPU wins by only 1.17×: inside the noise, and nowhere near enough to trade f64 for f32. An FFT
makes log₂(n) passes over the data, so it amortises the upload more slowly than the memory-bound
element-wise chain does. Sharing one threshold would have been convenient and wrong.

`parallelFFT` / `parallelIFFT` use it when `enableGpu()` is on; with the flag off (the default) they
are bit-identical f64 — pinned by a test asserting the GPU-on result is f32-accurate **but not
f64-exact** (which is what proves the tier actually ran) while the GPU-off result is exact.

### Fixed — `parallelFFT` ignored its own benchmark-tuned threshold

`computePool.shouldParallelize(paddedLength)` was called **without the op name**, so
`DEFAULT_THRESHOLD_BY_OP`'s tuned `parallelFFT: 'never'` was never consulted and the global 50,000
threshold applied instead. Every transform above 50k silently took the four-step worker path — which
does not pay: **n=2¹⁸, 156 ms via workers vs 77 ms on this thread** (2× slower) in Chrome, and a wash
in Node. The tuned decision was right and simply never read.

This also means the first version of the GPU table in this entry was measured against a CPU path
`parallelFFT` never takes. Both are fixed.

### Changed — `serializeGpu` moved into `@danielsimonjr/mathts-gpu` (one shared queue)

The WebGPU error scope is a **per-device LIFO stack**: two dispatches in flight pop each other's
scope, and a real validation error then goes unobserved — returning a zero-filled buffer as a
plausible result (for an FFT, a silently empty spectrum). The queue belongs in the shared foundation,
not in one domain module: a per-module queue would not stop an element-wise dispatch racing an FFT
dispatch, and `Promise.all([fuseUnaryChainAsync(a), parallelFFT(b)])` is ordinary code. The cheap
gates run *outside* the queue, so a CPU-only `parallelFFT` never waits behind GPU work.

## [autograd 0.1.0] - 2026-05-15

> First release of the `@danielsimonjr/mathts-autograd` package — forward
> and reverse-mode automatic differentiation on rank-N Tensors. Built as
> the AD adapter for the UPT v0.4.0 connection-layer + AD backend. Repo
> tag: `mathts-autograd-v0.1.0`. Not yet published to npm (publish
> requires 2FA — deferred to a manual `npm publish`).

### Added

- `@danielsimonjr/mathts-autograd` package scaffold: forward + reverse-mode AD (Tasks 6/7 populate the implementation).
- `forwardGrad` + `DualTensor` in `@danielsimonjr/mathts-autograd`: dual-number forward-mode AD on rank-N Tensors, full Jacobian assembly (shape `[...y.shape, ...x.shape]`, row-major).
- `reverseGrad` + `Tape` + `TapedTensor` in `@danielsimonjr/mathts-autograd`: tape-based reverse-mode AD; `reverseGrad(fn, x, cotangent?)` returns `{ value, gradient }` with `gradient.shape = x.shape`.

## [tensor 0.1.0] - 2026-05-14

> First release of the `@danielsimonjr/mathts-tensor` package — a rank-N,
> `Float64Array`-backed dense tensor type with einsum/contraction. Built as
> the second `TensorEngine` implementation for the UPT v0.3.5
> numerical-contraction backend. Repo tag: `mathts-tensor-v0.1.0`.
> Not yet published to npm (publish requires 2FA — deferred to a manual
> `npm publish` / `changeset publish`).

### Added

- `@danielsimonjr/mathts-tensor` package: rank-N `Tensor` (storage, construction, elementwise, identity, normInf).
- `Tensor` einsum / matMul / transpose / reshape.

## [Security Release 2026-05-01] — expression@0.2.0, parallel@0.1.3, functions@0.1.3, wasm@0.1.3

> Repo-level tag: `security-2026-05-01` (HEAD `3ef899c`).
> Per-package tags follow the existing `@danielsimonjr/mathts-<pkg>@<version>` convention.
> Driving commits: `6e76d62` (expression sandbox — BREAKING),
> `862ae30` (parallel timeout — additive), `3ef899c` (WASM SHA-384 — additive).

### Security

- **functions, assembly**: WASM modules now verify a SHA-384 manifest
  before instantiation. The build step writes `wasm-manifest.json`
  beside the `.wasm` artefact (see `tools/generate-wasm-manifest.mjs`),
  and at load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against the manifest. A mismatch throws
  before any module is compiled or instantiated, blocking silent
  code-injection via tampered .wasm payloads. Affected files:
  - `functions/src/wasm/integrity.ts` (new helper module)
  - `functions/src/wasm/WasmLoader.ts:744,748,773,795,799` — both Node
    and browser load paths now verify; streaming compilation is bypassed
    when a manifest is present
  - `assembly/src/bindings/wasm-loader.ts:75,87,89` — `loadWasm()`
    verifies before compile in both fetch and `fs.readFileSync` paths
  - `tools/generate-wasm-manifest.mjs` (new build-time hashing script)
  - `functions/tests/security/wasm-integrity.test.ts` (5 tests)
    covering manifest load, untampered accept, tampered reject,
    soft-warn on missing manifest, and `{required: true}` fail-closed
- **parallel**: `WorkerPool.execute()` now accepts an optional
  `timeoutMs` argument (`parallel/src/WorkerPool.ts`). When the worker
  does not reply within `timeoutMs` the pool calls `worker.terminate()`,
  evicts the dead worker from its rosters, spawns a replacement so the
  pool's capacity is preserved, and rejects the returned promise with a
  `"Worker task timed out after Nms"` error. Pass `0` or omit the
  argument to keep the legacy untimed behaviour. Closes a DoS vector
  where a hung worker (e.g. infinite loop in user-supplied math code)
  would block the queue indefinitely. Adds
  `parallel/tests/WorkerPool.timeout.test.ts` (2 tests) covering
  timeout rejection and pool replacement.
- **expression**: Restored sandbox in the tree-walking compiler
  (`expression/src/compiler/compile.ts`). All five bypass sites now route
  through the existing `getSafeProperty` / `setSafeProperty` /
  `getSafeMethod` helpers in `expression/src/utils/customs.ts`:
  - `compileAccessorNode` — both property-name and computed-index forms
  - `compileAssignmentNode` — `obj.prop = …` lvalue writes
  - `compileObjectNode` — object-literal key assignment
  - `compileSymbolNode` / `compileFunctionNode` — math-namespace lookups
    use `Object.prototype.hasOwnProperty.call(math, name)` to skip
    prototype-chain names; method calls of shape `obj.method(…)` route
    through `getSafeMethod`.
- **expression**: Added pre-compile AST validator in
  `expression/src/evaluator/evaluate.ts`. By default `evaluate()` and
  `compileExpression()` reject `AssignmentNode`, `FunctionAssignmentNode`,
  and `FunctionNode` calls to forbidden builtins (`import`, `createUnit`,
  `evaluate`, `parse`, `compile`, `simplify`, `derivative`, `help`,
  `chain`). Hosts that need the legacy permissive behaviour can opt out
  with `{ unsafe: true }`. Blocklist mirrors `math-mcp/src/validation.ts`.
- **expression**: Added regression suite at
  `expression/tests/security/sandbox.test.ts` (13 tests) covering
  RCE chains (`arr.constructor.constructor("…")()`), prototype pollution
  (`__proto__` writes via assignment and ObjectNode literal), forbidden
  function calls, FunctionAssignmentNode rejection, and confirms safe
  paths still work (`2 + 3`, `arr.length`, etc.).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added

#### Matrix Operations (9 — completing all deferred matrix ops)
- characteristicPolynomial (Faddeev-LeVerrier), rowReduce (Gauss-Jordan RREF), matrixRank (via RREF)
- cholesky (L*L^T decomposition), hessenbergForm (Householder reduction)
- matrixPower (binary exponentiation + eigendecomposition for fractional)
- matrixLog (inverse scaling-and-squaring + Taylor series)
- polarDecomposition (via SVD: A = U*P), jordanForm (eigenvalue clustering + null space analysis)

#### Rust WASM Optimization — 72 high+medium-value functions accelerated
- Special functions (10 Rust): besselI/J/K/Y general order, betainc, ellipticE/K, lambertW, fresnelC/S + TS WASM dispatch
- Signal processing (9 Rust): dct/idct, dst/idst, dwt (Haar), hilbertTransform, spectrogram (STFT), periodogram (Welch), FIR filter + TS dispatch
- Numerical methods (12 Rust): minimize_quadratic, least_squares, levenberg_marquardt, condition_number, matrix_rank, bezier/bspline/loess/griddata/rbf interpolation, implicit_euler/rk4 ODE steps + TS dispatch
- Geometry (4 Rust): delaunayTriangulation (Bowyer-Watson), voronoiDiagram, kdTree build+nearest + TS dispatch with threshold=32
- SIMD array arithmetic (29 Rust): simd_add/sub/mul/div/abs/sqrt/exp/log/sin/cos arrays, sum/mean/min/max/variance/std/dot/norm/distance stats, polygon_area/manhattan/chebyshev/minkowski distances, trig arrays
- Interpolation + distributions (11 Rust): linear/cubic_spline/pchip/lagrange/poly_fit interpolation, normal_pdf/cdf, binomial/poisson/gamma PMFs

#### 190 New Functions — mathjs v15.4–15.6 Parity (Item 1 complete)
- Algebra (36): polyval, polyadd, polymul, polyder, polynomialGCD/LCM/Quotient/Remainder, degree, discriminant, differences, expand, factor, collect, substitute, variables, cancel, together, apart, trigExpand/Reduce, trigToExp, expToTrig, tangentLine, resultant, + 12 more
- Symbolic CAS (28): integrate, limit, taylor, solve, laplace/inverseLaplace, fourierSeries, zTransform, gradientSymbolic, jacobian, laplacian, divergence, curl, groebnerBasis, piecewise, odeGeneral, + 13 more
- Graph Theory (8): adjacencyMatrix, shortestPath, minimumSpanningTree, connectedComponents, stronglyConnectedComponents, topologicalSort, isConnected, graphDistance
- Number Theory (15): prime, nextPrime, primePi, primeFactors, divisors, eulerPhi, divisorSigma, carmichaelLambda, moebiusMu, jacobiSymbol, chineseRemainder, lucasL, partitions, harmonicNumber, integerDigits
- Distribution Objects (12): normalDist, betaDist, binomialDist, chiSquaredDist, exponentialDist, fDist, gammaDist, logNormalDist, poissonDist, tDist, uniformDist, weibullDist — each with .pdf/.cdf/.quantile/.mean/.variance/.sample
- Statistical Tests (7): studentTTest, chiSquareTest, anova, kolmogorovSmirnovTest, mannWhitneyTest, shapiroWilkTest, principalComponentAnalysis
- Numerical Methods (34): findRoot, minimize/maximize, linsolve, leastSquares, nintegrate, curvefit, expfit/logfit/powerfit, bezierCurve, bspline, loess, solveODESystem, stiffODESolver, solveBVP, cond, rank, + 18 more
- Signal Processing (19): dct/idct, dst/idst, dwt, fft2d, fourier/invFourier, hilbertTransform, spectrogram, periodogram, lowpass/highpass/bandpassFilter, resample, medfilt, windowFunction, convolve, correlate
- Extended Geometry (11): area, centroid, coordinateTransform, polygonPerimeter, manhattanDistance, chebyshevDistance, minkowskiDistance, delaunayTriangulation, voronoiDiagram, kdTree, nearestNeighbor
- Extended Special (20): besselI/J/K/Y (general order), betainc, gammaincp, ellipticE/K, chebyshevT, hermiteH, laguerreL, legendreP, lambertW, erfi, cosIntegral, sinIntegral, logIntegral, expIntegralEi, fresnelC/S
- 557 new tests, 36+ embedded doc files

#### Rust WASM Migration
- 192 AS-compatible wrapper functions added to Rust WASM crate (`wasm-rust/crates/mathts-wasm/src/compat/`):
  - `scalar.rs`: 42 scalar ops (add_f64, sin_f64, sqrt_f64, etc.)
  - `array.rs`: 36 array ops (array_add, array_dot, array_norm, etc.)
  - `complex.rs`: 75 complex ops (complex_add, complex_sin, complex_array_fft, etc.)
  - `matrix.rs`: 39 matrix ops (matrix_multiply, matrix_transpose, matrix_trace, etc.)
- Rust WASM binary now exports 1,017 functions (was 741) — full AS parity
- BackendManager already prefers Rust WASM for heavy ops (FFT, eig, SVD)
- Build script: `wasm-rust/scripts/build-for-mathts.sh`
- WASM backend comparison benchmark (`tests/benchmark/wasm-comparison.test.ts`)

#### New Math Functions (60 — beyond mathjs)
- Special functions (8): erfc, beta, gammainc (incomplete gamma), digamma, besselJ0, besselJ1, besselY0, besselY1
- Probability distributions (10): normalPDF, normalCDF, exponentialPDF, exponentialCDF, poissonPMF, binomialPMF, geometricPMF, bernoulliPMF, entropy, jsDivergence
- Numerical integration (4): trapz, simpson, gaussQuad (Gauss-Legendre), romberg (adaptive)
- Interpolation (6): linearInterp, lagrangeInterp, cubicSpline, hermiteInterp, pchipInterp, polyFit
- Extended combinatorics (6): fibonacci (fast doubling), lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial
- Geometry (18): angle2D/3D, cross3D, dot3D, triangleArea, polygonArea, convexHull (Andrew's monotone chain), pointInPolygon (ray casting), rotateVector2D/3D (Rodrigues), reflectVector, projectVector, distance2D/3D/ND, distancePointToLine2D, intersectLines2D, intersectSegments2D
- Signal processing (4): crossCorrelation, autoCorrelation, groupDelay, unwrapPhase
- Statistics selection (4): quickSelect (Hoare's O(n)), medianSelect, minSelect, maxSelect
- 56 embedded doc files for all new functions
- 260 new tests covering all functions against known reference values

#### Core Types & Type System
- 22 math methods on BigNumber: trig (sin, cos, tan, asin, acos, atan), hyperbolic (sinh, cosh, tanh, asinh, acosh, atanh), transcendental (exp, ln, log10, log2, cbrt, expm1), other (mod, log1p, atan2, hypot) — all pure BigNumber arithmetic with Taylor series
- Instance `compare()` method on BigNumber and Fraction (delegates to `compareTo()`)
- Type compatibility bridge (`registerNativeTypes()`) — adds `isComplex`, `isFraction`, `isBigNumber` duck-typing markers to native type prototypes
- Typed-function bridge (`initTypeBridge()`) enabling synced mathjs factories to recognize native MathTS types
- 6 inverse trig methods on AssemblyScript Complex class (asin, acos, atan, asinh, acosh, atanh)

#### Factory Activation System
- Factory activation infrastructure: shared scope (`functions/src/factories/scope.ts`), barrel export (`functions/src/factories/index.ts`)
- 242/273 mathjs factories activated across 18 tiers (89%):
  - Tier 1 (69): leaf factories — abs, sin, cos, sqrt, erf, combinations, etc.
  - Tier 2 (13): inter-factory deps — divideScalar, dot, mode, isZero, bin/hex/oct, etc.
  - Tier 3 (14): matrix factories — transpose, identity, zeros, ones, diag, det, trace, kron, etc.
  - Tiers 4-9 (73): equal, compare, larger, smaller, gcd, lcm, mod, pow, ceil, floor, inv, pinv, qr, concat, subset, range, sort, factorial, gamma, permutations, bellNumbers, stirlingS2
  - Tiers 10-18 (67): subtract, divide, simplify, derivative, rationalize, eigs, fft/ifft, mean/median/variance/std, all set operations, solveODE, Chain/Unit, sqrtm, norm, cross, diff
- Remaining 31 factories are infrastructure types already provided by @danielsimonjr/mathts-core
- Expression node constructors (all 16 types) injected into factory scope for full AST support
- Index and Range stub types registered in typed-function for subset/range factory activation

#### Matrix & WASM
- Matrix compatibility bridge (`MathJSDenseMatrix`) — adapts native DenseMatrix to mathjs `._data`/`._size`/`.storage()` interface
- Real SparseMatrix bridge with CSC (Compressed Sparse Column) storage — `_values`, `_index`, `_ptr` with get/set, map, forEach, resize, diagonal, row swap
- WASM-accelerated FFT (`matrix/src/backends/wasm/fft-wasm.ts`) — Cooley-Tukey radix-2 with Rust WASM acceleration path, JS fallback, spectral analysis utilities
- WASM-accelerated eigendecomposition (`matrix/src/operations/eig-wasm.ts`) — Rust WASM Jacobi for symmetric matrices, JS QR fallback
- WASM-accelerated SVD (`matrix/src/operations/svd-wasm.ts`) — derives from eigendecomposition for symmetric matrices, Golub-Reinsch JS fallback
- Rust WASM backend integration: `RustWasmLoader` singleton with bump allocator, `RustWASMBackend` implementing MatrixBackend, BackendManager routing heavy ops (FFT, eig, SVD) to Rust WASM
- Parallel FFT (`parallel/src/operations/fft.ts`) — threshold-based parallel dispatch, auto-padding, parallel convolution
- Parallel eigendecomposition (`parallel/src/operations/eig.ts`) — inlined QR algorithm (avoids circular deps), ParallelResult wrapper

#### Expression & Evaluation
- Expression compiler (`expression/src/compiler/compile.ts`) — tree-walking AST interpreter handling all 16 node types
- Expression evaluator (`expression/src/evaluator/evaluate.ts`) — `createEvaluate()` factory for `evaluate(expr, scope)` API
- `evaluate()` function wired to activated factory scope — `evaluate('sin(pi/2)')` works end-to-end
- `parse()` bootstrapped from expression node factories through dependency-ordered scope injection
- `compileExpr()` for reusable compiled expressions
- Workbook `executeCode()` implementation using Function constructor with scope injection

#### typed-function & workerpool Improvements
- typed-function: Symbol-based type identification (`TYPED_FUNCTION_TYPE`) — survives esbuild/minification
- typed-function: Safe conversions (`createSafeConversion`) — prevents "cannot invoke without new" errors
- typed-function: Robust multi-strategy type tests (`createRobustTypeTest`) — symbol → property → prototype fallback
- workerpool: SharedArrayBuffer helpers and Transferable support for zero-copy transfer
- workerpool: Eager worker initialization (`warmup()`) with `pool.ready` promise
- workerpool: Enhanced metrics (`enhancedStats()` with p95, throughput, workerUtilization)

#### Build & Publishing
- npm publishing setup — all 10 packages have `publishConfig`, `files`, `repository`
- Production build optimization (`build:prod`) — minified + tree-shaken bundles, 57% size reduction (1524 KB → 662 KB)
- Package scope rename: `@mathts/*` → `@danielsimonjr/mathts-*` for npm publishing under personal scope
- Root `release` script via changesets

#### Testing & Documentation
- Performance regression test suite (`tests/benchmark/performance.test.ts`) — 23 benchmarks covering Complex, BigNumber, Fraction, DenseMatrix, typed dispatch, factory functions
- Parallel operation benchmarks (`parallel/tests/benchmark.test.ts`) — 18 tests covering elementwise, reduce, matmul
- `vitest.config.ts` added for functions, parallel, workbook, packages/typed-function, packages/workerpool
- `@types/node` added to all 7 workspace package devDependencies
- 5 synced mathjs files: constants.ts, factoriesAny.ts, factoriesNumber.ts, defaultInstance.ts, shared/types.ts
- Codebase inventory tooling (tools/codebase-inventory.json, tools/build-mathts-inventory.py, tools/scan_missing.py, tools/inventory.py)
- Full codebase inventory reports (docs/inventory/00-05)
- Integration plan and priority status tracker
- Architecture docs updated (ARCHITECTURE.md, API.md, DATAFLOW.md, OVERVIEW.md)
- Per-package dependency graphs regenerated for all 9 packages (+ new: expression, assembly)
- User-facing documentation modeled after mathjs:
  - `docs/datatypes/` (7 files): numbers, complex, fractions, bignumbers, matrices, bigints
  - `docs/expressions/` (6 files): syntax, parsing, algebra, security, expression trees
  - `docs/core/` (4 files): configuration, extension, serialization
  - `docs/reference/` (4 files): classes, constants, functions
- README.md updated with v0.1.2 capabilities: evaluate(), 242 factories, dual WASM, bundle sizes

### Changed
- Synced mathjs factory code uses correct import paths (./function/ prefix stripped, depth-agnostic ../ reduction)
- functions/src/typed: renamed .neg() → .negate(), .reciprocal() → .inverse(), .div() → .divide() to match core type APIs
- factoriesAny.ts/factoriesNumber.ts: stripped 287 broken ./function/ import prefixes
- expression/ package: build enabled (was echo-skip), tsconfig added, shared utils copied, 60+ import paths fixed
- assembly/ WASM: prefixed 114 bare math calls with Math., fixed abort path, fixed complex_pow(→powReal)
- matrix/WASMBackend: fixed SIMD method names (addSIMD→simdAddF64, etc.)
- parallel/tsconfig: workerpool type stub replaces raw .ts source resolution
- matrix/tsconfig, compat/tsconfig: added workerpool path override

### Fixed
- besselI_wasm: sign correction `(-1)^n` for negative x with odd order n
- erfc Rust WASM: replaced `1-erf(x)` with direct Abramowitz & Stegun computation (catastrophic cancellation for large x)
- standardNormalCDF: divide x by √2 before erf (was computing Φ(x√2) instead of Φ(x))
- Delaunay in_circumcircle: orientation-independent determinant test (was assuming CCW winding, Edge::new destroys winding order)
- special.ts WASM dispatch: disabled getRustWasm() — was using `.exports` (doesn't exist on RustWasmLoader) and `require()` in ESM package
- next_power_of_2(0): guard against usize underflow in signal processing WASM
- exponential() Rust WASM: guard against lambda≤0 division by zero
- partialDerivative export collision: renamed algebra.ts version to symbolicPartialDerivative
- curvefit LM convergence: compute cost change before updating prevCost
- PCA explained variance: uses trace(cov) instead of sum of extracted eigenvalues when k < p
- factor/collect: normalize subtraction before splitting on +
- binomialDist PDF: handle degenerate p=0 and p=1 (was NaN from 0*log(0))
- adjacencyMatrix docstring: fixed example matrix
- BigNumber.exp() overflow: `2**k` → `BigNumber.fromNumber(2).pow(k)` for large inputs
- WASMBackend SIMD argument order: swapped resultPtr/length in 7 operations (add, subtract, mul, scale, abs, negate)
- WASMBackend divideElementwise: was calling multiply — now delegates to JS backend
- WASMBackend QR decomposition: was reading R from unwritten buffer — now reads from in-place aAlloc
- eig-wasm memory leak: added try/finally to free WASM allocations in eigWasm and spectralRadiusWasm
- parallelIFFT: removed wasteful forward FFT call, reports honest metadata
- SparseMatrix _swapRows: splice-insert at sorted position instead of overwriting index (maintains CSC invariant)
- factoryScope.add/multiply: upgraded from scalar stubs to full typed implementations after tier 12
- workerpool canUseSharedMemory(): added crossOriginIsolated check for browser environments
- workerpool _recordExecution(): single performance.now() snapshot prevents timestamp inconsistency
- typed-function dep in functions/package.json: npm registry → github fork
- turbo.json test tasks: `"dependsOn": ["build"]` → `["^build"]` for correct upstream ordering
- Package.json consistency: workbook directory path, assembly author/URL, compat author/URL/dev deps
- Tests using BigNumber private constructor → public fromNumber/parse
- Removed duplicate factoryScope injections (map, conj)
- All 10 packages now build (was 9/10 — assembly WASM was broken)
- All 14 typecheck tasks now pass (was 9/14 — parallel, matrix, compat, expression, functions failed)
- assembly/ WASM build: 64 errors → 0 (Math. prefix, abort path, missing Complex methods)
- parallel/ typecheck: workerpool raw .ts source resolution → type stub
- expression/ typecheck: removed unnecessary embeddedDocs exclusion
- functions/ typecheck: re-enabled (was echo-skip), fixed 35 type errors
- workbook executor: executeCode() implemented (was throwing "not yet implemented")
- ParallelMatrix test: added missing beforeAll/afterAll vitest imports

## [0.1.0] - 2026-02-06

### Added
- Initial project structure with monorepo setup (npm workspaces + Turborepo)
- @danielsimonjr/mathts-core: Complex, Fraction, BigNumber types, TypeRegistry, factory system
- @danielsimonjr/mathts-matrix: DenseMatrix, SparseMatrix, JS/WASM/GPU backends, BackendManager
- @danielsimonjr/mathts-functions: typed arithmetic, trigonometry, statistics, signal processing
- @danielsimonjr/mathts-parallel: ComputePool, WebWorker parallelization, threshold strategies
- @danielsimonjr/mathts-compat: mathjs-compatible `create(all)` API with 54 shim functions
- @danielsimonjr/mathts-workbook: .mtsw notebook runtime with dependency graph and reactive execution
- @danielsimonjr/mathts-wasm: AssemblyScript WASM operations (scalar, array, complex, matrix)
- @danielsimonjr/mathts-typed-function: forked type dispatch system
- @danielsimonjr/mathts-workerpool: forked worker pool management
- TypeScript configuration with project references and strict mode
- GitHub Actions CI/CD workflows
- Comprehensive test suite with 1,342 passing tests across 51 files
- Integration tests for cross-package operations
- API documentation for all packages (docs/api/)
- Migration guide from mathjs (docs/migration/)
- Example projects (examples/)
- Getting Started and Advanced Usage guides

[0.1.2]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0
