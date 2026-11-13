---
'@danielsimonjr/mathts-arithmetic': minor
'@danielsimonjr/mathts-wasm': minor
'@danielsimonjr/mathts-ast': minor
'@danielsimonjr/mathts-autograd': minor
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-evaluator': minor
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-gpu': minor
'@danielsimonjr/mathts-linalg': minor
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-numbers': minor
'@danielsimonjr/mathts-parallel': minor
'@danielsimonjr/mathts-parser': minor
'@danielsimonjr/mathts-plot': minor
'@danielsimonjr/mathts-signal': minor
'@danielsimonjr/mathts-statistics': minor
'@danielsimonjr/mathts-tensor': minor
'@danielsimonjr/mathts-trigonometry': minor
'@danielsimonjr/mathts-units': minor
'@danielsimonjr/mathts-workbook': minor
'@danielsimonjr/mathts-typed-function': minor
'@danielsimonjr/mathts-workerpool': minor
---

**Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).

Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.

Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.

Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.
