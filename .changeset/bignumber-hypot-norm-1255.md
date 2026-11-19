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
- At precision 20, `hypot(368908340768.57994560571, 3.0302e-19)` returned `368908340768.5799456`. The result is now the correctly rounded `368908340768.57994561`. In 3000 seeded random vectors at precision 20 (2 to 6 values, 1 to 30 digits, orders -60 to 60), the result equals the exact root rounded once in all 3000. Before the fix, typed `hypot` and `norm` differed from the exact root in 240 of the 3000, and the factory `hypot` in 861. So the last digit of an ordinary `hypot`, `norm` or core `BigNumber.hypot` result can change.
- A number in a list with a BigNumber is converted with `BigNumber.fromNumber` before the squares. The factory `norm` squared the number as a number first, so `norm([bignumber('0.1'), 0.2])` changes from the 17th digit (`0.22360679774997899...` is now `0.22360679774997896964...`, the root of 0.05).
- The factory `hypot` of a BigNumber and a number that is not finite threw `Cannot create fraction from non-finite number`. The result is now `NaN` or `Infinity`. The factory `hypot` of two BigNumbers whose root is above `maxExponent` returned `0`. The result is now `Infinity`.
- `norm(v, p)` for p other than 2 returned `Infinity` or `0` when the sum of p-th powers was out of range, for numbers and BigNumbers (for example `norm([1e200, 1e200], 3)`). The norm is now `m * norm(v / m, p)` in that case, with `m = max(abs(v))` for a positive p and `m = min(abs(v))` for a negative p. For numbers, the case also includes a sum below 2^-969, where a subnormal p-th power loses digits: `norm([1e-107, 1e-107], 3)` was `1.2590858e-107` and is now `1.2599210e-107`. A sum in range keeps its digits.
- The point-to-line `distance` returned `NaN` when a product or a square overflowed (for example the point `(3e160, 4e160)` and the line through `(0, 0)` and `(1e160, 0)` at `maxExponent: 300`, or numbers of order 1e160). The result is now `4e160`. The subnormal point-to-line `distance` result also changed: `distance([3e-160, 4e-160], [0, 1e-160, 0])` is now `4e-160` and was `3.99998e-160`.
- `hypot` of an infinite BigNumber and a NaN BigNumber stays `NaN`, as in mathjs 15.2.0. The typed `hypot(Infinity, NaN)` of numbers stays `Infinity` (#1259).
