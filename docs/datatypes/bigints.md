# BigInts

MathTS supports JavaScript's native `bigint` type for calculations with large integers. Unlike `number`, which can only represent integers exactly up to 2^53 − 1, `bigint` can represent arbitrarily large integers without overflow.

## Usage

Create a `bigint` using the `n` suffix or the `BigInt()` constructor:

```ts
42n;
BigInt('9007199254740993'); // one above Number.MAX_SAFE_INTEGER
```

`bigint` values can be used directly in MathTS arithmetic functions:

```ts
import { add, multiply, gcd } from '@danielsimonjr/mathts-functions';

add(300000000000000000n, 1n); // 300000000000000001n
multiply(1000000000n, 1000000000n); // 1000000000000000000n
```

## When to Use BigInt

Use `bigint` when you need:

- Exact integer arithmetic beyond `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991)
- Cryptographic or combinatorial computations with large numbers
- Precise integer operations without floating-point error

```ts
// JavaScript number loses precision here
9007199254740991 + 1; // 9007199254740992 (correct)
9007199254740991 + 2; // 9007199254740992 (WRONG — same as +1)

// bigint is exact
9007199254740991n + 2n; // 9007199254740993n (correct)
```

## Conversion

Convert between `bigint`, `number`, and `BigNumber`:

```ts
import { BigNumber } from '@danielsimonjr/mathts-core';

// number → bigint
BigInt(42); // 42n

// bigint → number (may lose precision for large values)
Number(42n); // 42

// bigint → BigNumber
BigNumber.fromNumber(Number(42n)); // BigNumber 42
```

## Limitations

`bigint` only holds integers — it cannot represent fractions or decimal values. Transcendental and root functions promote integer `bigint` inputs to `BigNumber` (not JavaScript `number`):

```ts
import { sqrt, sin } from '@danielsimonjr/mathts-functions';

sqrt(4n).toString(); // '2' (BigNumber)
sin(2n).toString(); // '0.909297426825681695…' (BigNumber)
```

Basic arithmetic (`add`, `subtract`, `multiply`, `mod`, `gcd`, `pow` with positive integer exponents) supports `bigint` input and returns `bigint` output.

## Related

- [Numbers](numbers.md)
- [BigNumber](bignumbers.md)
- [Fractions](fractions.md)
