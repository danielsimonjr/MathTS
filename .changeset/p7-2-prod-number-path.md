---
'@danielsimonjr/mathts-functions': patch
---

Speed up `prod` on plain flat number arrays by folding with the cached number `multiplyScalar` implementation after a `typeof` scan; arrays holding any other type, nested arrays, matrices, subclasses and empty arrays keep the generic path.
