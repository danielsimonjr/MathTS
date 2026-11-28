### Fixed

- **Compat geometry (#1792):** `distance` and `intersect` on `create(all)` now match mathjs 15.3.0 — euclidean distance uses the mathjs sum-of-squares loop, and `intersect` coerces mixed matrix/array and row/column shapes like mathjs.
