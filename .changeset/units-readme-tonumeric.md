---
'@danielsimonjr/mathts-units': patch
---

The README states that `Unit.value` is the SI magnitude and that an offset unit keeps its zero point out of `value`. Its samples use `toNumeric()`, not the deprecated `toNumber()` (#921).
