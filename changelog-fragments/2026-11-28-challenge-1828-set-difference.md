### Fixed

- **setDifference mixed-type order matches mathjs (#1793, challenge #1833):** `create(all).setDifference([1, complex(2, 2), 3], [1])` returns `[2 + 2i, 3]`. `setUnion` and `setSymDifference` use the same `compareNatural` factory path, including named exports and `evaluate`.
