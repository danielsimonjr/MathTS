# Numbers

MathTS supports three numeric types suited to different precision needs:

- **Number** — JavaScript's built-in 64-bit floating-point (this page)
- **[BigNumber](bignumbers.md)** — arbitrary-precision decimal arithmetic
- **[Fraction](fractions.md)** — exact rational arithmetic

Plain JavaScript numbers are the default and fastest option for most work.

## Precision and Round-off Errors

JavaScript's `Number` is an IEEE 754 double-precision float with about 16 significant digits. This means round-off errors can occur:

```ts
0.1 + 0.2; // 0.30000000000000004
```

For display purposes, format the result to a precision slightly below 16 digits. For computations where exact results matter, use [Fraction](fractions.md) or [BigNumber](bignumbers.md) instead.

## Range

`Number` can represent values between `5e-324` and `1.7976931348623157e+308`. Values outside this range become `0` or `±Infinity`.

The largest safe integer is `Number.MAX_SAFE_INTEGER` = `9007199254740991` (2^53 − 1). For integers beyond this range, use [BigInt](bigints.md).

```ts
Number.MAX_SAFE_INTEGER; // 9007199254740991
Number.MAX_SAFE_INTEGER + 1; // 9007199254740992 (exact, last safe value)
Number.MAX_SAFE_INTEGER + 2; // 9007199254740992 (WRONG — same as above)
```

## Using Numbers with MathTS Functions

Functions in `@danielsimonjr/mathts-functions` accept plain numbers directly:

```ts
import { add, multiply, sqrt, sin } from '@danielsimonjr/mathts-functions';

add(1, 2); // 3
multiply(3, 4); // 12
sqrt(9); // 3
sin(Math.PI / 2); // 1
```

Note: scalar calls are synchronous. Only array inputs (`Float64Array`) dispatch to worker threads and return `Promise<T>`.

## Choosing the Right Type

| Need                         | Recommended Type           |
| ---------------------------- | -------------------------- |
| Speed, general math          | `number` (default)         |
| Avoid floating-point drift   | [Fraction](fractions.md)   |
| Very high precision decimals | [BigNumber](bignumbers.md) |
| Large integers               | [BigInt](bigints.md)       |

## Constants

Standard constants are available on `Math` or via the functions package:

```ts
Math.PI; // 3.141592653589793
Math.E; // 2.718281828459045
Math.SQRT2; // 1.4142135623730951
```

For high-precision constants, see [BigNumber](bignumbers.md#constants).
