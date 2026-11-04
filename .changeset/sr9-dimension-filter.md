---
'@danielsimonjr/mathts-functions': patch
---

SR-9: dimensional and unit filter for the scalar search. `unitToRationalDimension(unitName)` maps a unit name to its SI `RationalDimension` via the existing `Unit` table, and `searchScalars` gains the opt-in `dimensions` option (`symbols`, `target`, `onUnderdetermined`): after the grammar check and before scoring, the scored tree's SI dimension is checked against `target` — violations and inconsistent solves score `Infinity`, an underdetermined solve is kept by default or rejected with `'reject'`. Omitted `dimensions` leaves the search unchanged.
