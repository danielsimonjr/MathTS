---
'@danielsimonjr/mathts-functions': patch
---

SR-9: dimensional and unit filter for the scalar search. `unitToRationalDimension(unitName)` maps SI units through the existing `Unit` table (angle/solid-angle units to a dimensionless 7-vector; `bit`/`byte` throw `UnitParseError`). `searchScalars` gains opt-in `dimensions` (`symbols`, `target`, `onUnderdetermined`): infer and solve paths both require the scored tree's root dimension to equal `target`; unused listed parameters no longer trigger `'reject'`; violations and inconsistent solves score `Infinity`; underdetermined trees are kept by default. The filter is snapshotted before the first yield. Omitted `dimensions` leaves the search unchanged.
