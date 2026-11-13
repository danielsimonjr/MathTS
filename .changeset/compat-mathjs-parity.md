---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-workbook': patch
---

Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892, #737).

Breaking, visible output changes:

- `Fraction#toString` prints the repeating decimal (`1/3` is now `0.(3)`, `1/2` is `0.5`). `format()` still prints the ratio (`1/3`), and a whole value prints without a denominator (`format(fraction(4, 2))` is `2`, not `2/1`).
- `Matrix#toString` (matrix package, and the compat dense and sparse matrices) prints the nested-array form through `format()`: `[[1, 2], [3, 4]]` for 2-D, nested brackets for 3-D and more. Entries use `format()`: a Fraction entry prints `1/3` and a string entry prints quoted. The sparse matrix no longer prints the `Sparse Matrix [n x m]` listing from `toString`.
- `Complex#toString` prints `NaN` when a part is NaN and `Infinity` when a part is infinite, as mathjs does (`log(-Infinity)` prints `Infinity`).
- The compat instance type has no string index signature: `MathInstance` is the functions namespace plus the compat members. Code that read `math[name]` as `unknown` needs a cast.

Workbook cells keep the ratio form for a Fraction result (`1/3`).

Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.

Documented exception: `asin(NaN)`, `acos(NaN)` and `log(NaN)` return a real `NaN` (mathjs returns Complex `NaN`); the printed text is the same.
