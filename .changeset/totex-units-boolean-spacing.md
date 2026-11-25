---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-compat': patch
---

Match mathjs 15.3.0 `toTex` unit names and boolean-operator spacing (#1577, #1578).

`SymbolNode._toTex` now treats a name with `Unit.isValuelessUnit(name)` as a unit even when the name is also a function on the instance (`cm`, `b`, `A` render as `\mathrm{…}`, `deg` as `^\circ`), and the operator LaTeX joins its operands with no added space, so `true and false`, `not true` and `true xor false` render as `true\wedgefalse`, `\negtrue` and `true\veebarfalse`, matching the mathjs 15.3.0 oracle byte for byte.
