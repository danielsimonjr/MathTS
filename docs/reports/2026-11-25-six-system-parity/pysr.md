> **In-repo archive** of the pysr deep parity review, produced on 2026-11-25
> (America/Chicago). MathTS commit at review time:
> [`e09eb301570b`](https://github.com/danielsimonjr/MathTS/commit/e09eb301570bbd18fbade0cdb4984a73bffafb54)
> (2026-11-25 07:41 CT).
> Related: issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713),
> tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).
> Sibling reviews and the merged report live in this folder; pass 1 is
> [2026-11-25-six-system-parity-review.md](../2026-11-25-six-system-parity-review.md).
> Imported data: [inventory](data/pysr-inventory.csv), [mapping](data/pysr-mapping.csv).
> Runtime harnesses, scripts, scratch, and vendored clones from the original
> working copy were not imported. Local paths have been rewritten to
> repo-relative links. Findings are otherwise unchanged.

# Deep parity review: MathTS symbolic regression vs PySR

## Versions and sources

- **Reference:** PySR **2.7.3** (the latest on PyPI on 2026-11-25), with SymbolicRegression.jl **2.7.2** on Julia **1.13.4** through juliacall 0.9.36. **It installed and ran.** Pass 1 most likely hung on a stale `julia_env/lock.pid` in the shared venv. A fresh venv at `deep/pysr/venv` resolved and precompiled in about 90 s. Each PySR process then needs about 30 s of JIT warm-up (measured 29.1–30.0 s). Docker was not needed and is not installed.
- **MathTS:** my own clone at `deep/pysr/mathts`, master **`e09eb301570bbd18fbade0cdb4984a73bffafb54`** (2026-11-25 07:41 CT, "docs: mathjs 15.3.0 parity fix plan (#1591)"). Built with `bun install --frozen-lockfile && bun run build` (exit 0). Bun 1.4.x and Node v24.22.1.
- **Inventory sources:** I introspected the installed package. That covers `inspect.signature(PySRRegressor.__init__)` (108 options), the `fit` signature, the docstring, `pysr/param_groupings.yml` for areas, `pysr.__all__`, `export_sympy.sympy_mappings` (58 operators) and `names(SymbolicRegression)` through juliacall (23 losses and the Julia API). Custom operators and losses come from https://ai.damtp.cam.ac.uk/pysr/operators/ and /api/.
- **MathTS SR surface:** `functions/src/{scalar-search,scalar-mutate,fit-scalar,pareto-front,front-export,scalar-node-bridge,scalar-compile,scalar-dimension}.ts` and `expression/src/{scalar-builder,scalar-enumerate,scalar-structure}.ts`. I also read `docs/reference/scalar-search.md` (which includes the SR-17 walkthrough), `docs/plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md` (SR-1…17) and `examples/scalar-search.ts`. The example reproduces the seed-7 pin exactly.

## Method

1. [`inventory.csv`](data/pysr-inventory.csv) has **307** PySR items: 108 options, 7 `fit` arguments, 20 methods, 10 fitted attributes, 8 front columns, 3 selection modes, 32 module exports, 58 built-in operators plus 2 custom-operator rows, 26 losses, 12 runtime features and 18 Julia API names. `scripts/inventory.py` regenerates it.
2. [`mapping.csv`](data/pysr-mapping.csv) maps each item to a MathTS status, location, option gaps, priority and verification level, and `scripts/mapping.py` regenerates it. Every "missing" claim is backed by two methods: a source grep, plus either a runtime rejection (the builder throws, or `loss` gets a RangeError) or a scan of all 1,514 runtime barrel exports (`verify/missing_export_scan.json`).
3. **Runtime checks** (`verify/`):
   - `probes.ts` → `probes.json` runs 47 option and feature probes against a live `runScalarSearch`, checking recomputed losses, constraint violations, RangeError wiring, determinism and parallel == serial.
   - `check_ops.py` → `operators.md` compares all 58 PySR operators: values against numpy (relative tolerance 1e-15) and domain masks against PySR's NaN-on-domain-error semantics.
   - `modelsel_diff.ts` runs MathTS `paretoFront`/`scoreFront`/`selectFrontModel('best')` on PySR's own 28 fronts and compares the pick with PySR's `get_best()`.
   - `pysr_ref_checks.py` covers PySR's Huber definition, dimensional analysis with units, sympy/latex export, predict, and multi-output with a custom operator and a custom loss.
   - A head-to-head benchmark (below).
