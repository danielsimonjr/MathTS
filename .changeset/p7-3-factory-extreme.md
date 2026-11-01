---
'@danielsimonjr/mathts-functions': patch
---

Speed up `factory_max` and `factory_min` on plain flat number arrays: the leading numbers are compared with the cached number implementations of `isNaN` and `larger` (`smaller`), and the running result is handed to the generic walk at the first element that is not a number. Nested arrays, matrices, subclasses and empty arrays keep the generic path, and so does a dependency that has no number implementation.
