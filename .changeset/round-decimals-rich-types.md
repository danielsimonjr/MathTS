---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`round` with a decimal count works for a Fraction and a Complex, and core `round(x, n)` uses `n`. `round(fraction, n)` returns a Fraction: it returned a BigNumber, and `factory_round(fraction(201, 200), 2)` returned 1. `round(complex, n)` rounds each part: it threw `Too many arguments`. Core `round(x, n)` ignored `n`. `Fraction.round` takes a decimal count, and a count that is not an integer throws `TypeError`. `round(5n, 2)` is now the Fraction 5, as `round(5n)` already was, and was a BigNumber 5: the cause is the order in which the typed dispatcher converts a bigint, and that order is a separate decision. `round` of an Array or a matrix with a decimal count works: `round([1.005, 2.675], 2)` is `[1.01, 2.68]` and `round(2.675, [1, 2])` is `[2.7, 2.68]`. Both threw `TypeError`. Each element takes the scalar row, so `round([-0], 2)` is `[0]`, as in mathjs. (Refs #996)
