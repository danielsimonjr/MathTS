---
'@danielsimonjr/mathts-compat': patch
---

Two type fixes, with no runtime change.

- **`chain()` now type-checks.** `chain(3).add(4).multiply(2).done()` failed to compile: the `Chain` index signature returned `Chain | unknown`, which is `unknown`. `Chain` is now `ChainMethods & ChainUnwrap`, so every function name returns the next `Chain` and `done()`/`valueOf()` still return `unknown`.
- **`MathJSConfig` declares every key `config()` returns.** The returned object is the merged functions runtime config, but the type listed only five keys, so reading `relTol`, `absTol`, `numberFallback`, `predictable` or `legacySubset` did not compile. `number` also accepts `'bigint'`, which the runtime config supports.
