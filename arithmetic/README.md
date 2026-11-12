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

## Example

```ts
import { add, multiply, sqrt } from '@danielsimonjr/mathts-arithmetic';
import { Complex } from '@danielsimonjr/mathts-numbers';

add(1, 2); // 3
multiply(new Complex(1, 2), new Complex(3, 4)); // -5 + 10i
sqrt(9); // 3
```

For hyperbolic functions use `@danielsimonjr/mathts-trigonometry` (`sinh`, `cosh`, …). For
`mean` / `variance` / `std` use `@danielsimonjr/mathts-statistics`. This package still
re-exports those names on the `typedArithmetic` bundle for one-import scripts, but the domain
packages above are the supported entry points.

## What it exports

Core arithmetic: `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`,
`sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`,
`log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `mod`, `gcd`, `lcm`, `xgcd`, `norm`,
`equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`, `min`, `max` (plus the
`typedArithmetic` bundle, which also carries adjacent reducers and hyperbolic names from the
functions typed graph).

## License

MIT (c) Daniel Simon Jr.
