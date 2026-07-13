---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-workerpool': patch
---

**Fix: published type declarations did not compile for consumers.**

A consumer building with `skipLibCheck: false` could not compile against these packages:

- `TS7016` — the `workerpool` fork declares `types: types/index.d.ts`, but that is a build
  output never committed and never generated for a `github:` dependency, so the module
  resolved fully **untyped**. `@danielsimonjr/mathts-workerpool` now ships a canonical ambient
  declaration (`workerpool.d.ts`) from `dist/` and references it from its own `index.d.ts`, so
  types resolve the same way for us and for consumers. The internal `paths` shims that had
  papered over this (compile-time only, never shipped) were removed, ending the two-tier
  reality where our builds passed and consumers' broke.
- `TS2665` — `matrix`'s emitted `.d.ts` contained an illegal `declare module 'workerpool'`
  augmentation, inlined by the dts bundler from **516 stale generated `.d.ts` files that had
  accumulated inside `src/`** (untracked `tsc` emissions shadowing their sibling `.ts`). These
  were being picked up as build input and corrupting the published surface. Removed.
