---
'@danielsimonjr/mathts-functions': patch
---

Fix `cbrt(number, allRoots)` — the real-number two-argument form now works instead of throwing "Too many arguments in function cbrt (expected: 1, actual: 2)". Both the programmatic `cbrt` and the expression-language `cbrt` gained explicit `number, boolean` / `Complex, boolean` signatures that route through the complex cube-root path: `cbrt(8, true)` returns all three cube roots `[2, -1±i√3]` and `cbrt(8, false)` the principal root (matching mathjs 15). The source previously assumed typed-function would synthesize `number, boolean` via a number→Complex conversion, which the MathTS typed instance does not.
