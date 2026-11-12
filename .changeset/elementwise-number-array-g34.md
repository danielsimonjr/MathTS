---
'@danielsimonjr/mathts-functions': patch
---

Accept flat `number[]` vectors on synchronous unary element-wise trig and arithmetic `Float64Array` overloads (`sin`, `cos`, `abs`, `exp`, …). Nested arrays and matrices still throw the mathjs-style `map(M, fn)` hint.
