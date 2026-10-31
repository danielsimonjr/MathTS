---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-units': patch
---

Add UPT residual unit aliases `d` → day and `Angstrom` → angstrom. A vendored UPT `units.json` symbol-walk test builds `new Unit(1, symbol)` for all 104 symbols and pins each scale and SI dimension (storage `bit` keeps its own scale; angle, solid-angle and bit exponents are an explicit allow-list).
