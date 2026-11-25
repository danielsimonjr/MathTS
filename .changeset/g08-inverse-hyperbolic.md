---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Inverse trig/hyperbolic special values and Complex `acsch` (#1558, #1559, #1560): fixed `acoth(0)`, `acsc(0)`, `asec(0)`, the `asech` branch cut for `x > 1`, and Complex `acsch` to match mathjs 15.3.0. `core`'s `Complex` gained `acoth`, `acsch` and `asech` methods, and its `asinh`, `acosh` and `atanh` now use the complex.js 2.4.2 algorithms (the library of mathjs) so branch cuts and infinities land on the mathjs sheet.
