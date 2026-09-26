---
'@danielsimonjr/mathts-functions': patch
---

Type fixes from type-checking the test suite, with no runtime change.

- **`chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest` and `shapiroWilkTest` return their plain result type when no `bootstrap` option is given.** Every call returned `Result | BootstrapResult`, so reading `pValue` from `await mannWhitneyTest(a, b)` did not compile. With a `bootstrap` option the result is still the union, because `bootstrap: 0` falls back to the plain result at run time.
- **`inv`, `eigs` and `sqrtm` return `unknown`, like every typed function.** The new callable signatures had typed their results as the scalar type their internal dependencies use, which is wrong for a matrix, an `{ values, eigenvectors }` object, or a nested array.
