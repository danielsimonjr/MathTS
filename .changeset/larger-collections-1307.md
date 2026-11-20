---
'@danielsimonjr/mathts-functions': patch
---

The operators `>`, `<`, `>=`, `<=`, `==` and `!=` and the functions `larger`, `smaller`, `largerEq`, `smallerEq`, `equal` and `unequal` take an Array or a matrix. `evaluate('[1,2,3] > 1')` gives `[false, true, true]` and `evaluate('[1,2,3][[1,2,3] > 1]')` gives `[2, 3]`. This also holds in the compat instance. (Refs #1307)