4. **Coverage:** **144 / 307 rows (46.9%) are checked at runtime**, or 52.4% of the 275 rows in scope. 131 are export+grep and 32 are name-only (all n/a).

## Counts

| priority | rows | full | partial | missing | n/a |
| -------- | ---- | ---- | ------- | ------- | --- |
| P0       | 6    | 6    | 0       | 0       | 0   |
| P1       | 76   | 43   | 11      | 22      | 0   |
| P2       | 225  | 51   | 35      | 107     | 32  |
| **all**  | 307  | 100  | 46      | 129     | 32  |

By area (the larger ones):

| area                              | full / partial / missing / n/a |
| --------------------------------- | ------------------------------ |
| built-in operators (58)           | 19 / 5 / 34 / 0                |
| losses (23 + 3 custom)            | 2 / 1 / 23 / 0                 |
| mutation weights and plugins (23) | 2 / 15 / 6 / 0                 |
| mutation classes (14)             | 10 / 2 / 2 / 0                 |
| complexity options (12)           | 9 / 0 / 3 / 0                  |
| constant optimisation (6)         | 4 / 2 / 0 / 0                  |
| search space (7)                  | 2 / 2 / 3 / 0                  |
| objective (7)                     | 2 / 3 / 2 / 0                  |
| migration (6)                     | 2 / 1 / 3 / 0                  |
| export (7)                        | 0 / 0 / 7 / 0                  |
| performance (13)                  | 1 / 4 / 2 / 6                  |
| Julia API (18)                    | 9 / 1 / 7 / 1                  |

**Pass 1 got some of this wrong.** Nested constraints (`grammar.nesting`) and per-operator argument constraints (`grammar.argumentLimits`) are **full** and verified at runtime: 0 violations in 4,000 enumerated trees and on the front. Constants **are** refit inside the loop (`optimizeProbability`, default 0.14, the same as PySR), but only for _named_ parameters (see gap 2). Islands and migration exist and pass their runtime probes.

## Head-to-head benchmark (`verify/sr_benchmark_*`)

**Setup.** Both systems got the same data: 100 training rows and 1,000 noiseless test rows, with fixed data seeds. They had the same operators (`+ - * /`, `exp cos sqrt`), maxsize 20, 31 populations of 27, `model_selection='best'` and float64 (PySR `precision=64`). PySR ran serial and deterministic with `random_state` set to the seed. MathTS used `seed` plus parameters `c0..c2` and literal `1`.

**Datasets.** F=ma, kinetic energy ½mv², Coulomb 8.9875·q1q2/r², ideal gas 8.314·nT/V, Gaussian e^(−θ²/2)/√(2π), ideal gas with 5% noise, and 2.5382·cos(x3)+x0²−0.5 with 10% noise and 3 distractor features.

**Recovery.** A model counts as recovered when its test NRMSE against the noiseless truth is below 1e-5 (clean) or 0.05 (noisy) **and** its complexity is no more than the true complexity + 2. I report it for the selected model and for any row on the front.

**Primary result (v2): 30 s wall budget per fit, no early stop, PySR JIT excluded, seeds 0–3.** Eight processes ran at once on the 8-core box, so contention was the same for both systems.

