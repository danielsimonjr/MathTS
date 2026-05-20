# BigNumbers

`BigNumber` provides arbitrary-precision decimal arithmetic. It can represent numbers with far more than the 16 significant digits of a JavaScript `number`, and performs arithmetic (including transcendental functions) without the rounding drift inherent to IEEE 754 floating-point.

```ts
import { BigNumber } from '@danielsimonjr/mathts-core';

BigNumber.parse('0.1').add('0.2').toString()   // '0.3'  (exact)
BigNumber.parse('0.1').add(0.2).toString()     // '0.3'
```

## Construction

```ts
import { BigNumber } from '@danielsimonjr/mathts-core';

// From a string (recommended for large/precise values)
const a = BigNumber.parse('3.14159265358979323846264338327950288')
const b = BigNumber.parse('2.3e+500')
const c = BigNumber.parse('NaN')
const d = BigNumber.parse('Infinity')

// From a JavaScript number
const e = BigNumber.fromNumber(42)
const f = BigNumber.fromNumber(0.1)
```

## Precision

The default precision is **64 significant digits**. All arithmetic is performed at this precision, and results are rounded to it.

```ts
// 64-digit precision by default
BigNumber.parse('1').divide('3').toString()
// '0.3333333333333333333333333333333333333333333333333333333333333333'
```

Precision is a global setting on the `BigNumber` class:

```ts
BigNumber.config({ precision: 100 })  // 100 significant digits
```

## Arithmetic

```ts
const x = BigNumber.parse('1.5')
const y = BigNumber.parse('2.5')

x.add(y)          // BigNumber 4
x.subtract(y)     // BigNumber -1
x.multiply(y)     // BigNumber 3.75
x.divide(y)       // BigNumber 0.6
x.abs()           // BigNumber 1.5
x.pow(3)          // BigNumber 3.375
x.sqrt()          // BigNumber 1.2247448713916...
```

All methods accept `BigNumber | number | string` as the argument.

## Transcendental Functions

BigNumber implements Taylor-series math internally — no external decimal library:

```ts
const x = BigNumber.parse('1')

x.exp()    // e^1 = 2.71828182845904523536...
x.log10()  // log₁₀(1) = 0
x.log2()   // log₂(1) = 0
x.sin()    // sin(1) ≈ 0.84147...
x.cos()    // cos(1) ≈ 0.54030...
x.tan()    // tan(1) ≈ 1.55740...
x.sinh()   // hyperbolic sine
x.cosh()   // hyperbolic cosine
x.tanh()   // hyperbolic tangent
x.expm1()  // e^x − 1 (accurate near zero)
x.log1p()  // ln(1+x) (accurate near zero)
```

## Comparison

```ts
const a = BigNumber.parse('1.5')
const b = BigNumber.parse('2.5')

a.equals(b)           // false
a.lessThan(b)         // true
a.greaterThan(b)      // false
a.isZero()            // false
a.isNaN()             // false
a.isFinite()          // true
a.sign()              // 1 (positive)
```

## Rounding

```ts
BigNumber.parse('2.5').round()    // BigNumber 3  (halfUp, default)
BigNumber.parse('2.5').ceil()     // BigNumber 3
BigNumber.parse('2.5').floor()    // BigNumber 2
BigNumber.parse('2.567').round(2)  // BigNumber 2.57  (round to 2 decimal places)
```

Rounding modes: `'up'`, `'down'`, `'ceil'`, `'floor'`, `'halfUp'` (default), `'halfDown'`, `'halfEven'`, `'halfCeil'`, `'halfFloor'`.

## Conversion

```ts
const n = BigNumber.parse('3.14')

n.valueOf()       // 3.14  (JS number, may lose precision)
n.toString()      // '3.14'
n.toFixed(6)      // '3.140000'
n.toExponential() // '3.14e+0'
n.toBigInt()      // 3n    (truncates toward zero)
```

## Constants

Pre-computed to 50+ digits:

```ts
import {
  BIGNUMBER_PI,     // 3.14159265358979323846...
  BIGNUMBER_E,      // 2.71828182845904523536...
  BIGNUMBER_LN2,    // 0.69314718055994530941...
  BIGNUMBER_LN10,   // 2.30258509299404568401...
  BIGNUMBER_ZERO,
  BIGNUMBER_ONE,
  BIGNUMBER_NEG_ONE,
  BIGNUMBER_TEN,
} from '@danielsimonjr/mathts-core';
```

## Internal Representation

MathTS `BigNumber` stores numbers as `sign × coefficient × 10^exponent` where `coefficient` is a native `bigint`. Unlike mathjs (which delegates to decimal.js), this is a pure TypeScript implementation using Taylor series for transcendental functions.

## Type Guard

```ts
import { isBigNumber } from '@danielsimonjr/mathts-core';

isBigNumber(BigNumber.parse('1'))   // true
isBigNumber(1)                      // false
```

## Limitations

BigNumbers do not solve all precision problems. Numbers with an infinite number of non-repeating digits (like `1/3` in decimal) are still truncated at the configured precision. For exact rational arithmetic use [Fraction](fractions.md).

Calculations with BigNumber are significantly slower than with `number`. Use them where precision is required, and plain numbers everywhere else.

## Related

- [Numbers](numbers.md)
- [Fractions](fractions.md)
- [BigInts](bigints.md)
