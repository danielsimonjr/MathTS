---
'@danielsimonjr/mathts-functions': minor
---

Add the `parallel` option to `searchScalars` (M14): `parallel: { timeoutMs?, pool? }` scores each generation's trees on worker threads (`scalar-batch.worker.js`, a second build entry) once `observed` has 100 or more rows. Parameter refits and every random draw stay on the caller thread, so a parallel run equals the serial run for the same seed, bit for bit. `timeoutMs` defaults to 30000 and must be positive; a pool the search starts itself is terminated when the generator ends or is closed. New type export: `ScalarPopulationParallelOptions`. `compileScalar` now evaluates through one shared `evaluateScalarTape` (internal).