| dataset         | PySR selected / front | MathTS selected / front | MathTS evals in 30 s (median) | PySR best (seed 0)         | MathTS best (seed 0)                                                                                                                          |
| --------------- | --------------------- | ----------------------- | ----------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| F_ma            | 4/4 · 4/4             | 4/4 · 4/4               | ~167k                         | `a*m`                      | `a*m`                                                                                                                                         |
| kinetic         | 4/4 · 4/4             | 4/4 · 4/4               | ~128k                         | `0.5*m*v**2`               | `0.5*m*v**2`                                                                                                                                  |
| coulomb         | 2/4 · 4/4             | 3/4 · 4/4               | ~119k                         | `8.9875*q1*q2/r**2`        | `8.9875*q1*q2/r**2`                                                                                                                           |
| ideal_gas       | 4/4 · 4/4             | 4/4 · 4/4               | ~126k                         | `8.314*T*n/V`              | `8.314*T*n/V`                                                                                                                                 |
| gaussian        | 4/4 · 4/4             | **1/4 · 1/4**           | ~118k                         | `0.39894*exp(-θ²)^0.5`     | `0.663·cos(0.273·e^cos θ + 54.9)` (test NRMSE 1.8e-3, not recovered)                                                                          |
| ideal_gas_noisy | 4/4 · 4/4             | 4/4 · 4/4               | ~134k                         | `8.3277*T*n/V`             | `8.3277*T*n/V` (the same loss, 1.8988)                                                                                                        |
| cos_quad_noisy  | 4/4 · 4/4             | **0/4 · 0/4**           | ~136k                         | `x0²+2.5071cos(x3)−0.3691` | best front MSE 0.39–3.6 across seeds (PySR reaches 0.288 at complexity 10); seed 2 found `x0²+cos(x3)−1` but never fitted the cos coefficient |
| **total**       | **26/28 · 28/28**     | **20/28 · 21/28**       | 115k–171k per run             |                            |                                                                                                                                               |

Losses, complexities, expressions and wall times for every run are in `verify/sr_benchmark_runs.csv`. Where both systems recovered a law, their fitted constants and losses match: ideal_gas_noisy has an identical MSE of 1.8987622 on both, and cos_quad's PySR optimum equals MathTS's 60 s optimum.

**Equal evaluation budget (v3): 200k evaluations, on the two datasets MathTS missed.**

- PySR took **0.9–1.6 s** and MathTS **40–57 s**, about **35–45× lower throughput** for MathTS. PySR's `max_evals` counting may include constant-optimisation evaluations, so treat the ratio as approximate.
- Gaussian recovered on PySR 3/4 front and MathTS 2/4. cos_quad recovered on PySR 1/4 and MathTS 1/4.
- At equal evaluations the search quality is comparable, so **the 30 s gap is mostly throughput.**

**v1 (60 s, early stop at MSE < 1e-12, seeds 0–2), kept for the record.** Early stop ends both systems on bloated exact fits (PySR 14/21, MathTS 11/21 front recovered). With 60 s, MathTS recovered cos_quad on 2 of 3 seeds.

**Dimensional analysis on Coulomb (separate runs, not a benchmark).**

- PySR with `X_units=['C','C','m']`, `y_units='N'` in 29 s found `q1/(0.111266·r²/q2)`, which is the true law.
- MathTS with its `dimensions` hard filter found the law with k = 8.9875 in **729 evaluations** (under a second).

## Bugs found (all reproduced at runtime)

- **BUG-1 (P1): a timer-based `AbortSignal` can never stop `searchScalars`.**
  - The search is CPU-bound and only awaits microtasks between generations, so `setTimeout` and `AbortSignal.timeout` callbacks never run. The `signal` option therefore cannot set a time limit, and there is no `timeoutMs` option.
  - It reproduces on both engines (`verify/scripts/_abort_probe.ts` and `.mjs`). In the minimal case, `AbortSignal.timeout(2000)` with `maxEvaluations: 60000` (1-D, 4 islands) ran 556 generations to `stopReason: 'max-evaluations'` in 12.1 s on Bun and 17.6 s on Node, and `signal.aborted` was still `false` at the end.
  - An already-aborted signal does work (`'cancelled'`).
  - Root cause: there is no macrotask yield in the generator loop. The fix is a `maxWallClockMs` checked against `performance.now()` between generations, like `enumerateScalars`' `maxWallClockMs`, and/or a macrotask yield when a `signal` is set.
