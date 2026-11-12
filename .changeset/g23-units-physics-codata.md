---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-units': patch
---

Linear-time unit parsing with a 10k length cap; decibel (power) and neper (field) units; physics scope binds `e0`/`G`/`c`/`hbar` (bare `e` stays Euler — breaking for callers that read `physicsScope().e` as the elementary charge); CODATA 2022 absolute uncertainties on physical constants, `0` when the constant is exact. Dimensionless CODATA values (`fineStructure`, `weakMixingAngle`, `sackurTetrode`) stay usable as numbers via `valueOf` and also expose `.unc` (their runtime type is object).
