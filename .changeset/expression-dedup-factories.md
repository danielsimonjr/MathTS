---
'@danielsimonjr/mathts-expression': patch
---

Remove three superseded, test-only factory duplicates from `expression/src/function/`: `compile.ts` (`createCompile`), `evaluate.ts` (`createEvaluate`), and `help.ts` (`createHelp`). These were mathjs-lineage dependency-injection factories duplicating the active `compiler/compile.ts`, `evaluator/evaluate.ts`, and `Help.ts` — which use MathTS-native positional signatures and are what `functions`/`workbook` actually consume. They were unreachable from the package index (wiring them would have collided with the `createEvaluate` already exported by `evaluator/index.ts`) and exercised only by one test, now pruned to its surviving `createParser` block. With this, the expression package has **zero dormant files** — every source file is reachable from a public entry point. Published surface unchanged.
