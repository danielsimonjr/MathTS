---
'@danielsimonjr/mathts-compat': patch
---

**Set functions match mathjs 15.3.0 for mixed scalars (#1793).** Every set operation that orders elements (`setCartesian`, `setDifference`, `setDistinct`, `setIntersect`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setSize`, `setSymDifference`, and `setUnion`) now uses the activated factory graph with `compareNatural` ordering on `create(all)`, named exports, `evaluate`, and DenseMatrix.
