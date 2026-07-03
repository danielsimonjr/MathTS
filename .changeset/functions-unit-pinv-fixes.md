---
'@danielsimonjr/mathts-functions': patch
---

Fix Unit arithmetic/comparison and `pinv` Array input.

- **Unit operators**: dimensional analysis now works through the public API — `add`/`subtract`/`multiply`/`divide`/`abs` and `smaller`/`larger`/`smallerEq`/`largerEq`/`equal`/`unequal`/`compare` on `unit(...)` values (`5 cm + 3 mm = 5.3 cm`, `3 m × 4 m = 12 m²`, `10 m / 2 s = 5 m/s`, `equal(5 cm, 50 mm) = true`); mismatched dimensions throw. The typed operators had been wired to a different `Unit`'s interface, so every `unit()` arithmetic/comparison threw. Both Unit flavors (`unit()` and `to()`/`toBest()`) are supported.
- **`pinv([[…]])`** (Array input) threw "expected DenseMatrix"; added Array-in/Array-out signatures.
