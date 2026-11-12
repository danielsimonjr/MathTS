---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`Unit.add` for same-dimension addition; incompatible unit `add`/`subtract` throw `DimensionMismatchError`. `new Unit(NaN, …)` and non-finite numeric values throw `TypeError: Unit value must be finite`.
