---
'@danielsimonjr/mathts-core': patch
---

Delete `core/src/types/index.ts` — a redundant, unreachable type barrel. `core/src/index.ts` already exports its constituents (`Complex`/`Fraction`/`BigNumber`/interfaces) directly from `./types/complex.js` etc.; nothing imported the barrel (`core/src/types.ts`'s `../types/index.js` resolves elsewhere, and there is no `./types` subpath export). Published surface unchanged — the barrel was tree-shaken out of the bundle. Surfaced by the dependency-graph tool, which also gained config-referenced-root seeding so bundler-alias targets (e.g. the `workerpool` browser shim aliased in by `vitest.config.browser.ts`) are no longer false-flagged as dormant.
