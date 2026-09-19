---
'@danielsimonjr/mathts-core': minor
---

Range now keeps its caches in four public `_cache*` fields instead of ES-private `#cache*` fields. The TypeScript 7 declaration-emit fix made this change. Results are unchanged, but the fields are now visible, enumerable properties of a Range.
