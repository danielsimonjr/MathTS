---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-wasm': patch
---

Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.
