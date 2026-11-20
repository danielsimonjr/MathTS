---
'@danielsimonjr/mathts-functions': patch
---

`limit` takes L'Hopital's rule (symbolic derivatives, at most 8 steps) for a quotient that is 0/0 or c/0 at the point. `limit('(1-cos(x))/x^2', 'x', 0)` is now 0.5, and `limit('1/x', 'x', 0, 'right')` is now `Infinity` (it was 1e10). A small constant is not read as zero (`limit('1e-15/x', 'x', 0, 'right')` is `Infinity`), and the sampling path returns `-Infinity` for `limit('log(x)', 'x', 0, 'right')` (it was -23.03) and `Infinity` for `limit('exp(1/x)', 'x', 0, 'right')` (it was NaN). (Refs #1022)
