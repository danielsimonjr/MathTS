# @danielsimonjr/mathts-arithmetic

Standalone arithmetic functions for [MathTS](https://github.com/danielsimonjr/mathts).

A focused entry point over the `arithmetic` typed-function domain in
[`@danielsimonjr/mathts-functions`](https://www.npmjs.com/package/@danielsimonjr/mathts-functions).
The implementation is re-exported, not duplicated. These are MathTS typed
functions (polymorphic dispatch across number / Complex / Fraction / BigNumber /
Matrix where supported).

## Install

```sh
npm install @danielsimonjr/mathts-arithmetic
```

## What it exports

`add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`, `sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `mod`, `gcd`, `lcm`, `xgcd`, `norm`, `sinh`, `cosh`, `tanh`, `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot` (plus the `typedArithmetic` bundle).

## License

MIT (c) Daniel Simon Jr.
