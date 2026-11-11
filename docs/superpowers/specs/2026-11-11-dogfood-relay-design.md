# MathTS persona-dogfood relay — design

Date: 2026-11-11  
Scope: 139 open GitHub issues labeled `dogfood` (13 P0, 68 P1, 58 P2).  
This spec is the grouping and policy document. Implementation lives in `docs/superpowers/plans/2026-11-11-dogfood-relay-plan.md`.

## Verification (2026-11-11, `main`)

Every issue body was read with `gh issue view N -R danielsimonjr/MathTS`. Claimed repros were checked against current source, not npm tarballs.

**Already fixed on `main`:** none of the 139. All P0s still match source (CFL empty branch, `number()` reading `.im` on null, `svd` treating DenseMatrix as `number[][]`, `fsolve` iterating a scalar residual, `TapedTensor.add` `checkSameShape`, private `BigNumber` constructor, compat `Math.asin` shims, `solvePDE` silent `r > 0.5`).

**Duplicates (keep open; one PR closes all):** shared-root, not invalid.

| Cluster                   | Issues                           | Shared root                                               |
| ------------------------- | -------------------------------- | --------------------------------------------------------- |
| Unit in trig              | #727 #834                        | typed `sin`/`cos` have no Unit signature                  |
| Complex promotion         | #728 #729                        | JS `Math.*` paths; compat shims override functions        |
| Thin parse/eval packages  | #715 #796                        | `createParse`/`compileExpression` need a factory instance |
| TypedFunction `unknown`   | #737 #785 #726 (evaluate typing) | `SignatureImpl` / index signatures                        |
| ComputePool sin           | #710 #758                        | `thresholdByOp` / `forceParallel` chunking                |
| FFT dual API              | #706 #774                        | factory `fft` vs `parallelFFT`                            |
| GPU status `error`        | #759 #835                        | `GPUContext.status` on missing adapter                    |
| Parser factories + README | #715 #793 #725                   | public path is `functions.parse` / `evaluate`             |

**Invalid:** none. Intentional product constraints (ESM-only, WASM dispatch policy, f64 Tensor) are still dogfood bugs: the README or API lies. Fix docs and/or the API; do not close as wontfix from this relay unless the issue's own acceptance criteria allow a docs-only close.

## Grouping rules

1. One PR = one root-cause cluster (shared file, type, or dispatch table). Do not mix packaging LICENSE with PDE CFL.
2. Order: any group that contains a **P0** first (G01–G11), then remaining **P1** groups, then **P2**. A **P1 issue must not sit only in a P2 group**.
3. A group that is mostly P2 but shares a P0 root stays in the P0 wave (e.g. #813 with #807).
4. Breaking API changes are allowed only when the issue's acceptance criteria require it, the package is pre-1.0, and the PR changeset is **minor** with the old/new behavior named.
5. Do not close a perf issue by special-casing the repro size. Re-measure with the A/B rules in `AGENTS.md`. A documented-cost acceptance criterion may close the issue when a fresh bench is inside noise.

## Reviewer corrections (2026-11-11, grok-4.7)

Checked cited file:line on this branch (same tree as `main` for these paths). Coverage of the 139 open `dogfood` issues stays exact (each issue in one group).

- **G01:** `functions` `asin`/`acos` already return `Complex` outside `[-1,1]` (`trigonometry.ts`). #728 is the compat shim at `shims.ts:242` installed by `compat/src/index.ts`. #729 is `log`/`pow`/`nthRoot`/`acosh` number kernels. Do not promote `nthRoot` via "Math returned NaN".
- **G02:** `multiplyScalar` already lists `Complex, Unit`. The public `multiply` in `typed/arithmetic.ts` does not, so the variadic `any, any, ...any` reports "Too few arguments".
- **G08:** `add(1)` throws "different Tapes" because `assertSameTape` runs before any scalar overload (`tape.ts:508-510`).
- **G09:** Oracle is `ttest_1samp([1..10], 5.5)` → statistic 0, p = 1, df = 9. A number is not a length-1 sample: `undefined < 2` is false, so the short-sample throw is skipped.
- **G10:** `solvePDE`'s empty `if (r > 0.5)` is the CFL bug. `solveParabolicPDE` is a different MOL/BDF solver; `bcLeft: 0` hits `.value` with no shape check. Do not replace `solvePDE` with a redirect.
- **G11–G07, G03–G06** cited lines match.
- **Grouping:** #690 and #832 join G21 (`solve` / `integrate`). #709 joins G12. #692 is G34 (P1). #772 is G35 (P1), not G30. #820 joins G28. Tensor surface beyond the constructor bugs is G36, before G13.

## Builder rules (normative)

Copied into the plan. Reviewers reject a PR that violates them.

- Fix the **root cause** (the type/dispatch/kernel), not a one-call wrapper.
- TDD: failing test that is the issue's **exact repro**, then fix, then green.
- Never skip tests, raise timeouts, or weaken assertions.
- Every PR body lists `Fixes #N` for each issue it actually resolves.
- No force-push, rebase, amend, or `--no-verify`.
- Never commit repo-tools JSON dumps (`dependency-graph.json` churn, file-inventory dumps, persona JSON).
- Keep Compile & Lint docs steps green: `bun run docs:functions:check`, `bun run docs:deps:test`, `bun run check:browser-safety`. If a public export or README sample changes, update generated docs via the existing generator, do not hand-edit `docs/api/` indexes.
- After editing a dependency package, rebuild it before downstream tests (`bunx turbo test --filter=…` so `^build` runs).
- After the PR is open, poll `gh pr checks <PR> --watch`. Do not end the run while checks are pending. Do not merge.
- Do not set `RELEASES_ENABLED`. Do not tag or publish.
- Conventional Commits. Changeset per published-package behavior change.

## Out of scope for a single builder PR

- Wiring the WASM FFT or public `sin` to WASM against `functions/src/wasm/policy.ts` (see #711).
- Enabling GPU by default.
- mathjs v15 full drop-in (the migration guide must stop claiming it until G16 lands).
