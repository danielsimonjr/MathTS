---
'@danielsimonjr/mathts-functions': patch
---

Sprint 2R: consolidate Nelder–Mead — `minimize` calls `nelderMead` with `stepRule` / `tolRule` `'absolute'`; `nelderMead` adds `NelderMeadOptions` (defaults unchanged, relative step/tolerance). No changed test expectations.
