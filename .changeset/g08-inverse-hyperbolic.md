---
'@danielsimonjr/mathts-compat': patch
---

Inverse trig/hyperbolic special values and Complex `acsch` (#1558, #1559, #1560): `create(all)` now routes `asinh`, `acosh`, `atanh`, `acoth`, `acsch`, `asech`, `acsc`, and `asec` through compat-local complex.js 2.4.2 adapters so branch cuts, infinities, and signed zeros match mathjs 15.3.0. Native `core` and `functions` are unchanged.
