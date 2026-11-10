---
'@danielsimonjr/mathts-core': patch
---

Add `exactScaleRoundingCount()` in `types/unit/exact-scale` (tests and diagnostics, not in the barrels). It counts the exact-ratio roundings since module load, so a test can prove that unit conversions use the rounding memo without a wall-clock budget.
