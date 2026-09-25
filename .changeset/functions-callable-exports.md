---
'@danielsimonjr/mathts-functions': patch
---

131 public exports were functions at runtime but not callable in the published types. Among them were `det`, `inv`, `lup`, `qr`, `zeros`, `identity`, `map`, `median`, `subset` and the `factory_*` functions. Most were declared `unknown`; `det` was declared as its own return value, `number | BigNumber | Complex`. Every TypeScript call needed a cast.

The cause was the factories' `typed` dependency type, whose call signature returned `unknown` (or the local result type) instead of a function. It now has a creation overload, `typed(name, signatures, ...more)`, that returns a typed function, and every export is callable. The shared `referTo` type now matches typed-function's variadic `referTo(...names, callback)`, so five factories no longer cast around a curried form that nothing calls. `tools/test/consumer-typecheck.mjs` now asserts, against the packed packages, that every runtime-function export is callable in its `.d.ts` (2,310 exports across all packages).
