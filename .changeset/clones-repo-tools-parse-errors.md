---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-parser': patch
'@danielsimonjr/mathts-ast': patch
'@danielsimonjr/mathts-wasm': patch
---

Replace `export type *` barrels with named type re-exports (tree-sitter-typescript 0.23.2) and drop `@inline` on private AssemblyScript sort helpers so `repo-tools clones` reports `parseErrors=0`.
