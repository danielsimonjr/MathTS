---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-compat': minor
---

**GC12 — `config()` now drives behavior + compat uses the real functions types.**

- functions gains a `config()` accessor (`config-api.ts`): read the global runtime config, or pass a partial to merge it. Functions read this shared object live at call time (e.g. `identity`/`range`'s `config.matrix === 'Array'` return-type switch, `zeta`'s `config.relTol`), so `config({ matrix: 'Array' })` genuinely changes results. It is process-global (the functions surface is a singleton), not per-instance like mathjs `create()`.
- compat's `config()` was **inert** (mutated a private object nothing read); it now forwards to `functions.config`, so `math.config({ matrix: 'Array' })` drives the functions surface, and `create(all, { … })` seeds it.
- Deleted `compat/src/functions.d.ts` — an outdated ambient `declare module` stub (21 functions) whose own header said "until the functions package has proper .d.ts files." It was **shadowing** the real, complete functions types, so `import * as F` saw an empty namespace (even `F.zeta`/`F.cbrt` were invisible). compat now type-checks against the real 829-export surface. This closes GC12's "widen functions.d.ts" at root cause.

Config is now process-global: a `delegation` test that asserted per-instance isolation was updated to reflect this (isolation was only ever "true" because config did nothing).
