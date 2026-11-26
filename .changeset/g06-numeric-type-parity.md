---
'@danielsimonjr/mathts-compat': patch
---

Compat `pinv`, `bernoulli`, `unaryPlus`, and `compare` match mathjs 15.3.0 result types (#1554): `pinv` keeps BigNumber / Fraction / Complex scalars (`pinv(bignumber('2.5'))` is BigNumber `0.4`, `pinv(fraction(1,3))` is Fraction `3/1`, `pinv(complex(1,2))` is Complex `0.2 - 0.4i`), `bernoulli` returns the exact Fraction for Fraction/bigint indexes and a BigNumber for BigNumber indexes, and `unaryPlus` / `compare` accept foreign mathjs scalars, reject Complex ordering with the mathjs error, and honor `config.number` through `evaluate`. Compat-only adapters; native `functions` / `matrix` packages are unchanged.
