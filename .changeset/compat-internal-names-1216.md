---
'@danielsimonjr/mathts-compat': minor
---

A compat instance from `create(all)` no longer exposes the internal names of the functions namespace (#1216). The 80 names are the 64 `factory_*` functions and 16 ALL_CAPS tuning constants (`ARRAY_WORKER_THRESHOLD`, `CAS_BATCH_THRESHOLD`, `CENTRALITY_WORKER_THRESHOLD`, `DEFAULT_MUTATION_WEIGHTS`, `DIST_WORKER_THRESHOLD`, `EVALUATE_SCOPE_OMIT`, `GAUSS_WORKER_THRESHOLD`, `GL4_A`, `GL4_B`, `GL4_C`, `GPU_ELEMENTWISE_OPS`, `GPU_MIN_ELEMENTS`, `GPU_REDUCE_OPS`, `MASS_PROPERTY_SHAPES`, `MUTATE_CONSTANT_NEGATE_PROBABILITY`, `WASM_INTERP_THRESHOLD`). They are gone from `in`, `for...in`, property reads, the `MathInstance` type, and `math.evaluate` / `math.compile`. They stay exported from `@danielsimonjr/mathts-functions`. The list is `compat/src/internal-names.generated.ts`, written by `compat/scripts/gen-internal-names.mjs`; its `--check` in CI fails when the functions namespace adds an internal name that the list does not hold.

Measured on `create(all)`:

|                                              | 0.6.0 (published) | main before this change | this change |
| -------------------------------------------- | ----------------- | ----------------------- | ----------- |
| `for...in` names                             | 1406              | 1406                    | 1326        |
| `Object.keys` names                          | 1406              | 317                     | 317         |
| internal names reachable through `in`        | 81                | 81                      | 0           |
| internal names that `math.evaluate` resolves | 72                | 72                      | 0           |

`EARTH_RADIUS_KM` stays: it is the default radius of `haversine`, a physical constant. The mathjs constants `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2` and `SQRT1_2` stay. A factory object that you pass to `create` keeps all its names: only a name whose value is the value of the functions namespace is hidden, so `create({ MY_CONST: 5, R: 8.31 })`, `create({ ...all, X1: 7 })` and `create({ ...all, GL4_A: 99 })` keep `MY_CONST`, `R`, `X1` and `GL4_A` as in 0.6.0 (#1250). `math.import({ GL4_A: 5 })` still makes `GL4_A` resolve in `math.evaluate`.

This change is breaking because 0.6.0 exposes all of these names. No non-breaking path is worth it: the names are tuning constants and internal factories, not mathjs API.
