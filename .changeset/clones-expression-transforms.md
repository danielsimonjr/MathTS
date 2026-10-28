---
'@danielsimonjr/mathts-expression': patch
---

Consolidate duplicate expression transform helpers (filter/forEach, cumsum/mapSlices dim shift, and/or/bitwise short-circuit) per Sprint 2R clone batch 1. The shared dim shift also fixes `cumsum`/`mapSlices` with a BigNumber `dim`, which used to throw `dim.minus is not a function`.
