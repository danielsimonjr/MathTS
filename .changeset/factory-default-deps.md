---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

Public factories resolve their own default dependencies. `createParse()` and `createEvaluate()` run with no argument (#883, #924). `createParse(create(all))` builds the AST node constructors on the caller's math scope (#924). The string-to-Node converter on the shared typed instance belongs to `functions`: `createParse` registers none, so `parse` works in every load order (#937). `simplify` tests nodes by their structure, so a node from another parse simplifies like an own node (#937). Caller-supplied dependencies always win.
