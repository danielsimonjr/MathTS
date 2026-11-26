---
'@danielsimonjr/mathts-compat': patch
---

Indexed assignment that grows a matrix matches mathjs 15.3.0 (#1557): `e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]` is `[[5, 6], [7, 8]]` and 1-D `a = []; a[3] = 4` is `[0, 0, 4]`. A differential parity suite pins the behavior against the mathjs oracle.
