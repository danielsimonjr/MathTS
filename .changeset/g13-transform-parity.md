---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-expression': patch
---

Compat `create(all)` now populates `instance.expression.transform` with all 26 mathjs 15.3.0 transform functions (including `apply`) and mirrors `instance.expression.mathWithTransform` as the full instance function/constant surface with those 26 replaced by their transform versions (#1572). The `mathWithTransform` entries are live getters over the instance, so config-dependent constants (`pi`, the physical constants) stay live; the evaluator keeps its own scope so the built-in typed signatures the expression language relies on are unchanged. `@danielsimonjr/mathts-expression` adds the `createApplyTransform` factory (`expression/src/transform/apply.transform.ts`) — the one-based `apply` transform was never built, which is the root cause of the empty `transform` object — and compat instances expose the typed `expression` property.
