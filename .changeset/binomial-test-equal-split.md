---
'@danielsimonjr/mathts-functions': patch
---

`binomialTest` divides the included probability by the computed total mass of the n + 1 pmf terms. An equal split now gives a p-value of exactly 1 (it was 0.9999999999998926 at 500 of 1000), and an asymmetric count keeps the scipy value.
