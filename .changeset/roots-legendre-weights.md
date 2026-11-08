---
'@danielsimonjr/mathts-functions': patch
---

`rootsLegendre` weights are within 1e-15 relative of 60-digit values for n = 2 to 64 (8.3e-14 at n = 16 before). The weight is evaluated at the final Newton node, in double-double, and corrected from the rounded node to the exact root. The call is about 3.4 times slower at n = 64 (0.68 ms against 0.20 ms).
