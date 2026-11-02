---
'@danielsimonjr/mathts-functions': patch
---

Speed up `prod` on plain flat number arrays: the leading numbers are folded with the cached number `multiplyScalar` implementation, and the partial product is handed to the generic fold at the first element that is not a number. Nested arrays, strings, matrices, subclasses and empty arrays keep the generic path, and so does a `multiplyScalar` that has no number implementation.
