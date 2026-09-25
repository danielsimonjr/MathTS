---
'@danielsimonjr/mathts-typed-function': patch
---

`createSafeConversion` and `createSafeConversionDef` accept classes whose constructors have typed parameters, including the one in their own documentation example. The old `new (...args: unknown[]) => T` parameter rejected them under `strictFunctionTypes`, because constructor parameters are contravariant. There is no runtime change.
