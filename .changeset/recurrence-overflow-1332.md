---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

`legendreP`, `chebyshevT`, `hermiteH` and `laguerreL` give a signed `Infinity` when the value leaves the double range. Before, the recurrence gave `Infinity - Infinity` and the result was `NaN`: `hermiteH(1000, 1.5)` was `NaN` and is `-Infinity`. `hermiteH` and `laguerreL` now run the recurrence with a power-of-2 scale, so the sign of the result is exact, and a value inside the range is unchanged. `hermiteH` has an order limit of 2500000000, as `laguerreL` has: an order above it throws `RangeError`. Before, a `NaN` ended the loop after a few hundred steps, and the call returned `NaN`. One call at the limit takes about 20 seconds. The AssemblyScript functions `legendreP`, `chebyshevT`, `hermiteH` and `laguerreL` follow the same rule, and the AssemblyScript `lgamma` reduces `sin(pi x)` exactly. The WASM binary and its SHA-384 manifest change. (Refs #1332)
