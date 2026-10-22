# Proposal: PySR-informed symbolic-search primitives in MathTS

**Author:** MathTS maintenance
**Date:** 2026-10-22
**Status:** Proposed (roadmap only; no feature code in this change)
**Target packages:** `@danielsimonjr/mathts-expression`, `@danielsimonjr/mathts-functions`, `@danielsimonjr/mathts-core` (Phases 1–3); a new search package is deferred to Phase 4 behind a CDG placement probe.
**Related external projects:** [PySR](https://github.com/danielsimonjr/pysr) (fork of MilesCranmer/PySR, studied read-only at commit `72a9ab9`, backend pin `SymbolicRegression ~2.7.2` in `pysr/juliapkg.json`); [Universal Physics Tensor (UPT)](https://github.com/danielsimonjr/universal-physics-tensor) (studied read-only at its default-branch HEAD).
**Related MathTS docs:** [`docs/integration/upt.md`](../integration/upt.md), [`docs/FEATURE_WORKFLOW.md`](../FEATURE_WORKFLOW.md), [`ITENSOR_PARITY.md`](ITENSOR_PARITY.md) (same proposal format).

---

## 0. TL;DR

PySR searches for a formula that fits numeric data. It evolves expression trees,
scores each one by loss and complexity, keeps a Pareto front, simplifies the trees,
fits their constants and can penalize unit mismatches. UPT is framed as "PySR in higher
dimensions". Its data is known physics (equations, units, constants), and it searches
for new bridge equations between domains. UPT's own design doc already sets the terms
for that search:

- No Python, SINDy or PySR is vendored.
- A native, deterministic, budgeted grammar enumerator ships first.
- Canonical deduplication and fingerprints are part of the design.
- A candidate is only ever reported as "unadjudicated".

The source is `docs/planning/Scientific-Bridge-Discovery-v1.md` in UPT: §0.2 row 9,
§7, §8, §9 and §10.1–10.3.

So MathTS should not grow a PySR clone. It should supply the **domain-neutral
primitives** that both PySR's backend and UPT's Product B pipeline need. Today UPT
works around each missing one by hand:

| UPT workaround today (file read)                                                                                                                       | Missing MathTS primitive                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `src/composition/probe/fit.ts` evaluates a candidate per row (`rows.rows.map(row => evalExpr(expr, row))`) and fits a **single prefactor** with `ols`. | Batch evaluator; multi-constant fitting     |
| `src/composition/algebraic-equivalence.ts` renders both sides to a gensym **string**, then calls `parse` + `simplify`.                                 | `ScalarNode` ↔ expression `Node` bridge     |
| `src/canonical/normal-form.ts` hashes structure, but its header says `a/(b/c)` and `a·c/b` hash differently.                                           | Canonical structural key for `ScalarNode`   |
| `src/atlas/witness-symbolic.ts` reseeds the **global** `seedProbabilityRng(spec.id)` before sampling.                                                  | Instance-scoped, splittable seeded RNG      |
| No loss-vs-complexity front utility exists in either repo.                                                                                             | Pareto front + PySR-style score / selection |

There are five phases and fifteen milestones (§6). Each milestone is scoped to one
focused PR.

**Best to build first tonight** (small, self-contained, no behavior change to existing
exports):

1. **M1 — `ScalarNode` structural toolkit** (`expression`): canonical key, size/depth,
   weighted complexity, symbol collection, map/forEach. Pure functions over an existing
   exported type.
2. **M4 — Pareto front and PySR scoring** (`functions`): `paretoFront`, `scoreFront`,
   `selectFrontModel`. Pure numeric code, and every value can be pinned by hand against
   PySR's `calculate_scores` / `idx_model_selection` (`pysr/sr.py:3414-3466`).
3. **M3 — batch compiled `ScalarNode` evaluator** (`functions`): `compileScalar` over
   `Float64Array` columns with a per-row validity mask, pinned by parity against
   `evaluateScalar`.

M1 and M4 have no dependencies. M3 does not need M1, but its tests are simpler once
M1's `scalarSymbols` exists.

---

## 1. Framing and division of labour

| Concern                                                                                          | Owner                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search policy, epistemic status, adjudication, falsifiers, holdouts, multiple-hypothesis control | **UPT** (`src/composition/probe/*`, Scientific-Bridge-Discovery-v1 §1.3–1.5, §13, §15)                                                                                       |
| UPT's physics AST (`ExprNode`), its dimensional validator, `normalForm`, `CanonicalEquation`     | **UPT** (`src/dimensional/ast-types.ts`, `src/dimensional/validator.ts`, `src/canonical/normal-form.ts`)                                                                     |
| Scalar IR that UPT lowers into (`ScalarNode`), its evaluation, simplification, LaTeX             | **MathTS** (`expression/src/scalar-builder.ts`, `functions/src/scalar-eval.ts`; UPT lowers into it in `src/composition/expr-eval.ts`)                                        |
| Numerics: optimizers, statistics, seeded RNG, units/dimension vectors, constants                 | **MathTS** (`functions/src/numeric/bfgs.ts`, `functions/src/optimization-extra.ts`, `core/src/types/si-dimension-vector.ts`, `functions/src/type/unit/physicalConstants.ts`) |
| Generic search kit (mutations, enumerator, evolution loop)                                       | **MathTS, Phase 4, optional.** UPT may wrap it as a `CandidateGenerator` (UPT §7.1) or keep its own enumerator. Placement is decided by a CDG probe.                         |

The roadmap is built around one design decision: **`ScalarNode` is the interchange
IR.** It is already public, it is already what UPT lowers into (`docs/integration/upt.md`
§ "Scalar ExprNode evaluation"), and it is small. Its four arms are `number`, `symbol`,
`op` (`+ - * / ^`) and `call` (12 lowered unary functions), defined in
`expression/src/scalar-builder.ts`. Every Phase 1–3 milestone operates on `ScalarNode`
and adds **no new node kinds**. Free constants are modelled as **named symbols listed
as parameters**, so the IR stays unchanged and UPT's lowering keeps working.

---

## 2. PySR evaluation

### 2.1 Architecture (what was read)

- **Frontend:** `pysr/sr.py` (3,669 lines) defines `PySRRegressor`, a scikit-learn
  estimator. Its `__init__` (`pysr/sr.py:1092-1216`) is the full options surface. The
  class docstring, which starts at `pysr/sr.py:478`, documents each option.
- **Backend:** SymbolicRegression.jl, called through `juliacall`
  (`pysr/julia_import.py`, `docs/src/backend.md`). Expressions are `Node{T}` trees.
  The main loop is `equation_search`, and the constraint check is `check_constraints`
  (`docs/src/backend.md`, "Edit the source").
- **Expression specs:** `pysr/expression_specs.py`. `ExpressionSpec` is a plain tree.
  `TemplateExpressionSpec` combines several sub-expressions through a fixed
  `combine` string, restricts the variables each one may use, can carry optimizable
  parameter vectors, and allows differential operators `D(f, 1)` (`:153-215`).
  `pysr/type_specs.py` adds custom value types.
- **Mutations:** `pysr/mutations.py` exposes the backend's mutation set as dataclasses:
  constant, operator, feature, swap operands, add / insert / delete node, rotate tree,
  backsolve, simplify, randomize, optimize, do nothing.
- **Export:** `pysr/export_sympy.py` maps operator names to SymPy (`sympy_mappings`,
  `:14-75`). `pysr/export_latex.py` renders through SymPy (`sympy2latex`,
  `sympy2latextable`). `pysr/export_jax.py`, `pysr/export_torch.py` and
  `pysr/export_numpy.py` emit callables.

### 2.2 Search

These are the defaults in `pysr/sr.py:1101-1162`, as documented in the docstring:

- **Islands.** `populations=31` of `population_size=27`. `ncycles_per_iteration=380`.
  Migration is controlled by `fraction_replaced=0.00036`,
  `fraction_replaced_hof=0.0614`, `fraction_replaced_guesses=0.001` and `topn=12`.
- **Selection.** Tournament selection with `tournament_selection_n=15` and
  `tournament_selection_p=0.982`. The docstring gives the decay as `p*(1-p)^n`.
- **Variation.** `crossover_probability=0.2`. The mutation weights default to
  add-node 2.47, rotate-tree 4.26, delete-node 0.870, mutate-operator 0.293,
  do-nothing 0.273, swap-operands 0.198, mutate-feature 0.1, mutate-constant 0.0346,
  insert-node 0.0112, simplify 0.00209, randomize 0.000502, and optimize / backsolve
  0.0 (docstring, `pysr/sr.py:697-741`).
  `AdaptiveMutationWeightsPlugin` retunes these weights from observed improvement
  rates (`docs/src/examples/search-behaviour.md:140`).
- **Simulated annealing.** `annealing=True`, initial temperature `alpha=3.17`.
- **Adaptive parsimony.** `use_frequency` and `use_frequency_in_tournament` measure how
  often each complexity occurs in the population and use that instead of a fixed
  parsimony penalty to explore all sizes. `adaptive_parsimony_scaling=1040.0`.
- **Structural constraints.** `maxsize=30` and an optional `maxdepth`. `constraints` caps
  the size of each operator argument (for example `pow: (-1, 1)`). `nested_constraints`
  limits nesting (for example `sin` inside `cos`). `warmup_maxsize_by` grows `maxsize`
  over the run. `docs/src/backend.md` warns that **every intermediate expression** must
  satisfy the hard constraints, so a target must be reachable one mutation at a time.
- **Seeding the search.** `guesses` plus `fraction_replaced_guesses` inject user
  formulas. `warm_start` resumes a saved search state.
- **Data handling.** `batching` scores evolution on row subsets but scores the hall of
  fame on every row. The automatic batch sizes are documented in
  `docs/src/examples/search-behaviour.md:5`.
- **Determinism.** `deterministic=True` requires `parallelism='serial'`
  (`pysr/sr.py:2405-2407`).

### 2.3 Scoring and model selection

- **Loss.** `elementwise_loss` (LossFunctions.jl, L2 by default), or a full
  `loss_function` / `loss_function_expression` written in Julia.
  `loss_scale ∈ {log, linear}`.
- **Complexity.** By default each node counts 1. This can be overridden by
  `complexity_of_operators`, `complexity_of_constants`, `complexity_of_variables`, or
  an arbitrary `complexity_mapping`. Real-valued weights are rounded to an integer
  after summing (docstring for `complexity_of_operators`).
- **Front and score.** The hall of fame keeps the best expression **per complexity**.
  `calculate_scores` (`pysr/sr.py:3435-3466`) walks the front in complexity order and
  computes `score_i = −ln(loss_i / loss_{i−1}) / (c_i − c_{i−1})`. The first row scores 0. A row with `loss_i = 0` (and a previous row) scores `+∞`.
- **Selection.** `idx_model_selection` (`pysr/sr.py:3414-3432`) offers three modes.
  `accuracy` takes the row with the minimum loss. `score` takes the row with the
  maximum score. `best` takes the maximum score among rows with
  `loss ≤ 1.5 × min loss`. Without a score column (for example, linear `loss_scale`),
  selection falls back to `accuracy`.

### 2.4 Simplification

- `should_simplify=True` applies "only a few simple rules" (docstring).
  `SimplifyMutation` folds constant subtrees by evaluation (`pysr/mutations.py:159-166`).
- Full algebraic simplification happens **after** the search, by exporting to SymPy
  (`pysr/export_sympy.py`). Custom operators must supply an `extra_sympy_mappings`
  entry, or a SymPy-capable fit is rejected
  (`docs/src/examples/search-behaviour.md:85`).

### 2.5 Constant fitting

`should_optimize_constants=True`, with `optimizer_algorithm ∈ {BFGS, NelderMead}`
(BFGS by default). Other settings: `optimizer_nrestarts=2`, `optimizer_iterations=8`,
`optimizer_f_calls_limit` (documented default `10_000`) and `optimize_probability=0.14`
per iteration. `weight_optimize` also runs optimization as a mutation. Constants are
perturbed by a factor up to `perturbation_factor·T + 1`, where `T` is the annealing
temperature, and are negated with probability `0.00743`. `autodiff_backend` can
supply gradients through Zygote, Mooncake or Enzyme. `BacksolveMutation` fits a
replacement subtree from a library of up to 500 terms (`pysr/mutations.py:138-157`).

### 2.6 Dimensional constraints

`fit(X, y, X_units=…, y_units=…)` takes unit strings in DynamicQuantities.jl syntax
(`docs/src/examples/physics.md:50`). An expression that fails dimensional analysis gets
an **additive** penalty, `dimensional_constraint_penalty` (documented default `1000.0`).
A constant whose units are left free is printed `[⋅]`.
`dimensionless_constants_only=True` forbids dimensional constants
(`docs/src/examples/physics.md:68-77`).

### 2.7 What PySR does well

- **The Pareto front is the deliverable.** PySR returns one best expression per
  complexity, not a single winner, and `best` selection is a defensible, cheap rule
  (§2.3).
- **The search is strong and well tuned.** Islands, migration, annealing and adaptive
  parsimony are mature, and the defaults are tuned. `docs/src/tuning.md` records the
  practical levers: operator minimalism, strict `constraints` / `nested_constraints`,
  `maxsize` slightly above the target, and `parsimony ≈ expected loss / 5–10`.
- **Constants are fitted inside the loop**, so the search explores structure rather
  than numbers.
- **Units are opt-in and cheap**, and the results stay interpretable through the `[⋅]`
  marker.
- **Export is broad**: SymPy, LaTeX tables, JAX, PyTorch and NumPy.

### 2.8 Limits that matter for UPT

1. **Units are a soft penalty, not a generation-time type.** Invalid trees are
   generated and then penalized. UPT §7 requires that invalid expressions be _avoided
   rather than generated and discarded_.
2. **The data is numeric rows `(X, y)`.** UPT's "data" includes known equations and
   constants. Fitting them is one evidence channel among several (§9 fingerprints,
   §13 uncertainty, §15 falsifiers in UPT's doc).
3. **Determinism needs serial execution** (§2.2), and the search is stochastic by
   design. UPT §7.1 requires its native enumerator to be deterministic and
   seed-independent in visit order. Stochastic backends must declare
   `deterministic: 'seeded' | 'no'`.
4. **Equivalence is weak during the search.** There are only "a few simple rules"
   (§2.4), so syntactically different but equivalent trees compete in the population.
   UPT §9 makes canonical equivalence a first-class stage.
5. **Runtime and language.** PySR needs Julia through `juliacall`, which UPT's
   `CLAUDE.md` rule (no Python in the codebase; UPT doc §0.2 row 9) excludes in-tree.
   UPT §10.3 allows PySR only as an optional, out-of-process candidate generator.
6. **The score is tied to log-loss.** `calculate_scores` assumes a positive loss and a
   log scale. With `loss_scale="linear"` there is no score, and selection falls back to
   `accuracy` (§2.3). A likelihood-style objective needs a different front statistic.

### 2.9 Transfer matrix: which PySR methods carry over to UPT-style search

| PySR method                                                    | Carries over?                                                                                                           | MathTS's role                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Expression trees + operator sets by arity                      | **Yes.** `ScalarNode` already exists, with `+ - * / ^` and 12 unary functions.                                          | M1 (structure), M11 (operator-set and grammar descriptor)                              |
| Complexity (weighted node count)                               | **Yes.** UPT §8 budgets already count `maxAstDepth` and `maxOperators`.                                                 | M1 `scalarComplexity` with PySR-style weights                                          |
| Pareto front per complexity + score + `best` selection         | **Yes**, as a reporting and ranking device. It is never a status decision (UPT §1.4).                                   | M4                                                                                     |
| Constant fitting (BFGS / Nelder–Mead, restarts)                | **Yes.** It generalizes UPT's single-prefactor `ols` fit to several constants.                                          | M6 exact gradients, M7 `fitScalarParameters`                                           |
| Simplification during and after search                         | **Yes, and more strongly.** UPT needs canonical equivalence, not only shorter output.                                   | M1 canonical key, M2 Node bridge (reuses `simplify`), M8 numeric equivalence           |
| Dimensional constraints                                        | **Yes, but as generation-time typing** (UPT §7), not an additive penalty.                                               | M9 dimension inference, M10 constant-unit solving (built only if UPT asks to delegate) |
| Structural constraints (`maxsize`, nesting, argument size)     | **Yes.** They map onto UPT `SearchBudget` and grammar rules.                                                            | M11 grammar descriptor, M12 constraint-checked mutations                               |
| Mutation + crossover operators                                 | **Partly.** They are useful for an optional stochastic backend (UPT §8.1 step 6), not for the deterministic enumerator. | M12                                                                                    |
| Islands, migration, annealing, adaptive parsimony              | **Optional.** This is the step-6 "stochastic generator", and it is declared `seeded`.                                   | M13                                                                                    |
| Batching rows                                                  | **Yes**, for large observation sets. UPT keeps holdouts separate (`fit.ts`: "Generation never sees holdout rows").      | M3 accepts row subsets; the caller picks them                                          |
| `guesses` / warm start                                         | **Yes.** Known equations are natural seeds for bridge search.                                                           | M13 `seeds` option, plus JSON round-trip of `ScalarNode` (it is already plain data)    |
| `TemplateExpressionSpec` (fixed skeleton + free sub-trees)     | **Interesting later.** It fits "a known law × an unknown correction".                                                   | Out of scope until M13 exists (§7)                                                     |
| SymPy / LaTeX export                                           | **Yes**, through the existing expression `Node.toTex`.                                                                  | M2, M15                                                                                |
| JAX / PyTorch export, `TypeSpec`, `denoise`, feature selection | **No**, for now. The author does not use `denoise` or `select_k_features` either (`docs/src/tuning.md:40`).             | None                                                                                   |

---

## 3. MathTS today (relevant surfaces, as read)

| Surface                                                                                | Where                                                                                                                                                                                                                                                                 | Notes for this roadmap                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScalarNode` IR + `createScalarBuilder`                                                | `expression/src/scalar-builder.ts`, exported from `expression/src/index.ts:45-57`                                                                                                                                                                                     | Four arms. `^` takes exactly two arguments. `+ - * /` are n-ary and fold left to right. `ln` lowers to `log` and `log` lowers to `log10` (`SCALAR_FUNCTION_LOWERING`). No traversal, hashing or complexity helpers exist.                                               |
| `evaluateScalar` / `scalar`                                                            | `functions/src/scalar-eval.ts`, exported at `functions/src/index.ts:49-50`                                                                                                                                                                                            | Recursive interpreter for **one scope at a time**. It dispatches each operation through typed `add` / `pow` / … and throws `ScalarEvalError` on a non-finite operator or call result.                                                                                   |
| Expression `Node` AST, `toTex`, `simplify`, `derivative`, `symbolicEqual`, `leafCount` | `expression/src/node/*`, `expression/src/utils/latex.ts`, `functions/src/algebra/{simplify,derivative,symbolicEqual,leafCount}.ts`                                                                                                                                    | All operate on `Node`, not on `ScalarNode`. Concrete node classes are instantiated in `functions/src/factories/index.ts:943-1035`. `symbolicEqual` simplifies `e1 − e2` and is one-sided ("`false` does not absolutely rule this out"). `leafCount` counts leaves only. |
| Optimizers                                                                             | `functions/src/numeric/bfgs.ts` (`bfgs`, optional analytic `grad`, projected box bounds), `functions/src/optimization-extra.ts` (`nelderMead`, `gradientDescent`, `levenbergMarquardt`)                                                                               | All take `number[]` closures. `levenbergMarquardt` has no analytic-Jacobian option: it uses a fixed-step numeric Jacobian with `h = 1e-7` and solves through `inv` (`:149-160`).                                                                                        |
| Forward-mode duals                                                                     | `core/src/types/dual.ts`, `core/src/types/dual-rules.ts` (`DUAL_UNARY_RULES`), `functions/src/grad-forward.ts` (`gradientAt`)                                                                                                                                         | The dual rules cover every lowered `ScalarNode` function (exp, log, log2, log10, sin, cos, tan, sinh, cosh, tanh, abs, …), so exact constant gradients need no new calculus.                                                                                            |
| Reverse-mode AD                                                                        | `autograd/src/{tape,reverse-grad,grad}.ts`                                                                                                                                                                                                                            | Tensor-level. It is not needed for the scalar constant counts PySR uses, but it is available.                                                                                                                                                                           |
| Units and dimension vectors                                                            | `core/src/types/unit/Unit.ts` (10-slot `dimensions`, `equalBase`, `multiply` / `divide` / `pow`), `core/src/types/si-dimension-vector.ts` (`SiDimensionVector` `[L,M,T,I,Θ,N,J]`, "the order UPT's Buckingham routine uses")                                          | Unit-string parsing was hardened for UPT delegation (issue #347, `core/tests/types/unit-upt-delegation.test.ts`). `docs/integration/upt.md` Q2 keeps dimensional analysis **on `Tensor`** UPT-only.                                                                     |
| Physical constants                                                                     | `functions/src/type/unit/physicalConstants.ts` (CODATA-2022, each one a core `UnitInstance`)                                                                                                                                                                          | They carry no uncertainty field (no `uncertainty` occurrences in the file), which matters if constants become "data" (open question §8).                                                                                                                                |
| Exact rational nullspace                                                               | `rationalNullspace` (`functions`, used by UPT `src/dimensional/buckingham.ts`)                                                                                                                                                                                        | It is the core of constant-unit solving (M10).                                                                                                                                                                                                                          |
| Seeded RNG                                                                             | `seedProbabilityRng` (global, `functions/src/typed/probability.ts:300`). Private Mulberry32 copies in `functions/src/typed/{hypothesis,dist-objects,graph}.ts` and `tensor/src/operations/random.ts:64`                                                               | There is no instance-scoped, splittable stream for reproducible multi-island search.                                                                                                                                                                                    |
| Parallel execution                                                                     | `parallel/src/{ComputePool,WorkerPool}.ts`                                                                                                                                                                                                                            | `WorkerPool#execute` `timeoutMs` and hung-worker replacement are a security invariant (`AGENTS.md`). A closure cannot be posted to a worker, so a worker must receive `ScalarNode` JSON and compile it there.                                                           |
| Symbolic regression / Pareto utilities                                                 | None. A case-insensitive grep for `pareto`, `symbolic regression`, `hall of fame`, `genetic` and `evolution` over the `.ts` sources found only the Pareto _distribution_ `paretoDist` (`functions/src/typed/dist-objects.ts:1219`) and unrelated `compareTo` matches. | Greenfield. Use a name such as `paretoFront`, which does not collide with `paretoDist`.                                                                                                                                                                                 |

---

## 4. Gap analysis

| #   | Gap                                                                                                           | Evidence                                                                       | Milestone |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------- |
| G1  | No traversal, size/depth, weighted complexity or symbol collection for `ScalarNode`                           | `expression/src/scalar-builder.ts` exports only build and normalize functions  | M1        |
| G2  | No canonical structural key for `ScalarNode` (commutative flattening, `a/(b/c)` ≡ `a·c/b`, `a·a` ≡ `a^2`)     | UPT `src/composition/algebraic-equivalence.ts` header                          | M1        |
| G3  | No direct `ScalarNode` ↔ `Node` conversion, so `simplify` / `toTex` / `derivative` need a string round trip   | UPT `algebraic-equivalence.ts` (`renderGensym`, then `parse`, then `simplify`) | M2        |
| G4  | No columnar batch evaluator. Per-row interpretation goes through typed dispatch, with a throw on failure      | `functions/src/scalar-eval.ts`; UPT `probe/fit.ts` `predictions()`             | M3        |
| G5  | No Pareto front, front score or model-selection utility                                                       | §3, last row                                                                   | M4        |
| G6  | No instance-scoped, splittable seeded RNG; Mulberry32 is duplicated privately four times                      | §3 RNG row; UPT `witness-symbolic.ts` reseeds the global stream                | M5        |
| G7  | No exact parameter gradient of a `ScalarNode`; `levenbergMarquardt` has no analytic-Jacobian hook             | `functions/src/optimization-extra.ts:149-160`                                  | M6        |
| G8  | No multi-constant fit of an expression to data (PySR §2.5)                                                    | UPT `probe/fit.ts` fits one prefactor with `ols`                               | M7        |
| G9  | No guarded numerical-equivalence check (UPT §9 level 5)                                                       | `symbolicEqual` is symbolic and one-sided                                      | M8        |
| G10 | No dimension inference over `ScalarNode` with rational exponents, and no constant-unit solving (PySR's `[⋅]`) | UPT owns `ExprNode` validation; `ScalarNode` has none                          | M9, M10   |
| G11 | No grammar / operator-set descriptor, no enumerator, no mutation / crossover operators, no evolution loop     | Greenfield                                                                     | M11–M13   |
| G12 | No front export (LaTeX table / JSON report) comparable to `sympy2latextable`                                  | `pysr/export_latex.py:62`                                                      | M15       |

---

## 5. Cross-cutting rules for every milestone

- **No IR change in Phases 1–3.** Milestones consume `ScalarNode` exactly as
  `createScalarBuilder` produces it. Free constants are `symbol`s named in a
  `parameters` list.
- **Oracle-pinned tests** (`ROADMAP.md` guiding principles). Pin against hand-computed
  closed forms, PySR's published formulas (§2.3), or `evaluateScalar`/`simplify` parity.
  Never pin a result against a round trip through the code under test.
- **Determinism.** Anything stochastic takes an explicit seed or RNG, and a test asserts
  that the same seed gives byte-identical output.
- **No performance claims without a committed benchmark**, following the `AGENTS.md`
  benchmarking rules: interleave the variants, keep a control, measure on Node with
  `tools/benchmark/wasm/run-node.mjs`-style isolation, and run twice. WASM and GPU
  evaluation of `ScalarNode` are **not** planned until a benchmark shows a win.
- **Repo gates per PR:**
  - `bun run typecheck` reports 0 errors and `bun run lint` reports zero warnings.
  - The affected package tests pass, with `import { describe, it, expect } from 'vitest'`.
  - `bun run docs:deps` stays at 0 cycles, 0 orphans, and the file census includes the
    new `.ts` files.
  - `check:duplicates:fast` reports no new `TRUE_DUPLICATE`. Names must not collide
    across packages; avoid generic names such as `complexity` or `score`.
  - `check:browser-safety` passes. All of this code is browser-safe, with no `node:`
    imports.
  - A changeset is added per package touched.
  - For a new `functions` export, rebuild before committing, because the pre-commit
    `docs:functions` step reads `dist` (`CLAUDE.md` known issues).
- **Sandbox invariant.** Nothing here routes through `expression/src` property access.
  If M2 builds `Node`s, it does so through the existing constructors, never through
  `obj[name]` lookups on user input.

---

## 6. Milestones

The size labels are S (one module plus tests), M (two or three modules) and L
(several modules, or a new package). Following `FEATURE_WORKFLOW.md`, each milestone is
a ROADMAP candidate until it passes the Definition of Ready.

### Phase 1 — `ScalarNode` foundations (no new dependencies or edges)

#### M1 — `ScalarNode` structural toolkit ★ first-tonight candidate

- **Package:** `expression`, as a new module `expression/src/scalar-structure.ts`
  re-exported from `index.ts`. **Size:** S. **Depends on:** nothing.
- **API sketch:**

```ts
export interface ScalarComplexityWeights {
  readonly op?: Partial<Record<ScalarOperator, number>>; // default 1 each
  readonly call?: Partial<Record<LoweredScalarFn, number>>; // default 1 each
  readonly number?: number; // default 1 (PySR complexity_of_constants)
  readonly symbol?: number | Readonly<Record<string, number>>; // default 1 (complexity_of_variables)
}
export function forEachScalar(
  node: ScalarNode,
  visit: (n: ScalarNode, depth: number) => void
): void;
export function mapScalar(node: ScalarNode, fn: (n: ScalarNode) => ScalarNode): ScalarNode; // post-order, rebuilds immutably
export function scalarSize(node: ScalarNode): number; // node count
export function scalarDepth(node: ScalarNode): number; // leaf = 1
export function scalarComplexity(node: ScalarNode, weights?: ScalarComplexityWeights): number;
export function scalarSymbols(node: ScalarNode): readonly string[]; // sorted, unique
export function scalarCanonicalKey(node: ScalarNode): string; // structural canonical form
export function scalarEquals(a: ScalarNode, b: ScalarNode): boolean; // key equality
```

- **Canonical key rules** (structural only, with no algebra beyond these):
  - Flatten nested `+` and `*`, then sort their operands by key.
  - Rewrite `a − b` as `a + (−1)·b`, and `a / b` as `a · b^−1`.
  - Collect repeated factors (`a·a → a^2`) and fold numeric literals inside a single
    `+` or `*`.
  - `^` is never reordered.
  - `call` keys use the lowered name, so `ln` and `log` differ correctly.
  - Numbers are serialized round-trip exact. `-0` is distinct from `0`, and `NaN` has
    one spelling.
- **Acceptance:**
  - The key is invariant under operand permutation of `+` and `*`.
  - `a/(b/c)`, `a*c/b` and `(c*a)*b^-1` share one key.
  - `x*x` and `x^2` share one key.
  - `x-y` and `y-x` have different keys.
  - `log(x)` (natural) and `log10(x)` have different keys.
  - `scalarComplexity` with all weights equal to 1 equals `scalarSize`. A PySR-style
    weighted example is pinned by hand.
  - All functions are pure: the input is deep-frozen in the tests and never mutated.
- **Tests:**
  - `expression/tests/scalar-structure.test.ts`, with a table of equivalence classes
    and non-equivalences.
  - A seeded random-permutation property test over 200 trees checks key stability.
  - A parity test checks that `evaluateScalar(a) === evaluateScalar(canonicalTreeOf(a))`
    on sample scopes, to catch a key rule that changes the value. Because this test
    imports `functions`, it lives in the root `tests/integration/`.

#### M2 — `ScalarNode` ↔ expression `Node` bridge

- **Package:** `functions`, next to `scalar-eval.ts`, because the concrete node classes
  are instantiated in `functions/src/factories/index.ts`. **Size:** S–M.
  **Depends on:** nothing. M1 helps the tests.
- **API sketch:**

```ts
export function scalarToNode(node: ScalarNode): MathNode; // OperatorNode / SymbolNode / ConstantNode / FunctionNode
export function nodeToScalar(node: MathNode): ScalarNode; // throws ScalarBuildError on an arm outside the scalar subset
export function simplifyScalar(node: ScalarNode, options?: SimplifyOptions): ScalarNode; // via simplify, no string round trip
export function scalarToTex(node: ScalarNode, options?: StringOptions): string;
```

- **Acceptance:**
  - `nodeToScalar(scalarToNode(n))` has the same `scalarCanonicalKey` as `n` for every
    test tree.
  - The `log` lowering is preserved: `scalarToNode` of natural `log` produces `log(x)`,
    and of `log10` produces `log10(x)`.
  - Unary minus maps to `(-1)*x`, the scalar convention (`scalar-eval.ts` header).
  - A `ParenthesisNode` is dropped and a `ConditionalNode` is rejected.
  - `simplifyScalar` of UPT's three header examples (`a/(b/c)` vs `a·c/b`, `a·a` vs
    `a²`) gives equal keys.
- **Tests:**
  - `functions/tests/scalar-node-bridge.test.ts`.
  - LaTeX output is pinned as strings for about 10 representative trees.
  - `evaluate(scalarToNode(n).toString(), scope)` agrees with `evaluateScalar(n, scope)`
    on sample scopes.

#### M3 — Batch compiled `ScalarNode` evaluator ★ first-tonight candidate

- **Package:** `functions`, as `functions/src/scalar-compile.ts`. **Size:** M.
  **Depends on:** nothing.
- **API sketch:**

```ts
export interface CompileScalarOptions {
  readonly variables: readonly string[]; // column order
  readonly parameters?: readonly string[]; // free constants, bound per call
  readonly constants?: Readonly<Record<string, number>>; // fixed bindings (e.g. pi)
}
export interface ScalarBatchResult {
  readonly values: Float64Array; // NaN where invalid
  readonly valid: Uint8Array; // 1 = finite, matches evaluateScalar not throwing
  readonly allValid: boolean; // PySR's eval_tree_array flag
}
export interface CompiledScalar {
  readonly variables: readonly string[];
  readonly parameters: readonly string[];
  evaluate(
    columns: readonly Float64Array[],
    params?: ArrayLike<number>,
    out?: Float64Array
  ): ScalarBatchResult;
  evaluateRow(row: ArrayLike<number>, params?: ArrayLike<number>): number; // throws ScalarEvalError like evaluateScalar
}
export function compileScalar(node: ScalarNode, options: CompileScalarOptions): CompiledScalar;
```

- **Design:** compile once into a tree of closures, or a flat postfix tape over
  preallocated scratch `Float64Array`s. Do **not** use `new Function` or `eval`; it is
  a sandbox and CSP hazard. Operations call the same numeric kernels that
  `evaluateScalar` reaches for real `number` input, so the results are bit-identical.
  The validity rule mirrors `requireFinite`: an operator or call that yields a
  non-finite or non-real value marks the row invalid. A bare symbol or number is
  returned as stored, as in `evaluateScalar`. An unknown symbol throws **at compile
  time**.
- **Acceptance:**
  - **Bit-for-bit parity** with `evaluateScalar` on every row where `evaluateScalar`
    returns, and `valid = 0` on exactly the rows where it throws. This includes
    negative base with a fractional exponent, `log(0)`, overflow in `exp`, and `0/0`.
  - `out` reuse allocates nothing per call. A test checks that the returned `values`
    is `out` itself.
  - The column-length mismatch and parameter-count mismatch errors are typed.
- **Tests:**
  - `functions/tests/scalar-compile.test.ts`, with a seeded random-tree parity sweep
    (about 500 trees by 64 rows) against `evaluateScalar`, plus edge-row tables.
- **Benchmark (optional in this PR, required before any speed claim):** add a case to
  `tools/benchmark/` comparing per-row `evaluateScalar` and `compileScalar` at a few
  row counts, following the `AGENTS.md` rules. No numbers go into docs until it is
  committed and run twice.

#### M4 — Pareto front and PySR-style scoring ★ first-tonight candidate

- **Package:** `functions`, as `functions/src/pareto-front.ts`. **Size:** S.
  **Depends on:** nothing.
- **API sketch:**

```ts
export interface FrontCandidate<T = unknown> {
  readonly loss: number;
  readonly complexity: number;
  readonly item: T;
}
export interface ScoredCandidate<T> extends FrontCandidate<T> {
  readonly score: number | null;
}
/** Non-dominated set on (complexity ↑, loss ↑); one entry per complexity, sorted by complexity. */
export function paretoFront<T>(candidates: readonly FrontCandidate<T>[]): FrontCandidate<T>[];
/** PySR calculate_scores: score_i = −ln(loss_i/loss_{i−1})/(c_i − c_{i−1}); first = 0; loss_i = 0 ⇒ +∞. 'linear' ⇒ score null. */
export function scoreFront<T>(
  front: readonly FrontCandidate<T>[],
  options?: { lossScale?: 'log' | 'linear' }
): ScoredCandidate<T>[];
/** PySR idx_model_selection: 'accuracy' | 'score' | 'best' (max score with loss ≤ factor·min loss, factor default 1.5). */
export function selectFrontModel<T>(
  scored: readonly ScoredCandidate<T>[],
  mode?: 'accuracy' | 'score' | 'best',
  options?: { bestLossFactor?: number }
): ScoredCandidate<T>;
```

- **Acceptance:**
  - A hand-computed front of five candidates gives exact scores, including the `+∞`
    case and the first row scoring 0.
  - Every mode gives the expected selection. `best` picks a lower-accuracy but
    higher-score row. Without scores (linear scale), selection falls back to
    `accuracy`, as in `pysr/sr.py:3417-3418`.
  - Ties resolve deterministically: lowest complexity first, then input order.
  - Inputs with a non-finite loss are excluded from the front, as an explicit
    documented choice.
  - The front is the hall of fame **per complexity**. A candidate is kept only if its
    loss is strictly lower than the loss of every candidate of lower complexity.
- **Tests:**
  - `functions/tests/pareto-front.test.ts`. The PySR formulas are cited in the test
    header, and the oracle values are worked by hand in the test comments.

#### M5 — Instance-scoped, splittable seeded RNG

- **Package:** `core` (`core/src/numeric/rng.ts`, exported). **Size:** S–M.
  **Depends on:** nothing.
- **API sketch:**

```ts
export interface SeededRng {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number;
  normal(): number; // Box–Muller, caches the pair
  fork(label: string | number): SeededRng; // independent child stream, deterministic in (seed, label)
  readonly seed: number;
}
export function createSeededRng(seed: number | string): SeededRng; // Mulberry32 core; strings hashed deterministically
```

- **Acceptance:**
  - The first 8 outputs of `createSeededRng(42)` are pinned as known values.
  - A forked stream is reproducible, and sibling forks are not identical.
  - **Migration is a separate follow-up.** It must keep every existing seeded output
    bit-identical (`randomTensor`, `bootstrapSeed` users, `dist-objects`, `graph`), so
    this PR only adds the module.
- **Tests:** `core/tests/numeric/rng.test.ts`.
- **Risk:** low if migration is excluded. If the four private copies are migrated later,
  confirm the duplicate-symbol gate treats them as one implementation.

### Phase 2 — Constant fitting and equivalence

#### M6 — Exact parameter gradients of a `ScalarNode`

- **Package:** `functions` (extends M3). **Size:** S–M. **Depends on:** M3.
- **API sketch:**

```ts
export interface CompiledScalarGradient {
  /** values[r] and grad[r * nParams + p] = ∂f/∂param_p at row r; same validity mask as M3. */
  evaluate(
    columns: readonly Float64Array[],
    params: ArrayLike<number>,
    out?: { values?: Float64Array; grad?: Float64Array }
  ): ScalarBatchResult & { readonly grad: Float64Array };
}
export function compileScalarGradient(
  node: ScalarNode,
  options: CompileScalarOptions
): CompiledScalarGradient;
```

- **Design:** forward-mode with one dual lane per parameter, using `DUAL_UNARY_RULES`
  (`core/src/types/dual-rules.ts`), which already cover every lowered function. For
  `^`, use `x^y` with `∂/∂x = y·x^(y−1)` and `∂/∂y = x^y·ln x`. Where `ln x` is
  undefined, mark the row invalid instead of returning NaN silently.
- **Acceptance:**
  - Agrees with symbolic `derivative` (through M2, or a hand-written closed form) to
    1e-12 relative on smooth test trees.
  - Agrees with central differences to about 1e-6 relative.
  - Values are bit-identical to M3.
- **Tests:** `functions/tests/scalar-compile-gradient.test.ts`.

#### M7 — `fitScalarParameters` (PySR-style constant optimization)

- **Package:** `functions`. **Size:** M. **Depends on:** M3, M5 and M6.
- **API sketch:**

```ts
export interface FitScalarOptions {
  readonly parameters: readonly string[];
  readonly initial?: ArrayLike<number>; // default 1 for each
  readonly loss?: 'l2' | 'l1' | 'huber' | ((pred: number, obs: number, w: number) => number); // default 'l2'
  readonly weights?: Float64Array;
  readonly algorithm?: 'lm' | 'bfgs' | 'nelder-mead'; // default 'lm' for l2, 'bfgs' otherwise
  readonly restarts?: number; // PySR optimizer_nrestarts (default 2)
  readonly maxIterations?: number;
  readonly bounds?: readonly (readonly [number, number])[];
  readonly rng?: SeededRng; // restart perturbations; required when restarts > 0
}
export interface FitScalarResult {
  readonly parameters: Float64Array;
  readonly loss: number;
  readonly converged: boolean;
  readonly evaluations: number;
  readonly validRows: number;
  /** √diag((JᵀJ)⁻¹·σ²) for l2 fits with a full-rank Jacobian; null otherwise. */
  readonly standardErrors: Float64Array | null;
}
export function fitScalarParameters(
  node: ScalarNode,
  columns: readonly Float64Array[],
  observed: Float64Array,
  variables: readonly string[],
  options: FitScalarOptions
): FitScalarResult;
```

- **Companion change** (small, additive): add an optional `jacobian` option to
  `levenbergMarquardt` (`functions/src/optimization-extra.ts`), keeping the
  numeric-Jacobian default unchanged. Existing tests must pass without edits.
- **Acceptance:**
  - Recovers planted constants: `a·exp(−b·x)+c` from noise-free data to 1e-8, and with
    seeded Gaussian noise within 3 standard errors.
  - A one-parameter `p·f(x)` fit equals the closed-form `ols` slope that UPT
    `probe/fit.ts` computes today, so the multi-constant fit generalizes the existing
    one.
  - Invalid rows are counted and excluded, never silently treated as zeros.
  - The same `rng` seed gives identical results.
- **Tests:** `functions/tests/fit-scalar-parameters.test.ts`.

#### M8 — Guarded numerical equivalence

- **Package:** `functions`. **Size:** S. **Depends on:** M3 and M5.
- **API sketch:**

```ts
export interface NumericEquivalenceOptions {
  readonly domain: Readonly<Record<string, readonly [number, number]>>; // per-symbol sampling box
  readonly samples?: number; // default 64
  readonly rng: SeededRng;
  readonly relTol?: number; // default 1e-9
  readonly absTol?: number; // default 1e-12
  readonly upToConstant?: boolean; // test a/b constant (UPT "equal up to a dimensionless constant")
  readonly logUniform?: readonly string[]; // sample these symbols log-uniformly (positive domains)
}
export type NumericEquivalence =
  | { readonly verdict: 'consistent'; readonly samplesUsed: number; readonly constant?: number }
  | {
      readonly verdict: 'counterexample';
      readonly at: Readonly<Record<string, number>>;
      readonly a: number;
      readonly b: number;
    }
  | { readonly verdict: 'inconclusive'; readonly reason: 'too-few-valid-samples' };
export function numericallyEquivalent(
  a: ScalarNode,
  b: ScalarNode,
  options: NumericEquivalenceOptions
): NumericEquivalence;
```

- **Wording rule:** `consistent` is evidence, never proof. The JSDoc must say so,
  matching UPT §9 ("Numerical agreement alone never proves symbolic equivalence").
- **Acceptance:**
  - Finds a counterexample for `sqrt(x^2)` vs `x` on a domain that includes negatives.
  - Reports `consistent` for `sin^2+cos^2` vs `1`.
  - With `upToConstant`, finds the constant for `2πx` vs `x`.
  - Reports `inconclusive` when most samples are invalid.
  - Results are deterministic for a given RNG seed.
- **Tests:** `functions/tests/numeric-equivalence.test.ts`.

### Phase 3 — Dimension-aware primitives (conditional on UPT delegation)

UPT owns `ExprNode` dimensional validation. `docs/integration/upt.md` Q2 keeps
dimensional analysis on `Tensor` UPT-only. These milestones cover a different object,
dimension inference over **`ScalarNode`**, and should be built **only if UPT files an
issue asking to delegate**, as it did for units in #347. Until then they stay
candidates.

#### M9 — `inferScalarDimension`

- **Package:** `core` (dimension algebra over `SiDimensionVector`, with `Fraction`
  exponents) or `functions`. The CDG probe decides. **Size:** M.
- **API sketch:**

```ts
export type RationalDimension = readonly [
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
  Fraction,
]; // [L,M,T,I,Θ,N,J]
export type DimensionInference =
  | { readonly ok: true; readonly dimension: RationalDimension }
  | {
      readonly ok: false;
      readonly violation:
        | 'add-mismatch'
        | 'transcendental-arg-not-dimensionless'
        | 'non-literal-exponent-on-dimensional-base'
        | 'unknown-symbol';
      readonly path: readonly number[];
    };
export function inferScalarDimension(
  node: ScalarNode,
  dims: Readonly<Record<string, RationalDimension>>
): DimensionInference;
```

- **Rules:** these are the four rules UPT §7 lists. `[a+b]` requires `[a]=[b]`.
  `exp`, `log` and the trigonometric and hyperbolic functions require a dimensionless
  argument. `abs` passes its argument's dimension through. A non-literal exponent
  requires a dimensionless base. A literal exponent multiplies the dimension exactly,
  so `x^0.5` gives half-integer dimensions.
- **Acceptance:** returns `M L T^-2` for Newton's law of gravitation, assembled from
  `G`, `m1`, `m2` and `r` with CODATA units turned into vectors through
  `toSiDimensionVector`. Each of the four violations, with its path, is pinned.
- **Tests:** a cross-check against UPT's validator is out of repo, so the tests pin
  physics closed forms instead.

#### M10 — Constant-unit solving (PySR's `[⋅]`)

- **Package:** same as M9. **Size:** M. **Depends on:** M9 and `rationalNullspace`.
- **API sketch:**
  `solveParameterDimensions(node, dims, target, parameters) → { solved: Record<string, RationalDimension> } | { underdetermined: string[] } | { inconsistent: true }`.
  It treats each parameter's dimension as an unknown in the linear exponent system
  that M9's rules generate, for trees where the parameters appear multiplicatively.
  Other placements report `underdetermined`.
- **Acceptance:**
  - For `y[m s⁻² kg] = M[kg]·c`, it solves `c = m s⁻²`, which is PySR's
    `docs/src/examples/physics.md:71-75` example.
  - With `dimensionlessOnly`, the same case is `inconsistent`, mirroring
    `dimensionless_constants_only`.

### Phase 4 — Search kit (optional; new package behind a placement probe)

Phase 4 only proceeds if UPT, or another consumer, wants a generic in-process
stochastic generator (UPT §8.1 step 6). The likely home is a new leaf package, for
example `@danielsimonjr/mathts-symbolic-search` depending on `core`, `expression` and
`functions` (with `parallel` for M14), because `functions` is already very large.
That is the 25th package, so the workspace list, the `CLAUDE.md` package tables and
the CDG artifacts all change. Run `bun run docs:graph -- cycles` and the
Definition-of-Ready probe first.

#### M11 — Grammar descriptor + deterministic bounded enumerator

- **Size:** M. **Depends on:** M1. M9 is optional, for dimension-typed generation.
- **API sketch:**

```ts
export interface ScalarGrammar {
  readonly variables: readonly string[];
  readonly parameters?: readonly string[];
  readonly literals?: readonly number[];
  readonly binary: readonly ScalarOperator[];
  readonly unary: readonly LoweredScalarFn[];
  readonly maxSize: number;
  readonly maxDepth?: number;
  readonly argumentLimits?: Readonly<Record<string, readonly number[]>>; // PySR `constraints`, −1 = unlimited
  readonly nesting?: Readonly<Record<string, Readonly<Record<string, number>>>>; // PySR `nested_constraints`
  readonly admit?: (node: ScalarNode) => boolean; // e.g. inferScalarDimension(...).ok
}
export interface EnumerationBudget {
  readonly maxCandidates: number;
  readonly maxWallClockMs?: number;
}
export type EnumerationStop = 'exhausted-space' | 'candidate-limit' | 'time-limit' | 'cancelled';
export function enumerateScalars(
  grammar: ScalarGrammar,
  budget: EnumerationBudget,
  signal?: AbortSignal
): Generator<ScalarNode, EnumerationStop>;
```

- **Acceptance:**
  - Visits trees in non-decreasing size, deterministically and without depending on a
    seed (UPT §7.1).
  - Deduplicates by `scalarCanonicalKey`.
  - For a tiny grammar ({x}, {+,*}, maxSize 3), the visit order is pinned and the
    result is checked against a hand count.
  - The stop reason is reported.
  - Pruning by `admit` happens before children are expanded, when the predicate is
    monotone. The predicate declares whether it is monotone.

#### M12 — Mutation and crossover operators

- **Size:** M. **Depends on:** M1, M5 and M11.
- **API:** each operator is a pure function
  `(node, rng: SeededRng, ctx: { grammar }) => ScalarNode | null`, where `null` means
  the mutation failed (PySR `skip_mutation_failures`). The operators are
  `mutateConstant` (with `perturbationFactor` and `temperature`, §2.5),
  `mutateOperator`, `mutateFeature`, `swapOperands`, `addNode`, `insertNode`,
  `deleteNode`, `rotateTree`, `randomizeTree`, `simplifyConstants` and
  `crossoverSubtrees`. They are combined by a `weightedMutation(weights)` combinator
  that defaults to PySR's weights from §2.2.
- **Acceptance:**
  - Every non-null output satisfies the grammar constraints, checked by a property
    test over 1,000 seeded draws.
  - The empirical mutation frequencies match the weights (χ² test, seeded).
  - The same seed gives the same output sequence.

#### M13 — Regularized-evolution loop

- **Size:** L, splittable into a single-population PR and an islands-plus-migration PR.
  **Depends on:** M3, M4, M7 and M12.
- **API sketch:** `searchScalars(problem, options) → AsyncIterable<SearchProgress>`,
  ending with
  `{ front: ScoredCandidate<ScalarNode>[], stopReason, evaluations, seed }`.
  The options cover PySR's population, tournament, annealing, adaptive-parsimony,
  migration, `optimizeProbability` and `seeds` (guesses) settings, under a UPT-shaped
  budget (`maxEvaluations`, `maxWallClockMs`, `maxCandidates`).
- **Acceptance:**
  - Rediscovers planted laws from noise-free data within a fixed evaluation budget,
    for fixed seeds: `x^2 + x`, and `G·m1·m2/r^2` with one fitted constant. The
    fixtures are committed.
  - Serial mode is byte-identical across runs for the same seed.
  - A front is always returned, including on budget exhaustion.
  - The report never labels a candidate beyond "fitted".

#### M14 — Parallel population evaluation

- **Size:** M. **Depends on:** M3 and M13.
- **Design:** post `ScalarNode` JSON and column buffers to `WorkerPool` workers, and
  compile inside the worker. Keep the `timeoutMs` and replacement plumbing (a security
  invariant). Results are merged deterministically by candidate index, so a parallel
  run equals a serial run for the same seed.
- **Acceptance:** parallel and serial fronts are identical for the same seed. Any
  speedup claim goes into a committed benchmark that follows `AGENTS.md`, and the
  per-op threshold reaches the dispatch code (benchmark rule 9).

### Phase 5 — Reporting

#### M15 — Front export

- **Size:** S. **Depends on:** M2 and M4.
- **API sketch:** `frontToLatexTable(scored, { variables, precision })` (cf.
  `pysr/export_latex.py` `sympy2latextable`) and `frontToJson(scored)`, a stable
  schema that includes canonical keys.
- **Acceptance:** the LaTeX output is pinned as strings, and the JSON round trip
  restores identical keys.

---

## 7. Explicitly out of scope (non-decisions)

- **Vendoring or wrapping PySR / Julia / Python.** UPT §0.2 row 9 and §10.3 rule this
  out. An external PySR worker is UPT's protocol concern (UPT §11), not MathTS's.
- **WASM / WebGPU `ScalarNode` evaluation.** Not planned until an M3 benchmark exists
  and shows memory-bound batch evaluation losing to a kernel. `AGENTS.md` records
  several "WASM is faster" assumptions that measured slower.
- **New `ScalarNode` arms** (n-ary calls, `sqrt` / `square` as separate functions,
  conditionals, tensors). `^` already covers powers. Revisit only with a consumer
  request, because UPT's lowering depends on the current arms.
- **`TemplateExpressionSpec`-style skeletons, differential operators `D(f)`,
  `TypeSpec`, `denoise`, feature selection.** Revisit after M13.
- **Dimensional analysis on `Tensor`.** It remains UPT-only (`docs/integration/upt.md`
  Q2).

## 8. Open questions for the owner

1. **Phase 3 delegation.** Does UPT want MathTS to own `ScalarNode` dimension inference
   (M9/M10), or should UPT keep its validator as the sole authority? The default is
   that UPT keeps it.
2. **Phase 4 home.** Is a 25th package acceptable for the search kit, or should it live
   under a `functions` subpath?
3. **Constant uncertainty.** If constants are "data", should
   `functions/src/type/unit/physicalConstants.ts` carry CODATA standard uncertainties?
   This would feed `propagateUncertainty` and M7's weights.
4. **Front statistic for likelihood losses.** PySR leaves the score undefined for
   linear loss scales (§2.3). Should M4 offer an AIC- or BIC-style alternative?

## 9. Sources read

**PySR** (clone of `danielsimonjr/pysr` at `72a9ab9`, read-only):

- `pysr/sr.py` (`__init__` `:1092-1216`, docstring from `:478`, `idx_model_selection`
  and `calculate_scores` `:3414-3466`, determinism check `:2405`)
- `pysr/expression_specs.py`
- `pysr/mutations.py`
- `pysr/export_sympy.py`
- `pysr/export_latex.py`
- `pysr/juliapkg.json`
- `docs/src/backend.md`
- `docs/src/tuning.md`
- `docs/src/examples/physics.md`
- `docs/src/examples/search-behaviour.md`

**UPT** (clone of `danielsimonjr/universal-physics-tensor`, read-only):

- `docs/planning/Scientific-Bridge-Discovery-v1.md` (§0.2, §7–§10)
- `src/composition/probe/fit.ts`
- `src/composition/expr-eval.ts`
- `src/composition/algebraic-equivalence.ts`
- `src/canonical/normal-form.ts`
- `src/atlas/witness-symbolic.ts`
- the MathTS import sites under `src/`

**MathTS:**

- `README.md`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`
- `docs/FEATURE_WORKFLOW.md`, `docs/README.md`, `docs/integration/upt.md`,
  `docs/roadmap/ITENSOR_PARITY.md`
- `expression/src/scalar-builder.ts`, `expression/src/index.ts`
- `functions/src/scalar-eval.ts`, `functions/src/index.ts`
- `functions/src/numeric/bfgs.ts`, `functions/src/optimization-extra.ts`
- `functions/src/algebra/{symbolicEqual,leafCount}.ts`
- `functions/src/factories/index.ts`
- `functions/src/grad-forward.ts`
- `functions/src/type/unit/physicalConstants.ts`
- `core/src/types/{si-dimension-vector,dual-rules}.ts`, `core/src/types/unit/Unit.ts`
- `core/tests/types/unit-upt-delegation.test.ts`
- `tensor/src/operations/random.ts`, `autograd/src/index.ts`
- the open issue list (`gh issue list`; the open issues are PhysJS kernel requests
  #375–#384, none of which overlap this roadmap)
