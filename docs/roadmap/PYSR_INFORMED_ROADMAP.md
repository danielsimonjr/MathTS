# Proposal: PySR-informed symbolic-search primitives in MathTS

> **Guiding principle (Daniel):** Reuse and expand the existing libraries and packages; add new functionality, files or packages only when necessary or truly missing from the codebase. Reviewers must reject PRs that duplicate or bypass existing code.

Every milestone and every integration sprint in this roadmap is judged against that
principle. A new file needs a stated reason that no existing module fits. D-1 is decided:
no new package for this roadmap (§10).

**Author:** MathTS maintenance
**Date:** 2026-10-22 (refreshed 2026-10-23 against the
[2026-10-22 codebase audit](../audit/2026-10-22-codebase-audit.md))
**Status:** Active. Phase 1: M1 ([#396](https://github.com/danielsimonjr/MathTS/pull/396)),
M3 ([#397](https://github.com/danielsimonjr/MathTS/pull/397)) and M4
([#395](https://github.com/danielsimonjr/MathTS/pull/395)) are merged; M1's weight lookup was
fixed in [#407](https://github.com/danielsimonjr/MathTS/pull/407). Sprint 1R items 1–7 are
merged ([#412](https://github.com/danielsimonjr/MathTS/pull/412)–[#418](https://github.com/danielsimonjr/MathTS/pull/418),
[#434](https://github.com/danielsimonjr/MathTS/pull/434)–[#438](https://github.com/danielsimonjr/MathTS/pull/438)); **exit
criteria are met** (consumer seeded-output fixtures recorded at commit `a6cf17af`, pre-#415, pinned in
`tensor/tests/operations/random.test.ts`, `functions/tests/typed-hypothesis-bootstrap.test.ts`,
`functions/tests/typed-dist-objects-workers.test.ts`, `functions/tests/typed-graph-workers.test.ts`). §6 B9 for M1, M3 and M4 stays **Partly** (no review was recorded on
[#396](https://github.com/danielsimonjr/MathTS/pull/396), [#397](https://github.com/danielsimonjr/MathTS/pull/397),
or [#395](https://github.com/danielsimonjr/MathTS/pull/395), and the later audit was after merge). M2 is merged
([#440](https://github.com/danielsimonjr/MathTS/pull/440), `71f8c3ce`). M5 (`createSeededRng`/`fork`) is implemented in `core`.
Phase 1 (M2 and M5) is complete. **M6** (`compileScalarGradient`), **M7** (`fitScalarParameters`) and **M8** (`numericallyEquivalent`) are implemented; sprints 2R–5R remain open. B9 for M5, M6, M7 and M8 stays open until a review is recorded.
D-1, D-2 and D-3 are decided (§10); D-2 is implemented (#414) and D-3 is implemented
(#413). Tags, GitHub Releases and publish stay off until `RELEASES_ENABLED=true` (§7, #411).
**Target packages:** `@danielsimonjr/mathts-expression`, `@danielsimonjr/mathts-functions`,
`@danielsimonjr/mathts-core` for the milestones; the integration sprints also touch
`matrix`, `parallel`, `tensor`, `workerpool`, `workbook` and `plot`. **D-1 is decided:** there is no 25th package. Phase 4 lives in `functions`, and M11 may sit in `expression` next to `scalar-structure.ts` only if it imports `expression` and `core` alone. A package is not an option in this roadmap (§8, Phase 4; §10).
**Related external projects:** [PySR](https://github.com/danielsimonjr/pysr) (fork of MilesCranmer/PySR, studied read-only at commit `72a9ab9`, backend pin `SymbolicRegression ~2.7.2` in `pysr/juliapkg.json`); [Universal Physics Tensor (UPT)](https://github.com/danielsimonjr/universal-physics-tensor) (studied read-only at its default-branch HEAD).
**Related MathTS docs:** [`docs/integration/upt.md`](../integration/upt.md), [`docs/FEATURE_WORKFLOW.md`](../FEATURE_WORKFLOW.md), [`ITENSOR_PARITY.md`](ITENSOR_PARITY.md) (same proposal format), the merged plans [`PYSR_M1_PLAN.md`](../plans/PYSR_M1_PLAN.md), [`PYSR_M3_PLAN.md`](../plans/PYSR_M3_PLAN.md) and [`PYSR_M4_PLAN.md`](../plans/PYSR_M4_PLAN.md).

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
primitives** that both PySR's backend and UPT's Product B pipeline need, and it should
build them out of the numerics it already has. When this roadmap was written, UPT worked
around each missing primitive by hand. Three of them now exist in MathTS:

| UPT workaround (file read)                                                                                                                             | Missing MathTS primitive                    | MathTS today                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/composition/probe/fit.ts` evaluates a candidate per row (`rows.rows.map(row => evalExpr(expr, row))`) and fits a **single prefactor** with `ols`. | Batch evaluator; multi-constant fitting     | Batch evaluator: `compileScalar` (M3, merged). Multi-constant fitting: `fitScalarParameters` (M7, merged).      |
| `src/composition/algebraic-equivalence.ts` renders both sides to a gensym **string**, then calls `parse` + `simplify`.                                 | `ScalarNode` ↔ expression `Node` bridge     | `scalarToNode` / `nodeToScalar` / `simplifyScalar` / `scalarToTex` (M2, `functions/src/scalar-node-bridge.ts`). |
| `src/canonical/normal-form.ts` hashes structure, but its header says `a/(b/c)` and `a·c/b` hash differently.                                           | Canonical structural key for `ScalarNode`   | `scalarCanonicalKey` (M1, merged).                                                                              |
| `src/atlas/witness-symbolic.ts` reseeds the **global** `seedProbabilityRng(spec.id)` before sampling.                                                  | Instance-scoped, splittable seeded RNG      | `createSeededRng` / `fork` (M5, in `core`).                                                                     |
| No loss-vs-complexity front utility exists in either repo.                                                                                             | Pareto front + PySR-style score / selection | `paretoFront`, `scoreFront`, `selectFrontModel` (M4, merged).                                                   |

There are five phases and fifteen milestones (§8). Each milestone is scoped to one
focused PR. Each phase ends with an **integration sprint** (Sprint 1R to Sprint 5R) that
removes the duplicates and documentation gaps the audit found in the code that phase
touches. Every milestone and every sprint has a Definition of Done (§6).

**Next, in order:**

1. **Phase 1 (M2 and M5) is complete.** M2 is on `main` as
   [#440](https://github.com/danielsimonjr/MathTS/pull/440) (`71f8c3ce`). M5 is
   `createSeededRng` / `fork` in `core`. **M6** (`compileScalarGradient`), **M7**
   (`fitScalarParameters`) and **M8** (`numericallyEquivalent`) are implemented; next
   is Sprint 2R. Leave §6 B9 for M5, M6, M7 and M8 unchecked until a review is recorded.
2. **Sprint 1R** is closed at the sprint level (items 1–7 merged; exit criteria met; DoD boxes
   ticked below). Do not tick §6 B9 for M1, M3 or M4.
3. **Phase 2 (M6–M8) is complete.** Next is Sprint 2R (ODE/BVP/DAE Jacobians, Nelder–Mead merge,
   `linearRegression`/`linregress`, `numericRealRoots`; LM/`svds`/`matMul` already moved
   into Sprint 1R).

---

## 1. Framing and division of labour

| Concern                                                                                          | Owner                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search policy, epistemic status, adjudication, falsifiers, holdouts, multiple-hypothesis control | **UPT** (`src/composition/probe/*`, Scientific-Bridge-Discovery-v1 §1.3–1.5, §13, §15)                                                                                                                                                                  |
| UPT's physics AST (`ExprNode`), its dimensional validator, `normalForm`, `CanonicalEquation`     | **UPT** (`src/dimensional/ast-types.ts`, `src/dimensional/validator.ts`, `src/canonical/normal-form.ts`)                                                                                                                                                |
| Scalar IR that UPT lowers into (`ScalarNode`), its evaluation, simplification, LaTeX             | **MathTS** (`expression/src/scalar-builder.ts`, `expression/src/scalar-structure.ts`, `functions/src/scalar-eval.ts`, `functions/src/scalar-compile.ts`; UPT lowers into it in `src/composition/expr-eval.ts`)                                          |
| Numerics: optimizers, statistics, seeded RNG, units/dimension vectors, constants                 | **MathTS** (`functions/src/numeric/bfgs.ts`, `functions/src/optimization-extra.ts`, `functions/src/numeric/numeric-jacobian.ts`, `core/src/numeric/stable.ts`, `core/src/types/si-dimension-vector.ts`, `functions/src/type/unit/physicalConstants.ts`) |
| Generic search kit (mutations, enumerator, evolution loop)                                       | **MathTS, Phase 4, optional.** UPT may wrap it as a `CandidateGenerator` (UPT §7.1) or keep its own enumerator. Home: `functions` by default; M11 may sit in `expression` if the placement probe allows. D-1 is decided: no new package (§10).          |

The roadmap is built around one design decision: **`ScalarNode` is the interchange
IR.** It is already public, it is already what UPT lowers into (`docs/integration/upt.md`
§ "Scalar ExprNode evaluation"), and it is small. Its four arms are `number`, `symbol`,
`op` (`+ - * / ^`) and `call` (12 input names that lower to 11 unary functions), defined in
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
  computes `score_i = −ln(loss_i / loss_{i−1}) / (c_i − c_{i−1})`. The first row scores 0. A later row with `loss_i ≤ 0` scores `+∞` (the Python test is `curMSE > 0.0`).
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
| Expression trees + operator sets by arity                      | **Yes.** `ScalarNode` already exists, with `+ - * / ^` and 11 lowered unary functions (12 input names).                 | M1 (structure, merged), M11 (operator-set and grammar descriptor)                      |
| Complexity (weighted node count)                               | **Yes.** UPT §8 budgets already count `maxAstDepth` and `maxOperators`.                                                 | M1 `scalarComplexity` with PySR-style weights (merged)                                 |
| Pareto front per complexity + score + `best` selection         | **Yes**, as a reporting and ranking device. It is never a status decision (UPT §1.4).                                   | M4 (merged): `paretoFront`, `scoreFront`, `selectFrontModel`                           |
| Constant fitting (BFGS / Nelder–Mead, restarts)                | **Yes.** It generalizes UPT's single-prefactor `ols` fit to several constants.                                          | M6 exact gradients, M7 `fitScalarParameters`                                           |
| Simplification during and after search                         | **Yes, and more strongly.** UPT needs canonical equivalence, not only shorter output.                                   | M1 canonical key (merged), M2 Node bridge (reuses `simplify`), M8 numeric equivalence  |
| Dimensional constraints                                        | **Yes, but as generation-time typing** (UPT §7), not an additive penalty.                                               | M9 dimension inference, M10 constant-unit solving (built only if UPT asks to delegate) |
| Structural constraints (`maxsize`, nesting, argument size)     | **Yes.** They map onto UPT `SearchBudget` and grammar rules.                                                            | M11 grammar descriptor, M12 constraint-checked mutations                               |
| Mutation + crossover operators                                 | **Partly.** They are useful for an optional stochastic backend (UPT §8.1 step 6), not for the deterministic enumerator. | M12                                                                                    |
| Islands, migration, annealing, adaptive parsimony              | **Optional.** This is the step-6 "stochastic generator", and it is declared `seeded`.                                   | M13                                                                                    |
| Batching rows                                                  | **Yes**, for large observation sets. UPT keeps holdouts separate (`fit.ts`: "Generation never sees holdout rows").      | M3 (merged) accepts any columns; the caller picks the row subset                       |
| `guesses` / warm start                                         | **Yes.** Known equations are natural seeds for bridge search.                                                           | M13 `seeds` option, plus JSON round-trip of `ScalarNode` (it is already plain data)    |
| `TemplateExpressionSpec` (fixed skeleton + free sub-trees)     | **Interesting later.** It fits "a known law × an unknown correction".                                                   | Out of scope until M13 exists (§9)                                                     |
| SymPy / LaTeX export                                           | **Yes**, through the existing expression `Node.toTex`.                                                                  | M2, M15                                                                                |
| JAX / PyTorch export, `TypeSpec`, `denoise`, feature selection | **No**, for now. The author does not use `denoise` or `select_k_features` either (`docs/src/tuning.md:40`).             | None                                                                                   |

---

## 3. MathTS today (relevant surfaces, as read)

Re-read on 2026-10-23 against `origin/main` after [#408](https://github.com/danielsimonjr/MathTS/pull/408);
the LM / `svds` / Mulberry32 / `SiDimensionVector` notes below were reconciled on 2026-10-24
against #412–#418. Line numbers drift; the symbol names are the stable reference.

| Surface                                                                                | Where                                                                                                                                                                                                                                                                                                                                                                                                                                      | Notes for this roadmap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ScalarNode` IR + `createScalarBuilder`                                                | `expression/src/scalar-builder.ts`, exported from `expression/src/index.ts:45-57` (`createScalarBuilder`, `SCALAR_FUNCTIONS`, `SCALAR_FUNCTION_LOWERING`, `ScalarBuildError`; types `ScalarNode`, `ScalarOperator`, `LoweredScalarFn`, `ScalarFunctionName`, `ScalarBuilder`)                                                                                                                                                              | Four arms. `^` takes exactly two arguments. `+ - * /` are n-ary and fold left to right. `ln` lowers to `log` and `log` lowers to `log10` (`SCALAR_FUNCTION_LOWERING`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ScalarNode` structural toolkit (**M1, merged**)                                       | `expression/src/scalar-structure.ts`, exported from `expression/src/index.ts:58-69`                                                                                                                                                                                                                                                                                                                                                        | `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`, `scalarEquals`, type `ScalarComplexityWeights`. Weight records are read through the own-property helper `hasOwnProperty` (`core/src/shared.ts`, re-exported by `expression/src/utils/object.ts`) since #407. Runnable `@example` TSDoc and `docs/Architecture` prose (Sprint 1R item 5). Every later milestone uses these for traversal, budgets and deduplication. `normalForm` (`functions/src/typed/algebra.ts`) is a string normalizer, not this key.                                                           |
| `evaluateScalar` / `scalar`                                                            | `functions/src/scalar-eval.ts`, exported at `functions/src/index.ts:49`                                                                                                                                                                                                                                                                                                                                                                    | Recursive interpreter for **one scope at a time**. It dispatches each operation through typed `add` / `pow` / … and throws `ScalarEvalError` on a non-finite operator or call result. It accepts formula strings and `transcendental` / `abs` nodes through `scalar.from`.                                                                                                                                                                                                                                                                                                                                                                                   |
| Batch evaluator `compileScalar` (**M3, merged**)                                       | `functions/src/scalar-compile.ts`, exported at `functions/src/index.ts:51` (types `CompileScalarOptions`, `ScalarBatchResult`, `CompiledScalar`)                                                                                                                                                                                                                                                                                           | Register tape over `Float64Array` columns with a per-row validity mask. No `eval` or `new Function`. It calls the same `Math.*` operations as the typed `number` signatures, without per-row typed dispatch. It takes a `ScalarNode` only (normalize with `scalar.from` first). It imports `NUMERIC_LITERAL` from `scalar-eval.ts` (Sprint 1R item 3). `@example` TSDoc and architecture prose (item 5). Benchmark: batch beats per-row `evaluateScalar` on the committed grid in two Node V8 runs; see [`docs/BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md#evaluatescalar-vs-compilescalar-m3-batch-evaluator--2026-10-25). **M14 threshold = 100 rows.** |
| `ScalarNode` ↔ expression `Node` bridge (**M2, merged #440**)                          | `functions/src/scalar-node-bridge.ts`; `scalarToNode`, `nodeToScalar`, `simplifyScalar`, `scalarToTex` on the `functions` barrel via `export *` from `functions/src/factories/index.ts`                                                                                                                                                                                                                                                    | Wired `ConstantNode` / `SymbolNode` / `OperatorNode` / `FunctionNode` plus `simplify` and `Node.toTex`. No formula string. `expression` re-exports `MathNode` and `StringOptions` types. Tests: `functions/tests/scalar-node-bridge.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pareto front and PySR scoring (**M4, merged**)                                         | `functions/src/pareto-front.ts`, exported at `functions/src/index.ts:54`                                                                                                                                                                                                                                                                                                                                                                   | `paretoFront`, `scoreFront`, `selectFrontModel`, `ParetoFrontError`; types `FrontCandidate`, `ScoredCandidate`. Unrelated to the Pareto _distribution_ `paretoDist` (`functions/src/typed/dist-objects.ts:1177`). `@example` TSDoc and architecture prose (item 5).                                                                                                                                                                                                                                                                                                                                                                                          |
| Expression `Node` AST, `toTex`, `simplify`, `derivative`, `symbolicEqual`, `leafCount` | `expression/src/node/*` (`Node.toTex` at `expression/src/node/Node.ts:395`), `functions/src/algebra/{simplify,derivative,symbolicEqual,leafCount}.ts`                                                                                                                                                                                                                                                                                      | All operate on `Node`, not on `ScalarNode`. The node classes are built from the expression `create*Node` factories in `functions/src/factories/index.ts` (`_OperatorNode`, `_ParenthesisNode`, `_ConstantNode`, `_SymbolNode`, `_FunctionNode`, lines 977-1037) and are not on the `functions` barrel. `symbolicEqual` simplifies `e1 − e2` and is one-sided ("`false` does not absolutely rule this out"). `leafCount` counts leaves only.                                                                                                                                                                                                                  |
| Optimizers                                                                             | `functions/src/numeric/bfgs.ts` (`bfgs`, optional analytic `grad`, projected box bounds), `functions/src/optimization-extra.ts` (`nelderMead`, `gradientDescent`, `levenbergMarquardt`)                                                                                                                                                                                                                                                    | All take `number[]` closures. `levenbergMarquardt` options are `LMOptions` (`maxIter?`, `tol?`, optional analytic `jacobian`; default Jacobian remains `numericJacobian(..., { h: 1e-7, scheme: 'forward' })`). `fitScalarParameters` (`functions/src/fit-scalar.ts`, M7) wires `compileScalarGradient` into LM/BFGS/NM. `curvefit` (`functions/src/typed/numeric.ts:909`) is a wrapper over LM. `minimize` (`functions/src/typed/numeric.ts:264`) is a second public Nelder–Mead (Sprint 2R).                                                                                                                                                               |
| Shared numeric Jacobian                                                                | `numericJacobian` (`functions/src/numeric/numeric-jacobian.ts:47`, on the `functions` barrel)                                                                                                                                                                                                                                                                                                                                              | Central differences by default, with optional `scheme: 'forward'` (#416). Step `max(1, \|x\|)·cbrt(eps)`. `levenbergMarquardt` / `curvefit` now call it. `solveBVP`, `solveODE` (stiff methods) and `solveDAE` still bypass it with private forward differences (Sprint 2R).                                                                                                                                                                                                                                                                                                                                                                                 |
| Stable reductions and tolerance                                                        | `pairwiseSum`, `pairwiseDot`, `norm2` (`core/src/numeric/stable.ts`, on the `core` barrel); `nearlyEqual` (`core/src/number.ts:710`, through `@danielsimonjr/mathts-core/internal`)                                                                                                                                                                                                                                                        | New losses, residual sums and tolerance checks use these. `svds` (`functions/src/numeric/svds.ts:117`) uses core `norm2` since #416. Private `norm2` copies remain in `eigsh.ts`, `fsolve.ts` and `krylov.ts` (Sprint 2R).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Forward-mode duals                                                                     | `core/src/types/dual.ts`, `core/src/types/dual-rules.ts` (`DUAL_UNARY_RULES`), `functions/src/grad-forward.ts` (`derivativeAt`, `valueAndDerivativeAt`, `gradientAt`)                                                                                                                                                                                                                                                                      | The dual rules cover every lowered `ScalarNode` function (exp, log, log2, log10, sin, cos, tan, sinh, cosh, tanh, abs), so exact constant gradients need no new calculus. They are unary only; `^` needs its two partials (M6).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Reverse-mode AD                                                                        | `autograd/src/{tape,reverse-grad,grad}.ts`                                                                                                                                                                                                                                                                                                                                                                                                 | Tensor-level. It is not needed for the scalar constant counts PySR uses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Units and dimension vectors                                                            | `core/src/types/unit/Unit.ts` (10-slot `dimensions`, `equalBase`, `multiply` / `divide` / `pow`), `core/src/types/si-dimension-vector.ts` (`SiDimensionVector` `[L,M,T,I,Θ,N,J]`, "the order UPT's Buckingham routine uses"; `toSiDimensionVector` and its inverse `fromSiDimensionVector`, plus the record form `fromSiDimensions`)                                                                                                       | `SiDimensionVector` exponents are `core` `Fraction`s since #414 (`si-dimension-vector.ts:44-52`). D-2 is decided and implemented. `Unit.dimensions` stays `number[]`. Unit-string parsing was hardened for UPT delegation (issue #347, `core/tests/types/unit-upt-delegation.test.ts`). `docs/integration/upt.md` Q2 keeps dimensional analysis **on `Tensor`** UPT-only.                                                                                                                                                                                                                                                                                    |
| Physical constants                                                                     | `functions/src/type/unit/physicalConstants.ts` (CODATA-2022, each one a core `UnitInstance`)                                                                                                                                                                                                                                                                                                                                               | They carry no uncertainty field (no `uncertainty` occurrences in the file), which matters if constants become "data" (open question, §10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Exact rational nullspace                                                               | `rationalNullspace` (`functions/src/numeric/rational-nullspace.ts:145`, re-exported through `functions/src/typed/numeric.ts`; used by UPT `src/dimensional/buckingham.ts`)                                                                                                                                                                                                                                                                 | It is the core of constant-unit solving (M10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Seeded RNG                                                                             | `createSeededRng` / `SeededRng` in `core/src/numeric/rng.ts` (M5). `seedProbabilityRng` (global, seedrandom, `functions/src/typed/probability.ts:300`) and `createRng` (seedrandom, `functions/src/probability/util/seededRNG.ts:14`) unchanged (§9). Canonical `mulberry32` / `boxMuller` / `rowMajorStrides` in `core` (#415). Worker-bundle copy of `mulberry32` and `rowMajorStrides` in `packages/workerpool/src/worker-numerics.ts`. | Number `next()` matches `mulberry32` (ToInt32); strings are FNV-1a 32 over UTF-8; `fork` does not advance the parent. `seedProbabilityRng` / `createRng` stay seedrandom (§9). Existing `randomTensor` / hypothesis / `sampleN` / graph samplers still call `mulberry32` directly (pinned fixtures).                                                                                                                                                                                                                                                                                                                                                         |
| Guarded numerical equivalence (**M8**)                                                 | `functions/src/numeric-equivalence.ts`, exported at `functions/src/index.ts:57` (`numericallyEquivalent`, `NumericEquivalenceError`; types `NumericEquivalenceOptions`, `NumericEquivalence`)                                                                                                                                                                                                                                              | Samples with `SeededRng.next`, evaluates both trees through `compileScalar`, compares with core `nearlyEqual` (`relTol` / `absTol`). A `consistent` verdict is evidence, never proof of symbolic equivalence. Tests: `functions/tests/numeric-equivalence.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                          |
| Parallel execution                                                                     | `parallel/src/{ComputePool,WorkerPool}.ts`; `kernelSource` (`functions/src/typed/parallel-map.ts:24`)                                                                                                                                                                                                                                                                                                                                      | `WorkerPool#execute` `timeoutMs` and hung-worker replacement are a security invariant (`AGENTS.md`). A closure cannot be posted to a worker. `kernelSource` serializes self-contained functions plus their dependencies into worker source. `workerpool` cannot import `functions` (it would cycle through `parallel`).                                                                                                                                                                                                                                                                                                                                      |
| Search kit (grammar, enumerator, mutations, evolution loop)                            | `scalarToNode` / `nodeToScalar` / `simplifyScalar` / `scalarToTex` (M2), `compileScalarGradient` (M6), `fitScalarParameters` (M7), `numericallyEquivalent` (M8). No `enumerateScalars`, `inferScalarDimension`, `frontToLatexTable`, or `solveParameterDimensions` yet.                                                                                                                                                                    | Greenfield beyond M2, built on the M1–M8 exports above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## 4. Gap analysis

| #   | Gap                                                                                                                                               | Evidence                                                                                                                        | Milestone | Status                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| G1  | No traversal, size/depth, weighted complexity or symbol collection for `ScalarNode`                                                               | `expression/src/scalar-builder.ts` exported only build and normalize functions                                                  | M1        | **Closed** by #396 (`expression/src/scalar-structure.ts`)                                                         |
| G2  | No canonical structural key for `ScalarNode` (commutative flattening, `a/(b/c)` ≡ `a·c/b`, `a·a` ≡ `a^2`)                                         | UPT `src/composition/algebraic-equivalence.ts` header                                                                           | M1        | **Closed** by #396 (`scalarCanonicalKey`)                                                                         |
| G3  | No direct `ScalarNode` ↔ `Node` conversion, so `simplify` / `toTex` / `derivative` need a string round trip                                       | UPT `algebraic-equivalence.ts` (`renderGensym`, then `parse`, then `simplify`)                                                  | M2        | **Closed** (`functions/src/scalar-node-bridge.ts`; no `parse(` in module)                                         |
| G4  | No columnar batch evaluator. Per-row interpretation goes through typed dispatch, with a throw on failure                                          | `functions/src/scalar-eval.ts`; UPT `probe/fit.ts` `predictions()`                                                              | M3        | **Closed** by #397 (`compileScalar`)                                                                              |
| G5  | No Pareto front, front score or model-selection utility                                                                                           | §3, Pareto row                                                                                                                  | M4        | **Closed** by #395 (`paretoFront`, `scoreFront`, `selectFrontModel`)                                              |
| G6  | No instance-scoped, splittable seeded RNG (`createSeededRng` / `fork`). The Mulberry32 _body_ is in `core` (#415); one worker-bundle copy remains | §3 RNG row; UPT `witness-symbolic.ts` reseeds the global stream                                                                 | M5        | **Closed** (API in `core`; worker mulberry32 copy unchanged; `seedProbabilityRng` / `createRng` not migrated, §9) |
| G7  | `levenbergMarquardt` has no analytic-Jacobian hook (exact `ScalarNode` parameter gradients: **closed** via `compileScalarGradient`, M6)           | `compileScalarGradient` (`functions/src/scalar-compile.ts`); `levenbergMarquardt` `LMOptions.jacobian`, `optimization-extra.ts` | M6, M7    | **Closed** (M6 gradients; M7 optional `jacobian` on LM)                                                           |
| G8  | No multi-constant fit of an expression to data (PySR §2.5)                                                                                        | UPT `probe/fit.ts` fits one prefactor with `ols`                                                                                | M7        | **Closed** (`fitScalarParameters`, `functions/src/fit-scalar.ts`)                                                 |
| G9  | No guarded numerical-equivalence check (UPT §9 level 5)                                                                                           | `symbolicEqual` is symbolic and one-sided                                                                                       | M8        | **Closed** (`functions/src/numeric-equivalence.ts`; `numericallyEquivalent`)                                      |
| G10 | No dimension inference over `ScalarNode` with rational exponents, and no constant-unit solving (PySR's `[⋅]`)                                     | UPT owns `ExprNode` validation; `ScalarNode` has none                                                                           | M9, M10   | Open (conditional on UPT delegation)                                                                              |
| G11 | No grammar / operator-set descriptor, no enumerator, no mutation / crossover operators, no evolution loop                                         | Greenfield                                                                                                                      | M11–M13   | Open (optional)                                                                                                   |
| G12 | No front export (LaTeX table / JSON report) comparable to `sympy2latextable`                                                                      | `pysr/export_latex.py:62`                                                                                                       | M15       | Open                                                                                                              |

---

## 5. Cross-cutting rules for every milestone and sprint

- **Reuse first (the guiding principle).** Before writing code, name the existing
  symbols that already do part of the job (the reuse map in
  [audit §7](../audit/2026-10-22-codebase-audit.md) and the "Reuse" bullet of each
  milestone below), and call them. A private copy of an existing algorithm is a
  duplicate even when its name differs: the name-based duplicate gate does not see it,
  so the reviewer checks for it by grep.
- **No IR change in Phases 1–3.** Milestones consume `ScalarNode` exactly as
  `createScalarBuilder` produces it. Free constants are `symbol`s named in a
  `parameters` list.
- **No new package.** D-1 is decided: out of scope for this roadmap. Code goes into the
  package that already owns the surrounding code and already has the needed dependency
  edges. A new dependency edge between existing packages (for example `workerpool` →
  `core`) is allowed when it creates no cycle (`bun run docs:graph -- cycles`).
- **Oracle-pinned tests** (`ROADMAP.md` guiding principles). Pin against hand-computed
  closed forms, PySR's published formulas (§2.3), or parity with an existing,
  independent implementation (`evaluateScalar`, `simplify`, `numericJacobian`).
  Never pin a result against a round trip through the code under test.
- **Determinism.** Anything stochastic takes an explicit seed or RNG, and a test asserts
  that the same seed gives byte-identical output.
- **No performance claims without a committed benchmark**, following the `AGENTS.md`
  benchmarking rules: interleave the variants, keep a control, measure on Node with
  `tools/benchmark/wasm/run-node.mjs`-style isolation, and run twice. WASM and GPU
  evaluation of `ScalarNode` are **not** planned until a benchmark shows a win.
- **Sandbox invariant.** Code in `expression/src` that reads a record by a name taken
  from a tree or from user input uses an own-property check (`hasOwnProperty`) or
  `getSafeProperty` (`expression/src/utils/customs.ts`), never a bare `obj[name]`. M1's
  `scalarComplexity` broke this rule and was fixed in #407. If M2 builds `Node`s, it does
  so through the existing constructors.
- **Repo gates.** The Definition of Done base checklist (§6) lists them. For a new
  `functions` export, rebuild before committing, because the pre-commit
  `docs:functions` step reads `dist` and **refuses** to rewrite the API docs until that
  dist is fresh (`CLAUDE.md` known issues). Rebuild-before-commit stays the remedy.

---

## 6. Definition of Done (DoD) base checklist

Every milestone and every integration sprint below carries the line
**"DoD: base checklist + the following specifics"**. The item is done only when every box
of the base checklist and every specific box is ticked in its pull request, with evidence
(a command and its output, or a file and line). Copy this list into the PR description.

- [ ] **B1 Reuse.** Implemented by reusing existing code. The PR names every reused symbol
      with its path, and gives the reason for every new file (no existing module fits).
      Nothing duplicates or bypasses an existing implementation, including under another
      name (reviewer grep).
- [ ] **B2 Oracle tests.** Tests are pinned to independent oracles (hand-computed closed
      forms, published reference formulas, or parity with an existing independent
      implementation), never to a round trip through the code under test. They cover the
      edge cases: empty input, non-finite values, domain boundaries, invalid arguments
      and their typed errors. Test files import `describe`, `it` and `expect` from
      `vitest` explicitly.
- [ ] **B3 Integrated and exported.** Every public symbol is re-exported from the
      package's `src/index.ts` and appears on the published surface (`dist/index.d.ts`,
      checked by `node tools/test/consumer-typecheck.mjs`). Internal refactors leave the
      public surface unchanged unless the PR says otherwise.
- [ ] **B4 TSDoc and usage guide.** Every new or changed export has TSDoc (parameters,
      return value, thrown errors, an `@example`). The package README and
      `docs/api/<package>.md` carry a usage section with an example that runs.
- [ ] **B5 Architecture and reference docs.** `bun run docs:deps` is re-run and its
      output committed. The hand-written prose in `docs/Architecture/`
      (`OVERVIEW`, `ARCHITECTURE`, `COMPONENTS`, `API`, `DATAFLOW`) and
      `docs/reference/` (where the package has a page) is updated. This roadmap's status
      line, §3 row and §4 gap row are updated.
- [ ] **B6 Docs gates pass:** `bun run docs:deps`, `bun run docs:functions:check`,
      `bun run check:duplicates:fast`, `bun run check:file-census`,
      `bun run docs:roadmap-check`, `bun run check:browser-safety`,
      `repo-tools check . --docs=docs/Architecture` and `bun run format:check`.
- [ ] **B7 Changeset.** A changeset (`.changeset/*.md`) for every package touched. No
      version bump, tag or publish (§7).
- [ ] **B8 Code gates.** `bun run typecheck` reports 0 errors; `bun run lint`
      (`oxlint --deny-warnings`) reports 0 warnings; the affected package tests pass;
      `check:duplicates:fast` reports no new `TRUE_DUPLICATE`; `check:browser-safety`
      passes (no `node:` imports); Linux CI is green on the PR head commit.
- [ ] **B9 Reviewed.** An independent reviewer re-ran the examples and the gates, checked
      B1 against the code, and approved.

### DoD audit of the merged milestones

M1, M3 and M4 merged before this checklist existed. The 2026-10-22 audit checked them
against it. B1–B8 are Yes. B9 stays Partly: no review was recorded on #396, #397, or #395, and the
later audit was after merge. Do not tick B9.

| Box | M1 (#396, #407)                                                                                                                       | M3 (#397)                                                                                     | M4 (#395)                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| B1  | Yes. No second walker; own-key lookup through `hasOwnProperty` after #407.                                                            | Yes. `scalar-compile.ts` imports `NUMERIC_LITERAL` from `scalar-eval.ts` (Sprint 1R item 3).  | Yes. No front existed; `paretoDist` is unrelated.                      |
| B2  | Yes. `expression/tests/scalar-structure.test.ts`, `tests/integration/scalar-canonical-parity.test.ts` (parity with `evaluateScalar`). | Yes. `functions/tests/scalar-compile.test.ts` (parity with `evaluateScalar`, edge-row table). | Yes. `functions/tests/pareto-front.test.ts` (hand-worked PySR scores). |
| B3  | Yes. `expression/src/index.ts:58-69`.                                                                                                 | Yes. `functions/src/index.ts:51`.                                                             | Yes. `functions/src/index.ts:54`.                                      |
| B4  | Yes. `@example` TSDoc; `expression/README.md` and `docs/api/expression.md` usage blocks re-run (item 5).                              | Yes. `@example` TSDoc; `functions/README.md` and `docs/api/functions.md` re-run.              | Yes. As M3.                                                            |
| B5  | Yes. Architecture prose documents the toolkit (item 5); `expression` is inside the export-index gate since #437 (item 4).             | Yes. Architecture prose + `docs/reference/functions.md` export index.                         | Yes. As M3.                                                            |
| B6  | Yes on `origin/main` at the audit baseline.                                                                                           | Yes.                                                                                          | Yes.                                                                   |
| B7  | Yes. `.changeset/scalar-structure-m1.md`, `.changeset/scalar-complexity-own-weights.md`.                                              | Yes. `.changeset/scalar-compile-m3.md`.                                                       | Yes. `.changeset/pareto-front-m4.md`.                                  |
| B8  | Yes. PR checks green.                                                                                                                 | Yes.                                                                                          | Yes.                                                                   |
| B9  | Partly. GitHub records no review on #396; the audit reviewed it after merge and found the gap fixed in #407.                          | Partly. No review recorded on #397; audited after merge.                                      | Partly. No review recorded on #395; audited after merge.               |

---

## 7. Release policy

A release happens **only when every roadmap item is done**: M1–M15 and Sprint 1R–5R, each
with every DoD box ticked. A milestone that the owner decides not to build (Phase 3 if UPT
does not delegate, Phase 4 if no consumer asks) counts as done once it is moved to §9 with
its rationale.

- **Nothing is released per milestone or per sprint.** No version PR merge, no tag, no
  GitHub Release, no npm publish.
- **CI guard:** set the repository Actions variable `RELEASES_ENABLED` to `true` only when
  this section’s criteria are met. Until then it stays unset (off). Tagging, GitHub Releases,
  and npm publish are disabled; the version PR still opens. Re-enable with
  `RELEASES_ENABLED=true` — do not delete the Release or Publish workflows.
- Each PR adds a changeset (B7). Changesets accumulate on `main`, including the ones
  M1, M3 and M4 already merged. The "chore: release packages" version PR that the
  Release workflow keeps open stays **unmerged** until the whole roadmap is done.
- This overrides the per-item "publish" step of `docs/FEATURE_WORKFLOW.md` for this
  roadmap.
- No `<pkg>@<version>` line for this work goes into `ROADMAP.md` "Recently shipped"
  before the publish, because `docs:roadmap-check` checks those lines against the npm
  registry.
- After the release, verify against the registry, not the publish log, as `AGENTS.md`
  requires: pack the published tarballs and type-check a real consumer with
  `skipLibCheck: false`.

---

## 8. Milestones and integration sprints

The size labels are S (one module plus tests), M (two or three modules) and L
(several modules). Following `FEATURE_WORKFLOW.md`, each open milestone is a ROADMAP
candidate until it passes the Definition of Ready. Each phase ends with an integration
sprint. A sprint adds no feature; it removes duplicates and closes documentation gaps
in the code that its phase touches, so the next phase builds on one implementation of
each algorithm.

### Phase 1 — `ScalarNode` foundations

#### M1 — `ScalarNode` structural toolkit ✅ merged (#396; fix #407)

- **Package:** `expression`, module `expression/src/scalar-structure.ts`, exported from
  `expression/src/index.ts:58-69`. Plan: [`PYSR_M1_PLAN.md`](../plans/PYSR_M1_PLAN.md).
- **Shipped API:** `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`,
  `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`,
  `scalarEquals`, and type `ScalarComplexityWeights` (PySR-style `op` / `call` /
  `number` / `symbol` weights, rounded after summing).
- **Canonical key rules** (structural only): nested `+` and `*` are flattened and their
  operands sorted by key; `a − b` becomes `a + (−1)·b` and `a / b` becomes `a · b^−1`;
  repeated factors are collected (`a·a → a^2`); numeric literals inside one `+` or `*`
  are folded; `^` is never reordered; `call` keys use the lowered name.
- **DoD:** base checklist + the following specifics. The audit table in §6 records the
  status. B4 `@example`, architecture prose (item 5) and the export-index gate (item 4,
  #437) are done; B9 stays open for the merged PRs.
  - [x] Key invariant under `+` / `*` permutation; `a/(b/c)`, `a*c/b` and `(c*a)*b^-1`
        share one key; `x-y` and `y-x` differ.
  - [x] Value parity with `evaluateScalar` (`tests/integration/scalar-canonical-parity.test.ts`).
  - [x] A symbol named `constructor` or `toString` gets the default weight (#407).

#### M2 — `ScalarNode` ↔ expression `Node` bridge ✅ implemented

- **Package:** `functions`, a module next to `scalar-eval.ts`, because the concrete node
  classes are instantiated in `functions/src/factories/index.ts`. **Size:** S–M.
  **Depends on:** nothing (M1 is merged and helps the tests).
- **Reuse (do not rebuild):** the node classes `functions/src/factories/index.ts` already
  builds from the expression factories (`_OperatorNode`, `_SymbolNode`, `_ConstantNode`,
  `_FunctionNode`, `_ParenthesisNode`); `simplify`, `derivative`, `symbolicEqual` and
  `leafCount` from the same file; `Node.toTex` (`expression/src/node/Node.ts:395`);
  `ScalarBuildError` and `SCALAR_FUNCTION_LOWERING` (`expression/src/scalar-builder.ts`);
  `scalarCanonicalKey` for the round-trip acceptance test. The new code is the two
  converters only. Do not add a simplifier, do not route through `normalForm`, and do not
  round-trip through a formula string (that is the UPT workaround M2 removes).
- **API sketch:**

```ts
export function scalarToNode(node: ScalarNode): MathNode; // OperatorNode / SymbolNode / ConstantNode / FunctionNode
export function nodeToScalar(node: MathNode): ScalarNode; // throws ScalarBuildError on an arm outside the scalar subset
export function simplifyScalar(node: ScalarNode, options?: SimplifyOptions): ScalarNode; // via simplify, no string round trip
export function scalarToTex(node: ScalarNode, options?: StringOptions): string; // via Node.toTex
```

- **Acceptance:**
  - `nodeToScalar(scalarToNode(n))` has the same `scalarCanonicalKey` as `n` for every
    test tree.
  - The `log` lowering is preserved: `scalarToNode` of natural `log` produces `log(x)`,
    and of `log10` produces `log10(x)`.
  - Unary minus maps to `(-1)*x`, the scalar convention (`scalar-eval.ts` header).
  - A `ParenthesisNode` is dropped and a `ConditionalNode` is rejected.
  - `simplifyScalar` of UPT's header examples (`a/(b/c)` vs `a·c/b`, `a·a` vs `a²`) gives
    equal keys.
- **Tests:** `functions/tests/scalar-node-bridge.test.ts`.
- **DoD:** base checklist + the following specifics:
  - [x] B1 names the reused node classes, `simplify` and `Node.toTex`; no string `parse`
        call in the module.
  - [x] Oracles: LaTeX pinned as hand-written strings for about 10 representative trees;
        `evaluate(scalarToNode(n).toString(), scope)` agrees with
        `evaluateScalar(n, scope)` on sample scopes; the UPT header examples.
  - [x] Exports on the `functions` barrel: `scalarToNode`, `nodeToScalar`,
        `simplifyScalar`, `scalarToTex`; a usage section in `docs/api/functions.md`.
  - [x] Tests: `functions/tests/scalar-node-bridge.test.ts`.
  - [ ] B9 reviewer sign-off (not recorded here).

#### M3 — Batch compiled `ScalarNode` evaluator ✅ merged (#397)

- **Package:** `functions`, module `functions/src/scalar-compile.ts`, exported at
  `functions/src/index.ts:51`. Plan: [`PYSR_M3_PLAN.md`](../plans/PYSR_M3_PLAN.md).
- **Shipped API:** `compileScalar(node, { variables, parameters?, constants? })` returns a
  `CompiledScalar` with `evaluate(columns, params?, out?)` (a `ScalarBatchResult` of
  `values`, `valid` and `allValid`) and `evaluateRow(row, params?)`, which throws
  `ScalarEvalError` like `evaluateScalar`.
- **Design as shipped:** a register tape, no `eval` or `new Function`. Unknown symbols
  throw at compile time. A row is invalid exactly where `evaluateScalar` throws.
- **DoD:** base checklist + the following specifics. The §6 audit table records the
  status. B1 (`NUMERIC_LITERAL`, item 3), B4 and B5 (item 5) and the M3 benchmark
  (item 6) are done; B9 stays open for the merged PRs.
  - [x] Bit-for-bit parity with `evaluateScalar` on valid rows; `valid = 0` exactly on the
        rows where it throws.
  - [x] `out` reuse: the returned `values` is `out` itself.
  - [x] A committed benchmark (`evaluateScalar` per row vs `compileScalar`) before any
        speed claim. `node tools/benchmark/wasm/run-node.mjs scalar` (twice on Node V8);
        control ratios 0.9853 and 1.0400; gated row large tree `n = 1e6` ratios 0.27 and 0.31;
        compiled always wins on the grid — **M14 threshold = 100 rows**
        ([`docs/BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md#evaluatescalar-vs-compilescalar-m3-batch-evaluator--2026-10-25)).

#### M4 — Pareto front and PySR-style scoring ✅ merged (#395)

- **Package:** `functions`, module `functions/src/pareto-front.ts`, exported at
  `functions/src/index.ts:54`. Plan: [`PYSR_M4_PLAN.md`](../plans/PYSR_M4_PLAN.md).
- **Shipped API:** `paretoFront(candidates)` (one survivor per complexity, strictly
  lower loss than every simpler survivor, non-finite rows dropped, ties keep input
  order), `scoreFront(front, { lossScale })` (PySR `calculate_scores`; `linear` gives
  `null` scores), `selectFrontModel(scored, mode, { bestLossFactor })` (`accuracy`,
  `score`, `best`), and `ParetoFrontError`.
- **DoD:** base checklist + the following specifics. The §6 audit table records the
  status. B4 `@example` and B5 architecture prose are done (item 5).
  - [x] Scores of a hand-worked five-candidate front, including the `+∞` row and the first
        row scoring 0.
  - [x] Every selection mode, including the fallback to `accuracy` without scores.

#### M5 — Instance-scoped, splittable seeded RNG

- **Package:** `core` (`core/src/numeric/rng.ts`, exported from the `core` barrel).
  **Size:** S–M. **Depends on:** nothing. `core` is the right home: `tensor`,
  `functions` and `parallel` already depend on it, and `workerpool` may (no cycle).
- **Reuse (do not rebuild):** Call core `mulberry32` and `boxMuller` ([#415](https://github.com/danielsimonjr/MathTS/pull/415)).
  Do not add another generator. The new code is `createSeededRng`, `fork`, and the string-to-seed hash.
  Do not build on `seedProbabilityRng`: it
  replaces the module-level `_rng` of the typed `random` family
  (`functions/src/typed/probability.ts:300-301`), which is the global reseed UPT trips
  over. Do not build on `createRng` (`functions/src/probability/util/seededRNG.ts:14`)
  either, although a seeded call already returns its own closure over a new
  `seedrandom(String(seed))` (only `null` falls back to the shared `singletonRandom`):
  it is seedrandom, not Mulberry32, so it cannot reproduce the existing
  `mulberry32` streams that `randomTensor`, the hypothesis bootstrap and the
  `dist-objects` / `graph` samplers emit, and it has no `fork`. The only new code is the
  `fork` derivation and the string-to-seed hash (no string hash exists in the repo).
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
  - `createSeededRng(42)` matches `MULBERRY32_42_FIRST_8` in `core/tests/numeric/rng.test.ts`.
    Forks are reproducible and siblings differ. The body move and the other copies are #415, not this PR.
- **Tests:** `core/tests/numeric/rng.test.ts`.
- **DoD:** base checklist + the following specifics:
  - [x] B1: moved in #415 (`tensor` imports `mulberry32` / `boxMuller` from `core`).
  - [x] Oracles: the reference Mulberry32 sequence for seed 42, worked independently of
        the module; `randomTensor` output for a fixed seed is byte-identical before and
        after (`core/tests/numeric/rng.test.ts`; fixture tests unchanged).
  - [x] Exports on the `core` barrel: `createSeededRng`, type `SeededRng`;
        `docs/api/core.md` usage section.

#### Sprint 1R — Phase 1 integration

Items 1–2 are **PR-RNG (#415)**; log-gamma, the retired erf, the nested-array `matMul`
copies, the two Levenberg–Marquardt bodies, and `polymul`/`polyMulJS` were pulled
forward into **PR-SPECIAL (#418)**, **PR-MATMUL (#417)**, **PR-LM (#416)**, and
**PR-POLY (#412)**. Items 3–6 (regex, export-index gate, architecture prose, M3
benchmark) are done (#435, #437, #438, #434). Sprint 2R's ODE/BVP/DAE Jacobians, Nelder–Mead merge,
`linearRegression`/`linregress`, and `numericRealRoots` stay open.

**Status (2026-10-24).** Merged: PR-POLY (#412), PR-SIDIM (#414, D-2: `SiDimensionVector`
exponents are `core` `Fraction`s), PR-RNG (#415: `mulberry32`, `boxMuller` and
`rowMajorStrides` now live in `core`; `workerpool` keeps one parity-pinned copy of
`mulberry32` and `rowMajorStrides` because its worker bundle cannot import `core`;
there is no worker `boxMuller`), PR-LM (#416) and PR-MATMUL (#417). PR-SPECIAL (#418)
is merged. M5's `createSeededRng`/`fork` API is in `core` (this milestone). The D-3 deletions are #413. The
release guard (#411) keeps tags, GitHub Releases and publish off until the repository
variable `RELEASES_ENABLED` is set to `true`.

- **Scope:**
  1. **The remaining four Mulberry32 copies → M5** (audit I-4). **Done (#415).**
     `hypothesis`, `dist-objects` and `graph` import `mulberry32` from `core`.
     `workerpool` keeps a parity-pinned copy in `packages/workerpool/src/worker-numerics.ts`
     (worker bundle cannot import `core`). M5's `createSeededRng`/`fork` is a separate
     milestone (API in `core`).
  2. **Row-major strides** (I-4). **Done (#415).** `rowMajorStrides` lives in `core`;
     `Tensor.rowMajorStrides` and `ComputePool` call it. The comment that said `parallel`
     has no `core` dependency is gone. `_tdRowMajorStrides` follows the worker copy in
     `worker-numerics.ts`.
  3. **Scalar literal regex.** **Done.** `scalar-compile.ts` imports the one export;
     it is not on the functions barrel.
  4. **Export-index gate for `expression`, `workbook` and `plot`** (I-13). **Done (#437).** Add their rows
     to `TARGETS` in `tools/generate-functions-reference.mjs` and a generated
     "Complete export index" block to `docs/api/{expression,workbook,plot}.md`, so a new
     export in those packages fails `docs:functions:check` until it is documented.
  5. **M1/M3/M4 documentation boxes.** **Done.** `@example` TSDoc on the M1, M3 and M4
     exports; `docs/Architecture` prose (`OVERVIEW`, `ARCHITECTURE`, `COMPONENTS`, `API`,
     `DATAFLOW`, `WASM_ACCELERATION`); `expression/README.md`, `functions/README.md`, and
     re-run usage blocks in `docs/api/expression.md` and `docs/api/functions.md`.
  6. **M3 benchmark.** **Done.** `tools/benchmark/wasm/scalar.bench.ts`; two Node V8 runs
     (`node tools/benchmark/wasm/run-node.mjs scalar`). Compiled batch wins at every grid
     size; control ≈ 1.00; **M14 threshold = 100 rows**
     ([`docs/BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md#evaluatescalar-vs-compilescalar-m3-batch-evaluator--2026-10-25)).
  7. **SiDimensionVector exact Fraction exponents (PR-SIDIM, #414).** **Done.** D-2 is decided (§10).
     Exponents become `core` `Fraction`s; `Unit`'s length-10 `dimensions: number[]` stays
     `number[]`. **Package:** `core`, `core/src/types/si-dimension-vector.ts`, re-exported
     unchanged through `core/src/types/unit.ts` and `units/src/index.ts`. **Size:** S. No
     new dependency. **Type:** `SiDimensionVector` becomes
     `readonly [Fraction, Fraction, Fraction, Fraction, Fraction, Fraction, Fraction]` in
     BIPM order `[L, M, T, I, Θ, N, J]`. **`toSiDimensionVector`:** build each component
     with `new Fraction(n, 1n)` when `Number.isInteger(n)`, otherwise `Fraction.fromNumber(n)`;
     `0.5` must be `1/2` (`numerator === 1n`, `denominator === 2n`), not a continued-fraction
     accident. **`fromSiDimensionVector`:** accept `readonly (number | Fraction)[]` so today's
     number tuples still run; return `number[]` via `Fraction.toNumber()` for the length-10
     `Unit` vector. An integral `Fraction` converts back to that integer.
     **Migration path** for `vec[0] === 1`: `vec.map((f) => f.toNumber())`; no new accessor
     export is added (reuse `Fraction.toNumber`). Do not keep the old return type of
     `toSiDimensionVector`.
     **Changeset:** `minor` on `@danielsimonjr/mathts-core` and
     `@danielsimonjr/mathts-units`, body starting with `BREAKING:` (not `major`). **Tests:**
     rewrite `core/tests/types/si-dimension-vector.test.ts` to compare `Fraction` components
     (`1/1`, `1/1`, `-2/1` for a newton) and to round-trip through
     `fromSiDimensionVector`. Add `0.5 → 1/2`. `fromSiDimensionVector([1, 1, -2, 0, 0, 0, 0])`
     still returns the length-10 `number[]`. **Docs:** `docs/api/core.md` (run
     `bun run docs:functions`), `units/README.md` one sentence, M9 below. M9 may start:
     PR-SIDIM (#414) has merged.
- **Reuse:** M5 `createSeededRng`; `Tensor.rowMajorStrides` as the body to lift;
  the existing `TARGETS` mechanism and generator; the existing `tools/benchmark/`
  harness; `core` `Fraction` for PR-SIDIM (no second dimension type).
- **Exit criteria:**
  - Outside `core`, a grep for the Mulberry32 constant `0x6d2b79f5` in production `.ts`
    files finds at most the documented `workerpool` copy.
  - **Met (2026-10-25):** Every seeded output that existed before the sprint is byte-identical
    after it (`randomTensor`, `bootstrapSeed` in the hypothesis tests, the `dist-objects` and
    `graph` samplers), pinned by fixtures recorded at commit `a6cf17af` (pre-#415) in
    `tensor/tests/operations/random.test.ts`, `functions/tests/typed-hypothesis-bootstrap.test.ts`,
    `functions/tests/typed-dist-objects-workers.test.ts`, and `functions/tests/typed-graph-workers.test.ts`.
  - One `rowMajorStrides` body outside `workerpool`; one `NUMERIC_LITERAL`.
  - `docs:functions:check` fails when an `expression`, `workbook` or `plot` export is
    missing from its API page.
  - The §6 audit table for M1, M3 and M4 has every box ticked except B9 for the merged
    PRs.
  - The M3 benchmark (`evaluateScalar` per row vs `compileScalar`) is committed under
    `tools/benchmark/wasm/scalar.bench.ts` and has been run twice on Node per the
    `AGENTS.md` rules. This closes M3's open benchmark box and is the input M14 depends
    on. Compiled batch wins on the grid in both runs; **M14 threshold = 100 rows**
    ([`docs/BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md#evaluatescalar-vs-compilescalar-m3-batch-evaluator--2026-10-25)).
  - `SiDimensionVector` exponents are `core` `Fraction`s; `fromSiDimensionVector`
    round-trips; `Unit.dimensions` is still `number[]`.
- **DoD:** base checklist + the following specifics:
  - [x] B1 lists each removed copy and the symbol that replaced it: tensor `makeMulberry32` /
        `boxMuller` and `Tensor.rowMajorStrides` → core `mulberry32` / `boxMuller` /
        `rowMajorStrides`; `hypothesis`, `dist-objects`, `graph` import `mulberry32`;
        `ComputePool` calls `rowMajorStrides`; worker keeps `_workerMulberry32` and
        `_tdRowMajorStrides`.
  - [x] Oracle: pre-change output fixtures for every migrated seeded function (commit
        `a6cf17af`, tests listed under exit criteria above).
  - [x] B3: no public export added or removed except `mulberry32`, `boxMuller`,
        `rowMajorStrides` (`.changeset/core-mulberry32-strides.md`), `SiDimensionExponent`
        (`.changeset/si-dimension-fraction-exponents.md`), and `matMul` (`.changeset/dense-matmul-export.md`);
        `NUMERIC_LITERAL` stayed off the functions barrel; consumer type check passes on PR heads.
  - [x] M3 benchmark committed, with the output of both Node runs in the PR; it
        interleaves the two variants and keeps a control case (control ratios 0.9853 and
        1.0400 on `n = 1e4`).

### Phase 2 — Constant fitting and equivalence

#### M6 — Exact parameter gradients of a `ScalarNode` ✅ implemented

- **Package:** `functions`, extending `functions/src/scalar-compile.ts` (M3). **Size:** S–M.
  **Depends on:** M3.
- **Reuse (do not rebuild):** the M3 tape compiler (add gradient lanes to it, do not
  write a second compiler); `DUAL_UNARY_RULES` (`core/src/types/dual-rules.ts`) for every
  unary derivative; `Dual` (`core/src/types/dual.ts`) and `gradientAt`
  (`functions/src/grad-forward.ts`) as the reference forward-mode semantics;
  `numericJacobian` only as the finite-difference oracle. `autograd` is tensor-level and
  not the tool here. The only new calculus is the two partials of `^`.
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

- **Design:** forward mode with one dual lane per parameter. For `^`, `∂/∂x = y·x^(y−1)`
  and `∂/∂y = x^y·ln x`. Where `ln x` is undefined, mark the row invalid instead of
  returning NaN silently.
- **Acceptance:**
  - Agrees with symbolic `derivative` (through M2, or a hand-written closed form) to
    1e-12 relative on smooth test trees.
  - Agrees with `numericJacobian` to about 1e-6 relative.
  - Values are bit-identical to M3.
- **Tests:** `functions/tests/scalar-compile-gradient.test.ts`.
- **DoD:** base checklist + the following specifics:
  - [x] B1: unary derivatives come from `DUAL_UNARY_RULES`; no derivative formula is
        restated except the `^` partials.
  - [x] Oracles: hand-written closed-form gradients, `derivative` through M2, and
        `numericJacobian`; edge rows `0^0`, negative base with fractional exponent,
        `log(0)`.
  - [x] Exports on the `functions` barrel: `compileScalarGradient`, type
        `CompiledScalarGradient`.

#### M7 — `fitScalarParameters` (PySR-style constant optimization) ✅ implemented

- **Package:** `functions`. **Size:** M. **Depends on:** M3, M5 and M6.
- **Reuse (do not rebuild):** `levenbergMarquardt`, `bfgs` (accepts `grad`) and
  `nelderMead` as the optimizers; M6 for the analytic Jacobian and gradient; M3 for
  residuals; `core` `pairwiseSum` / `pairwiseDot` for loss sums (not `Array.reduce`);
  M5 for restart perturbations; `ols` (`functions/src/ml/ols.ts`) for standard-error
  conventions. Do not write another optimizer: `bfgs`, `nelderMead`, `gradientDescent`,
  `levenbergMarquardt`, `minimize` (a second Nelder–Mead,
  `functions/src/typed/numeric.ts:264`) and `curvefit` (a second Levenberg–Marquardt,
  `functions/src/typed/numeric.ts:908`, model `f(x, params)` over `xs`/`ys`) already
  exist. Do not write another numeric Jacobian: `numericJacobian` exists, and six
  private finite-difference Jacobian loops already copy it (listed in Sprint 2R item 1),
  besides BFGS's private `numericGradient` (`functions/src/numeric/bfgs.ts:66`).
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
  `levenbergMarquardt` (`functions/src/optimization-extra.ts`). Existing tests must pass
  without edits. Moving the default numeric Jacobian onto `numericJacobian` is Sprint 2R.
- **Acceptance:**
  - Recovers planted constants: `a·exp(−b·x)+c` from noise-free data to 1e-8, and with
    seeded Gaussian noise within 3 standard errors.
  - A one-parameter `p·f(x)` fit equals the closed-form least-squares slope
    `Σ f·y / Σ f²` that UPT `probe/fit.ts` obtains from `ols` today, so the
    multi-constant fit generalizes the existing one.
  - Invalid rows are counted and excluded, never silently treated as zeros.
  - The same `rng` seed gives identical results.
- **Tests:** `functions/tests/fit-scalar-parameters.test.ts`.
- **DoD:** base checklist + the following specifics:
  - [x] B1 names `levenbergMarquardt`, `bfgs`, `nelderMead`, `compileScalarGradient`,
        `pairwiseSum` / `pairwiseDot` and `createSeededRng` as the parts used.
  - [x] Oracles: planted constants; the closed-form one-parameter slope; standard errors
        against a hand-computed `(JᵀJ)⁻¹σ²` for a two-parameter linear model.
  - [x] Exports on the `functions` barrel: `fitScalarParameters`, types
        `FitScalarOptions`, `FitScalarResult`; `levenbergMarquardt`'s new `jacobian`
        option documented in `docs/reference/functions.md`.

#### M8 — Guarded numerical equivalence ✅ implemented

- **Package:** `functions`. **Size:** S. **Depends on:** M3 and M5.
- **Reuse (do not rebuild):** `compileScalar` to evaluate both trees on the samples;
  M5 for sampling; `nearlyEqual` (`core/src/number.ts`, through
  `@danielsimonjr/mathts-core/internal`) and the `relTol` / `absTol` convention for the
  comparison. `symbolicEqual` stays the symbolic check; do not extend it or `normalForm`
  into a numeric probe.
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

- **Wording rule:** `consistent` is evidence, never proof. The TSDoc must say so,
  matching UPT §9 ("Numerical agreement alone never proves symbolic equivalence").
- **Acceptance:**
  - [x] Finds a counterexample for `sqrt(x^2)` vs `x` on a domain that includes negatives.
  - [x] Reports `consistent` for `sin^2+cos^2` vs `1`.
  - [x] With `upToConstant`, finds the constant for `2πx` vs `x`.
  - [x] Reports `inconclusive` when most samples are invalid.
  - [x] Results are deterministic for a given RNG seed.
- **Tests:** `functions/tests/numeric-equivalence.test.ts`.
- **DoD:** base checklist + the following specifics:
  - [x] B1: comparisons call `nearlyEqual`; samples come from `createSeededRng`;
        evaluation is `compileScalar`.
  - [x] Oracles: the four identities above, worked by hand.
  - [x] Exports on the `functions` barrel: `numericallyEquivalent`, types
        `NumericEquivalenceOptions`, `NumericEquivalence`; the "evidence, not proof"
        wording in TSDoc and `docs/api/functions.md`.

#### Sprint 2R — Phase 2 integration

The two Levenberg–Marquardt bodies, `svds` `norm2`, nested-array `matMul` copies,
log-gamma, and the retired erf were pulled forward into **PR-LM (#416)**, **PR-MATMUL
(#417)**, and **PR-SPECIAL (#418)** and are done. Remaining open: ODE/BVP/DAE Jacobians, `ols` `pairwiseSum`, Nelder–Mead
merge, `linearRegression`/`linregress`, and `numericRealRoots`.

- **Scope:** M7 and M8 fit and compare numbers, so the numerics under them must have
  one correct implementation each.
  1. **Levenberg–Marquardt and finite-difference Jacobians** (I-5, extended).
     **LM/`curvefit` done (#416):** one body on `numericJacobian` (`scheme: 'forward'`,
     `h = 1e-7`) and core `pairwiseDot`. Still open: `solveBVP` Jacobian
     (`typed/numeric.ts:1279-1288`, `delta = 1e-7`), `solveODE` `_fdJacobian` (`:209`),
     `solveDAE` (`:229-236` and `:404-412`). The scalar finite-difference derivatives
     (BFGS's `numericGradient`, `centralDiff1` / `centralDiff2`, `centralPartial`,
     `numericalDerivative`) are not Jacobians and are not part of this item. Route the
     remaining solvers through `numericJacobian`; if they need their relative forward
     step, add that step rule to `NumericJacobianOptions` instead of keeping private
     loops. The M7 public `jacobian` option is implemented (`LMOptions.jacobian`).

  2. **`svds` vector norm** (I-5). **Done (#416).** `functions/src/numeric/svds.ts:117`
     calls core `norm2`.
  3. **Dense matrix product** (I-7). **`matMul` export done (#417)**
     (`matrix/src/operations/common.ts:80`, on the matrix barrel). `ols`,
     `geometry-extra`, `control-equations`, `solveODE` and the sequential path of
     `matrix-ops.ts` call it. Leave `functions/src/typed/arithmetic.ts:1557` `matmul`
     alone. **Still open:** replace the naive `reduce` sums in `ols` (RSS, mean, TSS)
     with `core` `pairwiseSum`.
  4. **Log-gamma drift** (I-2). **Copies unified (#418).** `lgammaNumber` keeps the
     NaN-for-negative contract (documented; not delegated).
  5. **Retired erf** (I-3). **Done (#418).** Hypothesis CDF and the KS kernel use
     `erfcSelfContained` / `erfcScalar`.
  6. **Regression wrappers and root finding** (I-7). Make `linearRegression` a wrapper
     around `linregress` (or the reverse) after a p-value parity pin; route
     `numericRealRoots` (`functions/src/typed/cas.ts:1117`) through `findRoot`.
  7. **Two public Nelder–Mead implementations** (found while reviewing this roadmap; not
     in the audit). `nelderMead` (`functions/src/optimization-extra.ts:26`) and
     `minimize` (`functions/src/typed/numeric.ts:264`) both implement the downhill
     simplex. Keep both public names and make one call the other after a parity pin on
     their existing fixtures.
- **Reuse:** `numericJacobian` (and its `NumericJacobianOptions`), `levenbergMarquardt`
  as the one LM body, `core` `norm2` / `pairwiseSum` / `pairwiseDot`,
  `matrix` `matMul`, `scalars.ts` `_lgamma`, `erfcScalar` / `_erfc`, `findRoot`, `fitLine`.
- **Exit criteria:**
  - No private finite-difference Jacobian loop in `functions/src` or `matrix/src`: a
    grep for a loop that perturbs one coordinate per column of a matrix finds only
    `numericJacobian`. No private sum-of-squares norm in `optimization-extra.ts`,
    `curvefit` or `svds.ts`.
  - One Levenberg–Marquardt body: `curvefit` calls `levenbergMarquardt`, and both public
    names stay.
  - Every nested-array dense ikj product in `functions/src` calls `matrix` `matMul`; the
    five private copies listed in item 3 are gone.
  - One Nelder–Mead body behind `nelderMead` and `minimize`.
  - Every `functions` Lanczos log-gamma copy uses the `abs(sin)` reflection; a test
    checks `lgamma(-0.5)` against the closed form `ln(2√π)` on each public path, except
    any path whose NaN contract the PR keeps and documents.
  - The `0.3275911` Abramowitz coefficient no longer occurs in `functions/src`.
  - **Test-expectation rule** (one rule for the whole sprint, LM included). An existing
    test passes unedited, or its expectation is changed in the same PR together with
    the independent oracle (a closed form or published reference value, cited in the
    test) that shows the new value is the correct one. The changeset lists every
    changed expectation. Iteration counts and intermediate iterates are not
    expectations and may change.
- **DoD:** base checklist + the following specifics:
  - [ ] Oracles: `lgamma` and `erfc` against published reference values (for example
        DLMF or SciPy at fixed arguments); `ols` coefficients and LM solutions checked
        against the oracle values of their existing fixtures, under the
        test-expectation rule. For LM, the fixture is a planted-parameter recovery test
        (`functions/tests/gap-optimization-clustering.test.ts:32-41`: noise-free data
        from `y = 2.5·exp(0.5·t)`, expecting `(2.5, 0.5)` to 6 digits). `curvefit`,
        `solveBVP`, `solveODE` and `solveDAE` keep their existing fixtures under the same
        rule.
  - [ ] B3: `matMul` added to the `matrix` barrel and `docs/api/matrix.md`; no other
        public export changes.

### Phase 3 — Dimension-aware primitives (conditional on UPT delegation)

UPT owns `ExprNode` dimensional validation. `docs/integration/upt.md` Q2 keeps
dimensional analysis on `Tensor` UPT-only. These milestones cover a different object,
dimension inference over **`ScalarNode`**, and are built **only if UPT files an issue
asking to delegate**, as it did for units in #347. D-2 is decided (§10) and is
implemented by Sprint 1R item 7 (**PR-SIDIM**, #414). **PR-SIDIM has merged, so M9
may start** (it still waits on a UPT delegation issue).

#### M9 — `inferScalarDimension`

- **Package:** `functions`. It walks `ScalarNode`, which `core` cannot import (`core`
  depends only on `typed-function`), and M10 needs `rationalNullspace`, which lives in
  `functions`. The dimension vector type itself stays in `core`. **Size:** M.
- **Reuse (do not rebuild):** `SiDimensionVector`, `toSiDimensionVector` and
  `fromSiDimensionVector` (its inverse; both in `core/src/types/si-dimension-vector.ts`)
  for the `[L,M,T,I,Θ,N,J]` vector and its order; `Fraction` (`core`) exponents on that
  vector after PR-SIDIM; `Unit` and the physical constants for the fixtures;
  `forEachScalar` for the walk. `RationalDimension` **is** `SiDimensionVector`; do not add
  a second dimension vector type. Exponents come from the `Fraction` vector, not from
  `toNumber()`.
- **API sketch:**

```ts
export type RationalDimension = SiDimensionVector; // [L,M,T,I,Θ,N,J] Fraction exponents
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
- **DoD:** base checklist + the following specifics:
  - [x] PR-SIDIM merged (Sprint 1R item 7, #414); D-2 recorded in §10.
  - [ ] B1: vectors come from `toSiDimensionVector` with `Fraction` exponents; no new
        dimension-order constant.
  - [ ] Oracles: physics closed forms (gravitation, kinetic energy, a pendulum period
        with `x^0.5`) and the four violations.
  - [ ] Exports on the `functions` barrel: `inferScalarDimension`, types
        `RationalDimension` (`SiDimensionVector`), `DimensionInference`.

#### M10 — Constant-unit solving (PySR's `[⋅]`)

- **Package:** `functions`, with M9. **Size:** M. **Depends on:** M9.
- **Reuse (do not rebuild):** `rationalNullspace`
  (`functions/src/numeric/rational-nullspace.ts:145`) for the linear exponent system;
  M9's rules to generate it. Do not write another nullspace or linear solver.
- **API sketch:**
  `solveParameterDimensions(node, dims, target, parameters, options?: { dimensionlessOnly?: boolean }) → { solved: Record<string, RationalDimension> } | { underdetermined: string[] } | { inconsistent: true }`.
  `dimensionlessOnly` (default `false`) requires every parameter to be dimensionless,
  mirroring PySR's `dimensionless_constants_only`.
  It treats each parameter's dimension as an unknown in the linear exponent system
  that M9's rules generate, for trees where the parameters appear multiplicatively.
  Other placements report `underdetermined`.
- **Acceptance:**
  - For `y[m s⁻² kg] = M[kg]·c`, it solves `c = m s⁻²`, which is PySR's
    `docs/src/examples/physics.md:71-75` example.
  - With `{ dimensionlessOnly: true }`, the same case is `inconsistent`, mirroring
    `dimensionless_constants_only`.
- **DoD:** base checklist + the following specifics:
  - [ ] B1: the system is solved by `rationalNullspace`.
  - [ ] Oracles: PySR's physics example; an underdetermined and an inconsistent case
        worked by hand.
  - [ ] Exports on the `functions` barrel: `solveParameterDimensions`.

#### Sprint 3R — Phase 3 integration

This sprint runs even if M9 and M10 stay candidates; item 2 does not depend on them.

- **Scope:**
  1. **D-2 and the units docs.** D-2 is recorded in §10 and implemented by Sprint 1R
     item 7 (PR-SIDIM, #414); do not re-decide here. Update `docs/integration/upt.md` with
     what UPT may now delegate after #414.
  2. **`simplify` with `exactFractions`** (I-12). **Done.** `_exactFraction` reads
     `core` `Fraction` `numerator` / `denominator`; `0.4 * x` with `exactFractions` is
     pinned to 2/5 by oracle test.
  3. **Constant uncertainty** (§10, question 4). Only if the owner says yes: add
     CODATA standard uncertainties to `functions/src/type/unit/physicalConstants.ts`
     so `propagateUncertainty` and M7's weights can use them.
- **Reuse:** `SiDimensionVector`, `core` `Fraction`, `propagateUncertainty`.
- **Exit criteria:** `simplify` of `0.4 * x` with `exactFractions` turns the literal into
  the exact fraction 2/5, pinned by a test; D-2 is recorded; `docs/integration/upt.md`
  matches the code.
- **DoD:** base checklist + the following specifics:
  - [x] Oracle: hand-written exact fractions for `simplify`; CODATA 2022 published
        uncertainties if item 3 is done.

### Phase 4 — Search kit (optional; no new package)

Phase 4 only proceeds if UPT, or another consumer, wants a generic in-process
stochastic generator (UPT §8.1 step 6).

**Home: D-1 decided — no new package.** All Phase 4 work stays in `core`, `functions`,
and `expression`. There is no `@danielsimonjr/mathts-symbolic-search`. The default home
is a module family in `functions` (M11 may sit in `expression` next to `scalar-structure.ts`
if the placement probe shows it imports only `expression` and `core`). Before M11 merges,
run `bun run docs:graph -- cycles` as a placement check **between `functions` and
`expression`**: a cycle means move the module, not create a package.

#### M11 — Grammar descriptor + deterministic bounded enumerator

- **Size:** M. **Depends on:** M1. M9 is optional, for dimension-typed generation.
- **Reuse (do not rebuild):** `ScalarOperator`, `LoweredScalarFn`, `SCALAR_FUNCTIONS`
  and `createScalarBuilder` (`expression/src/scalar-builder.ts`) for the operator set
  and node construction; `scalarSize` and `scalarDepth` for budgets; `scalarCanonicalKey`
  for deduplication; `inferScalarDimension` (M9) as an `admit` predicate only if M9
  exists. The grammar is data over the existing arms, not new node kinds.
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
  - For a tiny grammar ({x}, {+,\*}, maxSize 3), the visit order is pinned and the
    result is checked against a hand count.
  - The stop reason is reported.
  - Pruning by `admit` happens before children are expanded, when the predicate is
    monotone. The predicate declares whether it is monotone.
- **DoD:** base checklist + the following specifics:
  - [ ] Placement (`functions` or `expression`) recorded; the cycle probe is in the PR.
  - [ ] B1: dedup is `scalarCanonicalKey`; budgets are `scalarSize` / `scalarDepth`.
  - [ ] Oracle: hand-counted enumeration for the tiny grammar.
  - [ ] Exports on the chosen barrel: `enumerateScalars`, types `ScalarGrammar`,
        `EnumerationBudget`, `EnumerationStop`.

#### M12 — Mutation and crossover operators

- **Size:** M. **Depends on:** M1, M2, M3, M5 and M11.
- **Reuse (do not rebuild):** M5 for every random choice; `mapScalar` and
  `scalarCanonical` for tree rewriting; M2 `simplifyScalar` and constant folding through
  `compileScalar` / `evaluateScalar` for `simplifyConstants` (what PySR's simplify
  mutation does); M11's grammar as the only constraint checker.
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
- **DoD:** base checklist + the following specifics:
  - [ ] B1: no simplifier or constraint checker of its own.
  - [ ] Oracles: PySR's default weights (§2.2) for the χ² test; hand-built before/after
        trees for each operator.
  - [ ] Exports on the chosen barrel: the operators and `weightedMutation`.

#### M13 — Regularized-evolution loop

- **Size:** L, splittable into a single-population PR and an islands-plus-migration PR.
  **Depends on:** M3, M4, M7 and M12.
- **Reuse (do not rebuild):** `paretoFront`, `scoreFront` and `selectFrontModel` for the
  hall of fame and the final selection; `compileScalar` for evaluation; M7
  `fitScalarParameters` for constants; M12 for variation; M5 `fork` for island streams.
  `seedProbabilityRng` must not be the island RNG (its global reseed is the UPT bug in
  §0's table).
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
- **DoD:** base checklist + the following specifics:
  - [ ] B1: the front is the M4 trio; no second Pareto or ranking helper.
  - [ ] Oracles: the planted laws; byte-identical serial runs.
  - [ ] Exports on the chosen barrel: `searchScalars` and its option and progress types.

#### M14 — Parallel population evaluation

- **Size:** M. **Depends on:** M3, M13 and the Sprint 1R benchmark (M14 batch threshold
  **= 100 rows** from the two-run `scalar` bench; see
  [`docs/BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md#evaluatescalar-vs-compilescalar-m3-batch-evaluator--2026-10-25)).
- **Reuse (do not rebuild):** `WorkerPool.execute` (`parallel/src/WorkerPool.ts:220`) with
  its `timeoutMs` and hung-worker replacement (a security invariant); the existing
  fan-out pattern of `ComputePool.integrateFanOut`; `kernelSource`
  (`functions/src/typed/parallel-map.ts:24`) to ship self-contained code to a worker. Do
  not add a pool.
- **Design:** post `ScalarNode` JSON and column buffers to the workers, and evaluate
  inside the worker. Results are merged deterministically by candidate index, so a
  parallel run equals a serial run for the same seed.
- **Open question:** how the worker obtains the evaluator. `workerpool` cannot import
  `functions`, and copying the M3 tape into `packages/workerpool/src/worker.ts` would be a
  duplicate. Serializing it through `kernelSource` is the candidate; settle this at the
  Definition of Ready.
- **Acceptance:** parallel and serial fronts are identical for the same seed. Any
  speedup claim goes into a committed benchmark that follows `AGENTS.md`, and the
  per-op threshold reaches the dispatch code (benchmark rule 9).
- **DoD:** base checklist + the following specifics:
  - [ ] B1: `WorkerPool.execute` with `timeoutMs`; no second copy of the M3 tape.
  - [ ] Oracle: parallel front equals serial front for fixed seeds.
  - [ ] A measured `ScalarNode` batch threshold, from two Node runs, cited in the code.

#### Sprint 4R — Phase 4 integration

`polymul`/`polyMulJS` is pulled forward into **PR-POLY**. Item 3 records that work; do not
re-decide it here if PR-POLY has already merged.

- **Scope:** acceleration-tier and layering hygiene in the code M14 touches.
  1. **D-1 placement record.** Write the `functions` vs `expression` placement and the
     `docs:graph -- cycles` output into the M11 PR (not a package decision).
  2. **Unreachable matrix FFT** (I-6, D-3). **Decided: delete** (not a banner).
     #413 removed `matrix/src/backends/wasm/fft-wasm.ts` and its tests; the public
     FFT is `functions`. The file is gone.
     Fix the stale header of `packages/workerpool/src/fft-core.ts`, which still names
     `typed/signal.ts` as the original; the shared core is
     `functions/src/signal/fft-core-f64.ts`.
  3. **Polynomial product** (I-7). `polymul` (`functions/src/typed/algebra.ts:242`)
     repeats the convolution below `WASM_POLY_THRESHOLD`; call `polyMulJS`
     (`functions/src/wasm/poly/wasm-bridge.ts:49`) instead.
  4. **Matrix backend tables** (I-8). `matrix/src/config.ts` thresholds differ from what
     `backendManager` uses, and `DenseMatrix.multiply` / `lu` / `qr` / `cholesky` never
     reach WASM. Wire them with a benchmark or delete the dormant branches.
  5. **Stale threshold prose** (I-14, I-15). WASM-threshold comments in
     `functions/src/typed/*` that predate `functions/src/wasm/policy.ts`, and
     `docs/BENCHMARK_RESULTS.md`.
- **Reuse:** `fft-core-f64.ts`, `polyMulJS`, `policy.ts`, the existing benchmark
  harnesses.
- **Exit criteria:** one JS radix-2 FFT body in `functions` plus the documented
  `workerpool` layering copy; one dense JS polynomial convolution; one matrix threshold
  table that the code reads; no threshold in a comment that `policy.ts` contradicts.
- **DoD:** base checklist + the following specifics:
  - [ ] Oracles: existing FFT and `polymul` fixtures pass under Sprint 2R's
        test-expectation rule; any new threshold backed by two committed Node runs.

### Phase 5 — Reporting

#### M15 — Front export

- **Size:** S. **Depends on:** M2 and M4.
- **Reuse (do not rebuild):** M2 `scalarToTex` (which is `Node.toTex`) for every formula
  cell; `scoreFront` rows as the table input; `scalarCanonicalKey` in the JSON. Before
  adding a LaTeX table writer, check whether `workbook`'s `toTeX`
  (`workbook/src/tex.ts:87`, not on the `workbook` barrel today) or `plot`'s `toTikZ`
  can render the table. No SymPy, JAX or PyTorch exporter (§9).
- **API sketch:** `frontToLatexTable(scored, { variables, precision })` (cf.
  `pysr/export_latex.py` `sympy2latextable`) and `frontToJson(scored)`, a stable
  schema that includes canonical keys.
- **Acceptance:** the LaTeX output is pinned as strings, and the JSON round trip
  restores identical keys.
- **DoD:** base checklist + the following specifics:
  - [ ] B1: formulas through `scalarToTex`; no second LaTeX printer.
  - [ ] Oracles: hand-written LaTeX table for a three-row front; JSON schema fixture.
  - [ ] Exports on the `functions` barrel: `frontToLatexTable`, `frontToJson`.

#### Sprint 5R — Phase 5 integration and release readiness

- **Scope:** reporting and output surfaces, then the last checks before the release in §7.
  1. **Workbook public surface** (I-17). Decide whether `DependencyGraph`,
     `DependencyNode`, `toDOT` and `toTeX` are public `workbook` API; export them or
     document them as internal.
  2. **`mtsw capabilities --json`** (I-11) prints `schemaVersion` as `"[Circular]"`
     (`workbook/src/cli.ts` `jsonEnvelope` replacer vs the shared `SCHEMA_VERSION`).
  3. **Runnable examples in CI** (I-14). A smoke test that runs `examples/*.ts`.
  4. **Configuration and dependency hygiene.** `create(all, config)` mutates the
     process-wide `DEFAULT_CONFIG` (I-9); the nine unused `typed-function ^4.0.0` pins are
     gone (#413) and `packages/typed-function` still has no workspace dependents (I-10);
     the `mad` / `parallelStatMAD` naming (I-16). **Done (mad clause):** `parallelStatMeanAD`
     alias, docs, and median-vs-mean oracle test; I-9 and I-10 in this item remain open.
  5. **Dead artefacts** (D-3, I-6, I-18). **Done (#413).** Deleted
     `write_factories_index.py`, the matrix JS FFT bridge, and the `MathTSWasm` bindings
     (`assembly/src/bindings/wasm-loader.ts`, `assembly/src/bindings/index.ts`).
  6. **CI audit step** (I-1). **Done (#421).** Retry `bun audit` on a registry outage via
     `tools/test/bun-audit-retry.mjs`, keep `--audit-level=high`, fail on a real advisory.
  7. **Roadmap close-out.** Every milestone and sprint box in this file ticked or the
     item moved to §9; `CHANGELOG.md` entries; this file's status line set to "complete,
     ready to release".
- **Reuse:** the existing CLI envelope, `examples/`, the release scripts and workflows
  as they are.
- **Exit criteria:** items 1–6 merged or recorded as owner decisions in §10; every DoD box
  in this roadmap ticked. Only then does §7's release happen.
- **DoD:** base checklist + the following specifics:
  - [ ] Oracle: the `capabilities --json` output parsed and `schemaVersion` compared to
        `SCHEMA_VERSION`; a test that `create(all, config)` leaves a fresh `evaluate`
        unchanged.
  - [ ] `node tools/test/consumer-typecheck.mjs` passes on the full set of packages.

---

## 9. Explicitly out of scope (non-decisions)

- **Vendoring or wrapping PySR / Julia / Python.** UPT §0.2 row 9 and §10.3 rule this
  out. An external PySR worker is UPT's protocol concern (UPT §11), not MathTS's.
- **A new package for this roadmap.** D-1 is decided: out of scope; no 25th package.
- **WASM / WebGPU `ScalarNode` evaluation.** Not planned until the M3 benchmark exists
  and shows memory-bound batch evaluation losing to a kernel. `AGENTS.md` records
  several "WASM is faster" assumptions that measured slower.
- **New `ScalarNode` arms** (n-ary calls, `sqrt` / `square` as separate functions,
  conditionals, tensors). `^` already covers powers. Revisit only with a consumer
  request, because UPT's lowering depends on the current arms.
- **`TemplateExpressionSpec`-style skeletons, differential operators `D(f)`,
  `TypeSpec`, `denoise`, feature selection.** Revisit after M13.
- **Dimensional analysis on `Tensor`.** It remains UPT-only (`docs/integration/upt.md`
  Q2).
- **Migrating `seedProbabilityRng` / `createRng` onto M5.** It would change published
  random streams; it needs its own decision.

## 10. Open questions and decisions for the owner

1. **Phase 3 delegation.** Does UPT want MathTS to own `ScalarNode` dimension inference
   (M9/M10), or should UPT keep its validator as the sole authority? The default is
   that UPT keeps it.
2. **D-1, Phase 4 home.** **Decided:** no 25th package. Phase 4 lives in `functions`;
   M11 may sit in `expression` if the placement probe allows. A package is not an option.
3. **D-2, dimension exponents.** **Decided and implemented (#414):** `SiDimensionVector`
   exponents are `core` `Fraction`s. `Unit.dimensions` stays `number[]`.
4. **Constant uncertainty.** If constants are "data", should
   `functions/src/type/unit/physicalConstants.ts` carry CODATA standard uncertainties?
   This would feed `propagateUncertainty` and M7's weights.
5. **Front statistic for likelihood losses.** PySR leaves the score undefined for
   linear loss scales (§2.3). Should M4 offer an AIC- or BIC-style alternative?
6. **D-3, dead artefacts.** **Decided: delete** (not a banner). **Done (#413):**
   `write_factories_index.py`, `matrix/src/backends/wasm/fft-wasm.ts`, and the
   `MathTSWasm` bindings under `assembly/src/bindings/` are gone.
7. **M14 worker evaluator.** Serialize the M3 tape through `kernelSource`, or another
   route that adds no copy (M14 open question).

## 11. Sources read

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
- `docs/audit/2026-10-22-codebase-audit.md` (sections 5, 7, 8 and 10) and
  `docs/plans/PYSR_M{1,3,4}_PLAN.md`
- `expression/src/scalar-builder.ts`, `expression/src/scalar-structure.ts`,
  `expression/src/index.ts`
- `functions/src/scalar-eval.ts`, `functions/src/scalar-compile.ts`,
  `functions/src/pareto-front.ts`, `functions/src/index.ts`
- `functions/src/numeric/{bfgs,numeric-jacobian,rational-nullspace,svds}.ts`,
  `functions/src/optimization-extra.ts`, `functions/src/ml/ols.ts`
- `functions/src/algebra/{symbolicEqual,leafCount,simplifyConstant}.ts`
- `functions/src/factories/index.ts`
- `functions/src/grad-forward.ts`, `functions/src/typed/parallel-map.ts`
- `functions/src/type/unit/physicalConstants.ts`
- `core/src/types/{si-dimension-vector,dual-rules}.ts`, `core/src/types/unit/Unit.ts`,
  `core/src/numeric/stable.ts`
- `core/tests/types/unit-upt-delegation.test.ts`
- `tensor/src/operations/random.ts`, `parallel/src/ComputePool.ts`,
  `packages/workerpool/src/worker.ts`, `autograd/src/index.ts`
- `tools/generate-functions-reference.mjs`, `tools/roadmap-check/roadmap-check.mjs`
- the open issue list (`gh issue list`; at the first writing the open issues were PhysJS
  kernel requests #375–#384, none of which overlap this roadmap)
