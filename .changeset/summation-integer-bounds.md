---
'@danielsimonjr/mathts-functions': patch
---

`summation` and `symbolicProduct` throw a `RangeError` when a bound is not an integer. Before, `summation('i', 'i', 1.5, 3)` returned 4 (it added 1.5 and 2.5) with no error (#1000).
