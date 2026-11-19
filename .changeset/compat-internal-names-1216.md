---
'@danielsimonjr/mathts-compat': minor
---

A compat instance from `create(all)` no longer exposes the internal names of the functions namespace (#1216). The 80 names are the 64 `factory_*` functions and 16 ALL_CAPS tuning constants (`ARRAY_WORKER_THRESHOLD`, `CAS_BATCH_THRESHOLD`, `CENTRALITY_WORKER_THRESHOLD`, `DEFAULT_MUTATION_WEIGHTS`, `DIST_WORKER_THRESHOLD`, `EVALUATE_SCOPE_OMIT`, `GAUSS_WORKER_THRESHOLD`, `GL4_A`, `GL4_B`, `GL4_C`, `GPU_ELEMENTWISE_OPS`, `GPU_MIN_ELEMENTS`, `GPU_REDUCE_OPS`, `MASS_PROPERTY_SHAPES`, `MUTATE_CONSTANT_NEGATE_PROBABILITY`, `WASM_INTERP_THRESHOLD`). They are gone from `in`, `for...in`, property reads, the `MathInstance` type, `math.chain`, and `math.evaluate` / `math.compile` / `math.parser()`. They stay exported from `@danielsimonjr/mathts-functions`. The list is `compat/src/internal-names.generated.ts`, written by `compat/scripts/gen-internal-names.mjs`; its `--check` in CI fails when the functions namespace adds an internal name that the list does not hold.

Measured on `create(all)`:

|                                            | 0.6.0 (published) | main before this change | this change |
| ------------------------------------------ | ----------------- | ----------------------- | ----------- |
| `for...in` names                           | 1406              | 1406                    | 1326        |
| `Object.keys` names                        | 1406              | 317                     | 317         |
| the 80 names reachable through `in`        | 80                | 80                      | 0           |
| the 80 names that `math.evaluate` resolves | 72                | 72                      | 0           |
| the 80 names that `math.parser()` resolves | 72                | 72                      | 0           |

`EARTH_RADIUS_KM` stays: it is the default radius of `haversine`, a physical constant. The mathjs constants `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2` and `SQRT1_2` stay. A factory object that you pass to `create` keeps all its names: only a name whose value is the value of the functions namespace is hidden, so `create({ MY_CONST: 5, R: 8.31 })`, `create({ ...all, X1: 7 })` and `create({ ...all, GL4_A: 99 })` keep `MY_CONST`, `R`, `X1` and `GL4_A` as in 0.6.0 (#1250). `math.import({ GL4_A: 5 })` now makes `GL4_A` resolve to 5 in `math.evaluate`; in 0.6.0 it threw `Cannot import "GL4_A": already exists`. The expression scope does not read instance properties, as in 0.6.0: `create({ ...all, GL4_A: 99 }).evaluate('GL4_A')` gave the internal table and now throws `Undefined symbol`.

`math.parser()` of a `create(all)` instance now evaluates with the evaluator of its instance. In 0.6.0 it used the module scope of the functions package, so it resolved the internal names, did not resolve a name from `math.import`, and ignored the instance config (after `math.config({ number: 'BigNumber' })`, `math.parser().evaluate('1/3')` returned a number and now returns a BigNumber). A `parser` that you pass to `create` in your own factory object is not changed.

This change is breaking because 0.6.0 exposes all of these names. No non-breaking path is worth it: the names are tuning constants and internal factories, not mathjs API.
