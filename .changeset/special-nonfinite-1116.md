---
'@danielsimonjr/mathts-functions': patch
---

`besselJ` with a real order and a tiny `x`, `sphericalBesselJ` and `sphericalBesselI` with a tiny `x`, `sphericalBesselY` after its first overflow, `sphericalBesselI` with a large `x` and `chebyshevT` with `|x| > 1` after its first overflow no longer return NaN. `besselJ(0.5, 1e-300)` is 7.98e-151, `sphericalBesselJ(1, 1e-300)` is 3.33e-301, `sphericalBesselY(50, 1e-10)` is `-Infinity`, `sphericalBesselI(1000, 1000)` is 6.95e227 and `chebyshevT(1000, 1.5)` is `Infinity`. `sphericalBesselK(1000, 1000)` is 7.99e-235 (it was 0). `sphericalBesselY(4e8, 5)` is `-Infinity` (it was NaN), and `sphericalBesselK(1.8e9, 1e4)` is `Infinity` (it was 0). (Refs #1116)
