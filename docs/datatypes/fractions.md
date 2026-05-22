# Fractions

`Fraction` provides exact rational arithmetic using native JavaScript `bigint` for the numerator and denominator. Unlike floating-point numbers, fractions can represent values like `1/3` exactly, with no rounding error.

```ts
import { Fraction } from '@danielsimonjr/mathts-core';

new Fraction(1n, 3n).toString(); // '1/3'
new Fraction(2n, 6n).toString(); // '1/3'  (auto-reduced)
```

## Construction

```ts
import { Fraction } from '@danielsimonjr/mathts-core';

// Direct: new Fraction(numerator, denominator)
const a = new Fraction(1n, 3n); // 1/3
const b = new Fraction(2n, 3n); // 2/3
const c = new Fraction(5n); // 5/1 = 5

// From a JavaScript number
const d = Fraction.fromNumber(0.5); // 1/2
const e = Fraction.fromNumber(0.1); // 1/10

// From a decimal string
const f = Fraction.fromDecimalString('0.25'); // 1/4
```

All fractions are **automatically reduced** to lowest terms and stored with a positive denominator.

## Properties

```ts
const f = new Fraction(3n, 4n);

f.numerator; // 3n  (bigint)
f.denominator; // 4n  (bigint)
f.type; // 'Fraction'
```

`Fraction` instances are **immutable** — all arithmetic methods return new instances.

## Arithmetic

```ts
const a = new Fraction(1n, 3n);
const b = new Fraction(1n, 6n);

a.add(b); // Fraction 1/2   (exact)
a.subtract(b); // Fraction 1/6
a.multiply(b); // Fraction 1/18
a.divide(b); // Fraction 2/1 = 2
a.negate(); // Fraction -1/3
a.abs(); // Fraction 1/3
a.inverse(); // Fraction 3/1 = 3
```

## Comparison

```ts
const a = new Fraction(1n, 2n);
const b = new Fraction(2n, 4n);

a.equals(b); // true  (both reduce to 1/2)
a.lessThan(b); // false
a.greaterThan(b); // false
a.compare(b); // 0
```

## Conversion

```ts
const f = new Fraction(1n, 3n);

f.toNumber(); // 0.3333333333333333  (JS number)
f.toString(); // '1/3'
f.toJSON(); // { mathjs: 'Fraction', n: '1', d: '3' }
```

## Why Fractions?

The classic floating-point problem:

```ts
0.1 + 0.2; // 0.30000000000000004  (float error)

const a = Fraction.fromNumber(0.1);
const b = Fraction.fromNumber(0.2);
a.add(b).toString(); // '3/10'  (exact)
a.add(b).toNumber(); // 0.3
```

Fractions excel at:

- Financial calculations requiring exact decimal results
- Ratios and proportions
- Situations where repeating decimals must be preserved exactly

## Implementation Detail

MathTS `Fraction` uses `bigint` internally — unlike mathjs which delegates to fraction.js. This means:

- Arbitrary-precision numerators and denominators (no overflow at 2^53)
- Uses the continued fraction algorithm for float-to-fraction conversion
- GCD is computed via the Euclidean algorithm

## Predefined Constants

```ts
import {
  FRACTION_ZERO, // 0/1
  FRACTION_ONE, // 1/1
  FRACTION_NEG_ONE, // -1/1
  FRACTION_HALF, // 1/2
  FRACTION_THIRD, // 1/3
  FRACTION_QUARTER, // 1/4
} from '@danielsimonjr/mathts-core';
```

## Type Guard

```ts
import { isFraction } from '@danielsimonjr/mathts-core';

isFraction(new Fraction(1n, 2n)); // true
isFraction(0.5); // false
```

## Related

- [Numbers](numbers.md)
- [BigNumber](bignumbers.md)
- [BigInts](bigints.md)
