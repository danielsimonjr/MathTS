---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

G08 inverse hyperbolic (#1558–#1560): native fixes for `acoth(0)`, `acsc(0)`, `asec(0)`, and Complex `acsch` (wrong zero limits and calling missing `Complex.acsch`). Compat `create(all)` routes the eight inverse hyperbolic names through complex.js 2.4.2 adapters for mathjs 15.3.0 parity on branch cuts and extremes.
