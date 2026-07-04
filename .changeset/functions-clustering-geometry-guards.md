---
'@danielsimonjr/mathts-functions': patch
---

Two input-validation fixes surfaced while adding WS-1 P2 oracles:

- `spectralClustering` now throws a clear error when given a non-square adjacency matrix. Previously a non-square input (e.g. a point cloud mistaken for an adjacency matrix) reached the eigensolver and **looped forever**.
- `voronoiDiagram` now throws a clear `TypeError` when its `bounds` argument is missing or not a 4-tuple, instead of crashing with `Cannot read properties of undefined`.
