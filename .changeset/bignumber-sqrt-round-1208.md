---
'@danielsimonjr/mathts-core': patch
---

`BigNumber.sqrt` and `BigNumber.cbrt` round the exact root once, in the configured rounding mode. A root just below a power of ten no longer rounds up to the power: `sqrt(0.99999999999999999999)` at precision 20 is `0.99999999999999999999`, not `1`. Fixes #1208.
