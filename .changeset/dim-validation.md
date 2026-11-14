---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
---

Every function checks a dimension argument the same way (#1047). A non-integer dim throws a TypeError. An out-of-range dim throws an IndexError with a true relation, as in mathjs. This change adds the core helper `validateDimension`.
