---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

Compat `version` reports the emulated mathjs version (#1581): `version` is `"15.3.0"` on the compat instance, the named export, and the expression scope, and a `compatVersion` named export carries the compat package version; `help('version')` and other doc examples evaluate through the instance evaluator; compat instance evaluate treats explicit scope bindings of `undefined` as mathjs does (native evaluate unchanged). BREAKING: code reading the compat package version from `math.version` must read `compatVersion`.
