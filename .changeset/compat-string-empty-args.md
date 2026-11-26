---
'@danielsimonjr/mathts-compat': patch
---

`string()` with no arguments returns `''` and too many arguments throw the mathjs "Too many arguments in function string" TypeError, matching mathjs 15.3.0 (#1775).
