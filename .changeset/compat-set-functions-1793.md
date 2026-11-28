---
'@danielsimonjr/mathts-compat': patch
---

**Set functions match mathjs 15.3.0 for mixed scalars (#1793).** `setCartesian`, `setDistinct`, `setIntersect`, and `setPowerset` now use the activated factory graph with `compareNatural` ordering on `create(all)` and on named exports.