- **BUG-2 (P2): the `'huber'` loss is twice standard Huber, and δ cannot be changed.**
  - `namedScalarLossTerm` uses ρ = a² for |a| ≤ 1 and 2|a| − 1 above that. LossFunctions.jl `HuberLoss(1)`, which PySR uses, gives 0.5a² and |a| − 0.5.
  - At residuals [−3, −1, −0.5, 0.4, 2], the MathTS values are exactly 2.0× PySR's (`verify/pysr_ref_checks.json`, probe `loss-huber`). Ranking is unchanged, but reported losses don't match the conventional definition or the docs' implied meaning.
  - `HUBER_DELTA = 1` is a constant, not an option.
- **FINDING-3 (P2): unknown option keys are silently ignored.** For example, `runScalarSearch(..., { timeoutInSeconds: 1, denoise: true })` runs without complaint. TypeScript callers are protected; JS callers are not.
- **Not a bug, a convention:** the `l2` hall loss is a **sum** of squares, while PySR reports a **mean**. Scores and selection are invariant to this; recomputed losses match to 1e-9.
- **No numerical bugs** were found in the 19 shared operators. They match numpy to ≤ 1.2e-16 relative, and the domain masks match PySR's safe-op NaN semantics on every probe input. `scoreFront` matches PySR's formula exactly, and `selectFrontModel('best')` agrees with PySR on **28/28** real PySR fronts.

## Top gaps (ranked)

1. **Search throughput.** MathTS is about 35–45× fewer evaluations per second than PySR (v3). This is the main cause of the 30 s recovery gap on the Gaussian and cos_quad datasets. (P1)
2. **Only named parameters are optimised.** Constants are named `grammar.parameters`, shared by name, and numeric literal leaves are never fitted, only randomly perturbed (`scalar-search.ts:1199`). PySR optimises every constant leaf. This is the likely reason MathTS stalls on cos_quad's offset; I didn't isolate it experimentally. (P1)
3. **No wall-clock timeout** (`timeout_in_seconds`), plus BUG-1. (P1)
4. **Operator library: 34 of 58 PySR operators are missing** as SR nodes. Among them are `inv`, `square` and `cube`, which only exist as composites with different complexity, plus asin/acos/asinh/acosh/atanh, cbrt, erf/erfc, gamma, log1p, sign, relu, floor/ceil/round, max/min/mod, the comparison and logical operators, `cond`, `clamp` and the `*_abs` safe variants. MathTS already implements most of these as ordinary functions (for example `functions/src/special/erf.ts`, `probability/gamma.ts`, `arithmetic/cbrt.ts`). (P1)
5. **No user-defined operators** (PySR `"inv(x) = 1/x"` plus `extra_sympy_mappings`) and no n-ary operators. (P1/P2)
6. **Losses:** only l2, l1 and huber are available. There's no custom elementwise loss and no full-objective `loss_function`. Quantile, LogCosh, LPDist and the epsilon-insensitive and margin losses are missing, and Huber δ can't be set. (P1)
7. **No constant `parsimony` coefficient**, only adaptive parsimony. (P1)
8. **`early_stop_condition` only takes a loss threshold**, not a (loss, complexity) predicate. (P1)
9. **No estimator object.** `predict` means recompiling a row with its `fittedParameters`, and there's no `score()` (R²). (P1/P2)
10. **Mutation weights are fixed constants.** There are no Optimize or Backsolve mutations, no custom mutations or plugins (adaptive mutation weights, mutation burst), and no hall-of-fame migration, `fraction_replaced_guesses`, configurable `topn` or `ncycles_per_iteration`. (P2)
11. **No multi-output targets, no minibatching** (`batching`/`batch_size`), and no `select_k_features` or `denoise`. (P2)
12. **No warm start, checkpoint or resume**, and no `from_file`, equation-file CSV, `output_directory` or `run_id`. `frontToJson` is in-memory only. (P2)
13. **No template or parametric expression specs**, no float32/float16, no complex input, and no `GraphNode` shared subexpressions. (P2)
14. **No JAX or PyTorch export.** The JS analogue would be TF.js, ONNX or JS-source export. LaTeX, LaTeX tables and the MathTS Node are covered. (P2)
15. **Dimensional analysis is a hard filter only**, with no soft `dimensional_constraint_penalty`, and callers have to convert unit strings themselves with `unitToRationalDimension`. (P2)

