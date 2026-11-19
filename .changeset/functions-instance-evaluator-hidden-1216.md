---
'@danielsimonjr/mathts-functions': patch
---

`createInstanceEvaluator(imported, hiddenNames)` takes an optional list of names that the instance scope does not resolve, in safe and unsafe evaluation (#1216). An imported name resolves even when it is in the list. The module-level `evaluate` and `compile` do not change. compat passes its internal-name list.
