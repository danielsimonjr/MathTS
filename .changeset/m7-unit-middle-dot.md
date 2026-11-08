---
'@danielsimonjr/mathts-core': minor
---

`Unit.parse` accepts the middle dot `·` (U+00B7) as a product sign, the same as `*`. For example, `N·m` is `N*m`, and `m^2/(V·s)` is `m^2/(V*s)`. After a solidus, the dot stays in the denominator: `W/m·K` is `W/(m*K)`.
