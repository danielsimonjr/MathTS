# MEMORY.md — MathTS institutional knowledge

Durable, high-signal context for anyone (human or AI) picking up this repo. Complements — does not
duplicate — `CLAUDE.md`/`AGENTS.md` (build/test/structure/rules) and `TODO.md` (live task tracker).
Keep it **terse**: every line costs context on every session. Detail lives in the linked docs.

---

## Current state (2026-07-16)

MathTS is a 24-package npm-workspaces monorepo (Turborepo, ESM-only, ES2022, `tsup`, `vitest`,
Changesets). Goal: **the best numerical-computing TypeScript library** for students, hobbyists,
research, and engineering — measured against numpy / scipy / mpmath / sklearn / statsmodels /
networkx / sympy / MATLAB.

**The Oracle-Gap Roadmap (Phases 0–8) is ✅ COMPLETE** — `@danielsimonjr/mathts-functions@0.28.0 →
0.36.0`, ~44 tasks, executed subagent-driven, every value oracle-pinned and verified in the published
npm tarball. What that added, phase by phase:

| Phase                          | Release | Surface                                                                                                                             |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0 Correctness & honesty        | 0.28.0  | Fixed wrong-answer bugs (linprog infeasible, taylor garbage, invmod/lambertW/stiffODESolver, silent signal/summation) + doc honesty |
| 1 Foundational primitives      | 0.29.0  | `numericJacobian`, `newton`/`secant`/`halley`, `fsolve`, `minimizeScalar`, adaptive `quad`, `svd`/`orth`                            |
| 2 Optimization core            | 0.30.0  | `bfgs`, `nnls`/`lsqBounded`, two-phase `linprog`                                                                                    |
| 3 Regression & ML              | 0.31.0  | `ols`+inference, ridge/lasso/elasticNet, `logisticRegression`, `dbscan`+kNN, `gaussianKDE`, χ²-contingency + multiple-testing       |
| 4 Statistics inference         | 0.32.0  | MLE `fitDistribution`, exact Mann–Whitney p, `pacf`/`ljungBox`/`adfuller`, noncentral CDFs, circular stats                          |
| 5 Special fns & number theory  | 0.33.0  | `pFq` hypergeometric, `polygamma`, Jacobi elliptic, `rootsLegendre`, continuedFraction/discreteLog/generators                       |
| 6 Signal processing            | 0.34.0  | rfft/fftshift, exact cheby/ellip filter design + `butter` btype, wavelets, STFT, `findPeaks`                                        |
| 7 Advanced linalg              | 0.35.0  | Krylov `cg`/`gmres`, `eigsh`, structured solvers, `funm`/`cosm`/`sinm`, `care`/`dare`                                               |
| 8 Graph/geometry/CAS/intervals | 0.36.0  | graph algorithms, quaternion/procrustes, N-D `interpn`, `interval`, real `expand`/`factor`/`apart`/`together`                       |

Full inventory + measured gaps: [`docs/roadmap/ORACLE_GAP_INVENTORY_2026-07-15.md`](docs/roadmap/ORACLE_GAP_INVENTORY_2026-07-15.md).
Per-phase implementation plans: `docs/superpowers/plans/2026-07-1{5,6}-phase*.md`. Pending follow-ups
(additive, non-blocking): the "Pending / follow-ups" list in [`TODO.md`](TODO.md).

---

## Load-bearing lessons (the ones that bite)

- **Measure the symbol a consumer actually imports.** MathTS has had **multiple implementations of the
  same public name** (three `fft`s; `sum`/`distance`/`cumsum` each existed in typed + factory + compat
  layers). A fix to the wrong layer looks done but changes nothing. **Probe the built `dist/` and
  confirm the exact object before/after.** This trap recurred across the whole roadmap.
