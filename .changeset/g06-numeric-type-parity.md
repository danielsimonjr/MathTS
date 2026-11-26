---
'@danielsimonjr/mathts-compat': patch
---

Compat `pinv`, `bernoulli`, `unaryPlus`, and `compare` match mathjs 15.3.0 result types (#1554): `pinv` keeps BigNumber / Fraction / Complex scalars and follows the mathjs rank-factorization for numeric matrices (a singular 1×2 matrix throws `Cannot calculate inverse, determinant is zero`), `bernoulli` returns the exact Fraction for Fraction/bigint indexes and a BigNumber for BigNumber indexes through the full mathjs recurrence, `compare` rejects Complex ordering and mixed BigNumber / Fraction pairs with the mathjs errors, and `unaryPlus` rejects a non-numeric string like mathjs. Compat-only adapters; native `functions` / `matrix` packages are unchanged.
