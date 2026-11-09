---
'@danielsimonjr/mathts-core': patch
---

`Unit.readings` reads the degree, micro, ohm and angstrom signs in the same way as `Unit.parse`. Thus, `m°R` gives `m·degR`.
