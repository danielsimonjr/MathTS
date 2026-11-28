### Fixed

- **Set functions keep compareNatural ordering for mixed scalars (#1793):** every mathjs set operation that orders or compares elements (`setCartesian`, `setDifference`, `setDistinct`, `setIntersect`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setSize`, `setSymDifference`, and `setUnion`) on `create(all)`, named exports, `evaluate`, and DenseMatrix now runs through the activated mathjs factories instead of the typed JSON `naturalCompare` paths, so Complex, Fraction, and BigNumber multisets match mathjs 15.3.0.
