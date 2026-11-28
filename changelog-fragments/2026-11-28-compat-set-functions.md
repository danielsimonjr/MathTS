### Fixed

- **Set functions keep compareNatural ordering for mixed scalars (#1793):** `setCartesian`, `setDistinct`, `setIntersect`, and `setPowerset` on `create(all)` and the module exports now run through the activated mathjs factories instead of the typed `naturalCompare` paths, so Complex/number multisets match mathjs 15.3.0.
