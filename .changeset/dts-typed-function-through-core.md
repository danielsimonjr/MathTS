---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-compat': patch
---

The published `.d.ts` files no longer import from `typed-function`, which neither package declares as a dependency. Consumers with `skipLibCheck: false` got TS7016 errors (138 in matrix, 39 in compat), because the import resolved to an untyped `typed-function@4.2.2` copy hoisted by other packages. The typed-function exports now use the `TypedFunction` type that `@danielsimonjr/mathts-core` re-exports, so the declarations resolve through a declared dependency.
