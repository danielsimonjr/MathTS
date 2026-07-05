---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-wasm': patch
---

Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.