- **Verify a reported bug before "fixing" it (RFL Rule 4).** The gap-survey agents mis-probed
  `betainc` (correct — signature is `(a,b,x)`, they passed x=3 out of range), `butter`/`firwin`
  (documented lowpass/scalar-only, not bugs). A blind fix would have broken every distribution CDF.
  Likewise, re-probe with the correct signature/args (e.g. `stiffODESolver` is `(f, y0, tspan)`).
- **Oracle-pin to an implementation-independent reference, never a round-trip.** numpy/scipy/mpmath/
  sympy/sklearn/statsmodels/networkx are installed — run `python -c "..."` to get the number, don't
  recall it. Hand-computed oracles get errors too (durbinWatson=10/3 not 4; maxFlow=5 not 4 — caught
  by implementers, not me).
- **Tests import built `dist/`, not `src/`.** Rebuild the package (`npx turbo build --filter=…`) before
  running its `vitest`, or use `npm run test` (through turbo). A stale `dist/` = false pass/fail.
- **New public exports must be added to the curated table in `docs/reference/functions.md`** — a
  `docs-reference-completeness.test.ts` gate fails otherwise. Then regenerate with `npm run docs:functions`
  and `npm run docs:deps`. Generated docs are generator-owned; never hand-edit.
- **The pre-commit hook is slow** (build:wasm + docs:deps + lint-staged/prettier). Allow ~540000ms on
  `git commit`. It also regenerates and folds `docs/Architecture/*` + `functions.md`-family files into
  the commit — expected, not scope creep.
- **`matrix.svd` is synchronous** (returns `{U,S,V,rank}`, not a Promise). **`matrix.eig` returns only
  REAL eigenvector columns** — it zeroes complex-conjugate-pair eigenvectors (forced `care` to use the
  matrix-sign-function method; a real fix is a logged follow-up).
- **BigNumber** is first-party in `core` (bigint-backed): use `add`/`sub`/`lessThanOrEqual`/`equals`/
  `compareTo`, NOT decimal.js `plus`/`minus`/`lte`/`eq`; private constructor → `fromNumber`/`parse`.

## Release discipline

Per-phase (or per coherent change): changeset (`functions` minor for additive, patch for fixes) →
`changeset version` → build → full `functions` suite + monorepo typecheck + eslint green → commit +
push → `changeset publish` → push tags → **verify the published tarball** (`npm view … version` +
clean install in a temp dir + probe). `main` is direct-push; verify local==remote after each push.
npm can lag ~30–60s after publish before `npm view` reflects it. Publishing needs npm auth (Daniel is
logged in as `danielsimonjr`).

## Forked dependencies

`typed-function` and `workerpool` are **already standalone forks** — local at
`~/danie/github/{typed-function,workerpool}`, remote at `github.com/danielsimonjr/{typed-function,
workerpool}` — consumed by the wrapper packages under `packages/` via bare `github:` refs. Daniel
granted (2026-07-16) standing authority to manage/publish them without per-change approval. Two
publishes are pending his go (`typed-function@5.0.0-alpha.3`; `workerpool` types-fix on an unmerged
branch); first-party integration is unblocked but an ADR-level call. See `TODO.md` → "Forked
dependency libs".

## Where to look

- **Charter/rules:** `CLAUDE.md` → `AGENTS.md` (repo); `~/Github/AGENTS.md` (workspace); `~/AGENTS.md` (machine).
- **Build/test/structure:** `Mathts/CLAUDE.md` (the full monorepo reference).
- **Live tasks + pending work:** `TODO.md`. **Change history:** `CHANGELOG.md` (running `[Unreleased]`).
- **Public API:** `docs/reference/functions.md` (curated, ~1012 exports across 27 domains).
- **Dependency graph:** `npm run docs:graph -- <query>` (QDG) over `docs/Architecture/dependency-graph.json`.
- **Security invariants (do not regress):** WASM SHA-384 manifest verification; expression sandbox
  helpers (`getSafeProperty`/`setSafeProperty`/`getSafeMethod`); WorkerPool timeout plumbing. See
  `Mathts/CLAUDE.md` → "Security Invariants".
