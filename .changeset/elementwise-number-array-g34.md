---
'@danielsimonjr/mathts-functions': patch
---

Unary element-wise functions (`sin`, `cos`, `exp`, `log`, `sqrt`, `abs`, and the other synchronous trig and arithmetic unaries) accept `number[]`, nested arrays, and Matrix through one shared `Array | Matrix` signature. Flat numeric vectors still use the Float64Array kernel. Mixed elements dispatch per leaf, and `sqrt`/`log` of a negative promote to Complex the same way the scalar does. A Matrix result stays that matrix class while every value is a real number.
