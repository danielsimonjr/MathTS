---
'@danielsimonjr/mathts-functions': minor
---

Add `searchScalars` and related types for single-population evolutionary search over scalar trees: tournament selection, constant fitting via `fitScalarParameters` at `optimizeProbability`, and Pareto hall-of-fame reporting via `paretoFront` / `scoreFront`. A tree that is invalid on any row has infinite loss, so it never reaches the front. Each front row comes with the parameter values behind its loss (`fittedParameters`).
