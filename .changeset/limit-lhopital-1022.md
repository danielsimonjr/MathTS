---
'@danielsimonjr/mathts-functions': patch
---

`limit` takes L'Hopital's rule (symbolic derivatives, at most 8 steps) for a quotient that is 0/0 or c/0 at the point. `limit('(1-cos(x))/x^2', 'x', 0)` is now 0.5, and `limit('1/x', 'x', 0, 'right')` is now `Infinity` (it was 1e10). (Refs #1022)
