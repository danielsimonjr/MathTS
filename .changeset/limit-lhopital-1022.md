---
'@danielsimonjr/mathts-functions': patch
---

`limit` takes L'Hopital's rule (symbolic derivatives, at most 8 steps) for a quotient that is 0/0 or c/0 at the point. `limit('(1-cos(x))/x^2', 'x', 0)` is now 0.5, and `limit('1/x', 'x', 0, 'right')` is now `Infinity` (it was 1e10). A small constant is not read as zero (`limit('1e-15/x', 'x', 0, 'right')` is `Infinity`), and the sampling path returns `-Infinity` for `limit('log(x)', 'x', 0, 'right')` (it was -23.03) and `Infinity` for `limit('exp(1/x)', 'x', 0, 'right')` (it was NaN). The sampling path returns 0 for samples that fall in size by 2 times or more at each step (`limit('x*log(x)', 'x', 0, 'right')` is 0, it was -2.3e-9), and `NaN` for samples that change sign and do not fall in size (`limit('sin(1/x)', 'x', 0, 'right')` has no limit). (Refs #1022)
