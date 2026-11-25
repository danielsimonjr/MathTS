---
'@danielsimonjr/mathts-compat': minor
---

Compat `version` reports the emulated mathjs version (#1581): `version` is `"15.3.0"` on the compat instance, the named export, and the expression scope, and a `compatVersion` named export carries the compat package version. BREAKING: code reading the compat package version from `math.version` must read `compatVersion`.
