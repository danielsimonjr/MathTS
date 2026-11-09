---
'@danielsimonjr/mathts-core': patch
---

`Unit.readings` reads a factor against the unrestricted prefix set. Thus, `lmpc` gives `l·mpc`, and `Hzpc` gives `H·zpc`. `Unit.parse` keeps the k-and-up prefix rule for `ly` and `pc`, so `Unit.parse('mpc')` still throws.
