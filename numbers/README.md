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

## What it exports

- `Complex` + `isComplex` + `I`, `COMPLEX_ZERO/ONE/NEG_ONE`.
- `Fraction` + `isFraction` + `FRACTION_ZERO/ONE/NEG_ONE/HALF/THIRD/QUARTER`.
- `BigNumber` + `bignumber` + `isBigNumber` + `BIGNUMBER_ZERO/ONE/NEG_ONE/TEN/PI/E/LN2/LN10`.
- Construct with `BigNumber.from(1)`, `bignumber('0.1')`, or `new BigNumber(1)` (same factories).
- Types: `IComplex`, `IFraction`, `IBigNumber`, `BigNumberConfig`, `RoundingMode`.

## License

MIT (c) Daniel Simon Jr.
