---
'@danielsimonjr/mathts-functions': patch
---

Type fixes from type-checking the test suite, with no runtime change.

- **`solveODE`, `freqz` and `zpk2tf` are declared `TypedFunction`, like every other typed function.** They were published as `any`: their factories' dependencies are untyped, so the result inherited `any` from `typed(...)`, and nothing about a call or its result was checked. Their results are now `unknown`, so narrow them as for any typed function (for example `solveODE(f, [0, 1], y0) as { t: number[]; y: number[][] }`).
- **The unit-valued physical constants (`speedOfLight`, `planckConstant`, `electronMass`, ...) are declared as core's `UnitInstance`.** They were declared as a stub `{ fixPrefix: boolean }`, so `speedOfLight.toNumeric('m/s')`, `.to(...)` and `.format()` did not compile. The value was always a core `Unit`.