## Where MathTS is ahead

- **Dimensional analysis.** It's an exact rational SI 7-vector, it solves for parameter dimensions, and the hard filter recovered Coulomb in 729 evaluations.
- **Determinism.** Results are bit-identical between parallel and serial (runtime-verified). PySR needs `parallelism='serial'` for determinism.
- **No JIT or foreign runtime.** Startup is well under 1 s, against PySR's ~30 s JIT per process, and it runs in browsers.
- **Search features PySR lacks:** a Levenberg–Marquardt fitter alongside BFGS and Nelder–Mead; parameter bounds and start vectors; the `invalidRows: 'penalize'` policy; the `grammar.admit` arbitrary structural predicate; canonical-key hall dedup; `numericallyEquivalent` evidence checks; a JSON front with a schema version; and `enumerateScalars` for exhaustive small-space enumeration.

## Proposed build batches (one cloud-agent PR each, in priority and dependency order)

| #      | batch                                        | priority | depends on    | contents                                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRP-1  | Wall-clock budget and BUG-1                  | P1       | —             | `maxWallClockMs` on `searchScalars`/`runScalarSearch` (stopReason `'time-limit'`); a macrotask yield between generations when `signal` is set; a test that `AbortSignal.timeout(200)` cancels on Node and Bun; reject unknown option keys (FINDING-3)                                                                 |
| SRP-2  | Per-leaf constant optimisation               | P1       | —             | an option such as `constants: 'parameters' \| 'leaves'` (or auto-naming each numeric leaf) so `fitScalarParameters` optimises every constant leaf the way PySR does; a dimension-solver interaction test; a cos_quad regression benchmark                                                                             |
| SRP-3  | Operator table refactor and smooth operators | P1       | —             | a single operator registry (eval, tape, dual/grad, dimension rule, TeX, bridge lowering, default complexity); add unary inv, square, cube, cbrt, neg, asin, acos, asinh, acosh, atanh, erf, erfc, gamma, log1p, and the safe `*_abs` variants (sqrt_abs, log_abs, log2_abs, log10_abs, log1p_abs, acosh_abs, pow_abs) |
| SRP-4  | Non-smooth and logical operators             | P2       | SRP-3         | sign, relu, floor, ceil, round, abs-gradient conventions, max, min, mod, greater, greater_equal, less, less_equal, logical_and, logical_or, cond, clamp, atanh_clip, fma/muladd                                                                                                                                       |
| SRP-5  | User-defined operators                       | P1       | SRP-3         | `defineScalarOperator({ name, arity (1/2/n), evaluate, gradient?, tex?, dimension?, complexity? })` wired into the grammar, compile, mutate, bridge and export                                                                                                                                                        |
| SRP-6  | Losses and objectives                        | P1       | —             | a Huber `delta` option and the standard ½ scaling (BUG-2; refresh the pins); quantile(τ), logcosh, LPDist(p), epsilon-insensitive; a custom elementwise loss callback; a full-objective callback (`loss_function`); a `lossReduction: 'sum' \| 'mean'` option                                                         |
| SRP-7  | Throughput                                   | P1       | SR-11 harness | profile the per-tree compile and score path; structural tape cache keyed on stored shape (a sound version of SR-12); a WASM tape evaluator for scoring; a batch-of-trees evaluator; gate on the SR-11 two-engine harness; target ≥ 5×                                                                                 |
| SRP-8  | Parsimony and stopping                       | P1       | —             | a constant `parsimony` coefficient; an `earlyStop` predicate `(loss, complexity) => boolean`; `lossScale` on the search with PySR's linear score; `warmupMaxsizeBy`                                                                                                                                                   |
| SRP-9  | Evolution controls                           | P2       | SRP-5         | configurable `mutationWeights`; Optimize and Backsolve mutations; custom mutation and plugin hooks (adaptive mutation weights, mutation burst); hall-of-fame migration (`fractionReplacedHof`), guess re-injection, `topn` and `cyclesPerGeneration` options; PySR-style acceptance annealing                         |
| SRP-10 | Data-scale features                          | P2       | SRP-7         | minibatch scoring (`batching`, `batchSize`); a multi-output `runScalarSearchMulti`; `selectKFeatures`; denoising (`denoise`, `Xresampled`) using the existing stats or GP code                                                                                                                                        |
| SRP-11 | Estimator, persistence and export            | P2       | SRP-2         | a `SymbolicRegressor` wrapper (fit, predict, score R², getBest, equations table); checkpoint, resume and warm start (`from_file`, front and population serialisation, CSV); JS-source, TF.js and ONNX export as the JAX/torch analogue                                                                                |
| SRP-12 | Expression specs and types                   | P2       | SRP-5         | template and parametric expressions; float32; complex input; a soft dimensional penalty alongside the hard filter; unit-string `X_units`/`y_units` convenience                                                                                                                                                        |

