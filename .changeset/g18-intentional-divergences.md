---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

Compat matches mathjs 15.3.0 on `zeta`, `symbolicEqual`, and `range` (#1585) via adapters in `compat/src/mathjs-parity-1585.ts`; native `@danielsimonjr/mathts-functions` keeps the more accurate implementations. Documented under `Native MathTS differences` in `docs/api/compat.md` and pinned in `compat/tests/parity/g18-parity.test.ts`.
