---
'@danielsimonjr/mathts-functions': minor
---

Add `massProperties(shape, density?)` and the `MASS_PROPERTY_SHAPES` catalog (#378): volume (area in 2-D), mass, centroid and inertia about the centroid for sphere, box, capsule, convex polyhedra (vertices with optional faces, else their convex hull), circle, rectangle, 2-D capsule and simple polygons. Polyhedra and polygons are exact (covariance method and shoelace sums).
