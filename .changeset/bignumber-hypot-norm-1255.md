---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`hypot`, `norm` (a vector 2-norm and `'fro'`) and `distance` of BigNumber values scale the values by a power of ten before they square them (Fixes #1255). The result is correct whenever it is in range, and the configured `minExponent` and `maxExponent` apply to the result only.

Core adds `BigNumber.hypotN(values)`, the n-ary form of `BigNumber.hypot`. `BigNumber.hypot` calls it. The scale changes only the exponent, so an input with more digits than `precision` is not rounded before it is squared. The squares and the root use 10 guard digits, and the root is rounded once.

Result before the fix, for values of order 5e15 above the exponent limit of the squares:

- `hypot(3e5000000000000000, 4e5000000000000000)`, `norm([..])` and `norm([[..]], 'fro')` returned `Infinity`. The result is now `5e+5000000000000000`.
- `hypot(3e-5000000000000000, 4e-5000000000000000)` and the same `norm` returned `0`. The result is now `5e-5000000000000000`.
- With `config({ maxExponent: 100 })`, `hypot(3e60, 4e60)` returned `Infinity`. The result is now `5e+60`.
- At precision 20, `hypot(368908340768.57994560571, 3.0302e-19)` returned `368908340768.5799456`. The result is now the correctly rounded `368908340768.57994561`.
- `norm(v, p)` for p other than 2 returned `Infinity` or `0` when the sum of p-th powers was out of range, for numbers and BigNumbers (for example `norm([1e200, 1e200], 3)`). The norm is now `m * norm(v / m, p)` with `m = max(abs(v))` in that case only.
- The point-to-line `distance` returned `NaN` when a product or a square overflowed (for example the point `(3e160, 4e160)` and the line through `(0, 0)` and `(1e160, 0)` at `maxExponent: 300`, or numbers of order 1e160). The result is now `4e160`.
- `hypot(Infinity, NaN)` stays `NaN`, as in mathjs 15.2.0.
