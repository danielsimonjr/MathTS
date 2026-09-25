---
'@danielsimonjr/mathts-core': patch
---

Type fixes that let callers pass real implementations without casts. There is no runtime change.

- **`createTypedFunction`** (factory and typed variants) accepts implementations with concrete parameter types, such as `(a: number, b: number) => number`. Its `unknown[]` parameter type rejected them under `strictFunctionTypes`.
- **BigNumber formatter.** `formatBigNumber`, `toFixedBigNumber`, `toExponentialBigNumber` and `toEngineeringBigNumber` (the `/internal` entry) now accept core's own `BigNumber` and decimal.js values. `BigNumberValue` is now generic over the implementation's own type. Before this, no real value satisfied it: its members demanded that every implementation accept any other implementation, and the instance `constructor` member was typed as a constructor.
