---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

Compat matches mathjs 15.3.0 on `zeta`, `symbolicEqual`, and `range` (#1585) via adapters in `compat/src/mathjs-parity-1585.ts`; native `@danielsimonjr/mathts-functions` keeps the more accurate implementations. Native `zeta`/`gamma`/`lgamma`/`factorial` now have explicit `bigint` signatures so typed-function does not promote a safe integer to BigNumber. Documented under `Native MathTS differences` in `docs/api/compat.md`.
