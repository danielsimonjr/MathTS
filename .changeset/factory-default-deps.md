---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-compat': patch
---

Public factories resolve their own default dependencies. `createParse()` and `createEvaluate()` run with no argument (#883, #924). `createParse(create(all))` builds the AST node constructors on the caller's math scope (#924). A second parse factory run on a shared typed instance no longer throws (#937). Caller-supplied dependencies always win.
