# @danielsimonjr/mathts-functions API Reference

Mathematical functions with automatic type dispatch.

## Installation

```bash
npm install @danielsimonjr/mathts-functions
```

## Overview

All functions use typed-function for automatic type dispatch:

```typescript
import { add } from '@danielsimonjr/mathts-functions';

// Works with numbers
add(1, 2);                    // 3

// Works with Complex
add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)

// Works with Fraction
add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)

// Works with BigNumber
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber(0.3)
```

---

## Arithmetic Functions

### Basic Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `add` | `(a, b) => result` | Addition |
| `subtract` | `(a, b) => result` | Subtraction |
| `multiply` | `(a, b) => result` | Multiplication |
| `divide` | `(a, b) => result` | Division |
| `mod` | `(a, b) => result` | Modulo |

### Power & Roots

| Function | Signature | Description |
|----------|-----------|-------------|
| `pow` | `(base, exp) => result` | Power |
| `sqrt` | `(x) => result` | Square root |
| `cbrt` | `(x) => result` | Cube root |
| `nthRoot` | `(x, n) => result` | Nth root |

### Exponential & Logarithm

| Function | Signature | Description |
|----------|-----------|-------------|
| `exp` | `(x) => result` | e^x |
| `log` | `(x) => result` | Natural log |
| `log10` | `(x) => result` | Base-10 log |
| `log2` | `(x) => result` | Base-2 log |

### Absolute & Sign

| Function | Signature | Description |
|----------|-----------|-------------|
| `abs` | `(x) => result` | Absolute value |
| `sign` | `(x) => result` | Sign (-1, 0, 1) |

### Example

```typescript
import { add, subtract, multiply, divide, pow, sqrt, abs } from '@danielsimonjr/mathts-functions';

add(1, 2);           // 3
subtract(5, 3);      // 2
multiply(3, 4);      // 12
divide(10, 2);       // 5
pow(2, 8);           // 256
sqrt(16);            // 4
abs(-5);             // 5
```

---

## Trigonometric Functions

### Basic Trig

| Function | Signature | Description |
|----------|-----------|-------------|
| `sin` | `(x) => result` | Sine |
| `cos` | `(x) => result` | Cosine |
| `tan` | `(x) => result` | Tangent |
| `cot` | `(x) => result` | Cotangent |
| `sec` | `(x) => result` | Secant |
| `csc` | `(x) => result` | Cosecant |

### Inverse Trig

| Function | Signature | Description |
|----------|-----------|-------------|
| `asin` | `(x) => result` | Arc sine |
| `acos` | `(x) => result` | Arc cosine |
| `atan` | `(x) => result` | Arc tangent |
| `atan2` | `(y, x) => result` | Two-argument arc tangent |

### Hyperbolic

| Function | Signature | Description |
|----------|-----------|-------------|
| `sinh` | `(x) => result` | Hyperbolic sine |
| `cosh` | `(x) => result` | Hyperbolic cosine |
| `tanh` | `(x) => result` | Hyperbolic tangent |
| `asinh` | `(x) => result` | Inverse hyperbolic sine |
| `acosh` | `(x) => result` | Inverse hyperbolic cosine |
| `atanh` | `(x) => result` | Inverse hyperbolic tangent |

### Example

```typescript
import { sin, cos, tan, atan2 } from '@danielsimonjr/mathts-functions';

sin(0);              // 0
cos(0);              // 1
tan(Math.PI / 4);    // ~1
atan2(1, 1);         // Math.PI / 4

// Works with Complex
sin(new Complex(0, 1)); // i * sinh(1)
```

---

## Statistical Functions

### Basic Statistics

| Function | Signature | Description |
|----------|-----------|-------------|
| `sum` | `(arr) => number` | Sum of array |
| `mean` | `(arr) => number` | Arithmetic mean |
| `median` | `(arr) => number` | Median value |
| `mode` | `(arr) => number[]` | Mode(s) |
| `min` | `(arr) => number` | Minimum |
| `max` | `(arr) => number` | Maximum |

### Variance & Deviation

| Function | Signature | Description |
|----------|-----------|-------------|
| `variance` | `(arr, normalization?) => number` | Variance |
| `std` | `(arr, normalization?) => number` | Standard deviation |
| `mad` | `(arr) => number` | Mean absolute deviation |

### Other

| Function | Signature | Description |
|----------|-----------|-------------|
| `prod` | `(arr) => number` | Product of array |
| `quantile` | `(arr, q) => number` | Quantile (0-1) |

### Example

```typescript
import { sum, mean, std, min, max } from '@danielsimonjr/mathts-functions';

const data = [1, 2, 3, 4, 5];

sum(data);           // 15
mean(data);          // 3
std(data);           // ~1.58
min(data);           // 1
max(data);           // 5
```

---

## Number Theory

| Function | Signature | Description |
|----------|-----------|-------------|
| `gcd` | `(a, b) => number` | Greatest common divisor |
| `lcm` | `(a, b) => number` | Least common multiple |
| `factorial` | `(n) => number` | n! |
| `isPrime` | `(n) => boolean` | Primality test |

### Example

```typescript
import { gcd, lcm, factorial, isPrime } from '@danielsimonjr/mathts-functions';

gcd(12, 18);         // 6
lcm(4, 6);           // 12
factorial(5);        // 120
isPrime(17);         // true
```

---

## Rounding Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `round` | `(x, decimals?) => number` | Round to nearest |
| `floor` | `(x) => number` | Round down |
| `ceil` | `(x) => number` | Round up |
| `trunc` | `(x) => number` | Truncate towards zero |
| `fix` | `(x) => number` | Same as trunc |

### Example

```typescript
import { round, floor, ceil } from '@danielsimonjr/mathts-functions';

round(2.5);          // 3
round(2.567, 2);     // 2.57
floor(2.9);          // 2
ceil(2.1);           // 3
```

---

## Signal Processing

### FFT

| Function | Signature | Description |
|----------|-----------|-------------|
| `fft` | `(x) => Complex[]` | Fast Fourier Transform |
| `ifft` | `(X) => Complex[]` | Inverse FFT |

### Convolution

| Function | Signature | Description |
|----------|-----------|-------------|
| `conv` | `(a, b) => number[]` | Convolution |
| `xcorr` | `(a, b) => number[]` | Cross-correlation |

### Example

```typescript
import { fft, ifft, conv } from '@danielsimonjr/mathts-functions';

const signal = [1, 2, 3, 4];
const spectrum = fft(signal);
const recovered = ifft(spectrum);

const kernel = [1, 0, -1];
const filtered = conv(signal, kernel);
```
