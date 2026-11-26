---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

G08 inverse hyperbolic (#1558–#1560): native C99 principal values for `Complex.asin`/`atanh` at infinity (so `acsc(0)`/`asec(0)`/`acoth(0)` are not NaN), `acsch(complex)` via `asinh(1/z)`, and compat `create(all)` complex.js 2.4.2 adapters for mathjs 15.3.0 quirks.
