# @danielsimonjr/mathts-numbers

Standalone numeric types for [MathTS](https://github.com/danielsimonjr/mathts):
`Complex`, `Fraction`, and `BigNumber`.

A focused entry point over the numeric types in
[`@danielsimonjr/mathts-core`](https://www.npmjs.com/package/@danielsimonjr/mathts-core).
The implementation is re-exported, not duplicated.

## Install

```sh
npm install @danielsimonjr/mathts-numbers
```

## Example

```ts
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-numbers';

const z = new Complex(3, 4);
console.log(z.abs()); // 5
console.log(new Fraction(1, 3).add(new Fraction(1, 6)).toString()); // 1/2
console.log(BigNumber.from('0.1').add(BigNumber.from('0.2')).toString()); // 0.3
```

## What it exports

- `Complex` + `isComplex` + `I`, `COMPLEX_ZERO/ONE/NEG_ONE`.
- `Fraction` + `isFraction` + `FRACTION_ZERO/ONE/NEG_ONE/HALF/THIRD/QUARTER`.
- `BigNumber` + `bignumber` + `isBigNumber` + `BIGNUMBER_ZERO/ONE/NEG_ONE/TEN/PI/E/LN2/LN10`.
- Construct with `BigNumber.from(1)`, `bignumber('0.1')`, or `new BigNumber(1)` (one argument). `new BigNumber(existing)` copies; `BigNumber.from(existing)` returns the same instance. A second argument throws.
- Types: `IComplex`, `IFraction`, `IBigNumber`, `BigNumberConfig`, `RoundingMode`.

## License

MIT (c) Daniel Simon Jr.
