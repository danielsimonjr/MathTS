---
'@danielsimonjr/mathts-core': patch
---

Fixes #1201. `BigNumber.sqrt` and `BigNumber.cbrt` seed Newton from the mantissa and scale the seed by an exact power of ten, so a value outside the double range (for example `1e-400` or `1e400`) no longer returns Infinity (or -Infinity for a negative `cbrt`).
