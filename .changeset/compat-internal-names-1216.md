---
'@danielsimonjr/mathts-compat': minor
---

A compat instance from `create(all)` no longer exposes the internal names of the functions namespace (#1216). The 64 `factory_*` functions and 17 ALL_CAPS tuning constants (`ARRAY_WORKER_THRESHOLD`, `CAS_BATCH_THRESHOLD`, `CENTRALITY_WORKER_THRESHOLD`, `DEFAULT_MUTATION_WEIGHTS`, `DIST_WORKER_THRESHOLD`, `EARTH_RADIUS_KM`, `EVALUATE_SCOPE_OMIT`, `GAUSS_WORKER_THRESHOLD`, `GL4_A`, `GL4_B`, `GL4_C`, `GPU_ELEMENTWISE_OPS`, `GPU_MIN_ELEMENTS`, `GPU_REDUCE_OPS`, `MASS_PROPERTY_SHAPES`, `MUTATE_CONSTANT_NEGATE_PROBABILITY`, `WASM_INTERP_THRESHOLD`) are gone from `in`, `for...in` and property reads, and from the `MathInstance` type. Before, `for...in` listed 1406 names and 81 of them were internal; `Object.keys` and spread already listed only the 317 mathjs-parity names. The names stay exported from `@danielsimonjr/mathts-functions`. The mathjs constants `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2` and `SQRT1_2` stay.
