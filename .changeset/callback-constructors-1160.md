---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`fraction`, `number` and `transpose` are typed-functions, as in mathjs. As a callback of `map`, `forEach`, `filter`, the `map` and `forEach` methods of a Matrix and of a SparseMatrix, `mapSlices`, `chain` and `evaluate`, each one now reads the value alone. Before, a callback adapter passed the index as the second argument: `map([1, 4], fraction)` threw `Fraction denominator cannot be zero`, and `map(['1', '4'], number)` threw about a unit. The compat `fraction` is the same function, with the no-argument and `undefined` calls that give 0. A call with a type that mathjs rejects now throws a TypeError: `number(undefined)`, `number({})`, `number(complex)`, `fraction(complex)`, `fraction(1, 2, 3)`, `fraction(1, null)` and a `Date` or a typed array as the argument. `transpose()` throws a TypeError too. (Refs #1160)