## Not verified

- PySR's `jax()` and `pytorch()` exports didn't run because jax and torch aren't installed in the scratch venv. Their rows come from the source.
- PySR's multiprocessing and cluster modes, plus `denoise`, `select_k_features`, `batching`, templates, loggers and plugins, weren't run. Their inventory rows come from introspection.
- PySR's evaluation counting under `max_evals` isn't established, so the throughput ratio is approximate.
- 131 mapping rows are export+grep only. These include all 15 mutation-weight rows: I confirmed the constants, but didn't exercise each weight's effect.
- 32 rows are n/a and name-only.
- The benchmark is small: 7 datasets, 4 seeds (v2), on a shared 8-core box with 8 concurrent processes. Recovery is numeric (held-out NRMSE plus a complexity bound), not a symbolic-equivalence proof.
- I didn't experimentally confirm that per-leaf constant optimisation is the cause of the MathTS cos_quad misses.
- MathTS parallel scoring speed at large row counts wasn't measured. The probe at 400 rows showed parity in results only.

## Files

This archive keeps this report plus [`inventory.csv`](data/pysr-inventory.csv) and [`mapping.csv`](data/pysr-mapping.csv). The original review also produced the following working-copy files (not imported):

- [`inventory.csv`](data/pysr-inventory.csv), [`mapping.csv`](data/pysr-mapping.csv), `REPORT.md`
- `verify/`: `probes.{ts,json,log}`, `operators.md`, `check_ops.py`, `modelsel_diff.{ts,json}`, `pysr_ref_checks.{py,json}`, `missing_export_scan.json`, `numeq_simplify.json`, `sr_benchmark_runs*.csv`, `sr_benchmark_summary*.md`, `scripts/`
- `bench/`: `make_data.py`, `data/`, `run_pysr*.py`, `run_mathts*.ts`, `analyze.py`, `results/` (v2), `results_v1_earlystop/`, `results_v3_evals/`
- `scripts/inventory.py`, `scripts/mapping.py`
- `venv/` (PySR + Julia) and `mathts/` (clone `e09eb301`; the bench and probe copies are in its `tools/_pysr_*`, `tools/_abort_probe.*`, and nothing was pushed)
