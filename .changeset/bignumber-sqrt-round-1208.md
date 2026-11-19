---
'@danielsimonjr/mathts-core': patch
---

`BigNumber.sqrt` and `BigNumber.cbrt` round the exact root once, in the configured rounding mode. A root just below a power of ten no longer rounds up to the power: `sqrt(0.99999999999999999999)` at precision 20 is `0.99999999999999999999`, not `1`. In a directed mode (`up`, `down`, `ceil`, `floor`) an inexact root now rounds in the right direction, and `cbrt` of a negative value rounds the signed result, so `ceil` and `floor` agree with decimal.js. Fixes #1208.
