---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-units': patch
---

Add supplementary unit aliases `d` → day and `Angstrom` → angstrom. A unit symbol oracle test builds `new Unit(1, symbol)` for all 104 symbols and pins each scale and SI dimension (storage `bit` keeps its own scale; angle, solid-angle and bit exponents are an explicit allow-list).
